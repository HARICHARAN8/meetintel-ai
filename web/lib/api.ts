import {
  Meeting,
  ActionItem,
  Decision,
  Project,
  WorkflowRule,
  IntegrationStatus,
  AuditEvent,
  NotificationFollowup,
  User,
  UserRole,
  CalendarEventItem,
  EisenhowerQuadrant,
} from "./types";
import { parseNaturalDeadline } from "./dateParser";
import {
  initialMeetings,
  initialActionItems,
  initialDecisions,
  initialProjects,
  initialWorkflowRules,
  initialIntegrations,
  initialAuditEvents,
  initialFollowups,
  initialUsers,
} from "./data";

// In-memory state store with localStorage persistence in the browser
let meetingsStore: Meeting[] = [...initialMeetings];
let actionItemsStore: ActionItem[] = [...initialActionItems];
let decisionsStore: Decision[] = [...initialDecisions];
let projectsStore: Project[] = [...initialProjects];
let rulesStore: WorkflowRule[] = [...initialWorkflowRules];
let integrationsStore: IntegrationStatus[] = [...initialIntegrations];
let auditStore: AuditEvent[] = [...initialAuditEvents];
let followupsStore: NotificationFollowup[] = [...initialFollowups];
let usersStore: User[] = [...initialUsers];

export function computeQuadrant(urgency?: string | null, importance?: string | null): EisenhowerQuadrant {
  const u = (urgency || "").trim().toLowerCase();
  const i = (importance || "").trim().toLowerCase();
  if (u === "urgent" && i === "important") return "Do First";
  if ((u === "not urgent" || u === "not_urgent") && i === "important") return "Schedule";
  if (u === "urgent" && (i === "not important" || i === "not_important")) return "Delegate";
  if ((u === "not urgent" || u === "not_urgent") && (i === "not important" || i === "not_important")) return "Defer";
  return "Unclassified";
}

const initialCalendarEvents: CalendarEventItem[] = [
  {
    id: "cal-evt-001",
    external_id: "gcal_evt_101",
    summary: "[MeetIntel] Complete OAuth 2.0 PKCE integration",
    description: "Implement PKCE challenge verification on client endpoints.",
    start: "2026-10-24T15:00:00Z",
    end: "2026-10-24T16:00:00Z",
    type: "task_deadline",
    source: "google_calendar",
    sync_status: "Synced",
    task_id: 101,
    meeting_id: "demo-meeting-q3-security",
  },
  {
    id: "cal-evt-002",
    external_id: "gcal_evt_102",
    summary: "[MeetIntel] Prepare automated regression testing matrix",
    description: "Construct end-to-end integration test suite covering auth flows.",
    start: "2026-10-27T17:00:00Z",
    end: "2026-10-27T18:00:00Z",
    type: "task_deadline",
    source: "google_calendar",
    sync_status: "Synced",
    task_id: 102,
    meeting_id: "demo-meeting-q3-security",
  },
  {
    id: "cal-evt-003",
    external_id: "gcal_meeting_201",
    summary: "Q3 Architecture & Security Alignment",
    description: "Review architecture, assess security blockers, and confirm deadlines.",
    start: "2026-10-23T14:30:00Z",
    end: "2026-10-23T15:30:00Z",
    type: "meeting",
    source: "google_calendar",
    sync_status: "Synced",
    meeting_id: "demo-meeting-q3-security",
  },
  {
    id: "cal-evt-004",
    external_id: "gcal_meeting_202",
    summary: "Sprint 43 Planning & Deliverables Review",
    description: "Bi-weekly sprint planning and action item sign-off.",
    start: "2026-10-28T10:00:00Z",
    end: "2026-10-28T11:00:00Z",
    type: "meeting",
    source: "google_calendar",
    sync_status: "Synced",
    meeting_id: "demo-meeting-sprint-planning",
  },
];

let calendarStore: CalendarEventItem[] = [...initialCalendarEvents];
let isStorageInitialized = false;

function ensureStorageLoaded() {
  if (typeof window !== "undefined" && !isStorageInitialized) {
    try {
      const stored = localStorage.getItem("meetintel_action_items");
      if (stored) {
        actionItemsStore = JSON.parse(stored);
      }
      const storedCal = localStorage.getItem("meetintel_calendar_events");
      if (storedCal) {
        calendarStore = JSON.parse(storedCal);
      }
      isStorageInitialized = true;
    } catch (e) {}
  }
}

function persistActionItems() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("meetintel_action_items", JSON.stringify(actionItemsStore));
    } catch (e) {}
  }
}

function persistCalendar() {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("meetintel_calendar_events", JSON.stringify(calendarStore));
    } catch (e) {}
  }
}

// Active user session state
let currentUser: User = initialUsers[1]; // Default to Sarah Jenkins (Team Lead)

export const api = {
  // Current user & authentication
  getCurrentUser(): User {
    return currentUser;
  },

  setCurrentUser(userId: string): User {
    const found = usersStore.find((u) => u.id === userId);
    if (found) {
      currentUser = found;
    }
    return currentUser;
  },

  setRole(role: UserRole): User {
    const found = usersStore.find((u) => u.role === role);
    if (found) {
      currentUser = found;
    } else {
      currentUser = { ...currentUser, role };
    }
    return currentUser;
  },

  getUsers(): User[] {
    return usersStore;
  },

  // Meetings
  getMeetings(role?: UserRole, userId?: string): Meeting[] {
    if (role === "Employee" && userId) {
      // Employees see meetings they own or are participants in
      return meetingsStore.filter((m) => m.user_id === userId);
    }
    return meetingsStore;
  },

  getMeetingById(id: string): Meeting | undefined {
    return meetingsStore.find((m) => m.id === id);
  },

  // Action Items
  getActionItems(filters?: {
    status?: string;
    approvalStatus?: string;
    assignedUserId?: string;
    quadrant?: string;
  }): ActionItem[] {
    ensureStorageLoaded();
    return actionItemsStore
      .map((item) => ({
        ...item,
        quadrant: item.quadrant || computeQuadrant(item.urgency, item.importance),
      }))
      .filter((item) => {
        if (filters?.status && filters.status !== "All" && item.status !== filters.status) return false;
        if (filters?.approvalStatus && filters.approvalStatus !== "All" && item.approval_status !== filters.approvalStatus)
          return false;
        if (filters?.assignedUserId && item.assigned_user_id !== filters.assignedUserId)
          return false;
        if (filters?.quadrant && filters.quadrant !== "All" && item.quadrant !== filters.quadrant)
          return false;
        return true;
      });
  },

  approveActionItem(taskId: number, approverUserId: string): ActionItem | null {
    ensureStorageLoaded();
    const item = actionItemsStore.find((t) => t.id === taskId);
    if (!item) return null;

    item.approval_status = "Approved";
    item.status = item.status === "Pending" ? "In Progress" : item.status;
    item.approved_by_user_id = approverUserId;
    item.approved_at = new Date().toISOString();
    item.calendar_synced = true;
    persistActionItems();

    // Auto-sync calendar event
    api.syncTaskToCalendar(taskId);

    // Log audit event
    auditStore.unshift({
      id: `audit-${Date.now()}`,
      actor: currentUser.full_name,
      action: "APPROVE",
      entity_type: "task",
      entity_id: String(taskId),
      details: `Approved action item '${item.task}' assigned to ${item.assigned_to}.`,
      timestamp: new Date().toISOString(),
    });

    return { ...item };
  },

  rejectActionItem(taskId: number, approverUserId: string, reason?: string): ActionItem | null {
    ensureStorageLoaded();
    const item = actionItemsStore.find((t) => t.id === taskId);
    if (!item) return null;

    item.approval_status = "Rejected";
    item.status = "Rejected";
    item.calendar_synced = false;
    persistActionItems();

    api.cancelTaskCalendarEvent(taskId);

    auditStore.unshift({
      id: `audit-${Date.now()}`,
      actor: currentUser.full_name,
      action: "REJECT",
      entity_type: "task",
      entity_id: String(taskId),
      details: `Rejected task '${item.task}'. Reason: ${reason || "Rejected in review"}.`,
      timestamp: new Date().toISOString(),
    });

    return { ...item };
  },

  updateActionItemStatus(
    taskId: number,
    status: ActionItem["status"],
    notes?: string
  ): ActionItem | null {
    ensureStorageLoaded();
    const item = actionItemsStore.find((t) => t.id === taskId);
    if (!item) return null;

    item.status = status;
    if (notes) item.completion_notes = notes;
    persistActionItems();

    auditStore.unshift({
      id: `audit-${Date.now()}`,
      actor: currentUser.full_name,
      action: "UPDATE",
      entity_type: "task",
      entity_id: String(taskId),
      details: `Updated task status to '${status}'. ${notes ? `Notes: ${notes}` : ""}`,
      timestamp: new Date().toISOString(),
    });

    return { ...item };
  },

  reassignActionItem(taskId: number, newAssigneeId: string): ActionItem | null {
    ensureStorageLoaded();
    const item = actionItemsStore.find((t) => t.id === taskId);
    const user = usersStore.find((u) => u.id === newAssigneeId);
    if (!item || !user) return null;

    const previousAssignee = item.assigned_to;
    item.assigned_to = user.full_name;
    item.assigned_user_id = user.id;
    item.assignment_status = "Assigned";
    persistActionItems();

    auditStore.unshift({
      id: `audit-${Date.now()}`,
      actor: currentUser.full_name,
      action: "REASSIGN",
      entity_type: "task",
      entity_id: String(taskId),
      details: `Reassigned task '${item.task}' from ${previousAssignee} to ${user.full_name}.`,
      timestamp: new Date().toISOString(),
    });

    return { ...item };
  },

  updateActionItemMatrix(
    taskId: number,
    urgency: "Urgent" | "Not Urgent" | null,
    importance: "Important" | "Not Important" | null
  ): ActionItem | null {
    ensureStorageLoaded();
    const item = actionItemsStore.find((t) => t.id === taskId);
    if (!item) return null;

    item.urgency = urgency;
    item.importance = importance;
    item.quadrant = computeQuadrant(urgency, importance);
    persistActionItems();

    auditStore.unshift({
      id: `audit-${Date.now()}`,
      actor: currentUser.full_name,
      action: "UPDATE",
      entity_type: "task",
      entity_id: String(taskId),
      details: `Updated Eisenhower Priority Matrix quadrant to '${item.quadrant}' (Urgency: ${urgency || "Unclassified"}, Importance: ${importance || "Unclassified"}).`,
      timestamp: new Date().toISOString(),
    });

    return { ...item };
  },

  updateActionItemDeadline(
    taskId: number,
    deadline: string,
    timezone?: string
  ): ActionItem | null {
    ensureStorageLoaded();
    const item = actionItemsStore.find((t) => t.id === taskId);
    if (!item) return null;

    item.deadline = deadline;
    persistActionItems();

    // If task already has a synced calendar event, update it too
    if (item.calendar_synced) {
      api.syncTaskToCalendar(taskId);
    }

    auditStore.unshift({
      id: `audit-${Date.now()}`,
      actor: currentUser.full_name,
      action: "UPDATE",
      entity_type: "task",
      entity_id: String(taskId),
      details: `Updated task deadline to '${deadline}'.`,
      timestamp: new Date().toISOString(),
    });

    return { ...item };
  },

  // Calendar Operations
  getCalendarEvents(): CalendarEventItem[] {
    ensureStorageLoaded();
    return [...calendarStore];
  },

  async fetchCalendarEventsFromBackend(): Promise<{
    events: CalendarEventItem[];
    connection_status: string;
    is_live: boolean;
    account_email?: string;
  }> {
    ensureStorageLoaded();
    const defaultRes = {
      events: [...calendarStore],
      connection_status:
        integrationsStore.find((i) => i.provider === "google_calendar")?.status || "Not connected",
      is_live: false,
      account_email:
        integrationsStore.find((i) => i.provider === "google_calendar")?.account_email ||
        "demo.calendar@acmeglobal.io",
    };

    if (typeof window === "undefined") {
      return defaultRes;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch("http://127.0.0.1:8000/api/calendar/events", {
        headers: { "x-user-id": currentUser.id },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.events && Array.isArray(data.events)) {
          // Merge backend events with calendarStore
          const backendList: CalendarEventItem[] = data.events.map((be: any) => ({
            id: String(be.id || `cal-${Date.now()}`),
            external_id: be.external_id,
            summary: be.summary || be.title || "Meeting Session",
            description: be.description || "",
            start: be.start || be.start_time || new Date().toISOString(),
            end: be.end || be.end_time || new Date().toISOString(),
            type: be.type || (be.task_id ? "task_deadline" : "meeting"),
            source: be.source || "google_calendar",
            sync_status: be.sync_status || "Synced",
            task_id: be.task_id,
            meeting_id: be.meeting_id,
          }));

          // Avoid duplicates by external_id or id
          backendList.forEach((be) => {
            const idx = calendarStore.findIndex(
              (c) => c.external_id === be.external_id || c.id === be.id
            );
            if (idx >= 0) {
              calendarStore[idx] = { ...calendarStore[idx], ...be };
            } else {
              calendarStore.push(be);
            }
          });
          persistCalendar();

          const calInt = integrationsStore.find((i) => i.provider === "google_calendar");
          if (calInt) {
            calInt.status = data.connection_status || "Connected";
            if (data.account_email) calInt.account_email = data.account_email;
            if (data.last_sync_at) calInt.last_sync = data.last_sync_at;
          }

          return {
            events: [...calendarStore],
            connection_status: data.connection_status || "Connected",
            is_live: data.is_live ?? false,
            account_email: data.account_email || calInt?.account_email,
          };
        }
      }
    } catch {
      // Backend offline or unreachable: fall back seamlessly to local store
    }

    return defaultRes;
  },

  syncTaskToCalendar(taskId: number): { success: boolean; eventId?: string; message: string } {
    ensureStorageLoaded();
    const item = actionItemsStore.find((t) => t.id === taskId);
    if (!item) return { success: false, message: "Task not found" };

    item.calendar_synced = true;
    persistActionItems();

    const existingIdx = calendarStore.findIndex((e) => e.task_id === taskId);
    const parsed = parseNaturalDeadline(item.deadline, undefined, currentUser.timezone);
    const startTime = parsed.parsedIso || new Date(Date.now() + 86400000 * 2).toISOString();
    const endTime = new Date(new Date(startTime).getTime() + 3600000).toISOString();

    const eventItem: CalendarEventItem = {
      id: existingIdx >= 0 ? calendarStore[existingIdx].id : `cal-task-${taskId}-${Date.now()}`,
      external_id: `gcal_evt_${taskId}`,
      summary: `[MeetIntel] ${item.task}`,
      description: item.description,
      start: startTime,
      end: endTime,
      type: "task_deadline",
      source: "google_calendar",
      sync_status: "Synced",
      task_id: taskId,
      meeting_id: item.meeting_id,
    };

    if (existingIdx >= 0) {
      calendarStore[existingIdx] = eventItem;
    } else {
      calendarStore.push(eventItem);
    }
    persistCalendar();

    auditStore.unshift({
      id: `audit-${Date.now()}`,
      actor: currentUser.full_name,
      action: "SYNC",
      entity_type: "calendar",
      entity_id: eventItem.id,
      details: `Synchronized task '${item.task}' to Google Calendar.`,
      timestamp: new Date().toISOString(),
    });

    return { success: true, eventId: eventItem.id, message: "Successfully synced with Google Calendar." };
  },

  cancelTaskCalendarEvent(taskId: number): boolean {
    ensureStorageLoaded();
    const idx = calendarStore.findIndex((e) => e.task_id === taskId);
    if (idx >= 0) {
      calendarStore[idx].sync_status = "Cancelled";
      persistCalendar();
    }
    const item = actionItemsStore.find((t) => t.id === taskId);
    if (item) {
      item.calendar_synced = false;
      persistActionItems();
    }
    return true;
  },

  syncAllCalendar(): { success: boolean; count: number } {
    ensureStorageLoaded();
    let count = 0;
    actionItemsStore.forEach((item) => {
      if (item.approval_status === "Approved") {
        api.syncTaskToCalendar(item.id);
        count++;
      }
    });

    const calInt = integrationsStore.find((i) => i.provider === "google_calendar");
    if (calInt) {
      calInt.last_sync = new Date().toISOString();
      calInt.status = "Connected";
    }

    return { success: true, count };
  },

  disconnectGoogleCalendar(): boolean {
    const calInt = integrationsStore.find((i) => i.provider === "google_calendar");
    if (calInt) {
      calInt.status = "Not connected";
      calInt.account_email = undefined;
    }
    auditStore.unshift({
      id: `audit-${Date.now()}`,
      actor: currentUser.full_name,
      action: "UPDATE",
      entity_type: "integration",
      entity_id: "google_calendar",
      details: "Disconnected Google Calendar integration and revoked access tokens.",
      timestamp: new Date().toISOString(),
    });
    return true;
  },

  // Decisions
  getDecisions(status?: string): Decision[] {
    if (status && status !== "All") {
      return decisionsStore.filter((d) => d.status === status);
    }
    return decisionsStore;
  },

  // Projects
  getProjects(): Project[] {
    return projectsStore;
  },

  createProject(name: string, description: string, targetDate: string): Project {
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      org_id: "org-default-001",
      name,
      description,
      status: "Active",
      target_date: targetDate,
      action_items_count: 0,
      completed_items_count: 0,
    };
    projectsStore.unshift(newProj);

    auditStore.unshift({
      id: `audit-${Date.now()}`,
      actor: currentUser.full_name,
      action: "CREATE",
      entity_type: "meeting",
      entity_id: newProj.id,
      details: `Created new project '${name}'.`,
      timestamp: new Date().toISOString(),
    });

    return newProj;
  },

  // Automations & Rules
  getWorkflowRules(): WorkflowRule[] {
    return rulesStore;
  },

  toggleWorkflowRule(ruleId: string): WorkflowRule | null {
    const rule = rulesStore.find((r) => r.id === ruleId);
    if (!rule) return null;
    rule.is_enabled = !rule.is_enabled;

    auditStore.unshift({
      id: `audit-${Date.now()}`,
      actor: currentUser.full_name,
      action: "UPDATE",
      entity_type: "automation",
      entity_id: rule.id,
      details: `${rule.is_enabled ? "Enabled" : "Disabled"} automation rule '${rule.name}'.`,
      timestamp: new Date().toISOString(),
    });

    return { ...rule };
  },

  triggerWorkflowRule(ruleId: string): { success: boolean; message: string } {
    const rule = rulesStore.find((r) => r.id === ruleId);
    if (!rule) return { success: false, message: "Rule not found" };

    rule.success_count += 1;
    rule.last_triggered_at = new Date().toISOString();

    auditStore.unshift({
      id: `audit-${Date.now()}`,
      actor: currentUser.full_name,
      action: "TRIGGER",
      entity_type: "automation",
      entity_id: rule.id,
      details: `Manually executed automation rule '${rule.name}'. Condition matched.`,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: `Rule '${rule.name}' triggered successfully. Action dispatched.`,
    };
  },

  // Integrations
  getIntegrations(): IntegrationStatus[] {
    return integrationsStore;
  },

  testIntegration(provider: string): { status: string; message: string; latency_ms: number } {
    const int = integrationsStore.find((i) => i.provider === provider);
    if (int) {
      int.last_sync = new Date().toISOString();
      int.status = "Connected";
    }

    auditStore.unshift({
      id: `audit-${Date.now()}`,
      actor: currentUser.full_name,
      action: "SYNC",
      entity_type: "integration",
      entity_id: provider,
      details: `Tested connection to ${provider}. Status: 200 OK.`,
      timestamp: new Date().toISOString(),
    });

    return {
      status: "success",
      message: `Connection to ${int?.display_name || provider} verified successfully.`,
      latency_ms: Math.floor(Math.random() * 80) + 40,
    };
  },

  // Audit Events
  getAuditEvents(limit = 50): AuditEvent[] {
    return auditStore.slice(0, limit);
  },

  // Follow-ups
  getFollowups(): NotificationFollowup[] {
    return followupsStore;
  },

  sendFollowup(followupId: string): boolean {
    const f = followupsStore.find((item) => item.id === followupId);
    if (!f) return false;
    f.status = "Sent";
    f.sent_at = new Date().toISOString();

    auditStore.unshift({
      id: `audit-${Date.now()}`,
      actor: currentUser.full_name,
      action: "SEND",
      entity_type: "notification",
      entity_id: f.id,
      details: `Sent executive follow-up email to ${f.recipient_email}.`,
      timestamp: new Date().toISOString(),
    });

    return true;
  },

  // Knowledge Search (RAG)
  searchKnowledge(query: string): {
    query: string;
    results: Array<{
      id: string;
      title: string;
      date: string;
      content: string;
      similarity: number;
      type: string;
    }>;
    search_time_ms: number;
  } {
    const q = query.toLowerCase();
    const results = [];

    // Search transcripts
    for (const m of meetingsStore) {
      if (m.segments) {
        for (const s of m.segments) {
          if (s.text.toLowerCase().includes(q)) {
            results.push({
              id: `${m.id}-seg-${s.id}`,
              title: m.title,
              date: m.date,
              content: `[${s.speaker}]: "${s.text}"`,
              similarity: 0.94,
              type: "Transcript Segment",
            });
          }
        }
      }
      if (m.executive_summary?.toLowerCase().includes(q)) {
        results.push({
          id: `${m.id}-summary`,
          title: m.title,
          date: m.date,
          content: m.executive_summary,
          similarity: 0.96,
          type: "Executive Summary",
        });
      }
    }

    // Search decisions
    for (const d of decisionsStore) {
      if (
        d.title.toLowerCase().includes(q) ||
        d.decision.toLowerCase().includes(q) ||
        d.rationale?.toLowerCase().includes(q)
      ) {
        results.push({
          id: `dec-${d.id}`,
          title: d.title,
          date: d.created_at,
          content: `${d.decision} Rationale: ${d.rationale || "Consensus"}`,
          similarity: 0.97,
          type: "Decision Register",
        });
      }
    }

    return {
      query,
      results: results.slice(0, 5),
      search_time_ms: 45,
    };
  },

  askAI(question: string): {
    answer: string;
    sources: Array<{ title: string; excerpt: string }>;
  } {
    const q = question.toLowerCase();
    if (q.includes("oauth") || q.includes("pkce") || q.includes("security")) {
      return {
        answer:
          "During the Q3 Architecture & Security Alignment meeting on Oct 14, 2026, the team led by Sarah Jenkins approved mandatory OAuth 2.0 PKCE flow for all clients to eliminate token interception vulnerabilities. Alex Chen was assigned to complete this implementation by Friday, Oct 24th, with automated regression testing handled by Priya Sharma.",
        sources: [
          {
            title: "Q3 Architecture & Security Alignment",
            excerpt:
              "Alex Chen: I will complete the OAuth 2.0 PKCE integration by this Friday.",
          },
          {
            title: "Decision Register #201",
            excerpt:
              "All web and mobile clients must migrate to authorization code flow with PKCE by Q4.",
          },
        ],
      };
    }

    if (q.includes("database") || q.includes("pool") || q.includes("replica")) {
      return {
        answer:
          "Database connection pooling optimization is currently flagged as Blocked (Task #104). Alex Chen reported that pool buffer tuning cannot proceed until DevOps provisions the dedicated staging replica.",
        sources: [
          {
            title: "Q3 Architecture & Security Alignment",
            excerpt:
              "Alex Chen: Note that database connection tuning is currently blocked until the staging replica is provisioned.",
          },
        ],
      };
    }

    return {
      answer: `Based on your organizational knowledge base across 4 indexed meetings, MeetIntel AI found that priorities emphasize enterprise security hardening, OAuth 2.0 PKCE migration, SOC2 audit compliance, and microservices worker decoupling.`,
      sources: [
        {
          title: "Q3 Architecture & Security Alignment",
          excerpt:
            "The engineering leadership aligned on the Q3 security roadmap and compliance retention policies.",
        },
      ],
    };
  },
};
