import os
import sys
import time
import datetime
import logging
from dotenv import load_dotenv

# Ensure environment variables are loaded
load_dotenv()
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from fastapi import FastAPI, Depends, HTTPException, Security, Request, Header
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware

from storage.database import get_db, init_db
from storage.models import Meeting, ActionItem, Decision, User, AuditEvent
from storage import repository, models
from ai.meeting_analyzer import MeetingAnalyzer
from storage.knowledge import get_knowledge_repository
from api.integrations import router as integrations_router
from integrations.google_workspace import GoogleWorkspaceIntegration
from utils.date_parser import parse_natural_deadline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_KEY = os.getenv("API_KEY", "dev-secret-key")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

def verify_api_key(api_key: Optional[str] = Security(api_key_header)):
    # If API key configured and provided, validate; else allow local dev key
    if api_key and api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key credentials")
    return api_key or API_KEY

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="MeetIntel AI — Enterprise Intelligence & Execution Platform",
    version="2.0.0",
    lifespan=lifespan
)

allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_raw.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(integrations_router, prefix="/api")

# ---------------------------------------------------------
# Health Endpoints (Phase 13)
# ---------------------------------------------------------

@app.get("/health/live")
def liveness():
    """Returns 200 OK if service process is running."""
    return {"status": "live", "timestamp": time.time()}

@app.get("/health/ready")
def readiness(db = Depends(get_db)):
    """Validates database and core services readiness."""
    try:
        db.execute(Meeting.__table__.select().limit(1))
        return {"status": "ready", "database": "connected", "ai_status": "ready"}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Database not ready: {e}")

# ---------------------------------------------------------
# Request Models & User Identity
# ---------------------------------------------------------

class SearchQuery(BaseModel):
    query: str
    top_k: int = 5
    meeting_id: Optional[str] = None

class AskQuery(BaseModel):
    question: str
    meeting_id: Optional[str] = None

class TaskStatusUpdate(BaseModel):
    status: str
    completion_notes: Optional[str] = None

class TaskRejectRequest(BaseModel):
    reason: Optional[str] = "Rejected in review"

class TaskReassignRequest(BaseModel):
    new_assigned_user_id: str

class TaskMatrixClassification(BaseModel):
    urgency: Optional[str] = None # "Urgent", "Not Urgent", or None
    importance: Optional[str] = None # "Important", "Not Important", or None

class TaskDeadlineUpdateRequest(BaseModel):
    deadline: str
    reference_datetime: Optional[str] = None
    timezone: Optional[str] = "UTC"

class DeadlineParseRequest(BaseModel):
    text: str
    reference_datetime: Optional[str] = None
    timezone: Optional[str] = "UTC"
    is_completed: bool = False

def get_current_user_id(x_user_id: str = Header("admin", description="Authenticated user ID for tenant isolation")):
    return x_user_id

# ---------------------------------------------------------
# Meetings Endpoints
# ---------------------------------------------------------

@app.get("/meetings")
def list_meetings(
    db = Depends(get_db),
    api_key: str = Depends(verify_api_key),
    user_id: str = Depends(get_current_user_id)
):
    user = repository.get_user_by_id(db, user_id)
    org_id = user.org_id if user else "org-default-001"
    
    # Role-based access: Employees only see their meetings, Leads & Admins see org meetings
    if user and user.role == "Employee":
        meetings = repository.get_all_meetings(db, user_id=user.id, org_id=org_id)
    else:
        meetings = repository.get_all_meetings(db, org_id=org_id)

    return [{
        "id": m.id,
        "title": m.title,
        "date": m.date,
        "status": m.processing_status,
        "duration": m.duration,
        "speaker_count": m.speaker_count,
        "source_platform": m.source_platform
    } for m in meetings]

@app.get("/meetings/{meeting_id}")
def get_meeting_detail(
    meeting_id: str,
    db = Depends(get_db),
    api_key: str = Depends(verify_api_key),
    user_id: str = Depends(get_current_user_id)
):
    user = repository.get_user_by_id(db, user_id)
    org_id = user.org_id if user else "org-default-001"
    
    m = repository.get_meeting(db, meeting_id, org_id=org_id)
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found or access denied")
    
    return {
        "id": m.id,
        "title": m.title,
        "date": m.date,
        "duration": m.duration,
        "executive_summary": m.executive_summary,
        "key_points": m.key_points,
        "decisions": [
            {
                "id": d.id,
                "title": d.title,
                "decision": d.decision,
                "status": d.status,
                "confidence": d.confidence,
                "evidence_excerpt": d.evidence_excerpt
            } for d in m.decisions
        ],
        "action_items": [
            {
                "id": a.id,
                "task": a.task,
                "description": a.description,
                "assigned_to": a.assigned_to,
                "assignment_status": a.assignment_status,
                "deadline": a.deadline,
                "priority": a.priority,
                "urgency": a.urgency,
                "importance": a.importance,
                "quadrant": a.quadrant,
                "status": a.status,
                "approval_status": a.approval_status,
                "confidence": a.confidence,
                "evidence_excerpt": a.evidence_excerpt
            } for a in m.action_items
        ]
    }

# ---------------------------------------------------------
# Action Items & Tasks Execution API
# ---------------------------------------------------------

@app.get("/tasks")
def list_tasks(
    status: Optional[str] = None,
    approval_status: Optional[str] = None,
    urgency: Optional[str] = None,
    importance: Optional[str] = None,
    db = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    user = repository.get_user_by_id(db, user_id)
    org_id = user.org_id if user else "org-default-001"
    
    # Filter by user if Employee role
    assigned_user = user.id if (user and user.role == "Employee") else None
    tasks = repository.get_action_items(
        db,
        user_id=assigned_user,
        org_id=org_id,
        status=status,
        approval_status=approval_status,
        urgency=urgency,
        importance=importance
    )
    return [
        {
            "id": t.id,
            "meeting_id": t.meeting_id,
            "task": t.task,
            "description": t.description,
            "assigned_to": t.assigned_to,
            "deadline": t.deadline,
            "priority": t.priority,
            "urgency": t.urgency,
            "importance": t.importance,
            "quadrant": t.quadrant,
            "status": t.status,
            "approval_status": t.approval_status,
            "confidence": t.confidence,
            "evidence_excerpt": t.evidence_excerpt,
            "dependencies": t.dependencies
        } for t in tasks
    ]

@app.post("/tasks/{task_id}/approve")
def approve_task(
    task_id: int,
    db = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    user = repository.get_user_by_id(db, user_id)
    if user and user.role == "Employee":
        raise HTTPException(status_code=403, detail="Employees cannot approve tasks. Requires Team Lead or Admin role.")
        
    task = repository.approve_action_item(db, task_id, approver_user_id=user_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # Auto-sync to Google Calendar if configured
    gcal = GoogleWorkspaceIntegration(org_id=task.org_id)
    sync_res = gcal.sync_task_to_calendar(db, task=task, user=user)
    
    return {
        "status": "approved",
        "task_id": task.id,
        "calendar_sync": sync_res
    }

@app.post("/tasks/{task_id}/status")
def update_task_status_endpoint(
    task_id: int,
    req: TaskStatusUpdate,
    db = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    task = repository.update_action_item_status(
        db,
        item_id=task_id,
        new_status=req.status,
        actor_user_id=user_id,
        completion_notes=req.completion_notes
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": "updated", "task_id": task.id, "new_status": task.status}

@app.post("/tasks/{task_id}/reject")
def reject_task_endpoint(
    task_id: int,
    req: Optional[TaskRejectRequest] = None,
    db = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    user = repository.get_user_by_id(db, user_id)
    if user and user.role == "Employee":
        raise HTTPException(status_code=403, detail="Employees cannot reject tasks. Requires Team Lead or Admin role.")
    reason = req.reason if req else "Rejected in review"
    task = repository.reject_action_item(db, task_id, approver_user_id=user_id, reason=reason)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": "rejected", "task_id": task.id}

@app.post("/tasks/{task_id}/reassign")
def reassign_task_endpoint(
    task_id: int,
    req: TaskReassignRequest,
    db = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    user = repository.get_user_by_id(db, user_id)
    if user and user.role == "Employee":
        raise HTTPException(status_code=403, detail="Employees cannot reassign tasks. Requires Team Lead or Admin role.")
    task = repository.reassign_action_item(db, task_id, new_assigned_user_id=req.new_assigned_user_id, actor_user_id=user_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"status": "reassigned", "task_id": task.id, "assigned_to": task.assigned_to}

@app.post("/tasks/{task_id}/matrix")
@app.patch("/tasks/{task_id}/matrix")
def update_task_matrix_endpoint(
    task_id: int,
    req: TaskMatrixClassification,
    db = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    user = repository.get_user_by_id(db, user_id)
    existing_task = db.query(ActionItem).filter(ActionItem.id == task_id).first()
    if not existing_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # Tenant isolation & authorization: Employee can only classify their own tasks
    if user and user.role == "Employee":
        if existing_task.assigned_user_id != user.id:
            raise HTTPException(status_code=403, detail="Employees can only modify their own assigned tasks.")

    task = repository.update_action_item_matrix(
        db,
        item_id=task_id,
        urgency=req.urgency,
        importance=req.importance,
        actor_user_id=user_id
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "status": "classified",
        "task_id": task.id,
        "urgency": task.urgency,
        "importance": task.importance,
        "quadrant": task.quadrant
    }

@app.post("/tasks/{task_id}/deadline")
def update_task_deadline_endpoint(
    task_id: int,
    req: TaskDeadlineUpdateRequest,
    db = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    user = repository.get_user_by_id(db, user_id)
    task = db.query(ActionItem).filter(ActionItem.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    if user and user.role == "Employee" and task.assigned_user_id != user.id:
        raise HTTPException(status_code=403, detail="Employees can only edit deadlines for their own tasks.")

    tz_str = req.timezone or (user.timezone if user and user.timezone else "UTC")
    parse_res = parse_natural_deadline(req.deadline, timezone_str=tz_str, is_completed=(task.status == "Completed"))
    if parse_res["status"] == "invalid":
        raise HTTPException(status_code=400, detail=parse_res.get("error_message", "Invalid deadline specification"))
    if parse_res["status"] == "needs_clarification":
        raise HTTPException(status_code=400, detail=parse_res.get("clarification_question", "Deadline is ambiguous"))
        
    task.deadline = parse_res["parsed_iso"] or req.deadline
    task.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(task)

    # Sync calendar update if event already exists
    cal_event = db.query(models.CalendarEvent).filter(models.CalendarEvent.task_id == task.id).first()
    cal_sync_status = "none"
    if cal_event:
        gcal = GoogleWorkspaceIntegration(org_id=task.org_id)
        u = repository.get_user_by_id(db, task.assigned_user_id) or user
        sync_res = gcal.sync_task_to_calendar(db, task=task, user=u)
        cal_sync_status = sync_res.get("status", "synced")

    return {
        "status": "updated",
        "task_id": task.id,
        "deadline": task.deadline,
        "formatted_local": parse_res["formatted_local"],
        "countdown_text": parse_res["countdown_text"],
        "badge_status": parse_res["badge_status"],
        "calendar_sync": cal_sync_status
    }

@app.post("/deadlines/parse")
def parse_deadline_endpoint(
    req: DeadlineParseRequest,
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db)
):
    user = repository.get_user_by_id(db, user_id)
    tz = req.timezone or (user.timezone if user and user.timezone else "UTC")
    return parse_natural_deadline(
        text=req.text,
        timezone_str=tz,
        is_completed=req.is_completed
    )

# ---------------------------------------------------------
# Decision Register API
# ---------------------------------------------------------

@app.get("/decisions")
def list_decisions(
    status: Optional[str] = None,
    db = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    user = repository.get_user_by_id(db, user_id)
    org_id = user.org_id if user else "org-default-001"
    decisions = repository.get_decisions(db, org_id=org_id, status=status)
    return [
        {
            "id": d.id,
            "title": d.title,
            "decision": d.decision,
            "context": d.context,
            "rationale": d.rationale,
            "alternatives": d.alternatives,
            "evidence_excerpt": d.evidence_excerpt,
            "confidence": d.confidence,
            "status": d.status,
            "proposer": d.proposer,
            "meeting_id": d.meeting_id
        } for d in decisions
    ]

# ---------------------------------------------------------
# Audit Trail API (Phase 7)
# ---------------------------------------------------------

@app.get("/audit")
def get_audit_log(
    limit: int = 50,
    entity_type: Optional[str] = None,
    db = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    user = repository.get_user_by_id(db, user_id)
    org_id = user.org_id if user else "org-default-001"
    events = repository.get_audit_trail(db, org_id=org_id, entity_type=entity_type, limit=limit)
    return [
        {
            "id": e.id,
            "actor": e.actor_username,
            "action": e.action,
            "entity_type": e.entity_type,
            "entity_id": e.entity_id,
            "details": e.details,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None
        } for e in events
    ]

# ---------------------------------------------------------
# Knowledge Search & RAG
# ---------------------------------------------------------

@app.post("/search")
def search_knowledge(
    req: SearchQuery,
    api_key: str = Depends(verify_api_key),
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db)
):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    user = repository.get_user_by_id(db, user_id)
    org_id = user.org_id if user else "org-default-001"
    assigned_user = user.id if (user and user.role == "Employee") else None
    
    repo = get_knowledge_repository()
    try:
        t0 = time.time()
        results = repo.semantic_search(
            req.query,
            user_id=assigned_user,
            meeting_id=req.meeting_id,
            org_id=org_id,
            top_k=req.top_k
        )
        return {
            "query": req.query,
            "results": results.get("results", []),
            "search_time_ms": results.get("search_time_ms", int((time.time() - t0) * 1000))
        }
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during search")

@app.post("/ask")
def ask_knowledge(
    req: AskQuery,
    api_key: str = Depends(verify_api_key),
    user_id: str = Depends(get_current_user_id),
    db = Depends(get_db)
):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
        
    user = repository.get_user_by_id(db, user_id)
    org_id = user.org_id if user else "org-default-001"
    assigned_user = user.id if (user and user.role == "Employee") else None
    
    analyzer = MeetingAnalyzer()
    try:
        t0 = time.time()
        response = analyzer.rag_ask(
            req.question,
            user_id=assigned_user,
            meeting_id=req.meeting_id,
            org_id=org_id
        )
        return {
            "question": req.question,
            "answer": response.get("answer", ""),
            "sources": response.get("sources", []),
            "generation_time_ms": int((time.time() - t0) * 1000)
        }
    except Exception as e:
        logger.error(f"RAG failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during ask")
