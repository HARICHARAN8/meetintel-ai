import streamlit as st
from storage.database import SessionLocal
from storage import repository
from ui.components import safe_escape, render_status_badge

def render_sidebar_navigation():
    db = SessionLocal()
    try:
        user_id = st.session_state.get('user_id')
        user = repository.get_user_by_id(db, user_id) if user_id else None
        role = user.role if user else "Employee"
        full_name = user.full_name or st.session_state.get('username', 'User')
        username = user.username if user else st.session_state.get('username', 'user')

        # Brand Logo & Title Area
        st.sidebar.markdown(f"""
            <div class="sidebar-logo-container">
                <div class="sidebar-logo-icon">✦</div>
                <div class="sidebar-logo-text">
                    <div class="sidebar-logo-title">MeetIntel AI</div>
                    <div class="sidebar-logo-subtitle">Meeting-to-Execution</div>
                </div>
            </div>
            <div style="padding: 0 10px 10px 10px;">
                <div style="background: var(--mt-primary-light); border: 1px solid rgba(108, 77, 255, 0.15); border-radius: var(--mt-radius-md); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div style="font-size: 0.65rem; color: var(--mt-primary); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Workspace</div>
                        <div style="font-size: 0.84rem; color: var(--mt-text); font-weight: 700; line-height: 1.2;">Acme Global</div>
                    </div>
                    <div>{render_status_badge(role, 'status')}</div>
                </div>
            </div>
        """, unsafe_allow_html=True)

        # Hierarchical Navigation Structure matching Enterprise Information Architecture
        nav_sections = [
            {
                "header": "Workspace",
                "items": [
                    {"name": "Overview", "route": "Dashboard", "icon": "⊞"},
                    {"name": "My Commitments", "route": "My Work", "icon": "☑"},
                    {"name": "Meeting Library", "route": "Meetings", "icon": "🎙"},
                    {"name": "Process Meeting", "route": "New Meeting", "icon": "＋"},
                ]
            },
            {
                "header": "Planning & Intelligence",
                "items": [
                    {"name": "Projects & Milestones", "route": "Projects", "icon": "⚑"},
                    {"name": "Decision Register", "route": "Decisions", "icon": "⚖"},
                    {"name": "Meeting Preparation", "route": "Meeting Prep", "icon": "◷"},
                    {"name": "Organizational Knowledge", "route": "Knowledge Search", "icon": "✦"},
                ]
            },
            {
                "header": "Automation & Ecosystem",
                "items": [
                    {"name": "Calendar Schedule", "route": "Calendar", "icon": "📅"},
                    {"name": "Absentee Follow-ups", "route": "Follow-ups", "icon": "✉"},
                    {"name": "Workflow Automations", "route": "Automations", "icon": "⚡"},
                    {"name": "Integrations Center", "route": "Integrations", "icon": "🔌"},
                ]
            }
        ]

        # Governance Section (Admin and Team Lead)
        admin_items = [
            {"name": "Team Directory", "route": "Team & Organization", "icon": "👥"},
            {"name": "AI Quality & Benchmarks", "route": "AI Quality", "icon": "📈"},
            {"name": "Audit Trail & Logs", "route": "Audit Trail", "icon": "🛡"},
            {"name": "Preferences & Settings", "route": "Settings", "icon": "⚙"},
            {"name": "Help & Learning Guide", "route": "Help", "icon": "📖"},
        ]
        if role in ["Admin", "Team Lead"]:
            nav_sections.append({
                "header": "Governance",
                "items": admin_items
            })
        else:
            nav_sections.append({
                "header": "Governance",
                "items": [
                    {"name": "Preferences & Settings", "route": "Settings", "icon": "⚙"},
                    {"name": "Help & Learning Guide", "route": "Help", "icon": "📖"},
                ]
            })

        current_page = st.session_state.get('current_page', 'Dashboard')

        for sec in nav_sections:
            st.sidebar.markdown(f"<div class='sidebar-section-header'>{sec['header']}</div>", unsafe_allow_html=True)
            for it in sec["items"]:
                is_active = (
                    (current_page == it["route"]) or
                    (it["route"] == "Dashboard" and current_page in ["Dashboard", "Overview"]) or
                    (it["route"] == "My Work" and current_page in ["My Work", "My Tasks"]) or
                    (it["route"] == "Meetings" and current_page in ["Meetings", "Meeting Results"])
                )
                btn_label = f"{it['icon']}  {it['name']}"
                if st.sidebar.button(
                    btn_label,
                    key=f"nav_{it['route']}",
                    use_container_width=True,
                    type="primary" if is_active else "secondary"
                ):
                    st.session_state['current_page'] = it["route"]
                    st.rerun()

        # User Profile & Logout at Bottom
        initial = (full_name[0] if full_name else "U").upper()
        st.sidebar.markdown(f"""
            <div style="margin-top: 14px; padding: 12px 10px 4px 10px; border-top: 1px solid var(--mt-border);">
                <div style="display: flex; align-items: center; gap: 10px; padding: 4px 6px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--mt-primary); display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-weight: 700; font-size: 0.85rem; flex-shrink: 0;">
                        {safe_escape(initial)}
                    </div>
                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        <div style="font-size: 0.84rem; color: var(--mt-text); font-weight: 650; line-height: 1.2;">{safe_escape(full_name)}</div>
                        <div style="font-size: 0.72rem; color: var(--mt-text-secondary); font-weight: 500; margin-top: 2px;">@{safe_escape(username)}</div>
                    </div>
                </div>
            </div>
        """, unsafe_allow_html=True)
        
        if st.sidebar.button("Log out", key="nav_logout", use_container_width=True):
            from ui.auth import logout
            logout()
    finally:
        db.close()
