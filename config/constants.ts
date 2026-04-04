// config/constants.ts
// All configurable mappings and constants

// ─── Freshservice Status Codes ────────────────────────────
// These are Freshservice's built-in status IDs
export const FS_STATUS_MAP: Record<number, string> = {
  2: "Open",
  3: "Pending",
  4: "Resolved",
  5: "Closed",
  // Custom statuses (add yours here — find them in Freshservice Admin → Ticket Fields → Status)
  // 6: "Waiting on Customer",
  // 7: "Waiting on Third Party",
};

export const FS_PRIORITY_MAP: Record<number, string> = {
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Urgent",
};

// ─── Jira Status → Human-Readable Mapping ─────────────────
// Map YOUR Jira workflow status names to plain English.
// Update these to match your Jira project's actual workflow statuses.
export const JIRA_STATUS_HUMAN: Record<string, string> = {
  // Common defaults
  "To Do": "Queued for development",
  "In Progress": "Actively being worked on by a developer",
  "In Review": "Code review in progress",
  "Done": "Development complete",
  Closed: "Closed and released",

  // Likewize-style custom statuses (adjust to your workflow)
  Backlog: "In the product backlog — not yet scheduled",
  "Selected for Development": "Picked up by the dev team",
  Draft: "Initial draft — being defined",
  "In Scope Review": "Scope is being reviewed with stakeholders",
  "Ready for Release": "Ready to deploy in the next release",
  "In Scope": "Scope has been approved",
  "Solution Complete": "Solution design is finalized",
  "Ready for Refinement": "Ready for sprint refinement",
};

// ─── Jira Status → Pizza Tracker Stage Mapping ────────────
// Maps Jira statuses to which pizza tracker stage they represent.
// The tracker has these stages:
//   submitted → under_review → scope_confirmed → development → uat → released/closed
export const JIRA_STATUS_TO_STAGE: Record<string, string> = {
  // Pre-development
  Backlog: "under_review",
  Draft: "under_review",
  "In Scope Review": "under_review",
  "In Scope": "scope_confirmed",
  "Solution Complete": "scope_confirmed",
  "Selected for Development": "scope_confirmed",
  "Ready for Refinement": "scope_confirmed",

  // Development
  "To Do": "development",
  "In Progress": "development",
  "In Review": "development",

  // Testing
  "Ready for QA": "uat",
  "In QA": "uat",
  "User Acceptance Testing": "uat",
  UAT: "uat",

  // Release
  "Ready for Release": "released",
  Done: "released",
  Closed: "closed",
  Released: "released",
};

// ─── Pizza Tracker Stage Definitions ──────────────────────
// The ordered stages for the visual tracker
export const TRACKER_STAGES = [
  {
    id: "submitted" as const,
    label: "Request submitted",
    subtitle: "Received by the product team",
  },
  {
    id: "under_review" as const,
    label: "Under product review",
    subtitle: "Being evaluated and scoped",
  },
  {
    id: "scope_confirmed" as const,
    label: "Scope confirmed with business",
    subtitle: "Final scope date",
  },
  {
    id: "development" as const,
    label: "Development sprint starts",
    subtitle: null,
  },
  {
    id: "uat" as const,
    label: "User acceptance testing",
    subtitle: "Planned testing window",
  },
  {
    id: "released" as const,
    label: "Released",
    subtitle: "Available in production",
  },
] as const;

// ─── Email Subjects ───────────────────────────────────────
export const EMAIL_SUBJECTS: Record<string, string> = {
  pm_assigned: "Product manager assigned to your request",
  jira_linked: "Your request is now tracked in development",
  jira_status_changed: "Product intake update",
  jira_sprint_assigned: "Your request has been scheduled for a sprint",
  request_closed: "Your request has been completed",
};

// ─── Notification Descriptions ────────────────────────────
// What the status change means in plain English for stakeholders
export const STATUS_EXPLANATIONS: Record<string, string> = {
  Draft:
    "The initial requirements are being captured. A product manager will reach out if they need more details from you.",
  "In Scope Review":
    "The scope of work is being reviewed with technical teams and stakeholders to ensure feasibility and alignment.",
  "In Scope":
    "Great news — the scope has been approved. The development team will pick this up for planning.",
  "Solution Complete":
    "The technical solution has been designed. This will move into development soon.",
  "Selected for Development":
    "This has been selected for an upcoming development sprint. Work will begin shortly.",
  "In Progress":
    "A developer is actively working on this. You'll be notified when it moves to testing.",
  "In Review":
    "The code has been written and is being reviewed by the team before moving to testing.",
  "Ready for QA":
    "Development is complete. Quality assurance testing is underway.",
  UAT: "User acceptance testing is in progress. You may be contacted to validate the feature.",
  "Ready for Release":
    "Testing is complete and this is queued for the next production release.",
  Done: "This has been completed and deployed. Please verify the changes in your environment.",
  Closed:
    "This request has been fully resolved and closed. No further action is needed.",
};
