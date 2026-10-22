"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CheckSquare,
  Clock,
  User,
  ShieldCheck,
  Check,
  X,
  AlertCircle,
  Calendar,
  Filter,
  UserPlus,
  Quote,
  Layers,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { ActionItem, TaskStatus, ApprovalStatus, EisenhowerQuadrant } from "@/lib/types";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { ConversationalDeadlineModal } from "@/components/ConversationalDeadlineModal";
import { ParsedDeadlineResult } from "@/lib/dateParser";

export default function TasksPage() {
  const [tasks, setTasks] = useState(() => api.getActionItems());
  const [users] = useState(() => api.getUsers());
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [approvalFilter, setApprovalFilter] = useState<string>("All");
  const [quadrantFilter, setQuadrantFilter] = useState<string>("All");
  const [reassignModalTask, setReassignModalTask] = useState<ActionItem | null>(null);
  const [selectedUserForReassign, setSelectedUserForReassign] = useState<string>("");
  const [deadlineModalTask, setDeadlineModalTask] = useState<ActionItem | null>(null);

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== "All" && t.status !== statusFilter) return false;
    if (approvalFilter !== "All" && t.approval_status !== approvalFilter) return false;
    if (quadrantFilter !== "All" && (t.quadrant || "Unclassified") !== quadrantFilter) return false;
    return true;
  });

  const handleApprove = (taskId: number) => {
    api.approveActionItem(taskId, "user-sarah-002");
    setTasks(api.getActionItems());
  };

  const handleReject = (taskId: number) => {
    const reason = prompt("Enter rejection reason:") || "Rejected in review";
    api.rejectActionItem(taskId, "user-sarah-002", reason);
    setTasks(api.getActionItems());
  };

  const handleStatusChange = (taskId: number, newStatus: TaskStatus) => {
    api.updateActionItemStatus(taskId, newStatus);
    setTasks(api.getActionItems());
  };

  const handleDeadlineConfirmed = (parsed: ParsedDeadlineResult) => {
    if (deadlineModalTask) {
      api.updateActionItemDeadline(deadlineModalTask.id, parsed.parsedIso || parsed.rawInput);
      setTasks(api.getActionItems());
      setDeadlineModalTask(null);
    }
  };

  const handleReassignSubmit = () => {
    if (reassignModalTask && selectedUserForReassign) {
      api.reassignActionItem(reassignModalTask.id, selectedUserForReassign);
      setTasks(api.getActionItems());
      setReassignModalTask(null);
      setSelectedUserForReassign("");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--mt-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-brand-500 bg-brand-500/10 px-2.5 py-0.5 rounded-full border border-brand-500/20">
              Execution Engine
            </span>
            <span className="text-[0.68rem] font-medium text-[var(--mt-text-secondary)]">
              {filteredTasks.length} Commitments
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--mt-text)]">
            My Commitments & Team Execution
          </h1>
          <p className="text-xs text-[var(--mt-text-secondary)] mt-1">
            Track commitments extracted from meeting dialogue, review lead sign-offs, and synchronize to calendars.
          </p>
        </div>

        {/* View Switchers */}
        <div className="flex items-center gap-2">
          <Link
            href="/matrix"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand-500 text-white shadow-sm hover:bg-brand-600 transition-all flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Eisenhower Matrix</span>
          </Link>
          <Link
            href="/calendar"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--mt-surface-soft)] text-[var(--mt-text)] border border-[var(--mt-border)] hover:bg-brand-500/10 hover:text-brand-600 transition-all flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Calendar</span>
          </Link>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="p-4 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--mt-text-secondary)]">
            <Filter className="w-3.5 h-3.5 text-brand-500" />
            <span>Status:</span>
          </div>
          {["All", "Pending", "In Progress", "Completed", "Blocked"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === st
                  ? "bg-brand-500 text-white font-semibold shadow-sm"
                  : "bg-[var(--mt-surface-soft)] text-[var(--mt-text)] hover:bg-brand-500/10"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={quadrantFilter}
            onChange={(e) => setQuadrantFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
          >
            <option value="All">All Quadrants</option>
            <option value="Do First">Q1: Do First</option>
            <option value="Schedule">Q2: Schedule</option>
            <option value="Delegate">Q3: Delegate</option>
            <option value="Defer">Q4: Defer</option>
            <option value="Unclassified">Unclassified</option>
          </select>

          <select
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
          >
            <option value="All">All Approvals</option>
            <option value="Approved">Approved</option>
            <option value="Draft">Draft</option>
            <option value="Pending Approval">Pending Approval</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Task Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTasks.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-[var(--mt-text-secondary)] bg-[var(--mt-surface)] rounded-2xl border border-[var(--mt-border)]">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 text-[var(--mt-text-muted)]" />
            No action items match the selected filter criteria.
          </div>
        ) : (
          filteredTasks.map((t) => (
            <div
              key={t.id}
              className="p-5 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card hover:border-brand-500/30 transition-all flex flex-col justify-between gap-4 text-xs"
            >
              <div className="space-y-2.5">
                {/* Header Pills */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${
                        t.priority === "Urgent"
                          ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                          : t.priority === "High"
                          ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          : "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                      }`}
                    >
                      {t.priority}
                    </span>
                    <span
                      className={`text-[0.65rem] font-bold px-2 py-0.5 rounded-full ${
                        t.quadrant === "Do First"
                          ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                          : t.quadrant === "Schedule"
                          ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                          : t.quadrant === "Delegate"
                          ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          : t.quadrant === "Defer"
                          ? "bg-slate-500/10 text-slate-600 border border-slate-500/20"
                          : "bg-gray-500/10 text-gray-500 border border-gray-500/20"
                      }`}
                    >
                      {t.quadrant || "Unclassified"}
                    </span>
                    <span className="text-[0.68rem] text-[var(--mt-text-muted)]">
                      #{t.id}
                    </span>
                  </div>

                  <span
                    className={`text-[0.68rem] font-bold px-2 py-0.5 rounded-full ${
                      t.approval_status === "Approved"
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : t.approval_status === "Rejected"
                        ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                        : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                    }`}
                  >
                    ● {t.approval_status}
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-sm font-bold text-[var(--mt-text)] leading-snug">
                    {t.task}
                  </h3>
                  <p className="text-xs text-[var(--mt-text-secondary)] mt-1 leading-relaxed">
                    {t.description}
                  </p>
                </div>

                {/* Evidence Quote */}
                {t.evidence_excerpt && (
                  <div className="p-2.5 rounded-lg bg-[var(--mt-surface-soft)] border-l-2 border-brand-500 text-[0.7rem] text-[var(--mt-text-secondary)] italic flex items-start gap-1.5">
                    <Quote className="w-3 h-3 text-brand-500 flex-shrink-0 mt-0.5" />
                    <span>&ldquo;{t.evidence_excerpt}&rdquo;</span>
                  </div>
                )}

                {/* Assignee & Deadline meta */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[0.72rem] text-[var(--mt-text-muted)] pt-1">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[var(--mt-text)] font-semibold">
                      <User className="w-3.5 h-3.5 text-brand-500" />
                      {t.assigned_to}
                    </span>
                    {t.calendar_synced && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <Calendar className="w-3.5 h-3.5" /> GCal Synced
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <DeadlineBadge
                      deadline={t.deadline}
                      isCompleted={t.status === "Completed"}
                    />
                    <button
                      onClick={() => setDeadlineModalTask(t)}
                      className="text-[0.65rem] font-semibold text-brand-600 hover:underline px-1.5 py-0.5 rounded hover:bg-brand-500/10 transition-colors"
                      title="Edit deadline with natural-language parser"
                    >
                      Change
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Controls */}
              <div className="pt-3 border-t border-[var(--mt-border)] flex items-center justify-between gap-3">
                {/* Status Selector */}
                <select
                  value={t.status}
                  onChange={(e) =>
                    handleStatusChange(t.id, e.target.value as TaskStatus)
                  }
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Blocked">Blocked</option>
                </select>

                {/* Lead Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setReassignModalTask(t);
                      setSelectedUserForReassign(t.assigned_user_id || "");
                    }}
                    className="p-1.5 rounded-lg text-[var(--mt-text-secondary)] hover:text-brand-500 hover:bg-[var(--mt-surface-soft)] transition-colors"
                    title="Reassign Task"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>

                  {t.approval_status !== "Approved" && (
                    <>
                      <button
                        onClick={() => handleReject(t.id)}
                        className="px-2.5 py-1 rounded-lg border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 font-semibold text-xs transition-colors flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Reject
                      </button>
                      <button
                        onClick={() => handleApprove(t.id)}
                        className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <Check className="w-3 h-3" /> Approve &amp; Sync
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reassign Modal */}
      {reassignModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--mt-surface)] border border-[var(--mt-border)] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[var(--mt-text)]">
              Reassign Action Item
            </h3>
            <p className="text-xs text-[var(--mt-text-secondary)]">
              Select team member to assign &ldquo;{reassignModalTask.task}&rdquo;.
            </p>

            <select
              value={selectedUserForReassign}
              onChange={(e) => setSelectedUserForReassign(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
            >
              <option value="">Select team member...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role} — {u.department})
                </option>
              ))}
            </select>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReassignModalTask(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--mt-text-secondary)] hover:bg-[var(--mt-surface-soft)]"
              >
                Cancel
              </button>
              <button
                onClick={handleReassignSubmit}
                disabled={!selectedUserForReassign}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50"
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversational Deadline Modal */}
      {deadlineModalTask && (
        <ConversationalDeadlineModal
          isOpen={true}
          initialText={deadlineModalTask.deadline || "next Friday at 3 PM"}
          taskTitle={deadlineModalTask.task}
          onConfirm={handleDeadlineConfirmed}
          onCancel={() => setDeadlineModalTask(null)}
        />
      )}
    </div>
  );
}
