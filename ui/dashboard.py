import streamlit as st
import datetime
from storage.database import SessionLocal
from storage.repository import get_all_meetings, get_action_items, get_audit_trail, get_user_by_id
from storage.models import ActionItem, Deadline, Decision, User
from ui.components import metric_card, render_meeting_card, section_header, empty_state, render_status_badge, safe_escape, get_icon_svg

def render_dashboard():
    db = SessionLocal()
    try:
        user_id = st.session_state.get('user_id')
        user = get_user_by_id(db, user_id) if user_id else None
        role = user.role if user else "Employee"
        full_name = user.full_name or st.session_state.get('username', 'User')
        org_id = user.org_id if user else "org-default-001"

        now = datetime.datetime.now()
        current_hour = now.hour
        greeting = "Good morning" if current_hour < 12 else "Good afternoon" if current_hour < 18 else "Good evening"
        date_str = now.strftime("%A, %B %d, %Y")

        # Fetch User & Org Live Application Data
        user_tasks = get_action_items(db, user_id=user_id, org_id=org_id)
        org_tasks = get_action_items(db, org_id=org_id)
        meetings = get_all_meetings(db, org_id=org_id)
        
        pending_approvals = [t for t in org_tasks if t.approval_status != "Approved"]
        blocked_tasks = [t for t in org_tasks if t.status == "Blocked"]
        active_personal_tasks = [t for t in user_tasks if t.status in ["In Progress", "Approved", "Scheduled", "Pending"]]
        next_personal_task = active_personal_tasks[0] if active_personal_tasks else None

        # ---------------------------------------------------------------------------
        # 1. Executive Workspace Header
        # ---------------------------------------------------------------------------
        col_h1, col_h2 = st.columns([3.8, 1.4])
        with col_h1:
            st.markdown(
                f"<div style='display: flex; align-items: center; gap: 8px; margin-bottom: 6px;'>"
                f"<span style='font-size: 0.72rem; font-weight: 700; color: var(--mt-primary); letter-spacing: 0.08em; text-transform: uppercase;'>Acme Global</span>"
                f"<span style='color: var(--mt-border);'>•</span>"
                f"<span style='font-size: 0.78rem; color: var(--mt-text-secondary); font-weight: 500;'>{date_str}</span>"
                f"{render_status_badge(role, 'status')}"
                f"</div>",
                unsafe_allow_html=True
            )
            st.markdown(f"<h1 style='font-size: 1.85rem; font-weight: 750; color: var(--mt-text); margin: 0 0 4px 0; letter-spacing: -0.025em;'>{greeting}, {safe_escape(full_name)}</h1>", unsafe_allow_html=True)
            st.markdown("<p style='color: var(--mt-text-secondary); font-size: 0.92rem; margin: 0; line-height: 1.5;'>Convert meeting conversations into accountable action items, verified decisions, and calendar outcomes.</p>", unsafe_allow_html=True)
        with col_h2:
            st.markdown("<div style='height: 14px;'></div>", unsafe_allow_html=True)
            if st.button("＋ Process New Meeting", key="dash_btn_new_meeting", type="primary", use_container_width=True):
                st.session_state['current_page'] = "New Meeting"
                st.rerun()

        st.markdown("<div style='height: 20px;'></div>", unsafe_allow_html=True)

        # ---------------------------------------------------------------------------
        # 2. Executive KPI Metrics Cards (4-column row from live application data)
        # ---------------------------------------------------------------------------
        c1, c2, c3, c4 = st.columns(4)
        with c1:
            metric_card("My Commitments", str(len(user_tasks)), "check-circle", f"{len(active_personal_tasks)} active in progress")
        with c2:
            metric_card("Pending Approvals", str(len(pending_approvals)), "clock", f"{len(pending_approvals)} awaiting review")
        with c3:
            metric_card("Blockers & Risks", str(len(blocked_tasks)), "alert-triangle", f"{len(blocked_tasks)} active dependencies")
        with c4:
            metric_card("Sessions Processed", str(len(meetings)), "mic", f"{len(meetings)} meetings analyzed")

        st.markdown("<div style='height: 22px;'></div>", unsafe_allow_html=True)

        # ---------------------------------------------------------------------------
        # 3. Main Operational Working Canvas (Responsive 2-Column Grid)
        # ---------------------------------------------------------------------------
        q_col1, q_col2 = st.columns(2)

        # Column 1 - Top: What Should I Do Next? (Personal Queue)
        with q_col1:
            st.markdown("<h3 style='font-size: 1.05rem; font-weight: 700; color: var(--mt-text); margin-bottom: 10px;'>1. What Should I Do Next? <span style='font-size: 0.8rem; font-weight: 500; color: var(--mt-text-secondary);'>(Personal Queue)</span></h3>", unsafe_allow_html=True)
            if next_personal_task:
                with st.container(border=True):
                    st.markdown(
                        f"<div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;'>"
                        f"{render_status_badge('Immediate Priority', 'status')}"
                        f"<span style='font-size: 0.78rem; color: var(--mt-text-secondary);'>Task #{next_personal_task.id}</span>"
                        f"</div>",
                        unsafe_allow_html=True
                    )
                    st.markdown(f"<h4 style='color: var(--mt-text); margin: 0 0 6px 0; font-size: 1.05rem; font-weight: 700;'>{safe_escape(next_personal_task.task)}</h4>", unsafe_allow_html=True)
                    st.markdown(f"<p style='color: var(--mt-text-secondary); font-size: 0.88rem; line-height: 1.5; margin-bottom: 12px;'>{safe_escape(next_personal_task.description, default='Execute scheduled deliverable from meeting decisions.')}</p>", unsafe_allow_html=True)
                    
                    # Clean horizontal metadata row
                    st.markdown(
                        f"<div style='background: var(--mt-surface-soft); border-radius: var(--mt-radius-sm); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;'>"
                        f"<div><span style='font-size: 0.72rem; color: var(--mt-text-secondary); text-transform: uppercase; font-weight: 600;'>Target Deadline</span><div style='font-size: 0.88rem; font-weight: 600; color: var(--mt-text);'>{safe_escape(next_personal_task.deadline, default='TBD')}</div></div>"
                        f"<div><span style='font-size: 0.72rem; color: var(--mt-text-secondary); text-transform: uppercase; font-weight: 600;'>Priority</span><div style='font-size: 0.88rem; font-weight: 600; color: var(--mt-primary);'>{safe_escape(next_personal_task.priority, default='Normal')}</div></div>"
                        f"<div><span style='font-size: 0.72rem; color: var(--mt-text-secondary); text-transform: uppercase; font-weight: 600;'>Effort</span><div style='font-size: 0.88rem; font-weight: 600; color: var(--mt-text);'>{next_personal_task.estimated_effort_hours or 2.0}h</div></div>"
                        f"</div>",
                        unsafe_allow_html=True
                    )
                    
                    if st.button("View My Commitments →", key="dash_btn_my_tasks", type="primary", use_container_width=True):
                        st.session_state['current_page'] = "My Work"
                        st.rerun()
            else:
                with st.container(border=True):
                    empty_state("check-circle", "All Commitments Clear", "You have 0 pending deliverables assigned in this workspace.")

        # Column 2 - Top: What Is Due Soon? (Organization-Wide Scope)
        with q_col2:
            st.markdown("<h3 style='font-size: 1.05rem; font-weight: 700; color: var(--mt-text); margin-bottom: 10px;'>2. What Is Due Soon? <span style='font-size: 0.8rem; font-weight: 500; color: var(--mt-text-secondary);'>(Organization-Wide)</span></h3>", unsafe_allow_html=True)
            upcoming_items = [t for t in org_tasks if t.status not in ["Completed", "Rejected"] and t.deadline and t.deadline != "Not specified"][:3]
            if upcoming_items:
                with st.container(border=True):
                    for i, item in enumerate(upcoming_items):
                        if i > 0:
                            st.markdown("<div style='height: 1px; background: var(--mt-border); margin: 8px 0;'></div>", unsafe_allow_html=True)
                        col_u1, col_u2 = st.columns([3, 1.4])
                        with col_u1:
                            st.markdown(f"<strong style='color: var(--mt-text); font-size: 0.9rem;'>{safe_escape(item.task)}</strong>", unsafe_allow_html=True)
                            st.markdown(f"<span style='color: var(--mt-text-secondary); font-size: 0.78rem;'>Assignee: {safe_escape(item.assigned_to, default='Unassigned')} &nbsp;•&nbsp; {safe_escape(item.status)}</span>", unsafe_allow_html=True)
                        with col_u2:
                            st.markdown(f"<div style='text-align: right; color: var(--mt-primary); font-weight: 650; font-size: 0.84rem;'>📅 {safe_escape(item.deadline)}</div>", unsafe_allow_html=True)
                    st.markdown("<div style='height: 8px;'></div>", unsafe_allow_html=True)
                    if st.button("View Calendar Schedule →", key="dash_btn_open_cal", use_container_width=True):
                        st.session_state['current_page'] = "Calendar"
                        st.rerun()
            else:
                with st.container(border=True):
                    empty_state("calendar-clock", "No Upcoming Deadlines", "No active tasks have explicit due dates registered.")
                    if st.button("Open Calendar Schedule →", key="dash_btn_open_cal_empty", use_container_width=True):
                        st.session_state['current_page'] = "Calendar"
                        st.rerun()

        st.markdown("<div style='height: 16px;'></div>", unsafe_allow_html=True)

        q_col3, q_col4 = st.columns(2)

        # Column 1 - Bottom: What Needs Attention? (Risks & Governance)
        with q_col3:
            st.markdown("<h3 style='font-size: 1.05rem; font-weight: 700; color: var(--mt-text); margin-bottom: 10px;'>3. What Needs My Attention? <span style='font-size: 0.8rem; font-weight: 500; color: var(--mt-text-secondary);'>(Risks & Governance)</span></h3>", unsafe_allow_html=True)
            attention_items = []
            if blocked_tasks:
                attention_items.append((f"⚠️ <strong>{len(blocked_tasks)} Task(s) Blocked</strong> by dependency risks.", "My Work"))
            if pending_approvals:
                attention_items.append((f"⏱ <strong>{len(pending_approvals)} Action Item(s)</strong> awaiting leadership approval.", "My Work"))
            
            unassigned = [t for t in org_tasks if t.assignment_status == "Needs assignment"]
            if unassigned:
                attention_items.append((f"👤 <strong>{len(unassigned)} Action Item(s)</strong> require assignee confirmation.", "My Work"))

            with st.container(border=True):
                if attention_items:
                    for i, (text, target_route) in enumerate(attention_items):
                        if i > 0:
                            st.markdown("<div style='height: 1px; background: var(--mt-border); margin: 8px 0;'></div>", unsafe_allow_html=True)
                        col_att_t, col_att_b = st.columns([3.5, 1.2])
                        with col_att_t:
                            st.markdown(f"<div style='padding: 2px 0; font-size: 0.88rem; color: var(--mt-text);'>{text}</div>", unsafe_allow_html=True)
                        with col_att_b:
                            if st.button("Review", key=f"btn_att_{abs(hash(text))}", use_container_width=True):
                                st.session_state['current_page'] = target_route
                                st.rerun()
                else:
                    st.markdown("<div style='padding: 12px; text-align: center; color: var(--mt-success); font-weight: 600; font-size: 0.88rem;'>✓ All workflows and approvals are operating smoothly with 0 active blockers.</div>", unsafe_allow_html=True)

        # Column 2 - Bottom: Recent Meeting Activity
        with q_col4:
            st.markdown("<h3 style='font-size: 1.05rem; font-weight: 700; color: var(--mt-text); margin-bottom: 10px;'>4. Recent Meeting Activity</h3>", unsafe_allow_html=True)
            if meetings:
                top_m = meetings[0]
                with st.container(border=True):
                    col_rm1, col_rm2 = st.columns([3, 1.3])
                    with col_rm1:
                        m_date = top_m.date.strftime('%B %d, %Y') if top_m.date else 'Recent Session'
                        st.markdown(f"<span style='color: var(--mt-primary); font-size: 0.72rem; font-weight: 700; text-transform: uppercase;'>Latest Session • {m_date}</span>", unsafe_allow_html=True)
                        st.markdown(f"<h4 style='color: var(--mt-text); margin: 2px 0 4px 0; font-size: 1rem; font-weight: 700;'>{safe_escape(top_m.title)}</h4>", unsafe_allow_html=True)
                    with col_rm2:
                        st.markdown(f"<div style='text-align: right;'>{render_status_badge(top_m.processing_status, 'status')}</div>", unsafe_allow_html=True)

                    summary_text = top_m.executive_summary[:130] + "..." if (top_m.executive_summary and len(top_m.executive_summary) > 130) else (top_m.executive_summary or 'Session intelligence processed.')
                    st.markdown(f"<p style='color: var(--mt-text-secondary); font-size: 0.85rem; line-height: 1.45; margin-bottom: 10px;'>{safe_escape(summary_text)}</p>", unsafe_allow_html=True)
                    
                    col_m_sp, col_m_btn = st.columns([2, 1.4])
                    with col_m_sp:
                        st.markdown(f"<span style='color: var(--mt-text-secondary); font-size: 0.8rem; font-weight: 500;'>👥 {top_m.speaker_count or 0} Participants</span>", unsafe_allow_html=True)
                    with col_m_btn:
                        if st.button("Open Dossier →", key="btn_dash_top_m", use_container_width=True, type="primary"):
                            st.session_state['current_meeting_id'] = top_m.id
                            st.session_state['current_page'] = "Meeting Results"
                            st.rerun()
            else:
                with st.container(border=True):
                    empty_state("folder", "No Meetings Recorded", "Process your first recording to generate intelligence.", action_label="Upload Meeting", action_key="dash_empty_upload")

        # ---------------------------------------------------------------------------
        # 4. System & Automation Activity Log (Clean Feed with Light Dividers)
        # ---------------------------------------------------------------------------
        st.markdown("<h3 style='font-size: 1.1rem; font-weight: 700; color: var(--mt-text); margin-top: 26px; margin-bottom: 10px;'>System & Automation Activity Log</h3>", unsafe_allow_html=True)
        events = get_audit_trail(db, org_id=org_id, limit=5)
        if events:
            with st.container(border=True):
                for i, ev in enumerate(events):
                    if i > 0:
                        st.markdown("<div style='height: 1px; background: var(--mt-border); margin: 8px 0;'></div>", unsafe_allow_html=True)
                    ts = ev.timestamp.strftime("%b %d, %H:%M") if ev.timestamp else "Recently"
                    col_ev_a, col_ev_b = st.columns([3.8, 1.2])
                    with col_ev_a:
                        st.markdown(f"<strong style='color: var(--mt-text); font-size: 0.88rem;'>[{safe_escape(ev.action)}]</strong> <span style='color: var(--mt-text-secondary); font-size: 0.86rem;'>{safe_escape(ev.details, default='System event recorded')}</span>", unsafe_allow_html=True)
                    with col_ev_b:
                        st.markdown(f"<div style='text-align: right; color: var(--mt-text-secondary); font-size: 0.78rem;'>{ts} • {safe_escape(ev.actor_username)}</div>", unsafe_allow_html=True)
        else:
            with st.container(border=True):
                st.caption("No automation events logged in this organization session yet.")
    finally:
        db.close()
