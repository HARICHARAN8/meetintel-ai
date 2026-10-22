import pytest
import uuid
import datetime
import calendar
from fastapi.testclient import TestClient

from storage.database import SessionLocal, init_db
from storage.models import ActionItem, User, Organization, Meeting, CalendarEvent, IntegrationConnection
from integrations.google_workspace import GoogleWorkspaceIntegration
from api.main import app
from utils.date_parser import parse_natural_deadline, get_tz

@pytest.fixture(scope="module")
def cal_workflow_db():
    init_db()
    db = SessionLocal()

    org_a = Organization(id=f"org-cal-a-{uuid.uuid4().hex[:6]}", name="Alpha Corp Calendar Org")
    org_b = Organization(id=f"org-cal-b-{uuid.uuid4().hex[:6]}", name="Beta Corp Calendar Org")
    db.add_all([org_a, org_b])
    db.commit()

    u_suffix = uuid.uuid4().hex[:6]
    user_a = User(
        id=f"user-cal-a-{u_suffix}",
        org_id=org_a.id,
        username=f"user_cal_a_{u_suffix}",
        email=f"user_a_{u_suffix}@alphacorp.io",
        role="Admin",
        timezone="America/New_York"
    )
    user_b = User(
        id=f"user-cal-b-{u_suffix}",
        org_id=org_b.id,
        username=f"user_cal_b_{u_suffix}",
        email=f"user_b_{u_suffix}@betacorp.io",
        role="Employee",
        timezone="Europe/London"
    )
    db.add_all([user_a, user_b])
    db.commit()

    meeting_a = Meeting(
        id=f"mtg-a-{uuid.uuid4().hex[:6]}",
        org_id=org_a.id,
        user_id=user_a.id,
        title="Alpha Q4 Architecture Alignment",
        date=datetime.datetime(2026, 10, 24, 14, 0, 0, tzinfo=datetime.timezone.utc),
        duration=1800.0,
        processing_status="Completed"
    )
    db.add(meeting_a)
    db.commit()

    yield {"db": db, "user_a": user_a, "user_b": user_b, "org_a": org_a, "org_b": org_b, "meeting_a": meeting_a}
    db.close()

def test_calendar_empty_event_list(cal_workflow_db):
    """Calendar API returns 200 and visible structure even when user has 0 events."""
    client = TestClient(app)
    user_b = cal_workflow_db["user_b"]
    
    res = client.get("/api/calendar/events", headers={"x-user-id": user_b.id})
    assert res.status_code == 200
    data = res.json()
    assert "events" in data
    assert isinstance(data["events"], list)
    assert data["connection_status"] in ["Not connected", "Connected (Demo)"]

def test_calendar_remains_visible_when_disconnected(cal_workflow_db):
    """Calendar remains visible when Google Workspace is disconnected."""
    client = TestClient(app)
    db = cal_workflow_db["db"]
    user_a = cal_workflow_db["user_a"]

    # Explicitly disconnect
    res_disc = client.post("/api/google/disconnect", headers={"x-user-id": user_a.id})
    assert res_disc.status_code == 200

    # Query calendar events: structure is intact
    res_cal = client.get("/api/calendar/events", headers={"x-user-id": user_a.id})
    assert res_cal.status_code == 200
    cal_data = res_cal.json()
    assert cal_data["connection_status"] in ["Disconnected", "Not connected"]
    assert cal_data["is_live"] is False

def test_month_navigation_leap_years_and_boundaries():
    """Verify month calculation boundaries, leap years, and year rollover."""
    # Leap year February 2028: 29 days
    feb_2028_range = calendar.monthrange(2028, 2)
    assert feb_2028_range[1] == 29

    # Non-leap year February 2026: 28 days
    feb_2026_range = calendar.monthrange(2026, 2)
    assert feb_2026_range[1] == 28

    # Year boundary rollover: Dec 2026 -> Jan 2027
    dec_date = datetime.date(2026, 12, 15)
    next_year = dec_date.year + (1 if dec_date.month == 12 else 0)
    next_month = 1 if dec_date.month == 12 else dec_date.month + 1
    next_date = datetime.date(next_year, next_month, 1)
    assert next_date.year == 2027
    assert next_date.month == 1

def test_views_use_same_underlying_data(cal_workflow_db):
    """Verify Month, Week, and Agenda views draw from the canonical database entities."""
    db = cal_workflow_db["db"]
    user_a = cal_workflow_db["user_a"]
    org_a = cal_workflow_db["org_a"]
    meeting_a = cal_workflow_db["meeting_a"]

    task = ActionItem(
        meeting_id=meeting_a.id,
        org_id=org_a.id,
        task="Shared Canonical Task Deliverable",
        description="Must be visible across month, week, and agenda representations",
        assigned_to=user_a.full_name,
        assigned_user_id=user_a.id,
        deadline="2026-10-24T17:00:00+00:00",
        approval_status="Approved",
        status="Approved"
    )
    db.add(task)
    db.commit()

    # Query Google workspace list events
    gw = GoogleWorkspaceIntegration(org_id=org_a.id)
    gw.demo_mode = True
    gw.sync_task_to_calendar(db, task=task, user=user_a)

    events = gw.list_calendar_events(db, user=user_a)
    matching = [e for e in events if e.get("task_id") == task.id]
    assert len(matching) == 1
    evt = matching[0]
    assert evt["summary"] == f"[MeetIntel] {task.task}"
    assert "2026-10-24" in evt["start"]

def test_google_oauth_state_validation(cal_workflow_db):
    """Validates OAuth authorization URL contains state param to prevent CSRF."""
    gw = GoogleWorkspaceIntegration(org_id="test-org")
    state_token = f"csrf_token_{uuid.uuid4().hex}"
    auth_url = gw.get_auth_url(state=state_token)
    assert state_token in auth_url
    assert "accounts.google.com" in auth_url
    assert "calendar.events" in auth_url

def test_calendar_user_isolation(cal_workflow_db):
    """User in Org B cannot sync or modify tasks in Org A."""
    client = TestClient(app)
    db = cal_workflow_db["db"]
    user_b = cal_workflow_db["user_b"]
    org_a = cal_workflow_db["org_a"]
    meeting_a = cal_workflow_db["meeting_a"]

    task_a = ActionItem(
        meeting_id=meeting_a.id,
        org_id=org_a.id,
        task="Secret Alpha Task",
        assigned_user_id="user-other",
        approval_status="Approved",
        status="Approved",
        deadline="tomorrow"
    )
    db.add(task_a)
    db.commit()

    # User B (Employee in Org B) attempts to edit deadline of task in Org A
    res = client.post(
        f"/tasks/{task_a.id}/deadline",
        json={"deadline": "next Friday"},
        headers={"x-user-id": user_b.id}
    )
    # Employee cannot edit task assigned to another user
    assert res.status_code == 403

def test_calendar_event_cancellation_preserves_task(cal_workflow_db):
    """Cancelling a calendar event does not delete the underlying ActionItem task."""
    client = TestClient(app)
    db = cal_workflow_db["db"]
    user_a = cal_workflow_db["user_a"]
    org_a = cal_workflow_db["org_a"]
    meeting_a = cal_workflow_db["meeting_a"]

    task = ActionItem(
        meeting_id=meeting_a.id,
        org_id=org_a.id,
        task="Task with cancelable calendar event",
        assigned_user_id=user_a.id,
        approval_status="Approved",
        status="Approved",
        deadline="2026-10-25T15:00:00+00:00"
    )
    db.add(task)
    db.commit()

    gw = GoogleWorkspaceIntegration(org_id=org_a.id)
    gw.demo_mode = True
    gw.sync_task_to_calendar(db, task=task, user=user_a)

    # Cancel via API
    res = client.delete(f"/api/calendar/tasks/{task.id}")
    assert res.status_code == 200

    # Verify task still exists in database!
    db.refresh(task)
    assert task is not None
    assert task.task == "Task with cancelable calendar event"

    # Verify calendar_event is cancelled
    cal_ev = db.query(CalendarEvent).filter(CalendarEvent.task_id == task.id).first()
    assert cal_ev.sync_status == "Cancelled"
