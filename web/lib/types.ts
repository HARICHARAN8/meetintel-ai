export type UserRole = "Admin" | "Team Lead" | "Employee";

export interface User {
  id: string;
  org_id: string;
  username: string;
  email: string;
  role: UserRole;
  full_name: string;
  department: string;
  timezone: string;
  theme_preference: "Light" | "Dark" | "System";
  avatar_url?: string;
}

export type ProcessingStatus = "Pending" | "Processing" | "Completed" | "Failed";
export type SourcePlatform = "upload" | "google_meet" | "zoom";

export interface Meeting {
  id: string;
  org_id: string;
  user_id: string;
  title: string;
  filename: string;
  date: string;
  duration: number; // in seconds
  speaker_count: number;
  processing_status: ProcessingStatus;
  source_platform: SourcePlatform;
  executive_summary?: string;
  meeting_objective?: string;
  meeting_plan?: string;
  emotional_analysis?: string;
  key_topics?: string[];
  key_points?: string[];
  risks?: string[];
  recommendations?: string[];
  next_steps?: string[];
  segments?: TranscriptSegment[];
  action_items?: ActionItem[];
  decisions?: Decision[];
  participants?: Participant[];
  deadlines?: Deadline[];
  priorities?: Priority[];
}

export interface TranscriptSegment {
  id: number | string;
  meeting_id: string;
  speaker: string;
  start: number;
  end: number;
  text: string;
  confidence: number;
}

export type TaskStatus =
  | "Pending"
  | "In Progress"
  | "Completed"
  | "Blocked"
  | "Rejected"
  | "Cancelled"
  | "Overdue";

export type ApprovalStatus = "Draft" | "Pending Approval" | "Approved" | "Rejected";
export type PriorityLevel = "Low" | "Medium" | "High" | "Urgent";

export type UrgencyLevel = "Urgent" | "Not Urgent";
export type ImportanceLevel = "Important" | "Not Important";
export type EisenhowerQuadrant = "Do First" | "Schedule" | "Delegate" | "Defer" | "Unclassified";

export interface ActionItem {
  id: number;
  meeting_id: string;
  meeting_title?: string;
  org_id: string;
  task: string;
  description: string;
  evidence_excerpt?: string;
  assigned_to: string;
  assigned_user_id?: string;
  assignment_status: "Assigned" | "Needs assignment" | "Suggested";
  deadline: string;
  priority: PriorityLevel;
  urgency?: UrgencyLevel | null;
  importance?: ImportanceLevel | null;
  quadrant?: EisenhowerQuadrant;
  status: TaskStatus;
  approval_status: ApprovalStatus;
  approved_by_user_id?: string;
  approved_at?: string;
  confidence: number;
  estimated_effort_hours?: number;
  dependencies?: string[];
  completion_notes?: string;
  project_id?: string;
  created_at: string;
  calendar_synced?: boolean;
}

export interface CalendarEventItem {
  id: string;
  external_id?: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  type: "meeting" | "task_deadline";
  source: "google_calendar" | "local_task";
  sync_status?: "Synced" | "Pending" | "Failed" | "Cancelled";
  task_id?: number;
  meeting_id?: string;
  html_link?: string;
}

export interface Decision {
  id: number;
  meeting_id: string;
  meeting_title?: string;
  org_id: string;
  title: string;
  decision: string;
  context: string;
  rationale?: string;
  alternatives?: string;
  evidence_excerpt?: string;
  confidence: number;
  status: "Approved" | "Proposed" | "Superseded" | "Rejected";
  proposer?: string;
  created_at: string;
}

export interface Participant {
  id: number;
  meeting_id: string;
  name: string;
  speaker_id: string;
  responsibilities: string[];
  attendance_status?: "Attended" | "Absent" | "Excused";
}

export interface Deadline {
  id: number;
  meeting_id: string;
  description: string;
  date: string;
  related_task: string;
}

export interface Priority {
  id: number;
  meeting_id: string;
  item: string;
  priority_level: PriorityLevel;
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  description: string;
  status: "Active" | "At Risk" | "Completed";
  target_date: string;
  action_items_count?: number;
  completed_items_count?: number;
}

export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  trigger_event: string;
  condition_json: string;
  action_type: string;
  is_enabled: boolean;
  success_count: number;
  failure_count: number;
  last_triggered_at?: string;
}

export interface IntegrationStatus {
  provider: "google_meet" | "zoom" | "google_calendar" | "email_smtp";
  display_name: string;
  status: "Connected" | "Not connected" | "Needs attention" | "Mock/Demo";
  account_email?: string;
  last_sync?: string;
  scopes?: string;
  features: string[];
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: "CREATE" | "UPDATE" | "APPROVE" | "REJECT" | "REASSIGN" | "SYNC" | "SEND" | "TRIGGER";
  entity_type: "task" | "decision" | "meeting" | "calendar" | "notification" | "integration" | "automation";
  entity_id: string;
  details: string;
  timestamp: string;
}

export interface NotificationFollowup {
  id: string;
  recipient_name: string;
  recipient_email: string;
  meeting_title: string;
  meeting_id: string;
  subject: string;
  summary_preview: string;
  status: "Pending" | "Approved" | "Sent" | "Acknowledged";
  sent_at?: string;
  acknowledged_at?: string;
}
