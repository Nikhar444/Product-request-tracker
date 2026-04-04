// config/constants.ts

// ─── Jira Status → Plain English ──────────────────────────
// Update these to match YOUR Jira workflow status names exactly.

export const JIRA_STATUS_HUMAN: Record<string, string> = {
  "To Do": "Queued for development",
  "In Progress": "Actively being worked on",
  "In Review": "Code review in progress",
  "Done": "Development complete",
  "Closed": "Closed and released",
  "Backlog": "In the product backlog",
  "Draft": "Initial draft — being defined",
  "In Scope Review": "Scope is being reviewed with stakeholders",
  "In Scope": "Scope has been approved",
  "Solution Complete": "Solution design is finalized",
  "Selected for Development": "Picked up by the dev team",
  "Ready for Refinement": "Ready for sprint planning",
  "Ready for QA": "In quality testing",
  "UAT": "User acceptance testing",
  "Ready for Release": "Queued for next production release",
  "Released": "Deployed to production",
};

// ─── Jira Status → Pizza Tracker Stage ────────────────────

export const JIRA_STATUS_TO_STAGE: Record<string, string> = {
  "Backlog": "submitted",
  "Draft": "under_review",
  "In Scope Review": "under_review",
  "In Scope": "scope_confirmed",
  "Solution Complete": "scope_confirmed",
  "Selected for Development": "scope_confirmed",
  "Ready for Refinement": "scope_confirmed",
  "To Do": "development",
  "In Progress": "development",
  "In Review": "development",
  "Ready for QA": "uat",
  "In QA": "uat",
  "UAT": "uat",
  "User Acceptance Testing": "uat",
  "Ready for Release": "released",
  "Done": "released",
  "Released": "released",
  "Closed": "released",
};

// ─── Tracker Stage Definitions ────────────────────────────

export const TRACKER_STAGES = [
  { id: "submitted" as const, label: "Request submitted", subtitle: "Received by the product team" },
  { id: "under_review" as const, label: "Under product review", subtitle: "Being evaluated and scoped" },
  { id: "scope_confirmed" as const, label: "Scope confirmed with business", subtitle: "Final scope date" },
  { id: "development" as const, label: "Development sprint starts", subtitle: null },
  { id: "uat" as const, label: "User acceptance testing", subtitle: "Planned testing window" },
  { id: "released" as const, label: "Released", subtitle: "Available in production" },
] as const;

// ─── Email ────────────────────────────────────────────────

export const EMAIL_SUBJECTS: Record<string, string> = {
  pm_assigned: "Product manager assigned to your request",
  jira_status_changed: "Product intake update",
  jira_sprint_assigned: "Your request has been scheduled for a sprint",
  request_closed: "Your request has been completed",
};

export const STATUS_EXPLANATIONS: Record<string, string> = {
  "Draft": "The initial requirements are being captured. A product manager will reach out if they need more details.",
  "In Scope Review": "The scope is being reviewed with technical teams and stakeholders.",
  "In Scope": "The scope has been approved. Development planning will begin shortly.",
  "Solution Complete": "The technical solution has been designed and will move into development soon.",
  "Selected for Development": "This has been selected for an upcoming sprint.",
  "In Progress": "A developer is actively working on this.",
  "In Review": "The code has been written and is under review.",
  "Ready for QA": "Development is complete — quality testing is underway.",
  "UAT": "User acceptance testing is in progress. You may be contacted to validate.",
  "Ready for Release": "Testing is complete. Queued for the next production release.",
  "Done": "Completed and deployed. Please verify in your environment.",
  "Closed": "Fully resolved and closed.",
};
