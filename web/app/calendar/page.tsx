"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Plus,
  Filter,
  Mic,
  CheckSquare,
  Globe,
  X,
  CalendarDays,
  List,
  Power,
  ShieldCheck,
  ArrowRight,
  Layers,
  Users,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { CalendarEventItem, ActionItem, Meeting } from "@/lib/types";
import { DeadlineBadge } from "@/components/DeadlineBadge";

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEventItem[]>(() => api.getCalendarEvents());
  const [integrations, setIntegrations] = useState(() => api.getIntegrations());
  const [tasks, setTasks] = useState(() => api.getActionItems());
  const [meetings, setMeetings] = useState(() => api.getMeetings());
  const [viewMode, setViewMode] = useState<"month" | "week" | "agenda">("month");
  
  // Current calendar browsing date & selected day focus
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 9, 23)); // October 23, 2026
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 9, 23));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch from real backend on mount with graceful offline fallback
  useEffect(() => {
    let isMounted = true;
    api.fetchCalendarEventsFromBackend().then((res) => {
      if (isMounted && res.events) {
        setEvents([...res.events]);
        setIntegrations([...api.getIntegrations()]);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const googleCalStatus = useMemo(() => {
    return integrations.find((i) => i.provider === "google_calendar");
  }, [integrations]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleManualSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      const res = api.syncAllCalendar();
      setEvents(api.getCalendarEvents());
      setIntegrations([...api.getIntegrations()]);
      setTasks(api.getActionItems());
      setIsSyncing(false);
      showToast(`Synchronized ${res.count} approved commitments with Google Calendar.`);
    }, 500);
  };

  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect Google Calendar integration? All local commitments and meetings will remain intact.")) {
      api.disconnectGoogleCalendar();
      setIntegrations([...api.getIntegrations()]);
      showToast("Google Calendar disconnected. Local commitments preserved.");
    }
  };

  const handleCancelEvent = (taskId?: number) => {
    if (!taskId) return;
    api.cancelTaskCalendarEvent(taskId);
    setEvents(api.getCalendarEvents());
    setTasks(api.getActionItems());
    setSelectedEvent(null);
    showToast("Calendar event cancelled.");
  };

  // Month / Week Navigation
  const handlePrev = () => {
    const nextDate = new Date(currentDate);
    if (viewMode === "month") {
      nextDate.setMonth(nextDate.getMonth() - 1);
    } else if (viewMode === "week") {
      nextDate.setDate(nextDate.getDate() - 7);
    } else {
      nextDate.setDate(nextDate.getDate() - 14);
    }
    setCurrentDate(nextDate);
  };

  const handleNext = () => {
    const nextDate = new Date(currentDate);
    if (viewMode === "month") {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (viewMode === "week") {
      nextDate.setDate(nextDate.getDate() + 7);
    } else {
      nextDate.setDate(nextDate.getDate() + 14);
    }
    setCurrentDate(nextDate);
  };

  const handleToday = () => {
    const today = new Date(2026, 9, 23);
    setCurrentDate(today);
    setSelectedDate(today);
  };

  // Calendar Grid generation for Month View
  const monthData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month padding days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      days.push({
        dayNumber: d,
        isCurrentMonth: false,
        date: new Date(year, month - 1, d),
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      days.push({
        dayNumber: d,
        isCurrentMonth: true,
        date: new Date(year, month, d),
      });
    }

    // Next month padding days to complete 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        dayNumber: d,
        isCurrentMonth: false,
        date: new Date(year, month + 1, d),
      });
    }

    return days;
  }, [currentDate]);

  // Week View Days (7 days for the active week)
  const weekData = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day); // Sunday start
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // Map events to date string YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEventItem[]> = {};
    events.forEach((evt) => {
      if (evt.start) {
        const dateKey = evt.start.slice(0, 10);
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(evt);
      }
    });
    return map;
  }, [events]);

  const selectedDateKey = selectedDate.toISOString().slice(0, 10);
  const selectedDateEvents = eventsByDate[selectedDateKey] || [];
  const todayKey = "2026-10-23";
  const todayEvents = eventsByDate[todayKey] || [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-[var(--mt-surface)] border border-brand-500/30 text-xs font-semibold text-[var(--mt-text)] shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-brand-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--mt-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-brand-500 bg-brand-500/10 px-2.5 py-0.5 rounded-full border border-brand-500/20">
              Ecosystem Orchestration
            </span>
            <span className="text-[0.68rem] font-semibold text-[var(--mt-text-secondary)]">
              Two-Way Google Calendar Sync
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--mt-text)]">
            Calendar
          </h1>
          <p className="text-xs text-[var(--mt-text-secondary)] mt-1 max-w-2xl">
            Meetings and follow-ups organized in one place with two-way Google Calendar synchronization.
          </p>
        </div>

        {/* View Switchers & Primary Action */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-1 rounded-xl bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] flex items-center gap-1">
            <button
              onClick={() => setViewMode("month")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "month"
                  ? "bg-[var(--mt-surface)] text-brand-600 dark:text-brand-400 shadow-sm border border-[var(--mt-border)]"
                  : "text-[var(--mt-text-secondary)] hover:text-[var(--mt-text)]"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Month</span>
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "week"
                  ? "bg-[var(--mt-surface)] text-brand-600 dark:text-brand-400 shadow-sm border border-[var(--mt-border)]"
                  : "text-[var(--mt-text-secondary)] hover:text-[var(--mt-text)]"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Week</span>
            </button>
            <button
              onClick={() => setViewMode("agenda")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "agenda"
                  ? "bg-[var(--mt-surface)] text-brand-600 dark:text-brand-400 shadow-sm border border-[var(--mt-border)]"
                  : "text-[var(--mt-text-secondary)] hover:text-[var(--mt-text)]"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Agenda</span>
            </button>
          </div>

          <Link
            href="/upload"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/20 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Process Meeting</span>
          </Link>
        </div>
      </div>

      {/* Google Calendar Connection Status Banner */}
      <div className="p-4 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-brand-500/20">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-[var(--mt-text)]">
                Google Calendar Connection
              </h2>
              <span
                className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${
                  googleCalStatus?.status === "Connected"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                }`}
              >
                ● {googleCalStatus?.status || "Connected (Demo)"}
              </span>
            </div>
            <div className="text-[0.7rem] text-[var(--mt-text-secondary)] mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Account: <strong>{googleCalStatus?.account_email || "demo.calendar@acmeglobal.io"}</strong></span>
              <span>•</span>
              <span>Scopes: <code>calendar.events</code></span>
              <span>•</span>
              <span>Last Synced: <strong>{googleCalStatus?.last_sync ? new Date(googleCalStatus.last_sync).toLocaleTimeString() : "Just now"}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-brand-500 text-white shadow-sm hover:bg-brand-600 disabled:opacity-50 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
          </button>

          {googleCalStatus?.status === "Connected" ? (
            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all flex items-center gap-1.5"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              onClick={() => {
                api.testIntegration("google_calendar");
                setIntegrations([...api.getIntegrations()]);
                showToast("Connected to Google Calendar.");
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-brand-600 bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/20 transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Connect Account</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace: Calendar Surface (Left 8 cols) & Context Panel (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Calendar Grid Surface                       */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 space-y-4">
          {/* Navigation Bar */}
          <div className="p-4 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-[var(--mt-text)]">
                {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h2>
              <button
                onClick={handleToday}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--mt-surface-soft)] text-[var(--mt-text)] border border-[var(--mt-border)] hover:bg-brand-500/10 hover:text-brand-600 transition-colors"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Legend */}
              <div className="hidden sm:flex items-center gap-3 text-[0.68rem] mr-3 text-[var(--mt-text-secondary)]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                  <span>Meeting Session</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Task Deadline</span>
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrev}
                  className="p-1.5 rounded-lg text-[var(--mt-text-secondary)] hover:bg-[var(--mt-surface-soft)] hover:text-[var(--mt-text)] border border-[var(--mt-border)] transition-colors"
                  title="Previous"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNext}
                  className="p-1.5 rounded-lg text-[var(--mt-text-secondary)] hover:bg-[var(--mt-surface-soft)] hover:text-[var(--mt-text)] border border-[var(--mt-border)] transition-colors"
                  title="Next"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* VIEW MODE 1: MONTH VIEW */}
          {viewMode === "month" && (
            <div className="rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card overflow-hidden">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 border-b border-[var(--mt-border)] bg-[var(--mt-surface-soft)] text-center text-[0.7rem] font-bold text-[var(--mt-text-secondary)] py-2.5 uppercase tracking-wider">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>

              {/* Month Days Grid */}
              <div className="grid grid-cols-7 divide-x divide-y divide-[var(--mt-border)]">
                {monthData.map((cell, idx) => {
                  const dateStr = cell.date.toISOString().slice(0, 10);
                  const cellEvents = eventsByDate[dateStr] || [];
                  const isToday =
                    cell.date.getFullYear() === 2026 &&
                    cell.date.getMonth() === 9 &&
                    cell.date.getDate() === 23;
                  const isSelected =
                    cell.date.getFullYear() === selectedDate.getFullYear() &&
                    cell.date.getMonth() === selectedDate.getMonth() &&
                    cell.date.getDate() === selectedDate.getDate();

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDate(cell.date)}
                      className={`min-h-[105px] p-2 flex flex-col justify-between transition-all cursor-pointer ${
                        !cell.isCurrentMonth
                          ? "bg-[var(--mt-surface-soft)]/40 opacity-40"
                          : "bg-[var(--mt-surface)] hover:bg-brand-500/[0.03]"
                      } ${isSelected ? "ring-2 ring-brand-500 bg-brand-500/[0.06] z-10" : ""} ${
                        isToday && !isSelected ? "border-2 border-brand-500/40 bg-brand-500/[0.03]" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`font-bold w-6 h-6 flex items-center justify-center rounded-full text-xs ${
                            isToday
                              ? "bg-brand-500 text-white shadow-sm"
                              : isSelected
                              ? "bg-brand-500/20 text-brand-600 dark:text-brand-400 font-extrabold"
                              : "text-[var(--mt-text)]"
                          }`}
                        >
                          {cell.dayNumber}
                        </span>
                        {cellEvents.length > 0 && (
                          <span className="text-[0.62rem] text-[var(--mt-text-muted)] font-semibold">
                            {cellEvents.length} evt
                          </span>
                        )}
                      </div>

                      {/* Day Events Pills */}
                      <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                        {cellEvents.slice(0, 2).map((evt) => (
                          <button
                            key={evt.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEvent(evt);
                            }}
                            className={`w-full text-left px-1.5 py-0.5 rounded text-[0.65rem] font-semibold truncate block transition-all ${
                              evt.type === "meeting"
                                ? "bg-brand-500/15 text-brand-600 dark:text-brand-400 hover:bg-brand-500/25"
                                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25"
                            }`}
                            title={evt.summary}
                          >
                            {evt.type === "meeting" ? "🎙 " : "☑ "}
                            {evt.summary.replace("[MeetIntel] ", "")}
                          </button>
                        ))}
                        {cellEvents.length > 2 && (
                          <div className="text-[0.62rem] text-[var(--mt-text-muted)] font-medium pl-1">
                            +{cellEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW MODE 2: WEEK VIEW */}
          {viewMode === "week" && (
            <div className="rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card overflow-hidden">
              <div className="p-3 border-b border-[var(--mt-border)] bg-[var(--mt-surface-soft)] text-xs font-semibold text-[var(--mt-text-secondary)]">
                Week: {weekData[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
                {weekData[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-[var(--mt-border)] min-h-[360px]">
                {weekData.map((wDate, idx) => {
                  const dStr = wDate.toISOString().slice(0, 10);
                  const wEvents = eventsByDate[dStr] || [];
                  const isToday =
                    wDate.getFullYear() === 2026 &&
                    wDate.getMonth() === 9 &&
                    wDate.getDate() === 23;
                  const isSelected =
                    wDate.getFullYear() === selectedDate.getFullYear() &&
                    wDate.getMonth() === selectedDate.getMonth() &&
                    wDate.getDate() === selectedDate.getDate();

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDate(wDate)}
                      className={`p-3 flex flex-col justify-between transition-all cursor-pointer ${
                        isSelected
                          ? "bg-brand-500/[0.06] ring-2 ring-brand-500"
                          : isToday
                          ? "bg-brand-500/[0.02]"
                          : "bg-[var(--mt-surface)] hover:bg-[var(--mt-surface-soft)]/50"
                      }`}
                    >
                      <div>
                        <div className="text-center pb-2 border-b border-[var(--mt-border)]">
                          <div className="text-[0.68rem] font-bold uppercase text-[var(--mt-text-secondary)]">
                            {wDate.toLocaleDateString("en-US", { weekday: "short" })}
                          </div>
                          <div
                            className={`w-7 h-7 mx-auto mt-0.5 rounded-full flex items-center justify-center text-xs font-bold ${
                              isToday
                                ? "bg-brand-500 text-white"
                                : isSelected
                                ? "bg-brand-500/20 text-brand-600 font-extrabold"
                                : "text-[var(--mt-text)]"
                            }`}
                          >
                            {wDate.getDate()}
                          </div>
                        </div>

                        <div className="space-y-1.5 mt-3">
                          {wEvents.map((evt) => (
                            <button
                              key={evt.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(evt);
                              }}
                              className={`w-full text-left p-1.5 rounded-lg text-[0.68rem] font-semibold block transition-all shadow-xs ${
                                evt.type === "meeting"
                                  ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 hover:bg-brand-500/20"
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                              }`}
                            >
                              <div className="truncate font-bold">
                                {evt.type === "meeting" ? "🎙 " : "☑ "}
                                {evt.summary.replace("[MeetIntel] ", "")}
                              </div>
                              <div className="text-[0.62rem] text-[var(--mt-text-muted)] font-normal mt-0.5">
                                {evt.start ? new Date(evt.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "All day"}
                              </div>
                            </button>
                          ))}
                          {wEvents.length === 0 && (
                            <div className="text-[0.65rem] text-[var(--mt-text-muted)] text-center py-4">
                              No items
                            </div>
                          )}
                        </div>
                      </div>

                      <span className="text-[0.62rem] text-[var(--mt-text-muted)] text-center block pt-2">
                        {wEvents.length} scheduled
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW MODE 3: AGENDA VIEW */}
          {viewMode === "agenda" && (
            <div className="space-y-3">
              {events.length === 0 ? (
                <div className="py-16 text-center text-xs text-[var(--mt-text-muted)] bg-[var(--mt-surface)] rounded-2xl border border-[var(--mt-border)] space-y-3">
                  <CalendarIcon className="w-8 h-8 mx-auto text-[var(--mt-text-muted)]" />
                  <div>No upcoming sessions or task commitments scheduled.</div>
                  <Link
                    href="/upload"
                    className="inline-block px-4 py-2 rounded-xl bg-brand-500 text-white text-xs font-semibold"
                  >
                    Process New Recording
                  </Link>
                </div>
              ) : (
                events.map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className="p-4 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card hover:border-brand-500/40 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                          evt.type === "meeting"
                            ? "bg-brand-500/15 text-brand-600 dark:text-brand-400"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {evt.type === "meeting" ? <Mic className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full uppercase ${
                              evt.type === "meeting"
                                ? "bg-brand-500/10 text-brand-500"
                                : "bg-emerald-500/10 text-emerald-600"
                            }`}
                          >
                            {evt.type === "meeting" ? "Meeting Session" : "Task Deliverable"}
                          </span>
                          <span className="text-[0.7rem] text-[var(--mt-text-muted)] font-medium">
                            {evt.start ? new Date(evt.start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "Scheduled"}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-[var(--mt-text)] group-hover:text-brand-500 transition-colors mt-1">
                          {evt.summary}
                        </h3>
                        <p className="text-[var(--mt-text-secondary)] text-[0.72rem] line-clamp-1 mt-0.5">
                          {evt.description || "Executive commitment schedule item."}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[0.65rem] font-bold ${
                          evt.sync_status === "Synced"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        ● {evt.sync_status || "Synced"}
                      </span>
                      <ArrowRight className="w-4 h-4 text-[var(--mt-text-muted)] group-hover:text-brand-500 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Context Panel                              */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-4">
          {/* Card 1: Selected Day Focus */}
          <div className="p-5 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--mt-border)]">
              <div>
                <span className="text-[0.65rem] font-bold uppercase tracking-wider text-brand-500">
                  Day Focus
                </span>
                <h3 className="text-sm font-bold text-[var(--mt-text)]">
                  {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--mt-surface-soft)] text-[var(--mt-text-secondary)]">
                {selectedDateEvents.length} item{selectedDateEvents.length === 1 ? "" : "s"}
              </span>
            </div>

            {selectedDateEvents.length === 0 ? (
              <div className="py-6 text-center text-xs text-[var(--mt-text-secondary)] space-y-2">
                <CalendarIcon className="w-6 h-6 mx-auto text-[var(--mt-text-muted)]" />
                <p>No commitments scheduled on this date.</p>
                <Link
                  href="/tasks"
                  className="inline-block text-[0.72rem] font-semibold text-brand-500 hover:underline"
                >
                  Schedule a task →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDateEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className="p-3 rounded-xl bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] hover:border-brand-500/40 cursor-pointer transition-colors text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[0.7rem] text-brand-600 dark:text-brand-400">
                        {ev.type === "meeting" ? "🎙 Meeting" : "☑ Deliverable"}
                      </span>
                      <span className="text-[0.65rem] text-[var(--mt-text-muted)]">
                        {ev.start ? new Date(ev.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                    <div className="font-semibold text-[var(--mt-text)] truncate">
                      {ev.summary}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Upcoming Meetings */}
          <div className="p-5 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[var(--mt-text)] flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-brand-500" />
                <span>Upcoming Meeting Sessions</span>
              </h3>
              <Link href="/meetings" className="text-[0.7rem] text-brand-500 font-semibold hover:underline">
                View all
              </Link>
            </div>

            <div className="space-y-2">
              {meetings.slice(0, 3).map((m) => (
                <Link
                  key={m.id}
                  href={`/meetings/${m.id}`}
                  className="p-3 rounded-xl bg-[var(--mt-surface-soft)] hover:bg-brand-500/10 border border-[var(--mt-border)] block transition-colors text-xs space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[0.65rem] font-bold uppercase text-brand-500">
                      {m.source_platform.replace("_", " ")}
                    </span>
                    <span className="text-[0.65rem] text-[var(--mt-text-muted)]">
                      {new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <div className="font-bold text-[var(--mt-text)] group-hover:text-brand-500 truncate">
                    {m.title}
                  </div>
                  <div className="text-[0.68rem] text-[var(--mt-text-secondary)] flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {m.speaker_count} speakers
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Card 3: Upcoming Action-Item Deadlines */}
          <div className="p-5 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[var(--mt-text)] flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                <span>Deliverable Commitments</span>
              </h3>
              <Link href="/tasks" className="text-[0.7rem] text-brand-500 font-semibold hover:underline">
                Tasks
              </Link>
            </div>

            <div className="space-y-2">
              {tasks
                .filter((t) => t.status !== "Completed" && t.deadline)
                .slice(0, 3)
                .map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[var(--mt-text)] truncate flex-1">
                        {t.task}
                      </span>
                      <DeadlineBadge deadline={t.deadline} isCompleted={t.status === "Completed"} />
                    </div>
                    <div className="flex items-center justify-between text-[0.68rem] text-[var(--mt-text-secondary)]">
                      <span>Assignee: <strong className="text-[var(--mt-text)]">{t.assigned_to}</strong></span>
                      <span className="text-brand-500 font-medium">{t.quadrant || "Do First"}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* EVENT DETAILS MODAL / DRAWER                              */}
      {/* ========================================================= */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[var(--mt-surface)] border border-[var(--mt-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-[var(--mt-border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[0.68rem] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                    selectedEvent.type === "meeting"
                      ? "bg-brand-500/10 text-brand-500 border border-brand-500/20"
                      : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                  }`}
                >
                  {selectedEvent.type === "meeting" ? "Executive Meeting" : "Action Item Deadline"}
                </span>
                <span className="text-[0.68rem] text-[var(--mt-text-secondary)]">
                  ID: {selectedEvent.external_id || selectedEvent.id}
                </span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 rounded-lg text-[var(--mt-text-secondary)] hover:bg-[var(--mt-surface-soft)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <h3 className="text-base font-bold text-[var(--mt-text)]">
                  {selectedEvent.summary}
                </h3>
                <p className="text-[var(--mt-text-secondary)] mt-1.5 leading-relaxed">
                  {selectedEvent.description || "Executive commitment schedule item."}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--mt-text-secondary)]">Start Time:</span>
                  <span className="font-semibold text-[var(--mt-text)]">
                    {selectedEvent.start ? new Date(selectedEvent.start).toLocaleString() : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--mt-text-secondary)]">End Time:</span>
                  <span className="font-semibold text-[var(--mt-text)]">
                    {selectedEvent.end ? new Date(selectedEvent.end).toLocaleString() : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--mt-text-secondary)]">Calendar Origin:</span>
                  <span className="font-medium text-[var(--mt-text)]">
                    {selectedEvent.source === "google_calendar" ? "Google Calendar (Cloud Synced)" : "MeetIntel Local Database"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--mt-text-secondary)]">Sync Status:</span>
                  <span className="font-bold text-emerald-600">
                    {selectedEvent.sync_status || "Synced"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--mt-border)] bg-[var(--mt-surface)] flex items-center justify-between gap-2">
              <div>
                {selectedEvent.type === "meeting" && selectedEvent.meeting_id && (
                  <Link
                    href={`/meetings/${selectedEvent.meeting_id}`}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand-500 text-white hover:bg-brand-600 flex items-center gap-1.5"
                  >
                    <span>Open Meeting Dossier</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}

                {selectedEvent.type === "task_deadline" && (
                  <Link
                    href="/tasks"
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand-500 text-white hover:bg-brand-600 flex items-center gap-1.5"
                  >
                    <span>View in Tasks</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedEvent.task_id && selectedEvent.sync_status === "Synced" && (
                  <button
                    onClick={() => handleCancelEvent(selectedEvent.task_id)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20"
                  >
                    Cancel Event
                  </button>
                )}
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--mt-surface-soft)] text-[var(--mt-text)] hover:bg-brand-500/10 hover:text-brand-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
