import os
import uuid
import sqlite3
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger(__name__)

# Define database URL (supports PostgreSQL or SQLite)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///meetintel.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db(target_engine=None, target_session=None):
    active_engine = target_engine or engine
    # 1. Create all newly defined tables if they do not exist
    from . import models
    Base.metadata.create_all(bind=active_engine)
    
    # 2. Safe schema migration for SQLite column extensions
    if not target_engine and DATABASE_URL.startswith("sqlite"):
        db_path = DATABASE_URL.replace("sqlite:///", "")
        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                
                # Helper to add missing column
                def ensure_column(table, column, col_type):
                    cursor.execute(f"PRAGMA table_info({table})")
                    cols = [info[1] for info in cursor.fetchall()]
                    if column not in cols:
                        logger.info(f"Safe migration: Adding '{column}' ({col_type}) to '{table}'")
                        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
                        conn.commit()

                # Users extensions
                ensure_column("users", "org_id", "VARCHAR REFERENCES organizations(id)")
                ensure_column("users", "role", "VARCHAR DEFAULT 'Employee'")
                ensure_column("users", "full_name", "VARCHAR")
                ensure_column("users", "department", "VARCHAR")
                ensure_column("users", "timezone", "VARCHAR DEFAULT 'UTC'")
                ensure_column("users", "theme_preference", "VARCHAR DEFAULT 'System'")

                # Meetings extensions
                ensure_column("meetings", "user_id", "VARCHAR REFERENCES users(id)")
                ensure_column("meetings", "org_id", "VARCHAR REFERENCES organizations(id)")
                ensure_column("meetings", "source_platform", "VARCHAR DEFAULT 'upload'")
                ensure_column("meetings", "external_meeting_id", "VARCHAR")

                # ActionItems extensions
                ensure_column("action_items", "org_id", "VARCHAR")
                ensure_column("action_items", "description", "TEXT")
                ensure_column("action_items", "evidence_excerpt", "TEXT")
                ensure_column("action_items", "assigned_user_id", "VARCHAR REFERENCES users(id)")
                ensure_column("action_items", "assignment_status", "VARCHAR DEFAULT 'Assigned'")
                ensure_column("action_items", "approval_status", "VARCHAR DEFAULT 'Draft'")
                ensure_column("action_items", "approved_by_user_id", "VARCHAR REFERENCES users(id)")
                ensure_column("action_items", "approved_at", "DATETIME")
                ensure_column("action_items", "confidence", "FLOAT DEFAULT 1.0")
                ensure_column("action_items", "estimated_effort_hours", "FLOAT")
                ensure_column("action_items", "dependencies", "VARCHAR DEFAULT '[]'")
                ensure_column("action_items", "completion_notes", "TEXT")
                ensure_column("action_items", "project_id", "VARCHAR")
                ensure_column("action_items", "urgency", "VARCHAR")
                ensure_column("action_items", "importance", "VARCHAR")
                ensure_column("action_items", "created_at", "DATETIME")
                ensure_column("action_items", "updated_at", "DATETIME")

                # Decisions extensions
                ensure_column("decisions", "org_id", "VARCHAR")
                ensure_column("decisions", "title", "VARCHAR")
                ensure_column("decisions", "rationale", "TEXT")
                ensure_column("decisions", "alternatives", "TEXT")
                ensure_column("decisions", "evidence_excerpt", "TEXT")
                ensure_column("decisions", "confidence", "FLOAT DEFAULT 1.0")
                ensure_column("decisions", "status", "VARCHAR DEFAULT 'Approved'")
                ensure_column("decisions", "proposer", "VARCHAR")
                ensure_column("decisions", "approver_id", "VARCHAR")
                ensure_column("decisions", "approved_at", "DATETIME")
                ensure_column("decisions", "superseded_by_id", "INTEGER")
                ensure_column("decisions", "related_task_ids", "VARCHAR DEFAULT '[]'")
                ensure_column("decisions", "created_at", "DATETIME")

                conn.close()
            except Exception as e:
                logger.error(f"Schema migration error: {e}")

    # 3. Seed Organization & Base Users
    db = target_session() if target_session else SessionLocal()
    try:
        from .models import Organization, User, Meeting, ActionItem
        from .auth import hash_password

        # Seed Default Organization
        default_org = db.query(Organization).filter(Organization.id == "org-default-001").first()
        if not default_org:
            default_org = Organization(
                id="org-default-001",
                name="Acme Global Technologies",
                domain="acmeglobal.io"
            )
            db.add(default_org)
            db.commit()

        # Seed or Update Admin User (Guarded against hardcoded default credentials in production)
        is_production = os.getenv("ENV", "").lower() in ["production", "prod"] or os.getenv("PRODUCTION", "false").lower() == "true"
        admin_pwd = os.getenv("ADMIN_PASSWORD")
        force_reset = os.getenv("FORCE_ADMIN_PASSWORD_RESET", "false").lower() == "true"
        placeholders = {"your-secure-admin-password", "placeholder", "changeme", "change-me", "password", "admin"}
        
        is_placeholder = (admin_pwd or "").strip() in placeholders
        valid_custom_pwd = admin_pwd and not is_placeholder and len(admin_pwd.strip()) >= 8

        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            if is_production and not valid_custom_pwd:
                logger.warning("PRODUCTION ENVIRONMENT DETECTED: ADMIN_PASSWORD environment variable is not configured. Default admin account creation skipped to prevent security vulnerability.")
            else:
                effective_pwd = admin_pwd if valid_custom_pwd else "admin123"
                admin = User(
                    id=str(uuid.uuid4()),
                    org_id=default_org.id,
                    username="admin",
                    email=os.getenv("ADMIN_EMAIL", "admin@meetintel.ai"),
                    role="Admin",
                    full_name="System Administrator",
                    department="Operations",
                    hashed_password=hash_password(effective_pwd)
                )
                db.add(admin)
                db.commit()
                db.refresh(admin)
        else:
            if not admin.org_id:
                admin.org_id = default_org.id
            if admin.role != "Admin":
                admin.role = "Admin"
            if not admin.full_name:
                admin.full_name = "System Administrator"
            
            # Sync password if explicit reset requested OR in development with a valid non-placeholder password
            from .auth import verify_password
            should_sync = (force_reset and valid_custom_pwd) or (not is_production and valid_custom_pwd and not verify_password(admin_pwd.strip(), admin.hashed_password))
            if should_sync:
                logger.info("Syncing administrator credentials with environment configuration.")
                admin.hashed_password = hash_password(admin_pwd.strip())
            db.commit()

        # Seed Team Lead User
        lead = db.query(User).filter(User.username == "sarah_lead").first()
        if not lead:
            lead = User(
                id=str(uuid.uuid4()),
                org_id=default_org.id,
                username="sarah_lead",
                email="sarah.lead@acmeglobal.io",
                role="Team Lead",
                full_name="Sarah Jenkins",
                department="Engineering",
                hashed_password=hash_password("password123")
            )
            db.add(lead)
            db.commit()

        # Seed Employee User
        emp = db.query(User).filter(User.username == "alex_eng").first()
        if not emp:
            emp = User(
                id=str(uuid.uuid4()),
                org_id=default_org.id,
                username="alex_eng",
                email="alex.chen@acmeglobal.io",
                role="Employee",
                full_name="Alex Chen",
                department="Frontend Engineering",
                hashed_password=hash_password("password123")
            )
            db.add(emp)
            db.commit()

        # Seed Secondary Employee for multi-user collaboration
        emp2 = db.query(User).filter(User.username == "priya_qa").first()
        if not emp2:
            emp2 = User(
                id=str(uuid.uuid4()),
                org_id=default_org.id,
                username="priya_qa",
                email="priya.sharma@acmeglobal.io",
                role="Employee",
                full_name="Priya Sharma",
                department="Quality Assurance",
                hashed_password=hash_password("password123")
            )
            db.add(emp2)
            db.commit()

        # Assign default org to any user lacking an org_id
        unlinked_users = db.query(User).filter(User.org_id == None).all()
        for u in unlinked_users:
            u.org_id = default_org.id

        # Migrate existing meetings and tasks to default org
        unlinked_meetings = db.query(Meeting).filter(Meeting.org_id == None).all()
        for m in unlinked_meetings:
            m.org_id = default_org.id
            if not m.user_id:
                m.user_id = admin.id

        unlinked_tasks = db.query(ActionItem).filter(ActionItem.org_id == None).all()
        for t in unlinked_tasks:
            t.org_id = default_org.id

        db.commit()
    except Exception as e:
        logger.error(f"Database seed/migration error: {e}")
        db.rollback()
    finally:
        db.close()
