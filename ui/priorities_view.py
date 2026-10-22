import streamlit as st
import html
from storage.database import get_db, SessionLocal
from storage.models import Priority, ActionItem
from storage import repository
from ui.components import section_header, empty_state, render_status_badge, safe_escape, get_icon_svg

def render_priorities_tab(meeting_id):
    section_header(
        "Eisenhower Priority Matrix & Strategic Initiatives",
        "Prioritize meeting commitments across urgency and importance, and review dialogue initiatives.",
        category="Meeting Deliverables"
    )
    
    db = SessionLocal()
    try:
        tasks = db.query(ActionItem).filter(ActionItem.meeting_id == meeting_id).all()
        priorities = db.query(Priority).filter(Priority.meeting_id == meeting_id).all()
        
        # 1. 2x2 Eisenhower Matrix for Action Items
        st.markdown("<h4 style='color: var(--mt-text); margin: 12px 0 6px 0; font-weight: 700; font-size: 1.1rem;'>✦ Interactive Eisenhower Action Matrix</h4>", unsafe_allow_html=True)
        st.caption("Drag/classify commitments by urgency and importance to establish immediate versus scheduled execution focus.")
        
        q1_tasks = [t for t in tasks if t.quadrant == "Do First"]
        q2_tasks = [t for t in tasks if t.quadrant == "Schedule"]
        q3_tasks = [t for t in tasks if t.quadrant == "Delegate"]
        q4_tasks = [t for t in tasks if t.quadrant == "Defer"]
        unclass_tasks = [t for t in tasks if t.quadrant == "Unclassified"]

        # 2x2 Layout
        col_m1, col_m2 = st.columns(2)
        
        with col_m1:
            # Q1: Do First
            with st.container(border=True):
                st.markdown(
                    f"<div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;'>"
                    f"<strong style='color: #E11D48; font-size: 0.92rem;'>Q1: DO FIRST</strong>"
                    f"<span style='background: rgba(225,29,72,0.12); color: #E11D48; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700;'>{len(q1_tasks)}</span>"
                    f"</div>"
                    f"<div style='font-size: 0.72rem; color: var(--mt-text-secondary); margin-bottom: 10px;'>Urgent + Important • Execute immediately</div>",
                    unsafe_allow_html=True
                )
                if not q1_tasks:
                    st.caption("No tasks in this quadrant.")
                for t in q1_tasks:
                    with st.expander(f"🔴 {t.task[:45]}...", expanded=False):
                        st.write(t.description or "No extended description")
                        st.caption(f"Owner: {t.assigned_to} • Deadline: {t.deadline or 'TBD'}")
                        new_q = st.selectbox("Reclassify Quadrant", ["Do First", "Schedule", "Delegate", "Defer"], index=0, key=f"q1_reclass_{t.id}")
                        if new_q != "Do First":
                            u = "Not Urgent" if new_q in ["Schedule", "Defer"] else "Urgent"
                            i = "Important" if new_q in ["Do First", "Schedule"] else "Not Important"
                            repository.update_action_item_matrix(db, t.id, u, i, actor_user_id=st.session_state.get('user_id'))
                            st.rerun()

            # Q3: Delegate
            with st.container(border=True):
                st.markdown(
                    f"<div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;'>"
                    f"<strong style='color: #D97706; font-size: 0.92rem;'>Q3: DELEGATE</strong>"
                    f"<span style='background: rgba(217,119,6,0.12); color: #D97706; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700;'>{len(q3_tasks)}</span>"
                    f"</div>"
                    f"<div style='font-size: 0.72rem; color: var(--mt-text-secondary); margin-bottom: 10px;'>Urgent + Not Important • Reassign to team members</div>",
                    unsafe_allow_html=True
                )
                if not q3_tasks:
                    st.caption("No tasks in this quadrant.")
                for t in q3_tasks:
                    with st.expander(f"🟠 {t.task[:45]}...", expanded=False):
                        st.write(t.description or "No extended description")
                        st.caption(f"Owner: {t.assigned_to} • Deadline: {t.deadline or 'TBD'}")
                        new_q = st.selectbox("Reclassify Quadrant", ["Do First", "Schedule", "Delegate", "Defer"], index=2, key=f"q3_reclass_{t.id}")
                        if new_q != "Delegate":
                            u = "Not Urgent" if new_q in ["Schedule", "Defer"] else "Urgent"
                            i = "Important" if new_q in ["Do First", "Schedule"] else "Not Important"
                            repository.update_action_item_matrix(db, t.id, u, i, actor_user_id=st.session_state.get('user_id'))
                            st.rerun()

        with col_m2:
            # Q2: Schedule
            with st.container(border=True):
                st.markdown(
                    f"<div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;'>"
                    f"<strong style='color: #2563EB; font-size: 0.92rem;'>Q2: SCHEDULE</strong>"
                    f"<span style='background: rgba(37,99,235,0.12); color: #2563EB; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700;'>{len(q2_tasks)}</span>"
                    f"</div>"
                    f"<div style='font-size: 0.72rem; color: var(--mt-text-secondary); margin-bottom: 10px;'>Not Urgent + Important • Plan on calendar</div>",
                    unsafe_allow_html=True
                )
                if not q2_tasks:
                    st.caption("No tasks in this quadrant.")
                for t in q2_tasks:
                    with st.expander(f"🔵 {t.task[:45]}...", expanded=False):
                        st.write(t.description or "No extended description")
                        st.caption(f"Owner: {t.assigned_to} • Deadline: {t.deadline or 'TBD'}")
                        new_q = st.selectbox("Reclassify Quadrant", ["Do First", "Schedule", "Delegate", "Defer"], index=1, key=f"q2_reclass_{t.id}")
                        if new_q != "Schedule":
                            u = "Not Urgent" if new_q in ["Schedule", "Defer"] else "Urgent"
                            i = "Important" if new_q in ["Do First", "Schedule"] else "Not Important"
                            repository.update_action_item_matrix(db, t.id, u, i, actor_user_id=st.session_state.get('user_id'))
                            st.rerun()

            # Q4: Defer / Eliminate
            with st.container(border=True):
                st.markdown(
                    f"<div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;'>"
                    f"<strong style='color: #64748B; font-size: 0.92rem;'>Q4: DEFER OR ELIMINATE</strong>"
                    f"<span style='background: rgba(100,116,139,0.12); color: #64748B; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 700;'>{len(q4_tasks)}</span>"
                    f"</div>"
                    f"<div style='font-size: 0.72rem; color: var(--mt-text-secondary); margin-bottom: 10px;'>Not Urgent + Not Important • Backlog or drop</div>",
                    unsafe_allow_html=True
                )
                if not q4_tasks:
                    st.caption("No tasks in this quadrant.")
                for t in q4_tasks:
                    with st.expander(f"⚪ {t.task[:45]}...", expanded=False):
                        st.write(t.description or "No extended description")
                        st.caption(f"Owner: {t.assigned_to} • Deadline: {t.deadline or 'TBD'}")
                        new_q = st.selectbox("Reclassify Quadrant", ["Do First", "Schedule", "Delegate", "Defer"], index=3, key=f"q4_reclass_{t.id}")
                        if new_q != "Defer":
                            u = "Not Urgent" if new_q in ["Schedule", "Defer"] else "Urgent"
                            i = "Important" if new_q in ["Do First", "Schedule"] else "Not Important"
                            repository.update_action_item_matrix(db, t.id, u, i, actor_user_id=st.session_state.get('user_id'))
                            st.rerun()

        # Unclassified section
        if unclass_tasks:
            st.markdown("<div style='height: 10px;'></div>", unsafe_allow_html=True)
            with st.container(border=True):
                st.markdown(f"<strong style='color: #D97706;'>⚠ Unclassified Tasks ({len(unclass_tasks)} Awaiting Quadrant Placement)</strong>", unsafe_allow_html=True)
                for t in unclass_tasks:
                    col_u1, col_u2 = st.columns([3, 1.5])
                    with col_u1:
                        st.markdown(f"**{safe_escape(t.task)}**")
                        st.caption(f"Assignee: {safe_escape(t.assigned_to)} | Deadline: {safe_escape(t.deadline or 'TBD')}")
                    with col_u2:
                        chosen_q = st.selectbox("Assign Quadrant", ["Select...", "Do First", "Schedule", "Delegate", "Defer"], key=f"unclass_{t.id}")
                        if chosen_q != "Select...":
                            u = "Not Urgent" if chosen_q in ["Schedule", "Defer"] else "Urgent"
                            i = "Important" if chosen_q in ["Do First", "Schedule"] else "Not Important"
                            repository.update_action_item_matrix(db, t.id, u, i, actor_user_id=st.session_state.get('user_id'))
                            st.rerun()

        # 2. Raw Identified Priorities from Dialogue
        st.markdown("<div style='height: 18px;'></div>", unsafe_allow_html=True)
        st.markdown("<h4 style='color: var(--mt-text); margin: 0 0 6px 0; font-weight: 700; font-size: 1.1rem;'>Strategic Initiatives Identified in Dialogue</h4>", unsafe_allow_html=True)
        
        if not priorities:
            empty_state("target", "No priorities identified", "No explicit priorities were identified in this meeting.")
        else:
            with st.container(border=True):
                for idx, p in enumerate(priorities):
                    if idx > 0:
                        st.markdown("<div style='height: 1px; background: var(--mt-border); margin: 10px 0;'></div>", unsafe_allow_html=True)
                    col_p1, col_p2 = st.columns([3.5, 1.2])
                    with col_p1:
                        st.markdown(f"<h4 style='color: var(--mt-text); margin: 0; font-weight: 700; font-size: 1.05rem;'>{safe_escape(p.item)}</h4>", unsafe_allow_html=True)
                    with col_p2:
                        st.markdown(f"<div style='text-align: right;'>{render_status_badge(p.priority_level, 'status')}</div>", unsafe_allow_html=True)
    finally:
        db.close()
