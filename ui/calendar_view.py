import streamlit as st
import datetime
import calendar
from storage.database import SessionLocal
from storage.models import Meeting, ActionItem, CalendarEvent, User, IntegrationConnection
from storage import repository
from integrations.google_workspace import GoogleWorkspaceIntegration
from ui.components import (
    page_header,
    empty_state,
    render_status_badge,
    safe_escape,
    get_icon_svg,
)

def render_calendar_page():
    db = SessionLocal()
    try:
        user_id = st.session_state.get('user_id')
        user = repository.get_user_by_id(db, user_id) if user_id else None
        role = user.role if user else "Employee"
        org_id = user.org_id if user else "org-default-001"

        # ---------------------------------------------------------------------------
        # Google Workspace Integration State
        # ---------------------------------------------------------------------------
        gw = GoogleWorkspaceIntegration(org_id=org_id)
        conn = repository.get_integration_connection(db, provider="google_calendar", org_id=org_id)
        is_connected = bool(conn and "Connected" in (conn.connection_status or ""))
        account_email = conn.account_email if conn else (gw.service_account_email or "system@meetintel.ai")

        badge_txt = "Connected (Cloud Synced)" if is_connected else "Local Calendar (Not Connected)"
        badge_type = "success" if is_connected else "warning"

        page_header(
            title="Calendar & Executive Schedule",
            subtitle="Organize meeting dialogues and action-item commitments in one unified timeline with two-way Google Calendar synchronization.",
            category="Ecosystem Orchestration",
            badge_text=badge_txt,
            badge_type=badge_type,
            icon="calendar"
        )

        # ---------------------------------------------------------------------------
        # Top Action & Sync Bar
        # ---------------------------------------------------------------------------
        with st.container(border=True):
            col_sb1, col_sb2, col_sb3 = st.columns([2.5, 1.2, 1.3])
            with col_sb1:
                cal_svg = get_icon_svg("calendar", size=18, color="#6C4DFF")
                status_color = "#169B69" if is_connected else "#D98A16"
                st.markdown(
                    f"<div style='display: flex; align-items: center; gap: 10px; margin-top: 4px;'>"
                    f"<span>{cal_svg}</span>"
                    f"<div>"
                    f"<strong style='color: var(--mt-text); font-size: 0.92rem;'>Google Calendar: <span style='color: {status_color};'>{conn.connection_status if conn else 'Disconnected'}</span></strong>"
                    f"<div style='color: var(--mt-text-secondary); font-size: 0.76rem;'>Account: {safe_escape(account_email)} • Scopes: <code>calendar.events</code></div>"
                    f"</div>"
                    f"</div>",
                    unsafe_allow_html=True
                )
            with col_sb2:
                if st.button("🔄 Sync Now", key="btn_cal_sync_now", use_container_width=True, help="Scan and schedule approved action items on Google Calendar"):
                    try:
                        synced_count = gw.sync_all_approved_tasks(db)
                        st.toast(f"Synchronized {synced_count} commitments with Google Calendar.")
                        st.rerun()
                    except Exception as e:
                        st.error(f"Sync error: {e}")
            with col_sb3:
                if is_connected:
                    if st.button("Disconnect", key="btn_cal_disconnect", use_container_width=True):
                        gw.disconnect(db, provider="google_calendar")
                        st.toast("Google Calendar disconnected.")
                        st.rerun()
                else:
                    auth_url = gw.get_auth_url(state="meetintel_cal_sync")
                    if gw.demo_mode or not gw.is_configured():
                        if st.button("Connect Account (Demo)", key="btn_cal_connect_demo", type="primary", use_container_width=True):
                            gw.exchange_code(db, "demo_auth_code_xyz")
                            st.toast("Connected in verified Demo mode.")
                            st.rerun()
                    else:
                        st.markdown(
                            f"<a href='{auth_url}' target='_blank' style='display: block; text-align: center; background: var(--mt-primary); color: white; padding: 7px 12px; border-radius: var(--mt-radius-md); font-weight: 600; font-size: 0.85rem; text-decoration: none;'>Connect Google Calendar</a>",
                            unsafe_allow_html=True
                        )

        # ---------------------------------------------------------------------------
        # Navigation & Date State
        # ---------------------------------------------------------------------------
        if 'cal_view_mode' not in st.session_state:
            st.session_state['cal_view_mode'] = "Month View"
        if 'cal_current_date' not in st.session_state:
            st.session_state['cal_current_date'] = datetime.date(2026, 10, 23)
        if 'cal_selected_date' not in st.session_state:
            st.session_state['cal_selected_date'] = datetime.date(2026, 10, 23)

        curr_d = st.session_state['cal_current_date']

        col_nav1, col_nav2, col_nav3 = st.columns([2.5, 1.5, 1.8])
        with col_nav1:
            st.markdown(f"<h3 style='margin: 0; color: var(--mt-text); font-weight: 750; font-size: 1.25rem;'>{curr_d.strftime('%B %Y')}</h3>", unsafe_allow_html=True)
            st.caption(f"Selected Day: {st.session_state['cal_selected_date'].strftime('%A, %B %d, %Y')}")
        with col_nav2:
            prev_col, today_col, next_col = st.columns([1, 1.2, 1])
            with prev_col:
                if st.button("◀", key="cal_prev_btn", use_container_width=True):
                    if st.session_state['cal_view_mode'] == "Month View":
                        year = curr_d.year - (1 if curr_d.month == 1 else 0)
                        month = 12 if curr_d.month == 1 else curr_d.month - 1
                        st.session_state['cal_current_date'] = datetime.date(year, month, 1)
                    else:
                        st.session_state['cal_current_date'] = curr_d - datetime.timedelta(days=7)
                    st.rerun()
            with today_col:
                if st.button("Today", key="cal_today_btn", use_container_width=True):
                    st.session_state['cal_current_date'] = datetime.date(2026, 10, 23)
                    st.session_state['cal_selected_date'] = datetime.date(2026, 10, 23)
                    st.rerun()
            with next_col:
                if st.button("▶", key="cal_next_btn", use_container_width=True):
                    if st.session_state['cal_view_mode'] == "Month View":
                        year = curr_d.year + (1 if curr_d.month == 12 else 0)
                        month = 1 if curr_d.month == 12 else curr_d.month + 1
                        st.session_state['cal_current_date'] = datetime.date(year, month, 1)
                    else:
                        st.session_state['cal_current_date'] = curr_d + datetime.timedelta(days=7)
                    st.rerun()
        with col_nav3:
            v_mode = st.radio(
                "View Mode",
                ["Month View", "Week View", "Agenda View"],
                horizontal=True,
                label_visibility="collapsed",
                key="cal_v_mode_radio"
            )
            if v_mode != st.session_state['cal_view_mode']:
                st.session_state['cal_view_mode'] = v_mode
                st.rerun()

        # ---------------------------------------------------------------------------
        # Fetch Real Data Entities: Meetings, Tasks, Calendar Events
        # ---------------------------------------------------------------------------
        all_meetings = repository.get_all_meetings(db, org_id=org_id)
        all_tasks = repository.get_action_items(db, org_id=org_id)
        cal_events = db.query(CalendarEvent).all()

        # Map by Date YYYY-MM-DD
        events_by_date = {}

        # 1. Meetings
        for m in all_meetings:
            if m.date:
                m_day = m.date.date() if isinstance(m.date, datetime.datetime) else m.date
                key = m_day.strftime("%Y-%m-%d")
                events_by_date.setdefault(key, []).append({
                    "id": f"meet_{m.id}",
                    "title": m.title,
                    "type": "meeting",
                    "time": m.date.strftime("%H:%M") if isinstance(m.date, datetime.datetime) else "10:00",
                    "duration": f"{int(m.duration)//60}m" if m.duration else "45m",
                    "source": m.source_platform or "Google Meet",
                    "status": m.processing_status,
                    "record": m
                })

        # 2. Approved Action Items / Deadlines
        for t in all_tasks:
            if t.deadline and t.deadline != "Not specified":
                # Try parsing ISO deadline or fallback
                t_date_str = None
                try:
                    if "T" in t.deadline:
                        dt = datetime.datetime.fromisoformat(t.deadline.replace("Z", "+00:00"))
                        t_date_str = dt.strftime("%Y-%m-%d")
                    elif len(t.deadline) == 10 and t.deadline.count("-") == 2:
                        t_date_str = t.deadline
                except Exception:
                    pass

                # If relative or unparsed, check if October 2026 dates match
                if not t_date_str:
                    dl_low = t.deadline.lower()
                    if "friday" in dl_low or "october 24" in dl_low or "24th" in dl_low:
                        t_date_str = "2026-10-24"
                    elif "monday" in dl_low or "october 27" in dl_low or "27th" in dl_low:
                        t_date_str = "2026-10-27"
                    elif "tomorrow" in dl_low:
                        t_date_str = "2026-10-24"
                    elif "today" in dl_low:
                        t_date_str = "2026-10-23"

                if t_date_str:
                    events_by_date.setdefault(t_date_str, []).append({
                        "id": f"task_{t.id}",
                        "title": t.task,
                        "type": "task",
                        "time": "17:00",
                        "assignee": t.assigned_to or "Unassigned",
                        "priority": t.priority or "Normal",
                        "quadrant": getattr(t, "quadrant", "Do First"),
                        "status": t.status,
                        "approval_status": t.approval_status,
                        "record": t
                    })

        # ---------------------------------------------------------------------------
        # Layout: Main Calendar Grid (Col 1) & Context Panel (Col 2)
        # ---------------------------------------------------------------------------
        col_main, col_ctx = st.columns([3.2, 1.8])

        # ==========================================
        # MAIN CALENDAR SURFACE
        # ==========================================
        with col_main:
            view_mode = st.session_state['cal_view_mode']

            # ------------------------------------------
            # MONTH VIEW
            # ------------------------------------------
            if view_mode == "Month View":
                year = curr_d.year
                month = curr_d.month
                cal = calendar.monthcalendar(year, month)

                # Weekday Header
                w_cols = st.columns(7)
                weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
                for i, w in enumerate(weekdays):
                    w_cols[i].markdown(f"<div style='text-align: center; font-size: 0.72rem; font-weight: 700; color: var(--mt-text-secondary); text-transform: uppercase; padding-bottom: 6px;'>{w}</div>", unsafe_allow_html=True)

                for week_idx, week in enumerate(cal):
                    day_cols = st.columns(7)
                    for day_idx, day_num in enumerate(week):
                        with day_cols[day_idx]:
                            if day_num == 0:
                                st.markdown("<div style='height: 80px; background: rgba(0,0,0,0.02); border-radius: 6px; border: 1px dashed var(--mt-border); opacity: 0.3;'></div>", unsafe_allow_html=True)
                            else:
                                day_date = datetime.date(year, month, day_num)
                                date_key = day_date.strftime("%Y-%m-%d")
                                day_events = events_by_date.get(date_key, [])

                                is_today = (day_date == datetime.date(2026, 10, 23))
                                is_sel = (day_date == st.session_state['cal_selected_date'])

                                bg_style = "background: var(--mt-primary-light);" if is_sel else ("background: var(--mt-surface-soft);" if is_today else "background: var(--mt-surface);")
                                border_style = "border: 2px solid var(--mt-primary);" if is_sel else ("border: 1px solid rgba(108, 77, 255, 0.4);" if is_today else "border: 1px solid var(--mt-border);")

                                evt_indicators = ""
                                for ev in day_events[:2]:
                                    c_dot = "#6C4DFF" if ev["type"] == "meeting" else "#169B69"
                                    evt_indicators += f"<div style='font-size: 0.65rem; color: {c_dot}; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;'>• {safe_escape(ev['title'][:12])}</div>"

                                if len(day_events) > 2:
                                    evt_indicators += f"<div style='font-size: 0.60rem; color: var(--mt-text-secondary);'>+{len(day_events)-2} more</div>"

                                num_badge = f"<span style='background: var(--mt-primary); color: white; padding: 1px 5px; border-radius: 10px;'>{day_num}</span>" if is_today else str(day_num)

                                st.markdown(
                                    f"<div style='{bg_style} {border_style} border-radius: 8px; padding: 6px 4px; height: 86px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden;'>"
                                    f"<div style='font-size: 0.78rem; font-weight: 700; color: var(--mt-text);'>{num_badge}</div>"
                                    f"<div style='overflow: hidden;'>{evt_indicators}</div>"
                                    f"</div>",
                                    unsafe_allow_html=True
                                )

                                # Clickable select day button
                                if st.button(f"View {day_num}", key=f"sel_d_{year}_{month}_{day_num}", use_container_width=True):
                                    st.session_state['cal_selected_date'] = day_date
                                    st.rerun()

            # ------------------------------------------
            # WEEK VIEW
            # ------------------------------------------
            elif view_mode == "Week View":
                # Compute 7 days surrounding the current date
                start_of_week = curr_d - datetime.timedelta(days=(curr_d.weekday() + 1) % 7)
                week_days = [start_of_week + datetime.timedelta(days=i) for i in range(7)]

                st.markdown(f"<div style='font-size: 0.82rem; font-weight: 700; color: var(--mt-primary); margin-bottom: 8px;'>Week: {week_days[0].strftime('%b %d')} – {week_days[-1].strftime('%b %d, %Y')}</div>", unsafe_allow_html=True)

                for w_day in week_days:
                    d_key = w_day.strftime("%Y-%m-%d")
                    d_evts = events_by_date.get(d_key, [])
                    is_today = (w_day == datetime.date(2026, 10, 23))
                    is_sel = (w_day == st.session_state['cal_selected_date'])

                    card_border = "border: 2px solid var(--mt-primary);" if is_sel else ("border: 1px solid var(--mt-primary-light);" if is_today else "border: 1px solid var(--mt-border);")

                    with st.container(border=True):
                        c_dw1, c_dw2 = st.columns([1.5, 4.5])
                        with c_dw1:
                            st.markdown(
                                f"<div style='text-align: center; padding: 4px;'>"
                                f"<div style='font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--mt-text-secondary);'>{w_day.strftime('%a')}</div>"
                                f"<div style='font-size: 1.2rem; font-weight: 800; color: var(--mt-text);'>{w_day.day}</div>"
                                f"{'<span style=\"font-size: 0.65rem; background: var(--mt-primary); color: white; padding: 1px 6px; border-radius: 4px;\">TODAY</span>' if is_today else ''}"
                                f"</div>",
                                unsafe_allow_html=True
                            )
                        with c_dw2:
                            if not d_evts:
                                st.caption("No sessions or task deadlines scheduled.")
                            else:
                                for ev in d_evts:
                                    icon = "🎙" if ev["type"] == "meeting" else "☑"
                                    color = "var(--mt-primary)" if ev["type"] == "meeting" else "#169B69"
                                    st.markdown(
                                        f"<div style='padding: 4px 8px; border-left: 3px solid {color}; background: var(--mt-surface-soft); border-radius: 4px; margin-bottom: 4px;'>"
                                        f"<span style='font-weight: 700; color: var(--mt-text); font-size: 0.85rem;'>{icon} {safe_escape(ev['title'])}</span> "
                                        f"<span style='font-size: 0.72rem; color: var(--mt-text-secondary);'>({ev['time']})</span>"
                                        f"</div>",
                                        unsafe_allow_html=True
                                    )

            # ------------------------------------------
            # AGENDA VIEW
            # ------------------------------------------
            elif view_mode == "Agenda View":
                st.markdown("<h4 style='color: var(--mt-text); font-weight: 700; font-size: 1.05rem; margin-bottom: 8px;'>Executive Schedule & Commitment Agenda</h4>", unsafe_allow_html=True)
                sorted_keys = sorted(events_by_date.keys())

                if not sorted_keys:
                    empty_state("calendar", "No Events Scheduled", "No upcoming meetings or task deadlines were found.")
                else:
                    for d_str in sorted_keys:
                        d_obj = datetime.datetime.strptime(d_str, "%Y-%m-%d").date()
                        st.markdown(f"<div style='font-size: 0.82rem; font-weight: 750; color: var(--mt-primary); margin-top: 12px; margin-bottom: 4px; text-transform: uppercase;'>📅 {d_obj.strftime('%A, %B %d, %Y')}</div>", unsafe_allow_html=True)
                        for ev in events_by_date[d_str]:
                            with st.container(border=True):
                                col_a1, col_a2, col_a3 = st.columns([1, 4, 1.5])
                                with col_a1:
                                    st.markdown(f"<div style='font-weight: 700; color: var(--mt-text); font-size: 0.9rem;'>{ev['time']}</div>", unsafe_allow_html=True)
                                    st.caption("Scheduled")
                                with col_a2:
                                    is_mtg = (ev["type"] == "meeting")
                                    prefix = "🎙️ Executive Session: " if is_mtg else "☑️ Deliverable: "
                                    st.markdown(f"<div style='font-weight: 700; color: var(--mt-text); font-size: 0.95rem;'>{prefix}{safe_escape(ev['title'])}</div>", unsafe_allow_html=True)
                                    if is_mtg:
                                        m_rec = ev["record"]
                                        st.caption(f"Platform: {ev['source']} • Speakers: {m_rec.speaker_count or 0} • Status: {m_rec.processing_status}")
                                    else:
                                        t_rec = ev["record"]
                                        st.caption(f"Assignee: {ev.get('assignee', 'Unassigned')} • Priority: {ev.get('priority', 'Normal')} • Quadrant: {ev.get('quadrant', 'Do First')}")
                                with col_a3:
                                    if ev["type"] == "meeting":
                                        if st.button("Open Dossier", key=f"btn_ag_m_{ev['id']}", use_container_width=True):
                                            st.session_state['current_meeting_id'] = ev['record'].id
                                            st.session_state['current_page'] = "Meeting Results"
                                            st.rerun()
                                    else:
                                        if st.button("View in Tasks", key=f"btn_ag_t_{ev['id']}", use_container_width=True):
                                            st.session_state['current_page'] = "My Work"
                                            st.rerun()

        # ==========================================
        # CONTEXT PANEL (Right Side)
        # ==========================================
        with col_ctx:
            st.markdown(f"<h4 style='color: var(--mt-text); font-weight: 700; font-size: 1.05rem; margin-bottom: 6px;'>Schedule Context Panel</h4>", unsafe_allow_html=True)

            # 1. Selected Day Overview
            sel_date = st.session_state['cal_selected_date']
            sel_key = sel_date.strftime("%Y-%m-%d")
            sel_events = events_by_date.get(sel_key, [])

            with st.container(border=True):
                st.markdown(f"<strong style='color: var(--mt-primary); font-size: 0.88rem;'>Selected Date: {sel_date.strftime('%B %d, %Y')}</strong>", unsafe_allow_html=True)
                if not sel_events:
                    st.caption("No events or task deadlines scheduled for this date.")
                else:
                    for s_ev in sel_events:
                        s_color = "#6C4DFF" if s_ev["type"] == "meeting" else "#169B69"
                        st.markdown(
                            f"<div style='padding: 6px 8px; border-left: 3px solid {s_color}; background: var(--mt-surface-soft); border-radius: 4px; margin-bottom: 6px; font-size: 0.82rem;'>"
                            f"<strong>{s_ev['time']}</strong>: {safe_escape(s_ev['title'])}"
                            f"</div>",
                            unsafe_allow_html=True
                        )

            # 2. Upcoming Meetings (Sessions)
            st.markdown("<div style='height: 10px;'></div>", unsafe_allow_html=True)
            with st.container(border=True):
                st.markdown("<strong style='color: var(--mt-text); font-size: 0.88rem;'>🎙️ Upcoming Meeting Sessions</strong>", unsafe_allow_html=True)
                if not all_meetings:
                    st.caption("No meetings ingested in workspace.")
                else:
                    for m in all_meetings[:3]:
                        m_dt = m.date.strftime("%b %d, %H:%M") if m.date else "Recent"
                        st.markdown(
                            f"<div style='border-bottom: 1px solid var(--mt-border); padding: 5px 0; font-size: 0.80rem;'>"
                            f"<div style='font-weight: 600; color: var(--mt-text);'>{safe_escape(m.title)}</div>"
                            f"<div style='color: var(--mt-text-secondary); font-size: 0.72rem;'>{m_dt} • {m.speaker_count or 0} speakers</div>"
                            f"</div>",
                            unsafe_allow_html=True
                        )

            # 3. Action-Item Deliverables Due Soon
            st.markdown("<div style='height: 10px;'></div>", unsafe_allow_html=True)
            with st.container(border=True):
                st.markdown("<strong style='color: var(--mt-text); font-size: 0.88rem;'>☑️ Commitments & Deadlines</strong>", unsafe_allow_html=True)
                active_deadlines = [t for t in all_tasks if t.status not in ["Completed", "Rejected"] and t.deadline][:3]
                if not active_deadlines:
                    st.caption("No pending task commitments.")
                else:
                    for t in active_deadlines:
                        st.markdown(
                            f"<div style='border-bottom: 1px solid var(--mt-border); padding: 5px 0; font-size: 0.80rem;'>"
                            f"<div style='font-weight: 600; color: var(--mt-text);'>{safe_escape(t.task)}</div>"
                            f"<div style='color: var(--mt-primary); font-size: 0.72rem; font-weight: 600;'>📅 Due: {safe_escape(t.deadline)}</div>"
                            f"</div>",
                            unsafe_allow_html=True
                        )

            # 4. Meetings Awaiting Analysis / Transcription
            unprocessed = [m for m in all_meetings if m.processing_status != "Completed"]
            if unprocessed:
                st.markdown("<div style='height: 10px;'></div>", unsafe_allow_html=True)
                with st.container(border=True):
                    st.markdown("<strong style='color: #D98A16; font-size: 0.88rem;'>⏳ Ingestion & Processing Pipeline</strong>", unsafe_allow_html=True)
                    for up in unprocessed:
                        st.markdown(
                            f"<div style='font-size: 0.78rem; padding: 4px 0; color: var(--mt-text);'>"
                            f"{safe_escape(up.title)} &nbsp; {render_status_badge(up.processing_status, 'status')}"
                            f"</div>",
                            unsafe_allow_html=True
                        )

    finally:
        db.close()
