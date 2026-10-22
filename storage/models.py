import uuid
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class Organization(Base):
    __tablename__ = "organizations"
    
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4())) # UUID
    name = Column(String, nullable=False)
    domain = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())
    
    users = relationship("User", back_populates="organization")
    meetings = relationship("Meeting", back_populates="organization")

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True) # UUID
    org_id = Column(String, ForeignKey("organizations.id"), nullable=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="Employee") # Admin, Team Lead, Employee
    full_name = Column(String, nullable=True)
    department = Column(String, nullable=True)
    timezone = Column(String, default="UTC")
    created_at = Column(DateTime, default=func.now())
    is_active = Column(Boolean, default=True)
    theme_preference = Column(String, default="System")
    
    organization = relationship("Organization", back_populates="users")
    meetings = relationship("Meeting", back_populates="owner", cascade="all, delete-orphan")
    assigned_tasks = relationship("ActionItem", foreign_keys="ActionItem.assigned_user_id", back_populates="assigned_user")

class Meeting(Base):
    __tablename__ = "meetings"
    
    id = Column(String, primary_key=True, index=True) # UUID
    org_id = Column(String, ForeignKey("organizations.id"), nullable=True)
    user_id = Column(String, ForeignKey("users.id"))
    filename = Column(String)
    title = Column(String, default="Untitled Meeting")
    file_hash = Column(String, nullable=True)
    date = Column(DateTime, default=func.now())
    duration = Column(Float, default=0.0) # seconds
    language = Column(String, default="en")
    speaker_count = Column(Integer, default=0)
    processing_status = Column(String, default="Pending") # Pending, Processing, Completed, Failed
    source_platform = Column(String, default="upload") # upload, google_meet, zoom
    external_meeting_id = Column(String, nullable=True)
    
    # AI Summary Fields
    executive_summary = Column(String, nullable=True)
    meeting_objective = Column(String, nullable=True)
    meeting_plan = Column(String, nullable=True)
    emotional_analysis = Column(String, nullable=True)
    key_topics = Column(String, nullable=True)
    key_points = Column(String, nullable=True)
    risks = Column(String, nullable=True)
    recommendations = Column(String, nullable=True)
    next_steps = Column(String, nullable=True)
    
    organization = relationship("Organization", back_populates="meetings")
    owner = relationship("User", back_populates="meetings")
    segments = relationship("TranscriptSegment", back_populates="meeting", cascade="all, delete-orphan")
    speakers = relationship("Speaker", back_populates="meeting", cascade="all, delete-orphan")
    action_items = relationship("ActionItem", foreign_keys="ActionItem.meeting_id", back_populates="meeting", cascade="all, delete-orphan")
    decisions = relationship("Decision", back_populates="meeting", cascade="all, delete-orphan")
    participants = relationship("Participant", back_populates="meeting", cascade="all, delete-orphan")
    deadlines = relationship("Deadline", back_populates="meeting", cascade="all, delete-orphan")
    priorities = relationship("Priority", back_populates="meeting", cascade="all, delete-orphan")
    attendance = relationship("MeetingAttendance", back_populates="meeting", cascade="all, delete-orphan")

class Speaker(Base):
    __tablename__ = "speakers"
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String, ForeignKey("meetings.id"))
    original_label = Column(String)
    display_name = Column(String)
    
    meeting = relationship("Meeting", back_populates="speakers")

class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String, ForeignKey("meetings.id"))
    speaker = Column(String)
    start = Column(Float)
    end = Column(Float)
    text = Column(String)
    confidence = Column(Float, default=1.0)
    
    meeting = relationship("Meeting", back_populates="segments")

class ActionItem(Base):
    __tablename__ = "action_items"
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String, ForeignKey("meetings.id"))
    org_id = Column(String, nullable=True)
    task = Column(String)
    description = Column(String, nullable=True)
    evidence_excerpt = Column(String, nullable=True)
    assigned_to = Column(String) # Text display name
    assigned_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    assignment_status = Column(String, default="Assigned") # Assigned, Needs assignment, Suggested
    deadline = Column(String, nullable=True)
    priority = Column(String, default="Medium") # Low, Medium, High, Urgent
    urgency = Column(String, nullable=True) # Urgent, Not Urgent, or None
    importance = Column(String, nullable=True) # Important, Not Important, or None
    status = Column(String, default="Pending") # Draft, Pending Approval, Approved, Scheduled, In Progress, Completed, Blocked, Rejected, Cancelled, Overdue
    approval_status = Column(String, default="Draft") # Draft, Pending Approval, Approved, Rejected
    approved_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    confidence = Column(Float, default=1.0)
    estimated_effort_hours = Column(Float, nullable=True)
    dependencies = Column(String, default="[]") # JSON list of task IDs
    completion_notes = Column(String, nullable=True)
    project_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    meeting = relationship("Meeting", foreign_keys=[meeting_id], back_populates="action_items")
    assigned_user = relationship("User", foreign_keys=[assigned_user_id], back_populates="assigned_tasks")
    approved_by = relationship("User", foreign_keys=[approved_by_user_id])
    calendar_event = relationship("CalendarEvent", back_populates="task", uselist=False, cascade="all, delete-orphan")

    @property
    def quadrant(self) -> str:
        u = (self.urgency or "").strip().lower()
        i = (self.importance or "").strip().lower()
        if u == "urgent" and i == "important":
            return "Do First"
        elif u in ["not urgent", "not_urgent"] and i == "important":
            return "Schedule"
        elif u == "urgent" and i in ["not important", "not_important"]:
            return "Delegate"
        elif u in ["not urgent", "not_urgent"] and i in ["not important", "not_important"]:
            return "Defer"
        return "Unclassified"

class Decision(Base):
    __tablename__ = "decisions"
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String, ForeignKey("meetings.id"))
    org_id = Column(String, nullable=True)
    title = Column(String, nullable=True)
    decision = Column(String)
    context = Column(String)
    rationale = Column(String, nullable=True)
    alternatives = Column(String, nullable=True)
    evidence_excerpt = Column(String, nullable=True)
    confidence = Column(Float, default=1.0)
    status = Column(String, default="Approved") # Proposed, Approved, Superseded, Rejected
    proposer = Column(String, nullable=True)
    approver_id = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    superseded_by_id = Column(Integer, nullable=True)
    related_task_ids = Column(String, default="[]") # JSON list
    timestamp_approx = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())
    
    meeting = relationship("Meeting", back_populates="decisions")

class Participant(Base):
    __tablename__ = "participants"
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String, ForeignKey("meetings.id"))
    name = Column(String)
    speaker_id = Column(String)
    responsibilities = Column(String) # JSON list of strings
    
    meeting = relationship("Meeting", back_populates="participants")

class Deadline(Base):
    __tablename__ = "deadlines"
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String, ForeignKey("meetings.id"))
    description = Column(String)
    date = Column(String)
    related_task = Column(String)
    
    meeting = relationship("Meeting", back_populates="deadlines")

class Priority(Base):
    __tablename__ = "priorities"
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String, ForeignKey("meetings.id"))
    item = Column(String)
    priority_level = Column(String)
    
    meeting = relationship("Meeting", back_populates="priorities")

class MeetingAttendance(Base):
    __tablename__ = "meeting_attendance"
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String, ForeignKey("meetings.id"))
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    name = Column(String)
    email = Column(String)
    status = Column(String, default="Attended") # Attended, Absent, Excused
    verified_source = Column(String, default="Organizer Input")
    
    meeting = relationship("Meeting", back_populates="attendance")
    user = relationship("User")

class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4())) # UUID
    task_id = Column(Integer, ForeignKey("action_items.id"), nullable=True)
    meeting_id = Column(String, ForeignKey("meetings.id"), nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    org_id = Column(String, nullable=True)
    external_event_id = Column(String, nullable=True)
    calendar_type = Column(String, default="Google Calendar")
    summary = Column(String)
    description = Column(String, nullable=True)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    reminders_config = Column(String, default="[24, 1]") # JSON list of hours before deadline
    sync_status = Column(String, default="Pending") # Synced, Pending, Failed, Cancelled
    last_synced_at = Column(DateTime, nullable=True)
    error_message = Column(String, nullable=True)
    idempotency_key = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=func.now())
    
    task = relationship("ActionItem", back_populates="calendar_event")
    meeting = relationship("Meeting")
    user = relationship("User")

class NotificationLog(Base):
    __tablename__ = "notification_logs"
    
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4())) # UUID
    org_id = Column(String, nullable=True)
    recipient_email = Column(String)
    recipient_user_id = Column(String, nullable=True)
    notification_type = Column(String) # absent_followup, task_reminder, approval_request, decision_alert, blocker_alert
    meeting_id = Column(String, nullable=True)
    task_id = Column(Integer, nullable=True)
    subject = Column(String)
    body_preview = Column(Text)
    status = Column(String, default="Pending") # Pending, Approved, Sent, Delivered, Failed, Acknowledged
    requires_approval = Column(Boolean, default=True)
    approved_by_user_id = Column(String, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    error_message = Column(String, nullable=True)
    retry_count = Column(Integer, default=0)
    idempotency_key = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=func.now())

class IntegrationConnection(Base):
    __tablename__ = "integration_connections"
    
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4())) # UUID
    org_id = Column(String, nullable=True)
    user_id = Column(String, nullable=True)
    provider = Column(String) # google_meet, zoom, google_calendar, email_smtp
    connection_status = Column(String, default="Not connected") # Connected, Not connected, Needs attention, Mock/Demo
    account_email = Column(String, nullable=True)
    encrypted_tokens = Column(Text, nullable=True)
    scopes = Column(String, nullable=True)
    last_sync_at = Column(DateTime, nullable=True)
    last_import_result = Column(String, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class AuditEvent(Base):
    __tablename__ = "audit_events"
    
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4())) # UUID
    org_id = Column(String, nullable=True)
    user_id = Column(String, nullable=True)
    actor_username = Column(String, default="System")
    entity_type = Column(String) # task, decision, meeting, calendar, notification, integration, automation
    entity_id = Column(String)
    action = Column(String) # CREATE, UPDATE, APPROVE, REJECT, REASSIGN, SYNC, SEND, TRIGGER
    previous_state = Column(Text, nullable=True)
    new_state = Column(Text, nullable=True)
    transcript_excerpt = Column(Text, nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=func.now())

class WorkflowRule(Base):
    __tablename__ = "workflow_rules"
    
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4())) # UUID
    org_id = Column(String, nullable=True)
    name = Column(String)
    description = Column(String, nullable=True)
    trigger_event = Column(String) # task_approved, deadline_approaching, task_blocked, member_absent, meeting_processed
    condition_json = Column(String, default="{}")
    action_type = Column(String) # create_calendar_event, send_notification, flag_risk, prepare_followup
    action_config = Column(String, default="{}")
    is_enabled = Column(Boolean, default=True)
    last_triggered_at = Column(DateTime, nullable=True)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=func.now())

class BackgroundJob(Base):
    __tablename__ = "background_jobs"
    
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4())) # UUID
    org_id = Column(String, nullable=True)
    job_type = Column(String) # calendar_sync, send_email, process_meeting_artifact, evaluate_rules
    payload = Column(Text) # JSON
    status = Column(String, default="QUEUED") # QUEUED, RUNNING, COMPLETED, FAILED
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    scheduled_at = Column(DateTime, default=func.now())
    idempotency_key = Column(String, unique=True, index=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4())) # UUID
    org_id = Column(String, nullable=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="Active") # Active, At Risk, Completed
    target_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now())
