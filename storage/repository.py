from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, func
from . import models
import uuid
import json
import datetime
from typing import List, Optional, Dict, Any

# -------------------------------------------------------------
# User & Organization Repositories
# -------------------------------------------------------------

def create_user(db: Session, username: str, email: str, hashed_password: str, role: str = "Employee", org_id: str = "org-default-001", full_name: str = None, department: str = None) -> models.User:
    clean_username = username.strip() if username else ""
    clean_email = email.strip() if email else ""
    user = models.User(
        id=str(uuid.uuid4()),
        org_id=org_id,
        username=clean_username,
        email=clean_email,
        hashed_password=hashed_password,
        role=role,
        full_name=full_name or clean_username.replace("_", " ").title(),
        department=department or "General"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    if not username:
        return None
    clean_username = username.strip()
    return db.query(models.User).filter(
        func.lower(models.User.username) == clean_username.lower()
    ).first()

def get_user_by_id(db: Session, user_id: str) -> Optional[models.User]:
    if not user_id:
        return None
    return db.query(models.User).filter(models.User.id == str(user_id).strip()).first()

def get_user_by_email(db: Session, email: str, org_id: Optional[str] = None) -> Optional[models.User]:
    if not email:
        return None
    clean_email = email.strip()
    query = db.query(models.User).filter(func.lower(models.User.email) == clean_email.lower())
    if org_id:
        query = query.filter(models.User.org_id == org_id)
    return query.first()

def get_all_org_users(db: Session, org_id: str) -> List[models.User]:
    return db.query(models.User).filter(models.User.org_id == org_id).all()

# -------------------------------------------------------------
# Meeting Repositories
# -------------------------------------------------------------

def create_meeting(db: Session, filename: str, user_id: str, duration: float = 0.0, file_hash: str = None, org_id: str = "org-default-001", source_platform: str = "upload", external_meeting_id: str = None) -> models.Meeting:
    meeting = models.Meeting(
        id=str(uuid.uuid4()),
        org_id=org_id,
        user_id=user_id,
        filename=filename,
        title=f"Meeting - {filename.replace('_', ' ').replace('.wav', '').replace('.mp3', '')}",
        duration=duration,
        file_hash=file_hash,
        source_platform=source_platform,
        external_meeting_id=external_meeting_id,
        processing_status="Processing"
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    
    # Audit trail
    user = get_user_by_id(db, user_id)
    log_audit_event(
        db,
        org_id=org_id,
        user_id=user_id,
        actor_username=user.username if user else "System",
        entity_type="meeting",
        entity_id=meeting.id,
        action="CREATE",
        details=f"Meeting created via {source_platform}: {meeting.title}"
    )
    
    return meeting

def get_meeting_by_hash(db: Session, file_hash: str, user_id: str = None, org_id: str = None):
    if not file_hash:
        return None
    query = db.query(models.Meeting).filter(models.Meeting.file_hash == file_hash)
    if org_id:
        query = query.filter(models.Meeting.org_id == org_id)
    elif user_id:
        query = query.filter(models.Meeting.user_id == user_id)
    return query.first()

def get_meeting_by_external_id(db: Session, external_id: str, source_platform: str = None, org_id: str = None):
    if not external_id:
        return None
    query = db.query(models.Meeting).filter(models.Meeting.external_meeting_id == external_id)
    if source_platform:
        query = query.filter(models.Meeting.source_platform == source_platform)
    if org_id:
        query = query.filter(models.Meeting.org_id == org_id)
    return query.first()

def update_meeting_status(db: Session, meeting_id: str, status: str):
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if meeting:
        meeting.processing_status = status
        db.commit()

def save_transcript(db: Session, meeting_id: str, segments: list):
    unique_speakers = set()
    db_segments = []
    
    for seg in segments:
        spk = seg.get("speaker", "UNKNOWN")
        unique_speakers.add(spk)
        db_segments.append(
            models.TranscriptSegment(
                meeting_id=meeting_id,
                speaker=spk,
                start=seg["start"],
                end=seg["end"],
                text=seg["text"],
                confidence=seg.get("confidence", 1.0)
            )
        )
        
    for spk in unique_speakers:
        db.add(models.Speaker(meeting_id=meeting_id, original_label=spk, display_name=spk))
        
    db.bulk_save_objects(db_segments)
    
    meeting = db.query(models.Meeting).filter(models.Meeting.id == meeting_id).first()
    if meeting:
        meeting.speaker_count = len(unique_speakers)
        
    db.commit()

def get_meeting(db: Session, meeting_id: str, user_id: str = None, org_id: str = None):
    query = db.query(models.Meeting).filter(models.Meeting.id == meeting_id)
    if org_id:
        query = query.filter(models.Meeting.org_id == org_id)
    elif user_id:
        query = query.filter(models.Meeting.user_id == user_id)
    return query.first()

def get_all_meetings(db: Session, user_id: str = None, org_id: str = None):
    query = db.query(models.Meeting)
    if org_id:
        query = query.filter(models.Meeting.org_id == org_id)
    elif user_id:
        query = query.filter(models.Meeting.user_id == user_id)
    return query.order_by(models.Meeting.date.desc()).all()

# -------------------------------------------------------------
# Action Items & Task Execution Repositories
# -------------------------------------------------------------

def get_action_items(db: Session, meeting_id: Optional[str] = None, user_id: Optional[str] = None, org_id: Optional[str] = None, status: Optional[str] = None, approval_status: Optional[str] = None, urgency: Optional[str] = None, importance: Optional[str] = None):
    query = db.query(models.ActionItem)
    if meeting_id:
        query = query.filter(models.ActionItem.meeting_id == meeting_id)
    if org_id:
        query = query.filter(models.ActionItem.org_id == org_id)
    if user_id:
        query = query.filter(models.ActionItem.assigned_user_id == user_id)
    if status:
        query = query.filter(models.ActionItem.status == status)
    if approval_status:
        query = query.filter(models.ActionItem.approval_status == approval_status)
    if urgency:
        query = query.filter(models.ActionItem.urgency == urgency)
    if importance:
        query = query.filter(models.ActionItem.importance == importance)
    return query.order_by(models.ActionItem.id.desc()).all()

def update_action_item_status(db: Session, item_id: int, new_status: str, actor_user_id: Optional[str] = None, completion_notes: Optional[str] = None) -> Optional[models.ActionItem]:
    item = db.query(models.ActionItem).filter(models.ActionItem.id == item_id).first()
    if not item:
        return None
    prev_status = item.status
    item.status = new_status
    if completion_notes:
        item.completion_notes = completion_notes
    item.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(item)
    
    actor = get_user_by_id(db, actor_user_id) if actor_user_id else None
    log_audit_event(
        db,
        org_id=item.org_id,
        user_id=actor_user_id,
        actor_username=actor.username if actor else "System",
        entity_type="task",
        entity_id=str(item.id),
        action="UPDATE",
        previous_state=f"status: {prev_status}",
        new_state=f"status: {new_status}",
        transcript_excerpt=item.evidence_excerpt,
        details=f"Task '{item.task}' status changed from '{prev_status}' to '{new_status}'"
    )
    return item

def approve_action_item(db: Session, item_id: int, approver_user_id: str) -> Optional[models.ActionItem]:
    item = db.query(models.ActionItem).filter(models.ActionItem.id == item_id).first()
    if not item:
        return None
    item.approval_status = "Approved"
    item.approved_by_user_id = approver_user_id
    item.approved_at = datetime.datetime.now(datetime.timezone.utc)
    if item.status in ["Draft", "Pending Approval", "Pending"]:
        item.status = "Approved"
    item.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(item)
    
    approver = get_user_by_id(db, approver_user_id)
    log_audit_event(
        db,
        org_id=item.org_id,
        user_id=approver_user_id,
        actor_username=approver.username if approver else "Team Lead",
        entity_type="task",
        entity_id=str(item.id),
        action="APPROVE",
        previous_state="approval_status: Pending Approval",
        new_state="approval_status: Approved",
        transcript_excerpt=item.evidence_excerpt,
        details=f"Action item approved: '{item.task}' assigned to {item.assigned_to}"
    )
    return item

def reject_action_item(db: Session, item_id: int, approver_user_id: str, reason: str = "") -> Optional[models.ActionItem]:
    item = db.query(models.ActionItem).filter(models.ActionItem.id == item_id).first()
    if not item:
        return None
    item.approval_status = "Rejected"
    item.status = "Rejected"
    item.completion_notes = f"Rejected: {reason}" if reason else "Rejected by lead"
    item.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(item)
    
    approver = get_user_by_id(db, approver_user_id)
    log_audit_event(
        db,
        org_id=item.org_id,
        user_id=approver_user_id,
        actor_username=approver.username if approver else "Team Lead",
        entity_type="task",
        entity_id=str(item.id),
        action="REJECT",
        new_state="approval_status: Rejected",
        transcript_excerpt=item.evidence_excerpt,
        details=f"Action item rejected: {reason}"
    )
    return item

def reassign_action_item(db: Session, item_id: int, new_assigned_user_id: str, actor_user_id: str) -> Optional[models.ActionItem]:
    item = db.query(models.ActionItem).filter(models.ActionItem.id == item_id).first()
    new_user = get_user_by_id(db, new_assigned_user_id)
    if not item or not new_user:
        return None
    prev_assignee = item.assigned_to
    item.assigned_user_id = new_user.id
    item.assigned_to = new_user.full_name or new_user.username
    item.assignment_status = "Assigned"
    item.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(item)
    
    actor = get_user_by_id(db, actor_user_id)
    log_audit_event(
        db,
        org_id=item.org_id,
        user_id=actor_user_id,
        actor_username=actor.username if actor else "Team Lead",
        entity_type="task",
        entity_id=str(item.id),
        action="REASSIGN",
        previous_state=f"assigned_to: {prev_assignee}",
        new_state=f"assigned_to: {item.assigned_to}",
        transcript_excerpt=item.evidence_excerpt,
        details=f"Action item reassigned from '{prev_assignee}' to '{item.assigned_to}'"
    )
    return item

def update_action_item_matrix(
    db: Session,
    item_id: int,
    urgency: Optional[str] = None,
    importance: Optional[str] = None,
    actor_user_id: Optional[str] = None
) -> Optional[models.ActionItem]:
    item = db.query(models.ActionItem).filter(models.ActionItem.id == item_id).first()
    if not item:
        return None
    prev_urgency = item.urgency
    prev_importance = item.importance
    prev_quadrant = item.quadrant
    
    # Normalize valid values
    norm_u = None
    if urgency is not None:
        u_str = str(urgency).strip().lower()
        if u_str in ["urgent"]:
            norm_u = "Urgent"
        elif u_str in ["not urgent", "not_urgent", "non-urgent", "noturgent"]:
            norm_u = "Not Urgent"
        elif u_str in ["none", "null", "unclassified", ""]:
            norm_u = None
        else:
            norm_u = None

    norm_i = None
    if importance is not None:
        i_str = str(importance).strip().lower()
        if i_str in ["important"]:
            norm_i = "Important"
        elif i_str in ["not important", "not_important", "non-important", "notimportant"]:
            norm_i = "Not Important"
        elif i_str in ["none", "null", "unclassified", ""]:
            norm_i = None
        else:
            norm_i = None

    item.urgency = norm_u
    item.importance = norm_i
    item.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(item)
    
    actor = get_user_by_id(db, actor_user_id) if actor_user_id else None
    log_audit_event(
        db,
        org_id=item.org_id,
        user_id=actor_user_id,
        actor_username=actor.username if actor else "System",
        entity_type="task",
        entity_id=str(item.id),
        action="UPDATE",
        previous_state=f"quadrant: {prev_quadrant} (urgency: {prev_urgency}, importance: {prev_importance})",
        new_state=f"quadrant: {item.quadrant} (urgency: {item.urgency}, importance: {item.importance})",
        transcript_excerpt=item.evidence_excerpt,
        details=f"Task '{item.task}' Eisenhower classification updated to {item.quadrant}."
    )
    return item

# -------------------------------------------------------------
# Decision Register Repositories
# -------------------------------------------------------------

def get_decisions(db: Session, meeting_id: Optional[str] = None, org_id: Optional[str] = None, status: Optional[str] = None) -> List[models.Decision]:
    query = db.query(models.Decision)
    if meeting_id:
        query = query.filter(models.Decision.meeting_id == meeting_id)
    if org_id:
        query = query.filter(models.Decision.org_id == org_id)
    if status:
        query = query.filter(models.Decision.status == status)
    return query.order_by(models.Decision.id.desc()).all()

def supersede_decision(db: Session, old_decision_id: int, new_decision_id: int, actor_user_id: str):
    old_d = db.query(models.Decision).filter(models.Decision.id == old_decision_id).first()
    if old_d:
        old_d.status = "Superseded"
        old_d.superseded_by_id = new_decision_id
        db.commit()
        
        actor = get_user_by_id(db, actor_user_id)
        log_audit_event(
            db,
            org_id=old_d.org_id,
            user_id=actor_user_id,
            actor_username=actor.username if actor else "System",
            entity_type="decision",
            entity_id=str(old_d.id),
            action="UPDATE",
            previous_state="status: Approved",
            new_state=f"status: Superseded (by #{new_decision_id})",
            details=f"Decision #{old_d.id} superseded by Decision #{new_decision_id}"
        )

# -------------------------------------------------------------
# Calendar Event Repositories
# -------------------------------------------------------------

def get_calendar_events(db: Session, user_id: Optional[str] = None, org_id: Optional[str] = None, sync_status: Optional[str] = None):
    query = db.query(models.CalendarEvent)
    if org_id:
        query = query.filter(models.CalendarEvent.org_id == org_id)
    if user_id:
        query = query.filter(models.CalendarEvent.user_id == user_id)
    if sync_status:
        query = query.filter(models.CalendarEvent.sync_status == sync_status)
    return query.order_by(models.CalendarEvent.start_time.asc()).all()

def upsert_calendar_event(db: Session, task_id: int, meeting_id: str, user_id: str, summary: str, start_time: datetime.datetime, end_time: datetime.datetime, org_id: str = "org-default-001", external_event_id: str = None, sync_status: str = "Synced", idempotency_key: str = None) -> models.CalendarEvent:
    key = idempotency_key or f"cal_task_{task_id}_{user_id}"
    cal_event = db.query(models.CalendarEvent).filter(models.CalendarEvent.idempotency_key == key).first()
    
    if not cal_event:
        cal_event = models.CalendarEvent(
            id=str(uuid.uuid4()),
            task_id=task_id,
            meeting_id=meeting_id,
            user_id=user_id,
            org_id=org_id,
            summary=summary,
            start_time=start_time,
            end_time=end_time,
            external_event_id=external_event_id,
            sync_status=sync_status,
            last_synced_at=datetime.datetime.now(datetime.timezone.utc),
            idempotency_key=key
        )
        db.add(cal_event)
    else:
        cal_event.summary = summary
        cal_event.start_time = start_time
        cal_event.end_time = end_time
        cal_event.external_event_id = external_event_id or cal_event.external_event_id
        cal_event.sync_status = sync_status
        cal_event.last_synced_at = datetime.datetime.now(datetime.timezone.utc)
        
    db.commit()
    db.refresh(cal_event)
    return cal_event

# -------------------------------------------------------------
# Notification & Attendance Repositories
# -------------------------------------------------------------

def get_notification_logs(db: Session, org_id: Optional[str] = None, user_id: Optional[str] = None, status: Optional[str] = None) -> List[models.NotificationLog]:
    query = db.query(models.NotificationLog)
    if org_id:
        query = query.filter(models.NotificationLog.org_id == org_id)
    if user_id:
        query = query.filter(models.NotificationLog.recipient_user_id == user_id)
    if status:
        query = query.filter(models.NotificationLog.status == status)
    return query.order_by(models.NotificationLog.created_at.desc()).all()

def log_notification(db: Session, recipient_email: str, subject: str, body_preview: str, notification_type: str, org_id: str = "org-default-001", recipient_user_id: str = None, meeting_id: str = None, task_id: int = None, status: str = "Pending", requires_approval: bool = True, idempotency_key: str = None) -> models.NotificationLog:
    key = idempotency_key or f"notif_{uuid.uuid4().hex[:12]}"
    existing = db.query(models.NotificationLog).filter(models.NotificationLog.idempotency_key == key).first()
    if existing:
        return existing
        
    log = models.NotificationLog(
        id=str(uuid.uuid4()),
        org_id=org_id,
        recipient_email=recipient_email,
        recipient_user_id=recipient_user_id,
        notification_type=notification_type,
        meeting_id=meeting_id,
        task_id=task_id,
        subject=subject,
        body_preview=body_preview,
        status=status,
        requires_approval=requires_approval,
        idempotency_key=key
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log

def get_meeting_attendance(db: Session, meeting_id: str) -> List[models.MeetingAttendance]:
    return db.query(models.MeetingAttendance).filter(models.MeetingAttendance.meeting_id == meeting_id).all()

# -------------------------------------------------------------
# Integrations Repositories
# -------------------------------------------------------------

def get_integration_connection(db: Session, provider: str, org_id: str = "org-default-001") -> Optional[models.IntegrationConnection]:
    return db.query(models.IntegrationConnection).filter(
        models.IntegrationConnection.provider == provider,
        models.IntegrationConnection.org_id == org_id
    ).first()

def upsert_integration_connection(
    db: Session,
    provider: str,
    connection_status: str,
    org_id: str = "org-default-001",
    account_email: str = None,
    encrypted_tokens: str = None,
    scopes: str = None,
    last_import_result: str = None,
    error_message: str = None,
    last_sync_at: Optional[datetime.datetime] = None
) -> models.IntegrationConnection:
    conn = get_integration_connection(db, provider, org_id)
    try:
        # Determine if this update represents a successful synchronization
        is_successful_sync = (
            last_sync_at is not None or 
            (connection_status.startswith("Connected") and not error_message and last_import_result is not None)
        )
        resolved_sync_at = last_sync_at or (datetime.datetime.now(datetime.timezone.utc) if is_successful_sync else None)

        if not conn:
            conn = models.IntegrationConnection(
                id=str(uuid.uuid4()),
                org_id=org_id,
                provider=provider,
                connection_status=connection_status,
                account_email=account_email,
                encrypted_tokens=encrypted_tokens,
                scopes=scopes,
                last_sync_at=resolved_sync_at,
                last_import_result=last_import_result,
                error_message=error_message
            )
            db.add(conn)
        else:
            conn.connection_status = connection_status
            if account_email is not None:
                conn.account_email = account_email
            if encrypted_tokens is not None:
                conn.encrypted_tokens = encrypted_tokens
            if scopes is not None:
                conn.scopes = scopes
            if last_import_result is not None:
                conn.last_import_result = last_import_result
            conn.error_message = error_message
            if is_successful_sync:
                conn.last_sync_at = resolved_sync_at
            
        db.commit()
        db.refresh(conn)
        return conn
    except Exception as e:
        db.rollback()
        raise e

# -------------------------------------------------------------
# Audit Log Repositories
# -------------------------------------------------------------

def log_audit_event(db: Session, org_id: str, user_id: Optional[str], actor_username: str, entity_type: str, entity_id: str, action: str, previous_state: str = None, new_state: str = None, transcript_excerpt: str = None, details: str = None):
    try:
        event = models.AuditEvent(
            id=str(uuid.uuid4()),
            org_id=org_id or "org-default-001",
            user_id=user_id,
            actor_username=actor_username or "System",
            entity_type=entity_type,
            entity_id=str(entity_id),
            action=action,
            previous_state=previous_state,
            new_state=new_state,
            transcript_excerpt=transcript_excerpt,
            details=details
        )
        db.add(event)
        db.commit()
        return event
    except Exception as e:
        # Avoid breaking parent transactions on audit log failures
        db.rollback()
        return None

def get_audit_trail(db: Session, org_id: Optional[str] = None, entity_type: Optional[str] = None, entity_id: Optional[str] = None, limit: int = 50) -> List[models.AuditEvent]:
    query = db.query(models.AuditEvent)
    if org_id:
        query = query.filter(models.AuditEvent.org_id == org_id)
    if entity_type:
        query = query.filter(models.AuditEvent.entity_type == entity_type)
    if entity_id:
        query = query.filter(models.AuditEvent.entity_id == str(entity_id))
    return query.order_by(models.AuditEvent.timestamp.desc()).limit(limit).all()

# -------------------------------------------------------------
# Background Jobs Repositories
# -------------------------------------------------------------

def enqueue_job(db: Session, job_type: str, payload: dict, org_id: str = "org-default-001", idempotency_key: str = None, scheduled_at: datetime.datetime = None) -> models.BackgroundJob:
    key = idempotency_key or f"{job_type}_{uuid.uuid4().hex[:12]}"
    existing = db.query(models.BackgroundJob).filter(models.BackgroundJob.idempotency_key == key).first()
    if existing:
        return existing
        
    job = models.BackgroundJob(
        id=str(uuid.uuid4()),
        org_id=org_id,
        job_type=job_type,
        payload=json.dumps(payload),
        status="QUEUED",
        scheduled_at=scheduled_at or datetime.datetime.now(datetime.timezone.utc),
        idempotency_key=key
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

# -------------------------------------------------------------
# Project & Milestone Repositories
# -------------------------------------------------------------

def get_projects(db: Session, org_id: Optional[str] = None) -> List[models.Project]:
    query = db.query(models.Project)
    if org_id:
        query = query.filter(models.Project.org_id == org_id)
    return query.order_by(models.Project.created_at.desc()).all()

def get_project_by_id(db: Session, project_id: str) -> Optional[models.Project]:
    return db.query(models.Project).filter(models.Project.id == project_id).first()

def create_project(db: Session, org_id: str, name: str, description: Optional[str] = None, status: str = "Active", target_date: Optional[datetime.datetime] = None) -> models.Project:
    if not name or not name.strip():
        raise ValueError("Project name is required and cannot be empty.")
        
    project = models.Project(
        id=str(uuid.uuid4()),
        org_id=org_id,
        name=name.strip(),
        description=description.strip() if description else None,
        status=status or "Active",
        target_date=target_date
    )
    try:
        db.add(project)
        db.commit()
        db.refresh(project)
        return project
    except Exception as e:
        db.rollback()
        raise e

def seed_default_projects(db: Session, org_id: str = "org-default-001") -> List[models.Project]:
    """Idempotently seeds default organizational strategic initiatives if not already present."""
    defaults = [
        {
            "name": "Cloud Migration & Resilience",
            "description": "Transition backend processing pipeline to containerized Kubernetes deployment.",
            "status": "Active",
            "days": 30
        },
        {
            "name": "SOC2 Security & Token Protection",
            "description": "Implement Fernet AES encryption at rest, HMAC webhook defense, and compliance audit trail.",
            "status": "Active",
            "days": 15
        },
        {
            "name": "Q3 Meeting Intelligence Automation",
            "description": "Automated task extraction, attendance-aware follow-ups, and calendar synchronization.",
            "status": "Completed",
            "days": -5
        }
    ]
    
    seeded = []
    for item in defaults:
        existing = db.query(models.Project).filter(
            models.Project.org_id == org_id,
            models.Project.name == item["name"]
        ).first()
        if not existing:
            target = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=item["days"])
            p = models.Project(
                id=str(uuid.uuid4()),
                org_id=org_id,
                name=item["name"],
                description=item["description"],
                status=item["status"],
                target_date=target
            )
            try:
                db.add(p)
                db.commit()
                db.refresh(p)
                seeded.append(p)
            except Exception as e:
                db.rollback()
                raise e
        else:
            seeded.append(existing)
    return seeded

