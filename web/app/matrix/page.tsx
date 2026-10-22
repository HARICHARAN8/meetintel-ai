"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Layers,
  CheckCircle2,
  Clock,
  User,
  Filter,
  Search,
  ArrowUpDown,
  Move,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Calendar,
  CheckSquare,
  ListFilter,
  LayoutGrid,
  List,
  Plus,
  Quote,
  X,
  ShieldAlert,
  HelpCircle,
  ExternalLink,
  RotateCcw,
} from "lucide-react";
import { api } from "@/lib/api";
import { ActionItem, EisenhowerQuadrant, UrgencyLevel, ImportanceLevel, TaskStatus } from "@/lib/types";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { ConversationalDeadlineModal } from "@/components/ConversationalDeadlineModal";
import { ParsedDeadlineResult } from "@/lib/dateParser";

export default function EisenhowerMatrixPage() {
  const [tasks, setTasks] = useState<ActionItem[]>(() => api.getActionItems());
  const [users] = useState(() => api.getUsers());
  const [meetings] = useState(() => api.getMeetings());
  const [viewMode, setViewMode] = useState<"matrix" | "list">("matrix");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeeting, setSelectedMeeting] = useState("All");
  const [selectedOwner, setSelectedOwner] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [sortBy, setSortBy] = useState<"priority" | "deadline" | "created" | "title">("priority");

  // Drag and Drop state
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [dragOverQuadrant, setDragOverQuadrant] = useState<EisenhowerQuadrant | null>(null);

  // Modals state
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<ActionItem | null>(null);
  const [deadlineModalTask, setDeadlineModalTask] = useState<ActionItem | null>(null);
  const [confirmDestructiveTask, setConfirmDestructiveTask] = useState<{ task: ActionItem; action: "reject" | "delete" } | null>(null);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const refreshTasks = () => {
    setTasks(api.getActionItems());
  };

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.task.toLowerCase().includes(q);
        const matchesDesc = (t.description || "").toLowerCase().includes(q);
        const matchesOwner = (t.assigned_to || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesOwner) return false;
      }
      if (selectedMeeting !== "All" && t.meeting_id !== selectedMeeting) return false;
      if (selectedOwner !== "All" && t.assigned_user_id !== selectedOwner && t.assigned_to !== selectedOwner) return false;
      if (selectedStatus !== "All" && t.status !== selectedStatus) return false;
      return true;
    }).sort((a, b) => {
      if (sortBy === "priority") {
        const order: Record<string, number> = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
        return (order[b.priority] || 0) - (order[a.priority] || 0);
      }
      if (sortBy === "created") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "title") {
        return a.task.localeCompare(b.task);
      }
      return (a.deadline || "").localeCompare(b.deadline || "");
    });
  }, [tasks, searchQuery, selectedMeeting, selectedOwner, selectedStatus, sortBy]);

  // Quadrant buckets
  const quadrantMap = useMemo(() => {
    const buckets: Record<EisenhowerQuadrant, ActionItem[]> = {
      "Do First": [],
      "Schedule": [],
      "Delegate": [],
      "Defer": [],
      "Unclassified": [],
    };
    filteredTasks.forEach((task) => {
      const q = task.quadrant || "Unclassified";
      if (buckets[q]) {
        buckets[q].push(task);
      } else {
        buckets["Unclassified"].push(task);
      }
    });
    return buckets;
  }, [filteredTasks]);

  // Quadrant move handler
  const handleMoveQuadrant = (taskId: number, newQuadrant: EisenhowerQuadrant) => {
    let urgency: UrgencyLevel | null = null;
    let importance: ImportanceLevel | null = null;

    if (newQuadrant === "Do First") {
      urgency = "Urgent";
      importance = "Important";
    } else if (newQuadrant === "Schedule") {
      urgency = "Not Urgent";
      importance = "Important";
    } else if (newQuadrant === "Delegate") {
      urgency = "Urgent";
      importance = "Not Important";
    } else if (newQuadrant === "Defer") {
      urgency = "Not Urgent";
      importance = "Not Important";
    }

    const updated = api.updateActionItemMatrix(taskId, urgency, importance);
    if (updated) {
      refreshTasks();
      showToast(`Task moved to ${newQuadrant}`);
      if (selectedTaskDetail?.id === taskId) {
        setSelectedTaskDetail(updated);
      }
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData("text/plain", String(taskId));
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, quadrant: EisenhowerQuadrant) => {
    e.preventDefault();
    if (dragOverQuadrant !== quadrant) {
      setDragOverQuadrant(quadrant);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, quadrant: EisenhowerQuadrant) => {
    e.preventDefault();
    setDragOverQuadrant(null);
    const taskIdStr = e.dataTransfer.getData("text/plain");
    const taskId = parseInt(taskIdStr, 10);
    if (!isNaN(taskId)) {
      handleMoveQuadrant(taskId, quadrant);
    }
    setDraggedTaskId(null);
  };

  // Task Status toggle
  const handleToggleStatus = (task: ActionItem) => {
    const nextStatus: TaskStatus = task.status === "Completed" ? "In Progress" : "Completed";
    api.updateActionItemStatus(task.id, nextStatus);
    refreshTasks();
    showToast(`Task marked as ${nextStatus}`);
  };

  // Conversational deadline confirmed
  const handleDeadlineConfirmed = (parsed: ParsedDeadlineResult) => {
    if (deadlineModalTask) {
      api.updateActionItemDeadline(deadlineModalTask.id, parsed.parsedIso || parsed.rawInput);
      refreshTasks();
      showToast(`Deadline set to ${parsed.formattedLocal}`);
      setDeadlineModalTask(null);
    }
  };

  // Destructive action confirm
  const handleConfirmDestructive = () => {
    if (confirmDestructiveTask) {
      const { task, action } = confirmDestructiveTask;
      if (action === "reject") {
        api.rejectActionItem(task.id, "user-sarah-002", "Rejected via Matrix");
        showToast(`Task #${task.id} rejected and removed from execution.`);
      }
      refreshTasks();
      setConfirmDestructiveTask(null);
      if (selectedTaskDetail?.id === task.id) {
        setSelectedTaskDetail(null);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-[var(--mt-surface)] border border-brand-500/30 text-xs font-semibold text-[var(--mt-text)] shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <Sparkles className="w-4 h-4 text-brand-500" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--mt-border)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[0.68rem] font-bold uppercase tracking-wider text-brand-500 bg-brand-500/10 px-2.5 py-0.5 rounded-full border border-brand-500/20">
              Strategic Prioritization
            </span>
            <span className="text-[0.68rem] font-medium text-[var(--mt-text-secondary)]">
              {filteredTasks.length} Commitments Indexed
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--mt-text)]">
            Eisenhower Priority Matrix
          </h1>
          <p className="text-xs text-[var(--mt-text-secondary)] mt-1 max-w-2xl">
            Prioritize meeting action items across urgency and strategic importance. Drag cards between quadrants or use accessible controls to govern execution focus.
          </p>
        </div>

        {/* View Switcher & Quick Navigation */}
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-xl bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] flex items-center gap-1">
            <button
              onClick={() => setViewMode("matrix")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "matrix"
                  ? "bg-[var(--mt-surface)] text-brand-600 shadow-sm border border-[var(--mt-border)]"
                  : "text-[var(--mt-text-secondary)] hover:text-[var(--mt-text)]"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>2×2 Matrix</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "list"
                  ? "bg-[var(--mt-surface)] text-brand-600 shadow-sm border border-[var(--mt-border)]"
                  : "text-[var(--mt-text-secondary)] hover:text-[var(--mt-text)]"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Compact Table</span>
            </button>
          </div>

          <Link
            href="/calendar"
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand-500/10 text-brand-600 border border-brand-500/20 hover:bg-brand-500/20 transition-all flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Calendar View</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mt-text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search action items by title, owner, or description..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] placeholder-[var(--mt-text-muted)] focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Meeting Filter */}
          <select
            value={selectedMeeting}
            onChange={(e) => setSelectedMeeting(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
          >
            <option value="All">All Source Meetings</option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>

          {/* Owner Filter */}
          <select
            value={selectedOwner}
            onChange={(e) => setSelectedOwner(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
          >
            <option value="All">All Owners</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Blocked">Blocked</option>
          </select>
        </div>

        {/* Sort By */}
        <div className="flex items-center gap-2 text-[var(--mt-text-secondary)]">
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span className="font-semibold text-[0.72rem]">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
          >
            <option value="priority">Priority Severity</option>
            <option value="deadline">Target Deadline</option>
            <option value="created">Extraction Date</option>
            <option value="title">Task Title</option>
          </select>
        </div>
      </div>

      {/* Unclassified / Needs Review Drawer */}
      {quadrantMap["Unclassified"].length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/25 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center font-bold text-xs">
                !
              </span>
              <div>
                <h3 className="text-xs font-bold text-[var(--mt-text)]">
                  Unclassified Commitments ({quadrantMap["Unclassified"].length} Awaiting Quadrant Placement)
                </h3>
                <p className="text-[0.68rem] text-[var(--mt-text-secondary)]">
                  These tasks lack explicit urgency or importance classification. Assign them to a quadrant to activate prioritization.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {quadrantMap["Unclassified"].map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => handleDragStart(e, task.id)}
                className="p-3.5 rounded-xl bg-[var(--mt-surface)] border border-amber-500/20 shadow-sm hover:border-amber-500/40 transition-all space-y-2 text-xs cursor-grab"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-[var(--mt-text)] leading-snug line-clamp-2">
                    {task.task}
                  </div>
                  <span className="text-[0.65rem] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full flex-shrink-0">
                    Needs Review
                  </span>
                </div>
                <div className="flex items-center justify-between text-[0.7rem] text-[var(--mt-text-secondary)] pt-1 border-t border-[var(--mt-border)]">
                  <span>{task.assigned_to}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveQuadrant(task.id, "Do First")}
                      className="px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 font-semibold text-[0.65rem]"
                      title="Move to Do First (Urgent + Important)"
                    >
                      Do First
                    </button>
                    <button
                      onClick={() => handleMoveQuadrant(task.id, "Schedule")}
                      className="px-1.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 font-semibold text-[0.65rem]"
                      title="Move to Schedule (Not Urgent + Important)"
                    >
                      Schedule
                    </button>
                    <button
                      onClick={() => handleMoveQuadrant(task.id, "Delegate")}
                      className="px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 font-semibold text-[0.65rem]"
                      title="Move to Delegate (Urgent + Not Important)"
                    >
                      Delegate
                    </button>
                    <button
                      onClick={() => handleMoveQuadrant(task.id, "Defer")}
                      className="px-1.5 py-0.5 rounded bg-slate-500/10 hover:bg-slate-500/20 text-slate-600 font-semibold text-[0.65rem]"
                      title="Move to Defer (Not Urgent + Not Important)"
                    >
                      Defer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main View: Matrix or Table */}
      {viewMode === "matrix" ? (
        <div className="space-y-4">
          {/* Axis Labels Overview */}
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="py-2 px-3 rounded-xl bg-brand-500/5 border border-brand-500/15 text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider flex items-center justify-center gap-2">
              <span>▲ Urgent (Immediate Timeframe)</span>
            </div>
            <div className="py-2 px-3 rounded-xl bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-xs font-bold text-[var(--mt-text-secondary)] uppercase tracking-wider flex items-center justify-center gap-2">
              <span>▼ Not Urgent (Strategic Timeframe)</span>
            </div>
          </div>

          {/* 2×2 Matrix Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* QUADRANT 1: URGENT + IMPORTANT -> DO FIRST */}
            <div
              onDragOver={(e) => handleDragOver(e, "Do First")}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, "Do First")}
              className={`p-5 rounded-2xl bg-[var(--mt-surface)] border-2 transition-all flex flex-col justify-between min-h-[420px] ${
                dragOverQuadrant === "Do First"
                  ? "border-rose-500 shadow-xl bg-rose-500/5 ring-4 ring-rose-500/10"
                  : "border-rose-500/30 hover:border-rose-500/50 shadow-card"
              }`}
            >
              <div className="space-y-3">
                {/* Quadrant Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--mt-border)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 font-bold flex items-center justify-center text-xs">
                      Q1
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[var(--mt-text)] leading-none flex items-center gap-1.5">
                        <span>Do First</span>
                        <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                          {quadrantMap["Do First"].length}
                        </span>
                      </h2>
                      <div className="text-[0.68rem] text-[var(--mt-text-secondary)] mt-1">
                        Urgent + Important • Execute immediately
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="space-y-2.5">
                  {quadrantMap["Do First"].length === 0 ? (
                    <div className="py-12 text-center text-xs text-[var(--mt-text-muted)] border border-dashed border-[var(--mt-border)] rounded-xl">
                      <CheckCircle2 className="w-7 h-7 mx-auto mb-2 text-rose-500/40" />
                      No urgent & important tasks pending. Drop cards here.
                    </div>
                  ) : (
                    quadrantMap["Do First"].map((task) => (
                      <TaskMatrixCard
                        key={task.id}
                        task={task}
                        currentQuadrant="Do First"
                        onDragStart={handleDragStart}
                        onMoveQuadrant={handleMoveQuadrant}
                        onToggleStatus={handleToggleStatus}
                        onOpenDetail={setSelectedTaskDetail}
                        onEditDeadline={setDeadlineModalTask}
                        onRejectTask={(t) => setConfirmDestructiveTask({ task: t, action: "reject" })}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* QUADRANT 2: NOT URGENT + IMPORTANT -> SCHEDULE */}
            <div
              onDragOver={(e) => handleDragOver(e, "Schedule")}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, "Schedule")}
              className={`p-5 rounded-2xl bg-[var(--mt-surface)] border-2 transition-all flex flex-col justify-between min-h-[420px] ${
                dragOverQuadrant === "Schedule"
                  ? "border-blue-500 shadow-xl bg-blue-500/5 ring-4 ring-blue-500/10"
                  : "border-blue-500/30 hover:border-blue-500/50 shadow-card"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--mt-border)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-600 font-bold flex items-center justify-center text-xs">
                      Q2
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[var(--mt-text)] leading-none flex items-center gap-1.5">
                        <span>Schedule</span>
                        <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          {quadrantMap["Schedule"].length}
                        </span>
                      </h2>
                      <div className="text-[0.68rem] text-[var(--mt-text-secondary)] mt-1">
                        Not Urgent + Important • Plan on calendar
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {quadrantMap["Schedule"].length === 0 ? (
                    <div className="py-12 text-center text-xs text-[var(--mt-text-muted)] border border-dashed border-[var(--mt-border)] rounded-xl">
                      <Calendar className="w-7 h-7 mx-auto mb-2 text-blue-500/40" />
                      No scheduled strategic tasks. Drop cards here.
                    </div>
                  ) : (
                    quadrantMap["Schedule"].map((task) => (
                      <TaskMatrixCard
                        key={task.id}
                        task={task}
                        currentQuadrant="Schedule"
                        onDragStart={handleDragStart}
                        onMoveQuadrant={handleMoveQuadrant}
                        onToggleStatus={handleToggleStatus}
                        onOpenDetail={setSelectedTaskDetail}
                        onEditDeadline={setDeadlineModalTask}
                        onRejectTask={(t) => setConfirmDestructiveTask({ task: t, action: "reject" })}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* QUADRANT 3: URGENT + NOT IMPORTANT -> DELEGATE */}
            <div
              onDragOver={(e) => handleDragOver(e, "Delegate")}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, "Delegate")}
              className={`p-5 rounded-2xl bg-[var(--mt-surface)] border-2 transition-all flex flex-col justify-between min-h-[420px] ${
                dragOverQuadrant === "Delegate"
                  ? "border-amber-500 shadow-xl bg-amber-500/5 ring-4 ring-amber-500/10"
                  : "border-amber-500/30 hover:border-amber-500/50 shadow-card"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--mt-border)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 font-bold flex items-center justify-center text-xs">
                      Q3
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[var(--mt-text)] leading-none flex items-center gap-1.5">
                        <span>Delegate</span>
                        <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          {quadrantMap["Delegate"].length}
                        </span>
                      </h2>
                      <div className="text-[0.68rem] text-[var(--mt-text-secondary)] mt-1">
                        Urgent + Not Important • Reassign to colleagues
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {quadrantMap["Delegate"].length === 0 ? (
                    <div className="py-12 text-center text-xs text-[var(--mt-text-muted)] border border-dashed border-[var(--mt-border)] rounded-xl">
                      <User className="w-7 h-7 mx-auto mb-2 text-amber-500/40" />
                      No items to delegate. Drop cards here.
                    </div>
                  ) : (
                    quadrantMap["Delegate"].map((task) => (
                      <TaskMatrixCard
                        key={task.id}
                        task={task}
                        currentQuadrant="Delegate"
                        onDragStart={handleDragStart}
                        onMoveQuadrant={handleMoveQuadrant}
                        onToggleStatus={handleToggleStatus}
                        onOpenDetail={setSelectedTaskDetail}
                        onEditDeadline={setDeadlineModalTask}
                        onRejectTask={(t) => setConfirmDestructiveTask({ task: t, action: "reject" })}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* QUADRANT 4: NOT URGENT + NOT IMPORTANT -> DEFER / ELIMINATE */}
            <div
              onDragOver={(e) => handleDragOver(e, "Defer")}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, "Defer")}
              className={`p-5 rounded-2xl bg-[var(--mt-surface)] border-2 transition-all flex flex-col justify-between min-h-[420px] ${
                dragOverQuadrant === "Defer"
                  ? "border-slate-500 shadow-xl bg-slate-500/5 ring-4 ring-slate-500/10"
                  : "border-slate-500/30 hover:border-slate-500/50 shadow-card"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--mt-border)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-slate-500/15 text-slate-600 font-bold flex items-center justify-center text-xs">
                      Q4
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[var(--mt-text)] leading-none flex items-center gap-1.5">
                        <span>Defer or Eliminate</span>
                        <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-600 border border-slate-500/20">
                          {quadrantMap["Defer"].length}
                        </span>
                      </h2>
                      <div className="text-[0.68rem] text-[var(--mt-text-secondary)] mt-1">
                        Not Urgent + Not Important • Backlog or drop
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {quadrantMap["Defer"].length === 0 ? (
                    <div className="py-12 text-center text-xs text-[var(--mt-text-muted)] border border-dashed border-[var(--mt-border)] rounded-xl">
                      <Clock className="w-7 h-7 mx-auto mb-2 text-slate-500/40" />
                      No deferred items. Drop low-priority items here.
                    </div>
                  ) : (
                    quadrantMap["Defer"].map((task) => (
                      <TaskMatrixCard
                        key={task.id}
                        task={task}
                        currentQuadrant="Defer"
                        onDragStart={handleDragStart}
                        onMoveQuadrant={handleMoveQuadrant}
                        onToggleStatus={handleToggleStatus}
                        onOpenDetail={setSelectedTaskDetail}
                        onEditDeadline={setDeadlineModalTask}
                        onRejectTask={(t) => setConfirmDestructiveTask({ task: t, action: "reject" })}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Compact Table View */
        <div className="rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--mt-border)] bg-[var(--mt-surface-soft)] text-[0.7rem] font-bold text-[var(--mt-text-secondary)] uppercase tracking-wider">
                  <th className="py-3 px-4">Task Deliverable</th>
                  <th className="py-3 px-4">Quadrant</th>
                  <th className="py-3 px-4">Owner</th>
                  <th className="py-3 px-4">Deadline & Countdown</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--mt-border)]">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[var(--mt-text-muted)]">
                      No commitments match the active filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => (
                    <tr
                      key={task.id}
                      className="hover:bg-[var(--mt-surface-soft)] transition-colors cursor-pointer group"
                      onClick={() => setSelectedTaskDetail(task)}
                    >
                      <td className="py-3 px-4 font-semibold text-[var(--mt-text)] max-w-xs">
                        <div className="line-clamp-1">{task.task}</div>
                        <div className="text-[0.68rem] text-[var(--mt-text-secondary)] font-normal line-clamp-1">
                          {task.meeting_title || "Direct Assignment"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[0.65rem] font-bold ${
                            task.quadrant === "Do First"
                              ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                              : task.quadrant === "Schedule"
                              ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                              : task.quadrant === "Delegate"
                              ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                              : task.quadrant === "Defer"
                              ? "bg-slate-500/10 text-slate-600 border border-slate-500/20"
                              : "bg-gray-500/10 text-gray-500 border border-gray-500/20"
                          }`}
                        >
                          {task.quadrant || "Unclassified"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[var(--mt-text)]">{task.assigned_to}</td>
                      <td className="py-3 px-4">
                        <DeadlineBadge
                          deadline={task.deadline}
                          isCompleted={task.status === "Completed"}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[0.65rem] font-bold ${
                            task.status === "Completed"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : task.status === "Blocked"
                              ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                              : task.status === "In Progress"
                              ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                              : "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          }`}
                        >
                          {task.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleStatus(task)}
                            className="p-1 rounded hover:bg-[var(--mt-surface-soft)] text-emerald-600"
                            title={task.status === "Completed" ? "Reopen" : "Complete"}
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeadlineModalTask(task)}
                            className="p-1 rounded hover:bg-[var(--mt-surface-soft)] text-brand-600"
                            title="Edit Deadline"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTaskDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-[var(--mt-border)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[0.68rem] font-bold uppercase tracking-wider text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-full">
                  Task #{selectedTaskDetail.id}
                </span>
                <span className="text-xs text-[var(--mt-text-secondary)]">
                  {selectedTaskDetail.meeting_title}
                </span>
              </div>
              <button
                onClick={() => setSelectedTaskDetail(null)}
                className="p-1.5 rounded-lg text-[var(--mt-text-secondary)] hover:bg-[var(--mt-surface-soft)] hover:text-[var(--mt-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              <div>
                <h3 className="text-base font-bold text-[var(--mt-text)]">
                  {selectedTaskDetail.task}
                </h3>
                <p className="text-[var(--mt-text-secondary)] mt-1.5 leading-relaxed">
                  {selectedTaskDetail.description || "No extended description provided."}
                </p>
              </div>

              {/* Evidence Quote */}
              {selectedTaskDetail.evidence_excerpt && (
                <div className="p-3.5 rounded-xl bg-brand-500/5 border border-brand-500/15 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[0.7rem] text-brand-600 dark:text-brand-400 uppercase tracking-wide">
                    <Quote className="w-3.5 h-3.5" />
                    <span>Verbatim Dialogue Evidence</span>
                  </div>
                  <p className="text-[var(--mt-text)] italic text-xs leading-relaxed">
                    "{selectedTaskDetail.evidence_excerpt}"
                  </p>
                </div>
              )}

              {/* Classification Selector */}
              <div className="p-4 rounded-xl bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] space-y-3">
                <div className="font-bold text-[var(--mt-text)]">
                  Eisenhower Quadrant Classification
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "Do First", label: "Do First (Urgent + Important)", color: "text-rose-600" },
                    { id: "Schedule", label: "Schedule (Not Urgent + Important)", color: "text-blue-600" },
                    { id: "Delegate", label: "Delegate (Urgent + Not Important)", color: "text-amber-600" },
                    { id: "Defer", label: "Defer (Not Urgent + Not Important)", color: "text-slate-600" },
                  ].map((q) => (
                    <button
                      key={q.id}
                      onClick={() => handleMoveQuadrant(selectedTaskDetail.id, q.id as any)}
                      className={`p-2.5 rounded-lg text-left text-xs font-semibold border transition-all ${
                        selectedTaskDetail.quadrant === q.id
                          ? "bg-[var(--mt-surface)] border-brand-500 shadow-sm ring-2 ring-brand-500/20"
                          : "bg-[var(--mt-surface)] border-[var(--mt-border)] hover:border-brand-500/40 text-[var(--mt-text)]"
                      }`}
                    >
                      <span className={q.color}>● </span>
                      <span>{q.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[var(--mt-surface-soft)] border border-[var(--mt-border)]">
                  <span className="text-[var(--mt-text-secondary)] block text-[0.68rem]">Assigned Owner</span>
                  <span className="font-bold text-[var(--mt-text)] mt-0.5 block">{selectedTaskDetail.assigned_to}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--mt-surface-soft)] border border-[var(--mt-border)]">
                  <span className="text-[var(--mt-text-secondary)] block text-[0.68rem]">Target Deadline</span>
                  <div className="mt-1">
                    <DeadlineBadge
                      deadline={selectedTaskDetail.deadline}
                      isCompleted={selectedTaskDetail.status === "Completed"}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-[var(--mt-border)] bg-[var(--mt-surface)] flex items-center justify-between">
              <button
                onClick={() => setConfirmDestructiveTask({ task: selectedTaskDetail, action: "reject" })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-500/10 transition-colors"
              >
                Reject Task
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDeadlineModalTask(selectedTaskDetail)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--mt-surface-soft)] text-[var(--mt-text)] border border-[var(--mt-border)] hover:bg-brand-500/10 hover:text-brand-600 transition-colors"
                >
                  Edit Deadline
                </button>
                <button
                  onClick={() => handleToggleStatus(selectedTaskDetail)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-brand-500 text-white hover:bg-brand-600 shadow-sm transition-colors"
                >
                  {selectedTaskDetail.status === "Completed" ? "Reopen Task" : "Mark as Completed"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Natural Language Deadline Modal */}
      {deadlineModalTask && (
        <ConversationalDeadlineModal
          isOpen={true}
          initialText={deadlineModalTask.deadline || "next Friday at 3 PM"}
          taskTitle={deadlineModalTask.task}
          onConfirm={handleDeadlineConfirmed}
          onCancel={() => setDeadlineModalTask(null)}
        />
      )}

      {/* Destructive Action Confirmation Modal */}
      {confirmDestructiveTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[var(--mt-surface)] border border-rose-500/30 rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/15 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--mt-text)]">
                  Confirm Destructive Action
                </h3>
                <p className="text-xs text-[var(--mt-text-secondary)] mt-0.5">
                  Are you sure you want to reject Task #{confirmDestructiveTask.task.id}?
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--mt-text-secondary)] bg-[var(--mt-surface-soft)] p-3 rounded-xl border border-[var(--mt-border)]">
              "{confirmDestructiveTask.task.task}"
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDestructiveTask(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--mt-text-secondary)] hover:bg-[var(--mt-surface-soft)]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDestructive}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent: Task Card within a Quadrant
interface TaskMatrixCardProps {
  task: ActionItem;
  currentQuadrant: EisenhowerQuadrant;
  onDragStart: (e: React.DragEvent, id: number) => void;
  onMoveQuadrant: (id: number, target: EisenhowerQuadrant) => void;
  onToggleStatus: (t: ActionItem) => void;
  onOpenDetail: (t: ActionItem) => void;
  onEditDeadline: (t: ActionItem) => void;
  onRejectTask: (t: ActionItem) => void;
}

const TaskMatrixCard: React.FC<TaskMatrixCardProps> = ({
  task,
  currentQuadrant,
  onDragStart,
  onMoveQuadrant,
  onToggleStatus,
  onOpenDetail,
  onEditDeadline,
  onRejectTask,
}) => {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onOpenDetail(task)}
      className="p-3.5 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-sm hover:border-brand-500/40 hover:shadow-md transition-all space-y-2 text-xs cursor-pointer group select-none relative"
    >
      {/* Title & Priority */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-[var(--mt-text)] leading-snug line-clamp-2 group-hover:text-brand-600 transition-colors">
          {task.task}
        </h4>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus(task);
          }}
          className={`p-1 rounded-md transition-colors flex-shrink-0 ${
            task.status === "Completed"
              ? "text-emerald-600 bg-emerald-500/10"
              : "text-[var(--mt-text-muted)] hover:text-emerald-600 hover:bg-emerald-500/10"
          }`}
          title={task.status === "Completed" ? "Reopen" : "Mark as completed"}
        >
          <CheckSquare className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Deadline Badge */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <DeadlineBadge
          deadline={task.deadline}
          isCompleted={task.status === "Completed"}
        />
        {task.meeting_title && (
          <span className="text-[0.65rem] text-[var(--mt-text-muted)] truncate max-w-[120px]">
            • {task.meeting_title}
          </span>
        )}
      </div>

      {/* Footer: Owner and Quick Move Controls */}
      <div
        className="flex items-center justify-between text-[0.7rem] text-[var(--mt-text-secondary)] pt-2 border-t border-[var(--mt-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 font-medium truncate max-w-[130px]">
          <div className="w-4 h-4 rounded-full bg-brand-500/15 text-brand-600 flex items-center justify-center font-bold text-[0.6rem] flex-shrink-0">
            {task.assigned_to.charAt(0)}
          </div>
          <span className="truncate">{task.assigned_to}</span>
        </div>

        {/* Accessible Move Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMoveMenu(!showMoveMenu)}
            className="px-2 py-0.5 rounded text-[0.65rem] font-semibold bg-[var(--mt-surface-soft)] text-[var(--mt-text-secondary)] hover:bg-brand-500/10 hover:text-brand-600 transition-colors flex items-center gap-1"
          >
            <span>Move</span>
            <ChevronRight className="w-2.5 h-2.5" />
          </button>

          {showMoveMenu && (
            <div className="absolute right-0 bottom-full mb-1 z-30 w-36 py-1 bg-[var(--mt-surface)] border border-[var(--mt-border)] rounded-xl shadow-xl text-[0.7rem] font-medium space-y-0.5 animate-in fade-in">
              {currentQuadrant !== "Do First" && (
                <button
                  onClick={() => {
                    onMoveQuadrant(task.id, "Do First");
                    setShowMoveMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-500/10 text-rose-600 transition-colors"
                >
                  Do First (Q1)
                </button>
              )}
              {currentQuadrant !== "Schedule" && (
                <button
                  onClick={() => {
                    onMoveQuadrant(task.id, "Schedule");
                    setShowMoveMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-blue-500/10 text-blue-600 transition-colors"
                >
                  Schedule (Q2)
                </button>
              )}
              {currentQuadrant !== "Delegate" && (
                <button
                  onClick={() => {
                    onMoveQuadrant(task.id, "Delegate");
                    setShowMoveMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-amber-500/10 text-amber-600 transition-colors"
                >
                  Delegate (Q3)
                </button>
              )}
              {currentQuadrant !== "Defer" && (
                <button
                  onClick={() => {
                    onMoveQuadrant(task.id, "Defer");
                    setShowMoveMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-500/10 text-slate-600 transition-colors"
                >
                  Defer (Q4)
                </button>
              )}
              <div className="border-t border-[var(--mt-border)] my-1"></div>
              <button
                onClick={() => {
                  onEditDeadline(task);
                  setShowMoveMenu(false);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[var(--mt-surface-soft)] text-brand-600"
              >
                Change Deadline
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
