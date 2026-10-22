"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  CheckSquare,
  Scale,
  Sparkles,
  Download,
  FileText,
  MessageSquare,
  Search,
  Quote,
  AlertTriangle,
  Send,
  CheckCircle2,
  Check,
  ExternalLink,
  Layers,
  ShieldCheck,
  CalendarDays,
} from "lucide-react";
import { api } from "@/lib/api";
import { DeadlineBadge } from "@/components/DeadlineBadge";

export default function MeetingDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const meeting = api.getMeetingById(id) || api.getMeetings()[0];

  const [activeTab, setActiveTab] = useState<
    "overview" | "action_items" | "participants" | "deadlines" | "priorities" | "transcript" | "ask_ai" | "mom"
  >("overview");

  const [actionItems, setActionItems] = useState(() => api.getActionItems());
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [askQuestion, setAskQuestion] = useState("");
  const [askHistory, setAskHistory] = useState<
    Array<{ q: string; a: string; sources: Array<{ title: string; excerpt: string }> }>
  >([
    {
      q: "What was decided regarding OAuth 2.0?",
      a: "The team led by Sarah Jenkins approved mandatory migration to OAuth 2.0 with PKCE for all client authentication by Q4. Alex Chen is assigned to complete the core integration by Friday, Oct 24th.",
      sources: [
        {
          title: "Q3 Architecture & Security Alignment",
          excerpt: "Alex Chen: I will complete the OAuth 2.0 PKCE integration by this Friday.",
        },
      ],
    },
  ]);

  const handleApprove = (taskId: number) => {
    const updated = api.approveActionItem(taskId, "user-sarah-002");
    if (updated) {
      setActionItems(api.getActionItems());
    }
  };

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!askQuestion.trim()) return;
    const res = api.askAI(askQuestion);
    setAskHistory([...askHistory, { q: askQuestion, a: res.answer, sources: res.sources }]);
    setAskQuestion("");
  };

  const handleExport = (format: "pdf" | "docx" | "csv") => {
    alert(
      `Downloading Minutes of Meeting (MoM) in .${format.toUpperCase()} format...\nDocument ID: MoM_${meeting.id}.${format}`
    );
  };

  const durationMin = Math.floor(meeting.duration / 60);
  const durationSec = meeting.duration % 60;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "action_items", label: "Action Items" },
    { id: "participants", label: "Participants" },
    { id: "deadlines", label: "Deadlines" },
    { id: "priorities", label: "Priorities" },
    { id: "transcript", label: "Transcript" },
    { id: "ask_ai", label: "Ask AI" },
    { id: "mom", label: "Minutes of Meeting (MoM)" },
  ] as const;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Back button */}
      <div>
        <Link
          href="/meetings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-500 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Meeting Library
        </Link>
      </div>

      {/* Hero Dossier Card */}
      <div className="p-6 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[0.65rem] font-bold uppercase tracking-wider text-brand-500 bg-brand-500/10 px-2.5 py-0.5 rounded-full border border-brand-500/20">
              INTELLIGENCE DOSSIER • {meeting.source_platform.replace("_", " ").toUpperCase()}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Fully Processed
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-[var(--mt-text)]">
            {meeting.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--mt-text-secondary)]">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(meeting.date).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {durationMin}m {durationSec}s
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {meeting.speaker_count} Speakers
            </span>
          </div>
        </div>

        {/* Quick Export Action */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => handleExport("pdf")}
            className="px-3 py-1.5 rounded-lg bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] hover:border-brand-500/40 text-xs font-semibold text-[var(--mt-text)] transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-brand-500" /> PDF
          </button>
          <button
            onClick={() => handleExport("docx")}
            className="px-3 py-1.5 rounded-lg bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] hover:border-brand-500/40 text-xs font-semibold text-[var(--mt-text)] transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-blue-500" /> DOCX
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[var(--mt-border)] flex items-center gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
              activeTab === tab.id
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-[var(--mt-text-secondary)] hover:text-[var(--mt-text)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card space-y-4">
              <h3 className="text-sm font-bold text-[var(--mt-text)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-500" /> Executive Summary
              </h3>
              <p className="text-xs text-[var(--mt-text-secondary)] leading-relaxed">
                {meeting.executive_summary}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card space-y-2 text-xs">
                <div className="font-bold text-[var(--mt-text)]">Meeting Objective</div>
                <div className="text-[var(--mt-text-secondary)] leading-relaxed">
                  {meeting.meeting_objective || "Finalize sprint deliverables and architecture alignment."}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card space-y-2 text-xs">
                <div className="font-bold text-[var(--mt-text)]">Tone & Emotional Analysis</div>
                <div className="text-[var(--mt-text-secondary)] leading-relaxed">
                  {meeting.emotional_analysis || "Decisive, collaborative, and focused."}
                </div>
              </div>
            </div>

            {meeting.key_points && (
              <div className="p-5 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card space-y-3">
                <div className="text-xs font-bold text-[var(--mt-text)]">Key Discussion Points</div>
                <ul className="space-y-1.5 text-xs text-[var(--mt-text-secondary)] list-disc pl-4">
                  {meeting.key_points.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ACTION ITEMS */}
        {activeTab === "action_items" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--mt-text-secondary)]">
                Extracted commitments and accountability register for this session.
              </span>
              <Link
                href="/matrix"
                className="px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 text-xs font-semibold hover:bg-brand-500/20 transition-colors flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Open in Priority Matrix</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {actionItems
                .filter((ai) => ai.meeting_id === meeting.id || !ai.meeting_id)
                .map((ai) => (
                  <div
                    key={ai.id}
                    className="p-5 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card space-y-3 text-xs flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[0.68rem] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-500 border border-brand-500/20">
                            {ai.priority}
                          </span>
                          {ai.quadrant && (
                            <span className="font-semibold text-[0.65rem] px-2 py-0.5 rounded-full bg-[var(--mt-surface-soft)] text-[var(--mt-text-secondary)] border border-[var(--mt-border)]">
                              {ai.quadrant}
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[0.68rem] font-semibold px-2 py-0.5 rounded-full ${
                            ai.approval_status === "Approved"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          ● {ai.approval_status}
                        </span>
                      </div>

                      <div className="font-bold text-sm text-[var(--mt-text)]">{ai.task}</div>
                      <div className="text-[var(--mt-text-secondary)] leading-relaxed">
                        {ai.description}
                      </div>

                      {/* Evidence Quote */}
                      {ai.evidence_excerpt && (
                        <div className="p-2.5 rounded-lg bg-[var(--mt-surface-soft)] border-l-2 border-brand-500 text-[0.7rem] text-[var(--mt-text-secondary)] italic flex items-start gap-1.5">
                          <Quote className="w-3.5 h-3.5 text-brand-500 flex-shrink-0 mt-0.5" />
                          <span>&ldquo;{ai.evidence_excerpt}&rdquo;</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[var(--mt-border)] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[0.72rem] text-[var(--mt-text-muted)]">
                          Assignee: <strong className="text-[var(--mt-text)]">{ai.assigned_to}</strong>
                        </span>
                        <DeadlineBadge deadline={ai.deadline} isCompleted={ai.status === "Completed"} />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <Link
                          href="/calendar"
                          className="text-[0.7rem] text-brand-500 hover:underline flex items-center gap-1 font-medium"
                        >
                          <CalendarDays className="w-3 h-3" />
                          <span>{ai.calendar_synced ? "Synced to Calendar" : "Pending Sync"}</span>
                        </Link>

                        {ai.approval_status !== "Approved" && (
                          <button
                            onClick={() => handleApprove(ai.id)}
                            className="px-2.5 py-1 rounded-md bg-brand-500 hover:bg-brand-600 text-white font-semibold text-[0.72rem] transition-colors flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Approve</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 3: PARTICIPANTS */}
        {activeTab === "participants" && (
          <div className="p-5 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card">
            <h3 className="text-xs font-bold text-[var(--mt-text)] mb-3">
              Participant Mapping & Attendance
            </h3>
            <div className="divide-y divide-[var(--mt-border)]">
              {(meeting.participants || []).map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-[var(--mt-text)]">{p.name}</div>
                    <div className="text-[0.7rem] text-[var(--mt-text-secondary)]">
                      {p.responsibilities.join(", ")}
                    </div>
                  </div>
                  <span
                    className={`text-[0.68rem] font-semibold px-2 py-0.5 rounded-full ${
                      p.attendance_status === "Attended"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-rose-500/10 text-rose-600"
                    }`}
                  >
                    {p.attendance_status || "Attended"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: DEADLINES */}
        {activeTab === "deadlines" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--mt-text-secondary)]">
                Chronological timeline of commitments agreed upon in this session.
              </span>
              <Link
                href="/calendar"
                className="px-3 py-1.5 rounded-lg bg-[var(--mt-surface-soft)] hover:bg-brand-500 hover:text-white border border-[var(--mt-border)] text-xs font-semibold text-[var(--mt-text)] transition-all flex items-center gap-1.5"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>View Full Schedule</span>
              </Link>
            </div>

            <div className="space-y-3">
              {((meeting.deadlines && meeting.deadlines.length > 0)
                ? meeting.deadlines
                : [
                    {
                      id: 1,
                      description: "Deliverable Milestones",
                      date: "Friday, October 24th",
                      related_task: "Sprint Architecture Completion",
                    },
                  ]
              ).map((dl, idx) => (
                <div
                  key={dl.id || idx}
                  className="p-4 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[var(--mt-text)]">
                        {dl.description}
                      </span>
                    </div>
                    {dl.related_task && (
                      <div className="text-[0.72rem] text-[var(--mt-text-secondary)] flex items-center gap-1.5">
                        <CheckSquare className="w-3 h-3 text-brand-500" />
                        <span>Related task: {dl.related_task}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <DeadlineBadge deadline={dl.date} />
                    <Link
                      href="/calendar"
                      className="px-3 py-1 rounded-md bg-[var(--mt-surface-soft)] hover:bg-brand-500/10 text-[var(--mt-text)] border border-[var(--mt-border)] text-[0.72rem] font-semibold transition-colors flex items-center gap-1"
                    >
                      <Calendar className="w-3 h-3 text-brand-500" />
                      <span>Calendar</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: PRIORITIES */}
        {activeTab === "priorities" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--mt-text-secondary)]">
                Priority weighting, critical focus areas, and Eisenhower quadrant allocations.
              </span>
              <Link
                href="/matrix"
                className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Open Priority Matrix</span>
              </Link>
            </div>

            {/* Meeting Priorities List */}
            <div className="space-y-3">
              {(meeting.priorities || [
                { id: 1, item: "Core Security Architecture", priority_level: "High" },
                { id: 2, item: "Performance & Connection Pooling", priority_level: "Urgent" },
              ]).map((pr, idx) => (
                <div
                  key={pr.id || idx}
                  className="p-4 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card flex items-center justify-between text-xs"
                >
                  <div className="font-semibold text-[var(--mt-text)] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>{pr.item}</span>
                  </div>
                  <span
                    className={`font-bold text-[0.68rem] px-2.5 py-0.5 rounded-full ${
                      pr.priority_level === "Urgent"
                        ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                        : "bg-brand-500/10 text-brand-600 border border-brand-500/20"
                    }`}
                  >
                    {pr.priority_level} Priority
                  </span>
                </div>
              ))}
            </div>

            {/* Eisenhower 2x2 Mini Overview for this meeting */}
            <div className="p-5 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--mt-border)] pb-3">
                <div className="font-bold text-xs text-[var(--mt-text)] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-500" />
                  <span>Eisenhower Quadrant Distribution for this Session</span>
                </div>
                <span className="text-[0.7rem] text-[var(--mt-text-secondary)]">
                  Live classification
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                  <div className="text-[0.65rem] font-bold text-rose-600 uppercase">
                    Q1: Do First (Urgent & Important)
                  </div>
                  <div className="text-xl font-bold text-[var(--mt-text)] mt-1">
                    {
                      actionItems.filter(
                        (a) =>
                          (a.meeting_id === meeting.id || !a.meeting_id) &&
                          a.quadrant === "Do First"
                      ).length
                    }
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                  <div className="text-[0.65rem] font-bold text-blue-600 uppercase">
                    Q2: Schedule (Important, Not Urgent)
                  </div>
                  <div className="text-xl font-bold text-[var(--mt-text)] mt-1">
                    {
                      actionItems.filter(
                        (a) =>
                          (a.meeting_id === meeting.id || !a.meeting_id) &&
                          a.quadrant === "Schedule"
                      ).length
                    }
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <div className="text-[0.65rem] font-bold text-amber-600 uppercase">
                    Q3: Delegate (Urgent, Not Important)
                  </div>
                  <div className="text-xl font-bold text-[var(--mt-text)] mt-1">
                    {
                      actionItems.filter(
                        (a) =>
                          (a.meeting_id === meeting.id || !a.meeting_id) &&
                          a.quadrant === "Delegate"
                      ).length
                    }
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-500/5 border border-slate-500/20">
                  <div className="text-[0.65rem] font-bold text-[var(--mt-text-secondary)] uppercase">
                    Q4: Defer (Neither)
                  </div>
                  <div className="text-xl font-bold text-[var(--mt-text)] mt-1">
                    {
                      actionItems.filter(
                        (a) =>
                          (a.meeting_id === meeting.id || !a.meeting_id) &&
                          a.quadrant === "Defer"
                      ).length
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: TRANSCRIPT */}
        {activeTab === "transcript" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--mt-text-muted)] absolute left-3 top-2.5" />
              <input
                type="text"
                value={transcriptSearch}
                onChange={(e) => setTranscriptSearch(e.target.value)}
                placeholder="Search dialogue text in this transcript..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs bg-[var(--mt-surface-soft)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="p-5 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card space-y-4 max-h-[500px] overflow-y-auto">
              {(meeting.segments || [])
                .filter((s) => s.text.toLowerCase().includes(transcriptSearch.toLowerCase()))
                .map((seg) => (
                  <div key={seg.id} className="flex gap-4 text-xs">
                    <div className="w-28 flex-shrink-0 text-[0.7rem] font-bold text-brand-500">
                      {seg.speaker}
                      <div className="text-[0.65rem] text-[var(--mt-text-muted)] font-normal">
                        {Math.floor(seg.start)}s – {Math.floor(seg.end)}s
                      </div>
                    </div>
                    <div className="flex-1 text-[var(--mt-text)] leading-relaxed">
                      {seg.text}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 7: ASK AI */}
        {activeTab === "ask_ai" && (
          <div className="space-y-6">
            <div className="space-y-4">
              {askHistory.map((item, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="p-3 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300 text-xs font-semibold max-w-xl ml-auto">
                    {item.q}
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card text-xs text-[var(--mt-text)] leading-relaxed space-y-2">
                    <div>{item.a}</div>
                    {item.sources && (
                      <div className="pt-2 border-t border-[var(--mt-border)] text-[0.7rem] text-[var(--mt-text-secondary)]">
                        <strong>Citation:</strong> {item.sources[0]?.excerpt}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAsk} className="flex gap-2">
              <input
                type="text"
                value={askQuestion}
                onChange={(e) => setAskQuestion(e.target.value)}
                placeholder="Ask any question about this meeting (e.g. 'What are the main security risks?')..."
                className="flex-1 px-4 py-2.5 rounded-xl text-xs bg-[var(--mt-surface)] border border-[var(--mt-border)] text-[var(--mt-text)] focus:outline-none focus:border-brand-500"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Ask
              </button>
            </form>
          </div>
        )}

        {/* TAB 8: MOM */}
        {activeTab === "mom" && (
          <div className="p-6 rounded-2xl bg-[var(--mt-surface)] border border-[var(--mt-border)] shadow-card space-y-6 text-xs">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--mt-border)]">
              <div>
                <h3 className="text-base font-bold text-[var(--mt-text)]">
                  Official Minutes of Meeting (MoM)
                </h3>
                <p className="text-[0.72rem] text-[var(--mt-text-secondary)]">
                  Verified executive record formatted for board and audit review.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport("pdf")}
                  className="px-3 py-1.5 rounded-lg bg-brand-500 text-white font-semibold flex items-center gap-1 text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
                <button
                  onClick={() => handleExport("docx")}
                  className="px-3 py-1.5 rounded-lg bg-[var(--mt-surface-soft)] text-[var(--mt-text)] border border-[var(--mt-border)] font-semibold flex items-center gap-1 text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Download Word (.docx)
                </button>
              </div>
            </div>

            <div className="space-y-4 text-[var(--mt-text)]">
              <div>
                <strong className="text-brand-500">I. Meeting Context:</strong> {meeting.title} held on{" "}
                {new Date(meeting.date).toLocaleDateString()}. Duration: {durationMin} minutes.
              </div>
              <div>
                <strong className="text-brand-500">II. Executive Summary:</strong> {meeting.executive_summary}
              </div>
              <div>
                <strong className="text-brand-500">III. Key Decisions:</strong> All attendees concurred on OAuth 2.0 PKCE implementation and 90-day retention policies.
              </div>
              <div>
                <strong className="text-brand-500">IV. Signed Action Items:</strong> Alex Chen (PKCE flow), Priya Sharma (Regression tests).
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
