// config/constants.ts

// ─── Jira Status → Plain English ──────────────────────────
// Update these to match YOUR Jira workflow status names exactly.

export const JIRA_STATUS_HUMAN: Record<string, string> = {
  "Backlog": "In the product backlog",
  "Open": "New request received",
  "New": "New request received",
  "Draft": "Initial draft — being defined",
  "In Scope Review": "Scope is being reviewed with stakeholders",
  "In Scope": "Scope has been approved",
  "Solution Complete": "Solution design is finalized",
  "Ready for Refinement": "Ready for sprint planning",
  "Selected for Development": "Picked up by the dev team",
  "To Do": "Queued for development",
  "In Progress": "This is actively being developed in the current sprint.",
  "In Development": "This is actively being developed in the current sprint.",
  "In Review": "Code has been written and is being reviewed by the team.",
  "Code Review": "Code has been written and is being reviewed by the team.",
  "In QA": "Development is done. The QA team is testing it now.",
  "Ready for QA": "Development is done. The QA team is testing it now.",
  "Ready for UAT": "Development is complete. The product manager is now testing this with the business before release.",
  "UAT": "Development is complete. The product manager is now testing this with the business before release.",
  "User Acceptance Testing": "Development is complete. The product manager is now testing this with the business before release.",
  "Ready for Release": "Testing is complete. Queued for the next production release.",
  "Done": "Completed and deployed.",
  "Released": "Completed and deployed.",
  "Closed": "Completed and deployed.",
};

// ─── Jira Status → Pizza Tracker Stage ────────────────────

export const JIRA_STATUS_TO_STAGE: Record<string, string> = {
  // STAGE 1 - submitted
  "Backlog": "submitted",
  "Open": "submitted",
  "New": "submitted",

  // STAGE 2 - under_review
  "Draft": "under_review",
  "In Scope Review": "under_review",
  "In Scope": "under_review",
  "Solution Complete": "under_review",
  "Ready for Refinement": "under_review",
  "Selected for Development": "under_review",
  "To Do": "under_review",

  // STAGE 3 - in_sprint
  "In Progress": "in_sprint",
  "In Development": "in_sprint",
  "In Review": "in_sprint",
  "Code Review": "in_sprint",
  "In QA": "in_sprint",
  "Ready for QA": "in_sprint",

  // STAGE 4 - in_uat
  "Ready for UAT": "in_uat",
  "UAT": "in_uat",
  "User Acceptance Testing": "in_uat",

  // STAGE 5 - released
  "Ready for Release": "released",
  "Done": "released",
  "Released": "released",
  "Closed": "released",
};

// ─── Tracker Stage Definitions ────────────────────────────

export const TRACKER_STAGES = [
  { id: "submitted" as const, label: "Request submitted", subtitle: "Received by the product team" },
  { id: "under_review" as const, label: "Under product review", subtitle: "Being evaluated and scoped" },
  { id: "in_sprint" as const, label: "In sprint", subtitle: null }, // subtitle will be dynamically set to sprint name
  { id: "in_uat" as const, label: "With product manager for UAT", subtitle: "User acceptance testing in progress" },
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
