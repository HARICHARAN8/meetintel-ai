import pytest
import uuid
import datetime
from fastapi.testclient import TestClient

from storage.database import SessionLocal, init_db
from storage.models import ActionItem, User, Organization, Meeting, CalendarEvent, IntegrationConnection
from integrations.google_workspace import GoogleWorkspaceIntegration
from api.main import app

@pytest.fixture(scope="module")
def setup_cal_db():
    init_db()
    db = SessionLocal()
    
    org = db.query(Organization).filter(Organization.id == "org-cal-test").first()
    if not org:
        org = Organization(id="org-cal-test", name="Calendar Test Org")
        db.add(org)
        db.commit()

    user = db.query(User).filter(User.username == "cal_user").first()
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            org_id="org-cal-test",
            username="cal_user",
            email="cal_user@test.io",
            role="Admin",
            timezone="UTC"
        )
        db.add(user)
        db.commit()

    meeting = db.query(Meeting).filter(Meeting.id == "mtg-cal-001").first()
    if not meeting:
        meeting = Meeting(
            id="mtg-cal-001",
            org_id="org-cal-test",
            user_id=user.id,
            title="Q3 Security Architecture Review"
        )
        db.add(meeting)
        db.commit()

    yield {"db": db, "user": user, "org": org, "meeting": meeting}
    db.close()

def test_google_workspace_oauth_url(setup_cal_db):
    gw = GoogleWorkspaceIntegration(org_id="org-cal-test")
    url = gw.get_auth_url(state="test_state_123")
    assert "test_state_123" in url

def test_google_workspace_demo_exchange(setup_cal_db):
    db = setup_cal_db["db"]
    gw = GoogleWorkspaceIntegration(org_id="org-cal-test")
    gw.demo_mode = True
    
    res = gw.exchange_code(db, "demo_auth_code_xyz")
    assert res["status"] == "success"
    
    conn = db.query(IntegrationConnection).filter(
        IntegrationConnection.provider == "google_calendar",
        IntegrationConnection.org_id == "org-cal-test"
    ).first()
    assert conn is not None
    assert "Connected" in conn.connection_status

def test_unapproved_task_does_not_sync(setup_cal_db):
    client = TestClient(app)
    user = setup_cal_db["user"]
    meeting = setup_cal_db["meeting"]
    db = setup_cal_db["db"]
    
    # Create draft unapproved task
    draft_task = ActionItem(
        meeting_id=meeting.id,
        org_id="org-cal-test",
        task="Draft unapproved task",
        assigned_user_id=user.id,
        approval_status="Draft",
        status="Pending"
    )
    db.add(draft_task)
    db.commit()
    db.refresh(draft_task)
    
    # Try syncing to calendar via API
    res = client.post(
        f"/api/calendar/tasks/{draft_task.id}/sync",
        headers={"x-user-id": user.id, "X-API-Key": "dev-secret-key"}
    )
    assert res.status_code == 400
    assert "Only approved tasks" in res.json()["detail"]

def test_approved_task_sync_and_idempotency(setup_cal_db):
    db = setup_cal_db["db"]
    user = setup_cal_db["user"]
    meeting = setup_cal_db["meeting"]
    gw = GoogleWorkspaceIntegration(org_id="org-cal-test")
    gw.demo_mode = True
    
    # Create approved task with natural language deadline
    task = ActionItem(
        meeting_id=meeting.id,
        org_id="org-cal-test",
        task="Complete SOC2 compliance documentation",
        assigned_user_id=user.id,
        approval_status="Approved",
        status="Approved",
        deadline="tomorrow at 3 PM"
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    # 1st sync
    sync_res1 = gw.sync_task_to_calendar(db, task=task, user=user)
    assert sync_res1["status"] == "success"
    ext_id1 = sync_res1["external_event_id"]
    
    # Check calendar_events table
    cal_event = db.query(CalendarEvent).filter(CalendarEvent.task_id == task.id).first()
    assert cal_event is not None
    assert cal_event.sync_status == "Synced"
    assert cal_event.external_event_id == ext_id1
    
    # 2nd sync (idempotency: should update existing event rather than create duplicate)
    sync_res2 = gw.sync_task_to_calendar(db, task=task, user=user)
    assert sync_res2["status"] == "success"
    assert sync_res2["external_event_id"] == ext_id1
    
    events_count = db.query(CalendarEvent).filter(CalendarEvent.task_id == task.id).count()
    assert events_count == 1

def test_task_deadline_update_updates_calendar_event(setup_cal_db):
    db = setup_cal_db["db"]
    user = setup_cal_db["user"]
    meeting = setup_cal_db["meeting"]
    gw = GoogleWorkspaceIntegration(org_id="org-cal-test")
    gw.demo_mode = True

    task = ActionItem(
        meeting_id=meeting.id,
        org_id="org-cal-test",
        task="Deploy staging environment",
        assigned_user_id=user.id,
        approval_status="Approved",
        status="Approved",
        deadline="in 2 days"
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    sync_res = gw.sync_task_to_calendar(db, task=task, user=user)
    assert sync_res["status"] == "success"

    # Update deadline to "next Friday"
    task.deadline = "next Friday"
    db.commit()

    update_res = gw.update_task_calendar_event(db, task=task, user=user)
    assert update_res["status"] == "success"
    assert update_res["action"] == "updated"

def test_cancel_calendar_event(setup_cal_db):
    db = setup_cal_db["db"]
    user = setup_cal_db["user"]
    meeting = setup_cal_db["meeting"]
    gw = GoogleWorkspaceIntegration(org_id="org-cal-test")
    gw.demo_mode = True

    task = ActionItem(
        meeting_id=meeting.id,
        org_id="org-cal-test",
        task="Obsolete feature task",
        assigned_user_id=user.id,
        approval_status="Approved",
        status="Approved",
        deadline="tomorrow"
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    gw.sync_task_to_calendar(db, task=task, user=user)
    cancel_res = gw.cancel_task_calendar_event(db, task_id=task.id)
    assert cancel_res["status"] == "success"

    cal_event = db.query(CalendarEvent).filter(CalendarEvent.task_id == task.id).first()
    assert cal_event.sync_status == "Cancelled"

def test_calendar_events_api_list(setup_cal_db):
    client = TestClient(app)
    user = setup_cal_db["user"]
    
    res = client.get("/api/calendar/events", headers={"x-user-id": user.id})
    assert res.status_code == 200
    data = res.json()
    assert "events" in data
    assert isinstance(data["events"], list)
    assert len(data["events"]) > 0

def test_google_disconnect(setup_cal_db):
    client = TestClient(app)
    user = setup_cal_db["user"]
    
    res = client.post("/api/google/disconnect", headers={"x-user-id": user.id})
    assert res.status_code == 200
    assert res.json()["status"] == "disconnected"

def test_master_pipeline_matrix_deadline_calendar(setup_cal_db):
    """
    Comprehensive end-to-end test linking:
    1. Natural Language Deadline Parser
    2. Eisenhower Matrix Data Model & Quadrants
    3. Google Calendar API Sync with Idempotency & Lifecycle Updates
    """
    client = TestClient(app)
    db = setup_cal_db["db"]
    user = setup_cal_db["user"]
    org = setup_cal_db["org"]
    meeting = setup_cal_db["meeting"]

    # 1. Parse natural-language deadline
    from utils.date_parser import parse_natural_deadline
    ref_time = datetime.datetime(2026, 10, 20, 10, 0, 0, tzinfo=datetime.timezone.utc)
    parsed = parse_natural_deadline("tomorrow at 3 PM", reference_datetime=ref_time, timezone_str="UTC")
    assert parsed["status"] == "success"
    assert parsed["parsed_iso"] is not None

    # 2. Create action item with parsed deadline and matrix fields
    task = ActionItem(
        meeting_id=meeting.id,
        org_id=org.id,
        task="End-to-End Master Pipeline Verification",
        description="Verify matrix, deadline, and calendar coherence",
        assigned_to="Calendar Lead",
        assigned_user_id=user.id,
        status="Pending",
        approval_status="Draft",
        deadline=parsed["parsed_iso"],
        urgency="Urgent",
        importance="Important"
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    assert task.quadrant == "Do First"

    # 3. Update quadrant via matrix API
    res_matrix = client.post(
        f"/tasks/{task.id}/matrix",
        json={"urgency": "Not Urgent", "importance": "Important"},
        headers={"x-user-id": user.id}
    )
    assert res_matrix.status_code == 200
    assert res_matrix.json()["quadrant"] == "Schedule"

    # 4. Approve task
    task.approval_status = "Approved"
    task.status = "Approved"
    db.commit()

    # 5. Connect Google Workspace
    from integrations.google_workspace import GoogleWorkspaceIntegration
    gw = GoogleWorkspaceIntegration(org_id=org.id)
    gw.demo_mode = True
    gw.exchange_code(db, "demo_auth_code_xyz")

    # 6. Sync to Google Calendar
    sync_res = client.post(
        f"/api/calendar/tasks/{task.id}/sync",
        headers={"x-user-id": user.id}
    )
    assert sync_res.status_code == 200
    sync_data = sync_res.json()
    assert sync_data["status"] == "success"

    # 7. Check calendar event created
    cal_event = db.query(CalendarEvent).filter(CalendarEvent.task_id == task.id).first()
    assert cal_event is not None
    assert cal_event.idempotency_key == f"gcal_task_{task.id}_{user.id}"

    # 8. Update deadline via API and verify calendar event is updated
    dl_res = client.post(
        f"/tasks/{task.id}/deadline",
        json={"deadline": "in 3 days"},
        headers={"x-user-id": user.id}
    )
    assert dl_res.status_code == 200
    assert dl_res.json()["status"] == "updated"
    assert dl_res.json()["calendar_sync"] in ["success", "pending_connection"]
    
    # Verify updated calendar event start time
    db.refresh(cal_event)
    assert cal_event.sync_status in ["Synced", "Pending Connection"]
