import streamlit as st
import os
import html
from dotenv import load_dotenv

from storage.database import init_db

# Load environment variables
load_dotenv()

# Import models to ensure they are registered with Base
import storage.models

# Initialize Database
init_db()

st.set_page_config(
    page_title="MeetIntel AI",
    page_icon="🎙️",
    layout="wide",
    initial_sidebar_state="expanded",
)

from ui.styles import apply_global_styles
from ui.navigation import render_sidebar_navigation
from ui.components import render_status_badge, safe_escape, get_icon_svg

def main():
    apply_global_styles()
    
    # Check for OAuth callback returned to Streamlit
    if "code" in st.query_params:
        auth_code = st.query_params.get("code")
        if auth_code:
            from storage.database import SessionLocal
            from integrations.google_workspace import GoogleWorkspaceIntegration
            cb_db = SessionLocal()
            try:
                gw = GoogleWorkspaceIntegration()
                cb_res = gw.exchange_code(cb_db, auth_code)
                if cb_res.get("status") == "success":
                    st.toast(f"Google Workspace connected successfully ({cb_res.get('email', 'Authorized')})!")
                    st.session_state['current_page'] = "Integrations"
                    st.query_params.clear()
                else:
                    st.error(f"Google authorization failed: {cb_res.get('message')}")
            except Exception as e:
                st.error(f"OAuth exchange error: {e}")
            finally:
                cb_db.close()
    
    # Check authentication - strict gate against unauthenticated access
    if not st.session_state.get('user_id'):
        from ui.auth import render_login_page
        render_login_page()
        return
        
    # Initialize session state for navigation
    if 'current_page' not in st.session_state:
        st.session_state['current_page'] = "Dashboard"
        
    render_sidebar_navigation()
        
    page = st.session_state['current_page']
    
    # Routed pages matching enterprise information architecture
    if page in ["Dashboard", "Overview"]:
        from ui.dashboard import render_dashboard
        render_dashboard()
    elif page in ["My Work", "My Tasks"]:
        from ui.my_tasks import render_my_tasks_page
        render_my_tasks_page()
    elif page == "New Meeting":
        from ui.upload import render_upload_page
        render_upload_page()
    elif page == "Processing":
        from ui.meeting import render_processing_page
        render_processing_page()
    elif page == "Meetings":
        from ui.meetings_list import render_meetings_list
        render_meetings_list()
    elif page in ["Projects", "Projects & Milestones"]:
        from ui.projects_view import render_projects_page
        render_projects_page()
    elif page in ["Decisions"]:
        from ui.decision_register import render_decision_register_page
        render_decision_register_page()
    elif page in ["Meeting Prep", "Meeting Preparation"]:
        from ui.meeting_prep import render_meeting_prep_page
        render_meeting_prep_page()
    elif page in ["Knowledge Search", "Organizational Knowledge"]:
        from ui.knowledge_search import render_knowledge_search_page
        render_knowledge_search_page()
    elif page in ["Calendar", "Calendar Schedule"]:
        from ui.calendar_view import render_calendar_page
        render_calendar_page()
    elif page in ["Follow-ups", "Absentee Follow-ups", "Calendar & Follow-ups"]:
        from ui.followups_view import render_followups_page
        render_followups_page()
    elif page in ["Automations"]:
        from ui.automations_view import render_automations_page
        render_automations_page()
    elif page in ["Integrations"]:
        from ui.integrations_center import render_integrations_page
        render_integrations_page()
    elif page in ["Team & Organization"]:
        from ui.team_view import render_team_page
        render_team_page()
    elif page in ["AI Quality", "AI Quality & Evaluation"]:
        from ui.quality_center import render_quality_center_page
        render_quality_center_page()
    elif page in ["Audit Trail"]:
        from ui.audit_view import render_audit_page
        render_audit_page()
    elif page in ["Settings"]:
        from ui.settings import render_settings_page
        render_settings_page()
    elif page in ["Help", "Help & Learning Guide"]:
        from ui.help_view import render_help_page
        render_help_page()
    elif page == "Meeting Results":
        if 'current_meeting_id' not in st.session_state:
            st.error("No active meeting selected.")
            return
            
        meeting_id = st.session_state['current_meeting_id']
        from storage.database import SessionLocal
        from storage.repository import get_meeting
        
        db = SessionLocal()
        try:
            meeting = get_meeting(db, meeting_id, user_id=st.session_state.get('user_id'))
            
            if not meeting:
                st.error("Meeting not found.")
                return
                
            duration_str = f"{int(meeting.duration)//60}m {int(meeting.duration)%60}s"
            
            col_nav, _ = st.columns([1.8, 3.5])
            with col_nav:
                if st.button("← Back to Meeting Library", key="btn_back_to_meetings"):
                    st.session_state['current_page'] = "Meetings"
                    st.rerun()

            with st.container(border=True):
                col_mr1, col_mr2 = st.columns([3.5, 1.5])
                with col_mr1:
                    raw_source = getattr(meeting, 'source_platform', 'upload') or 'upload'
                    src_lbl = "Google Meet" if "meet" in str(raw_source).lower() else "Zoom" if "zoom" in str(raw_source).lower() else "Audio Upload"
                    cal_svg = get_icon_svg("calendar", size=14, color="#73809A")
                    clock_svg = get_icon_svg("clock", size=14, color="#73809A")
                    users_svg = get_icon_svg("users", size=14, color="#73809A")
                    st.caption(f"INTELLIGENCE DOSSIER • {src_lbl.upper()}")
                    st.markdown(f"<h2 style='margin: 0 0 6px 0; font-size: 1.6rem; font-weight: 750; color: var(--mt-text); letter-spacing: -0.02em;'>{safe_escape(meeting.title)}</h2>", unsafe_allow_html=True)
                    st.markdown(
                        f"<div style='display: flex; align-items: center; gap: 14px; font-size: 0.85rem; color: var(--mt-text-secondary); font-weight: 500;'>"
                        f"<span style='display: inline-flex; align-items: center; gap: 4px;'>{cal_svg} {meeting.date.strftime('%B %d, %Y')}</span>"
                        f"<span style='display: inline-flex; align-items: center; gap: 4px;'>{clock_svg} {duration_str}</span>"
                        f"<span style='display: inline-flex; align-items: center; gap: 4px;'>{users_svg} {meeting.speaker_count} Speakers</span>"
                        f"</div>",
                        unsafe_allow_html=True
                    )
                with col_mr2:
                    st.markdown(f"<div style='text-align: right;'>{render_status_badge(meeting.processing_status, 'status')}</div>", unsafe_allow_html=True)

            st.markdown("<div style='height: 10px;'></div>", unsafe_allow_html=True)

            tab1, tab2, tab3, tab4, tab5, tab6, tab7, tab8 = st.tabs(["Overview", "Action Items", "Participants", "Deadlines", "Priorities", "Transcript", "Ask AI", "MoM"])
            
            with tab1:
                from ui.insights_view import render_insights_tab
                render_insights_tab(meeting)
                
            with tab2:
                from ui.action_items import render_action_items_tab
                render_action_items_tab(meeting.id)
                
            with tab3:
                from ui.participants_view import render_participants_tab
                render_participants_tab(meeting.id)
                
            with tab4:
                from ui.deadlines_view import render_deadlines_tab
                render_deadlines_tab(meeting.id)
                
            with tab5:
                from ui.priorities_view import render_priorities_tab
                render_priorities_tab(meeting.id)
                
            with tab6:
                from ui.transcript_view import render_transcript_tab
                render_transcript_tab(meeting.id)
                
            with tab7:
                from ui.ask_ai import render_ask_ai_tab
                render_ask_ai_tab(meeting.id)
                
            with tab8:
                from ui.mom import render_mom_tab
                render_mom_tab(meeting)
        finally:
            db.close()
            
    elif page == "Transcripts":
        from ui.transcripts_list import render_transcripts_list
        render_transcripts_list()
            
    else:
        st.info(f"Page '{page}' is under construction.")
    
if __name__ == "__main__":
    main()
