// types/index.ts
// Central type definitions for the entire application

// ─── Freshservice Types ───────────────────────────────────

export interface FreshserviceTicket {
  id: number;
  subject: string;
  description: string;
  description_text: string;
  status: number;
  priority: number;
  requester_id: number;
  responder_id: number | null;
  group_id: number | null;
  type: string;
  source: number;
  custom_fields: Record<string, any>;
  tags: string[];
  created_at: string;
  updated_at: string;
  due_by: string | null;
  fr_due_by: string | null;
}

export interface FreshserviceRequester {
  id: number;
  first_name: string;
  last_name: string;
  primary_email: string;
  job_title: string | null;
  department_ids: number[];
  phone: string | null;
}

export interface FreshserviceAgent {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  job_title: string | null;
  department_ids: number[];
}

// ─── Jira Types ───────────────────────────────────────────

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description: any; // ADF format
    status: {
      name: string;
      id: string;
      statusCategory: {
        key: string;
        name: string;
        colorName: string;
      };
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
    priority: {
      name: string;
      id: string;
    };
    issuetype: {
      name: string;
      id: string;
    };
    project: {
      key: string;
      name: string;
    };
    sprint?: {
      id: number;
      name: string;
      state: string;
      startDate?: string;
      endDate?: string;
      completeDate?: string;
    } | null;
    comment?: {
      comments: JiraComment[];
      total: number;
    };
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
  body: any; // ADF format
  created: string;
  updated: string;
}

export interface JiraWebhookPayload {
  timestamp: number;
  webhookEvent: string;
  issue_event_type_name?: string;
  user: {
    displayName: string;
    emailAddress: string;
  };
  issue: {
    id: string;
    key: string;
    fields: Record<string, any>;
  };
  changelog?: {
    id: string;
    items: JiraChangelogItem[];
  };
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

// ─── Freshservice Webhook Types ───────────────────────────

export interface FreshserviceWebhookPayload {
  freshdesk_webhook?: {
    ticket_id: number;
    ticket_subject?: string;
    ticket_status?: string;
    ticket_priority?: string;
    ticket_type?: string;
    triggered_by?: string;
    [key: string]: any;
  };
  ticket_id?: number;
  event_type?: "pm_assigned" | "jira_linked" | "status_changed";
  changes?: Record<string, { from: any; to: any }>;
  [key: string]: any;
}

// ─── Application Types ────────────────────────────────────

export type PizzaTrackerStage =
  | "submitted"
  | "under_review"
  | "scope_confirmed"
  | "development"
  | "uat"
  | "released"
  | "closed";

export interface TrackerStep {
  id: PizzaTrackerStage;
  label: string;
  subtitle?: string;
  date?: string;
  dateRange?: { start: string; end: string };
  status: "complete" | "current" | "upcoming";
}

export interface EnrichedRequest {
  // Freshservice data
  id: number;
  subject: string;
  description: string;
  status: string;
  statusRaw: number;
  priority: string;
  type: string;
  createdAt: string;
  updatedAt: string;

  // Requester
  requester: {
    name: string;
    email: string;
    jobTitle?: string;
  };

  // Product Manager (from Freshservice agent/responder)
  productManager: {
    name: string;
    email: string;
    initials: string;
  } | null;

  // Jira data (null if no Jira ticket linked)
  jira: {
    key: string;
    summary: string;
    status: string;
    statusCategory: string;
    assignee: string | null;
    sprint: string | null;
    sprintEndDate: string | null;
    url: string;
  } | null;

  // Computed pizza tracker
  tracker: TrackerStep[];

  // Client/project metadata (parsed from ticket subject or custom fields)
  client?: string;
  country?: string;
  category?: string;

  // Recent notes from Jira
  recentNotes: NoteEntry[];
}

export interface NoteEntry {
  id: string;
  author: {
    name: string;
    initials: string;
    avatarUrl?: string;
  };
  body: string;
  createdAt: string;
}

// ─── Subscription Types ───────────────────────────────────

export type SubscriptionType = "full_activity" | "status_milestones";

export interface Subscription {
  id: string;
  email: string;
  requestId: number;
  jiraKey?: string;
  type: SubscriptionType;
  createdAt: string;
  active: boolean;
}

// ─── Email Types ──────────────────────────────────────────

export type NotificationEventType =
  | "pm_assigned"
  | "jira_linked"
  | "jira_status_changed"
  | "jira_sprint_assigned"
  | "request_closed";

export interface EmailNotification {
  to: string;
  requesterName: string;
  requestId: number;
  requestSubject: string;
  eventType: NotificationEventType;
  jiraKey?: string;
  details: Record<string, string>;
}

// ─── API Response Types ───────────────────────────────────

export interface SearchResponse {
  results: EnrichedRequest[];
  total: number;
  query: string;
}

export interface WebhookResponse {
  ok: boolean;
  event: string;
  message?: string;
}

export interface ApiError {
  error: string;
  message: string;
  status: number;
}
