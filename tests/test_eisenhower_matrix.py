import pytest
import uuid
import datetime
from fastapi.testclient import TestClient

from storage.database import SessionLocal, init_db
from storage import repository
from storage.models import ActionItem, User, Organization, Meeting
from api.main import app

@pytest.fixture(scope="module")
def setup_db():
    init_db()
    db = SessionLocal()
    
    # Ensure test org
    org = db.query(Organization).filter(Organization.id == "org-test-matrix").first()
    if not org:
        org = Organization(id="org-test-matrix", name="Matrix Test Org")
        db.add(org)
        db.commit()
        
    # Ensure test users
    admin_user = db.query(User).filter(User.username == "matrix_admin").first()
    if not admin_user:
        admin_user = User(
            id=str(uuid.uuid4()),
            org_id="org-test-matrix",
            username="matrix_admin",
            email="matrix_admin@test.io",
            role="Admin"
        )
        db.add(admin_user)
        
    lead_user = db.query(User).filter(User.username == "matrix_lead").first()
    if not lead_user:
        lead_user = User(
            id=str(uuid.uuid4()),
            org_id="org-test-matrix",
            username="matrix_lead",
            email="matrix_lead@test.io",
            role="Team Lead"
        )
        db.add(lead_user)

    emp1 = db.query(User).filter(User.username == "matrix_emp1").first()
    if not emp1:
        emp1 = User(
            id=str(uuid.uuid4()),
            org_id="org-test-matrix",
            username="matrix_emp1",
            email="matrix_emp1@test.io",
            role="Employee"
        )
        db.add(emp1)

    emp2 = db.query(User).filter(User.username == "matrix_emp2").first()
    if not emp2:
        emp2 = User(
            id=str(uuid.uuid4()),
            org_id="org-test-matrix",
            username="matrix_emp2",
            email="matrix_emp2@test.io",
            role="Employee"
        )
        db.add(emp2)
        
    # Ensure test meeting
    meeting = db.query(Meeting).filter(Meeting.id == "mtg-matrix-001").first()
    if not meeting:
        meeting = Meeting(
            id="mtg-matrix-001",
            org_id="org-test-matrix",
            user_id=admin_user.id,
            title="Strategic Prioritization Sync"
        )
        db.add(meeting)

    db.commit()
    yield {"db": db, "admin": admin_user, "lead": lead_user, "emp1": emp1, "emp2": emp2, "meeting": meeting}
    db.close()

def test_quadrant_calculation_rules(setup_db):
    db = setup_db["db"]
    admin = setup_db["admin"]
    meeting = setup_db["meeting"]
    
    # 1. Do First: Urgent + Important
    item1 = ActionItem(
        meeting_id=meeting.id,
        org_id=admin.org_id,
        task="Critical zero-day patch",
        assigned_user_id=admin.id,
        urgency="Urgent",
        importance="Important"
    )
    db.add(item1)
    db.commit()
    db.refresh(item1)
    assert item1.quadrant == "Do First"
    
    # 2. Schedule: Not Urgent + Important
    item2 = ActionItem(
        meeting_id=meeting.id,
        org_id=admin.org_id,
        task="Architectural redesign for 2027",
        assigned_user_id=admin.id,
        urgency="Not Urgent",
        importance="Important"
    )
    db.add(item2)
    db.commit()
    db.refresh(item2)
    assert item2.quadrant == "Schedule"
    
    # 3. Delegate: Urgent + Not Important
    item3 = ActionItem(
        meeting_id=meeting.id,
        org_id=admin.org_id,
        task="Renew SSL certificate banner in staging",
        assigned_user_id=admin.id,
        urgency="Urgent",
        importance="Not Important"
    )
    db.add(item3)
    db.commit()
    db.refresh(item3)
    assert item3.quadrant == "Delegate"
    
    # 4. Defer: Not Urgent + Not Important
    item4 = ActionItem(
        meeting_id=meeting.id,
        org_id=admin.org_id,
        task="Reorganize old slack channels archive",
        assigned_user_id=admin.id,
        urgency="Not Urgent",
        importance="Not Important"
    )
    db.add(item4)
    db.commit()
    db.refresh(item4)
    assert item4.quadrant == "Defer"
    
    # 5. Unclassified: Missing urgency or importance
    item5 = ActionItem(
        meeting_id=meeting.id,
        org_id=admin.org_id,
        task="Review meeting recording",
        assigned_user_id=admin.id,
        urgency=None,
        importance="Important"
    )
    db.add(item5)
    db.commit()
    db.refresh(item5)
    assert item5.quadrant == "Unclassified"

def test_task_moves_between_quadrants_and_persists(setup_db):
    db = setup_db["db"]
    admin = setup_db["admin"]
    meeting = setup_db["meeting"]

    item = ActionItem(
        meeting_id=meeting.id,
        org_id=admin.org_id,
        task="Database indexing",
        assigned_user_id=admin.id,
        urgency="Not Urgent",
        importance="Important"
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    assert item.quadrant == "Schedule"

    # Move from Schedule to Do First (mark urgent)
    updated = repository.update_action_item_matrix(
        db,
        item_id=item.id,
        urgency="Urgent",
        importance="Important",
        actor_user_id=admin.id
    )
    assert updated.quadrant == "Do First"
    
    # Re-fetch from clean query to ensure persistence
    persisted = db.query(ActionItem).filter(ActionItem.id == item.id).first()
    assert persisted.urgency == "Urgent"
    assert persisted.importance == "Important"
    assert persisted.quadrant == "Do First"

def test_status_lifecycle_independent_of_matrix(setup_db):
    db = setup_db["db"]
    admin = setup_db["admin"]
    meeting = setup_db["meeting"]

    item = ActionItem(
        meeting_id=meeting.id,
        org_id=admin.org_id,
        task="Security vulnerability audit",
        assigned_user_id=admin.id,
        urgency="Urgent",
        importance="Important",
        status="Completed"
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    
    # Quadrant should remain Do First while lifecycle status remains Completed
    assert item.quadrant == "Do First"
    assert item.status == "Completed"

def test_authorization_matrix_update_api(setup_db):
    client = TestClient(app)
    emp1 = setup_db["emp1"]
    emp2 = setup_db["emp2"]
    admin = setup_db["admin"]
    meeting = setup_db["meeting"]
    db = setup_db["db"]
    
    # Create task assigned to emp1
    emp1_task = ActionItem(
        meeting_id=meeting.id,
        org_id=emp1.org_id,
        task="Emp1 task",
        assigned_user_id=emp1.id
    )
    db.add(emp1_task)
    db.commit()
    db.refresh(emp1_task)
    
    # Emp2 tries to modify Emp1's task -> 403 Forbidden
    res_unauth = client.post(
        f"/tasks/{emp1_task.id}/matrix",
        headers={"x-user-id": emp1.id, "X-API-Key": "dev-secret-key"},
        json={"urgency": "Urgent", "importance": "Important"}
    )
    # Emp1 modifying their own task succeeds -> 200 OK
    assert res_unauth.status_code == 200
    assert res_unauth.json()["quadrant"] == "Do First"

    # Now Emp2 modifies Emp1 task -> 403 Forbidden
    res_forbidden = client.post(
        f"/tasks/{emp1_task.id}/matrix",
        headers={"x-user-id": emp2.id, "X-API-Key": "dev-secret-key"},
        json={"urgency": "Not Urgent", "importance": "Important"}
    )
    assert res_forbidden.status_code == 403

    # Admin modifying any task -> 200 OK
    res_admin = client.post(
        f"/tasks/{emp1_task.id}/matrix",
        headers={"x-user-id": admin.id, "X-API-Key": "dev-secret-key"},
        json={"urgency": "Urgent", "importance": "Not Important"}
    )
    assert res_admin.status_code == 200
    assert res_admin.json()["quadrant"] == "Delegate"
