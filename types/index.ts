// types/index.ts

// ─── Jira Types ───────────────────────────────────────────

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description: any;
    status: {
      name: string;
      id: string;
      statusCategory: { key: string; name: string; colorName: string };
    };
    assignee: {
      displayName: string;
      emailAddress: string;
      avatarUrls: Record<string, string>;
    } | null;
    reporter: {
      displayName: string;
      emailAddress: string;
    } | null;
    priority: { name: string; id: string };
    issuetype: { name: string; id: string };
    project: { key: string; name: string };
    labels: string[];
    sprint?: {
      id: number;
      name: string;
      state: string;
      startDate?: string;
      endDate?: string;
    } | null;
    comment?: { comments: JiraComment[]; total: number };
    updated: string;
    created: string;
    resolutiondate: string | null;
    [key: string]: any;
  };
}

export interface JiraComment {
  id: string;
  author: {
    displayName: string;
    emailAddress: string;
    avatarUrls: Record<string, string>;
  };
  body: any;
  created: string;
  updated: string;
}

export interface JiraWebhookPayload {
  timestamp: number;
  webhookEvent: string;
  issue_event_type_name?: string;
  user: { displayName: string; emailAddress: string };
  issue: { id: string; key: string; fields: Record<string, any> };
  changelog?: { id: string; items: JiraChangelogItem[] };
}

export interface JiraChangelogItem {
  field: string;
  fieldtype: string;
  fieldId?: string;
  from: string | null;
  fromString: string | null;
  to: string | null;
  toString: string | null;
}

// ─── App Types ────────────────────────────────────────────

export type PizzaTrackerStage =
  | "submitted"
  | "under_review"
  | "in_sprint"
  | "in_uat"
  | "released";

export interface TrackerStep {
  id: PizzaTrackerStage;
  label: string;
  subtitle?: string;
  date?: string;
  status: "complete" | "current" | "upcoming";
}

export interface EnrichedRequest {
  jiraKey: string;
  summary: string;
  description: string;
  status: string;
  statusCategory: string;
  priority: string;
  issueType: string;
  project: string;
  createdAt: string;
  updatedAt: string;

  // Requester (from custom field or reporter)
  requester: { name: string; email: string } | null;

  // Client/business metadata (from custom field or label)
  client?: string;

  // Assignee
  assignee: string | null;

  // PM (Product Owner from custom field)
  productManager: { name: string; initials: string } | null;

  // Solution Owner (Tech Lead from custom field)
  solutionOwner?: { name: string; initials: string } | null;

  // Sprint
  sprint: string | null;
  sprintEndDate: string | null;

  // Jira URL
  url: string;

  // Computed pizza tracker
  tracker: TrackerStep[];

  // Recent comments
  recentNotes: NoteEntry[];
}

export interface NoteEntry {
  id: string;
  author: { name: string; initials: string; avatarUrl?: string };
  body: string;
  createdAt: string;
}

// ─── Subscription Types ───────────────────────────────────

export type SubscriptionType = "full_activity" | "status_milestones";

export interface Subscription {
  id: string;
  email: string;
  jiraKey: string;
  type: SubscriptionType;
  createdAt: string;
  active: boolean;
}

// ─── Email Types ──────────────────────────────────────────

export type NotificationEventType =
  | "pm_assigned"
  | "jira_status_changed"
  | "jira_sprint_assigned"
  | "request_closed";

export interface EmailNotification {
  to: string;
  requesterName: string;
  jiraKey: string;
  requestSubject: string;
  eventType: NotificationEventType;
  details: Record<string, string>;
}

// ─── API Responses ────────────────────────────────────────

export interface SearchResponse {
  results: EnrichedRequest[];
  total: number;
  query: string;
}
