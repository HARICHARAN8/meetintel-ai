"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Mic,
  CheckSquare,
  Scale,
  RefreshCw,
  PlusCircle,
  Clock,
  Calendar,
  Users,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Check,
  ExternalLink,
  Layers,
  CalendarDays,
} from "lucide-react";
import { api } from "@/lib/api";
import { DeadlineBadge } from "@/components/DeadlineBadge";

export default function DashboardPage() {
  const [meetings] = useState(api.getMeetings());
  const [actionItems, setActionItems] = useState(api.getActionItems());
  const [decisions] = useState(api.getDecisions());
  const [auditEvents] = useState(api.getAuditEvents(4));

  const pendingApprovals = actionItems.filter(
    (a) => a.approval_status === "Draft" || a.approval_status === "Pending Approval"
  );
  const urgentTasks = actionItems.filter(
    (a) => a.priority === "Urgent" || a.priority === "High"
  );

  const handleApprove = (taskId: number) => {
    const updated = api.approveActionItem(taskId, "user-sarah-002");
    if (updated) {
      setActionItems(api.getActionItems());
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--mt-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-brand-500 bg-brand-500/10 px-2.5 py-0.5 rounded-full border border-brand-500/20">
              Executive Telemetry
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--mt-text)]">
            Intelligence & Execution Overview
          </h1>
          <p className="text-xs text-[var(--mt-text-secondary)] mt-1 max-w-2xl">
            Live telemetry across ingested dialogues, decision registers, automated calendar syncs, and team commitments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs shadow-md shadow-brand-500/20 transition-all hover:scale-[1.02]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Process Meeting</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="p-5 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card hover:border-brand-500/30 transition-all">
          <div className="flex items-center justify-between text-[var(--mt-text-secondary)] mb-3">
            <span className="text-xs font-semibold">Total Meetings</span>
            <div className="w-8 h-8 rounded-lg bg-brand-500/10 text-brand-500 flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--mt-text)] tracking-tight">
            {meetings.length}
          </div>
          <div className="text-[0.72rem] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <span>↑ 100% audio verified</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="p-5 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card hover:border-brand-500/30 transition-all">
          <div className="flex items-center justify-between text-[var(--mt-text-secondary)] mb-3">
            <span className="text-xs font-semibold">Action Items</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--mt-text)] tracking-tight">
            {actionItems.length}
          </div>
          <div className="text-[0.72rem] text-amber-600 dark:text-amber-400 font-medium mt-1">
            {pendingApprovals.length} awaiting lead sign-off
          </div>
        </div>

        {/* Card 3 */}
        <div className="p-5 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card hover:border-brand-500/30 transition-all">
          <div className="flex items-center justify-between text-[var(--mt-text-secondary)] mb-3">
            <span className="text-xs font-semibold">Decisions Logged</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--mt-text)] tracking-tight">
            {decisions.length}
          </div>
          <div className="text-[0.72rem] text-[var(--mt-text-secondary)] font-medium mt-1">
            Avg confidence: 98.2%
          </div>
        </div>

        {/* Card 4 */}
        <div className="p-5 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card hover:border-brand-500/30 transition-all">
          <div className="flex items-center justify-between text-[var(--mt-text-secondary)] mb-3">
            <span className="text-xs font-semibold">Ecosystem Sync</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[var(--mt-text)] tracking-tight">
            100%
          </div>
          <div className="text-[0.72rem] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
            Google Calendar & SMTP active
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Meetings & Urgent Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Ingested Meetings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--mt-text)] flex items-center gap-2">
              <Mic className="w-4 h-4 text-brand-500" />
              <span>Recent Meeting Dossiers</span>
            </h2>
            <Link
              href="/meetings"
              className="text-xs font-semibold text-brand-500 hover:underline flex items-center gap-1"
            >
              View all library <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {meetings.map((m) => {
              const durationMin = Math.floor(m.duration / 60);
              const durationSec = m.duration % 60;

              return (
                <div
                  key={m.id}
                  className="p-4 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card hover:border-brand-500/40 hover:shadow-card-hover transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          m.source_platform === "google_meet"
                            ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            : m.source_platform === "zoom"
                            ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                            : "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                        }`}
                      >
                        {m.source_platform.replace("_", " ")}
                      </span>
                      <span className="text-[0.7rem] text-[var(--mt-text-secondary)]">
                        {new Date(m.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <Link
                      href={`/meetings/${m.id}`}
                      className="text-sm font-bold text-[var(--mt-text)] hover:text-brand-500 transition-colors block truncate"
                    >
                      {m.title}
                    </Link>

                    <p className="text-xs text-[var(--mt-text-secondary)] line-clamp-1">
                      {m.executive_summary}
                    </p>

                    <div className="flex items-center gap-4 text-[0.72rem] text-[var(--mt-text-muted)] pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {durationMin}m {durationSec}s
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {m.speaker_count} Speakers
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/meetings/${m.id}`}
                    className="px-3.5 py-2 rounded-lg bg-[var(--mt-surface-soft)] hover:bg-brand-500 hover:text-white border border-[var(--mt-border)] text-xs font-semibold text-[var(--mt-text)] transition-all flex items-center justify-center gap-1.5 flex-shrink-0"
                  >
                    <span>Intelligence Dossier</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Urgent Action Items & Sign-offs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--mt-text)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Priority Commitments</span>
            </h2>
            <div className="flex items-center gap-2">
              <Link
                href="/matrix"
                className="text-[0.72rem] font-semibold text-brand-500 hover:underline flex items-center gap-1"
                title="View in 2x2 Matrix"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Matrix</span>
              </Link>
              <span className="text-[var(--mt-border)]">|</span>
              <Link
                href="/tasks"
                className="text-xs font-semibold text-brand-500 hover:underline flex items-center gap-1"
              >
                <span>All tasks</span> <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            {urgentTasks.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card flex flex-col justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <span
                      className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${
                        item.priority === "Urgent"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {item.priority}
                    </span>
                    <DeadlineBadge deadline={item.deadline} isCompleted={item.status === "Completed"} />
                  </div>

                  <div className="font-bold text-[var(--mt-text)] mb-1">
                    {item.task}
                  </div>
                  <div className="text-[0.72rem] text-[var(--mt-text-secondary)]">
                    Assigned: <strong className="text-[var(--mt-text)]">{item.assigned_to}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--mt-border)]">
                  <span
                    className={`text-[0.68rem] font-semibold ${
                      item.approval_status === "Approved"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    ● {item.approval_status}
                  </span>

                  {item.approval_status !== "Approved" ? (
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="px-2.5 py-1 rounded-md bg-brand-500 hover:bg-brand-600 text-white font-semibold text-[0.72rem] transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Approve
                    </button>
                  ) : (
                    <span className="text-[0.7rem] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Synced
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Executive Calendar & Schedule Preview Widget */}
          <div className="p-4 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-[var(--mt-text)] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-500" />
                <span>Executive Calendar Preview</span>
              </h2>
              <Link
                href="/calendar"
                className="text-[0.7rem] font-semibold text-brand-500 hover:underline flex items-center gap-1"
              >
                <span>Full Schedule</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-2">
              {api.getCalendarEvents().slice(0, 3).map((evt) => (
                <div
                  key={evt.id}
                  className="p-2.5 rounded-lg bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[var(--mt-text)] truncate text-[0.72rem]">
                      {evt.summary}
                    </div>
                    <div className="text-[0.65rem] text-[var(--mt-text-secondary)] mt-0.5">
                      {evt.start ? new Date(evt.start).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "Scheduled"}
                    </div>
                  </div>
                  <span className="text-[0.62rem] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                    {evt.sync_status || "Synced"}
                  </span>
                </div>
              ))}
            </div>

            <Link
              href="/calendar"
              className="w-full py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 font-semibold text-[0.72rem] transition-colors flex items-center justify-center gap-1 block text-center"
            >
              <span>Open Two-Way Calendar</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Governance Audit Snippet */}
          <div className="p-4 rounded-xl bg-[var(--mt-surface-soft)] border border-[var(--mt-border)]">
            <div className="text-[0.7rem] font-bold uppercase tracking-wider text-[var(--mt-text-muted)] mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-500" />
              Latest Governance Audit
            </div>
            <div className="space-y-2">
              {auditEvents.slice(0, 3).map((e) => (
                <div key={e.id} className="text-[0.72rem] text-[var(--mt-text-secondary)] leading-relaxed">
                  <span className="font-semibold text-[var(--mt-text)]">{e.actor}</span>:{" "}
                  {e.details}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
