// lib/enrich.ts
// Combines Freshservice ticket + Jira issue data into a single EnrichedRequest
// with computed pizza tracker stages

import type {
  FreshserviceTicket,
  EnrichedRequest,
  TrackerStep,
  PizzaTrackerStage,
  NoteEntry,
} from "@/types";
import {
  getRequester,
  getAgent,
  getJiraKeyFromTicket,
  getInitials,
} from "./freshservice";
import {
  getIssue,
  getIssueComments,
  getStageFromStatus,
  humanizeSprint,
  adfToPlainText,
  transformComments,
  getJiraUrl,
} from "./jira";
import {
  FS_STATUS_MAP,
  FS_PRIORITY_MAP,
  TRACKER_STAGES,
} from "@/config/constants";

// ─── Enrich a Freshservice ticket with all related data ───

export async function enrichRequest(
  ticket: FreshserviceTicket
): Promise<EnrichedRequest> {
  // Fetch requester
  const requester = await getRequester(ticket.requester_id);

  // Fetch PM (agent/responder) if assigned
  let productManager: EnrichedRequest["productManager"] = null;
  if (ticket.responder_id) {
    try {
      const agent = await getAgent(ticket.responder_id);
      productManager = {
        name: `${agent.first_name} ${agent.last_name}`,
        email: agent.email,
        initials: getInitials(agent.first_name, agent.last_name),
      };
    } catch (err) {
      console.warn(
        `[enrich] Could not fetch agent ${ticket.responder_id}:`,
        err
      );
    }
  }

  // Fetch Jira data if linked
  let jiraData: EnrichedRequest["jira"] = null;
  let recentNotes: NoteEntry[] = [];
  const jiraKey = getJiraKeyFromTicket(ticket);

  if (jiraKey) {
    try {
      const issue = await getIssue(jiraKey);
      const sprintInfo = humanizeSprint(issue.fields.sprint);

      jiraData = {
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        statusCategory: issue.fields.status.statusCategory.name,
        assignee: issue.fields.assignee?.displayName || null,
        sprint: sprintInfo,
        sprintEndDate: issue.fields.sprint?.endDate || null,
        url: getJiraUrl(issue.key),
      };

      // Fetch recent comments from Jira
      try {
        const comments = await getIssueComments(jiraKey, 10);
        recentNotes = transformComments(comments);
      } catch (err) {
        console.warn(`[enrich] Could not fetch comments for ${jiraKey}:`, err);
      }
    } catch (err) {
      console.warn(`[enrich] Could not fetch Jira issue ${jiraKey}:`, err);
      // Still include partial data
      jiraData = {
        key: jiraKey,
        summary: "",
        status: "Unknown",
        statusCategory: "undefined",
        assignee: null,
        sprint: null,
        sprintEndDate: null,
        url: getJiraUrl(jiraKey),
      };
    }
  }

  // Parse client/country from subject (common format: "CLIENT | COUNTRY | #REQ | Title")
  const { client, country, category } = parseTicketMetadata(ticket);

  // Build pizza tracker
  const tracker = buildPizzaTracker(ticket, jiraData);

  return {
    id: ticket.id,
    subject: ticket.subject,
    description: ticket.description_text || ticket.description || "",
    status: FS_STATUS_MAP[ticket.status] || "Open",
    statusRaw: ticket.status,
    priority: FS_PRIORITY_MAP[ticket.priority] || "Normal",
    type: ticket.type || "Service Request",
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
    requester: {
      name: `${requester.first_name} ${requester.last_name}`,
      email: requester.primary_email,
      jobTitle: requester.job_title || undefined,
    },
    productManager,
    jira: jiraData,
    tracker,
    client,
    country,
    category,
    recentNotes,
  };
}

// ─── Pizza Tracker Builder ────────────────────────────────

function buildPizzaTracker(
  ticket: FreshserviceTicket,
  jira: EnrichedRequest["jira"]
): TrackerStep[] {
  // Determine current stage
  let currentStageId: PizzaTrackerStage = "submitted";

  if (ticket.status === 4 || ticket.status === 5) {
    // Resolved or Closed in Freshservice
    currentStageId = "released";
  } else if (jira) {
    const jiraStage = getStageFromStatus(jira.status) as PizzaTrackerStage;
    currentStageId = jiraStage;
  } else if (ticket.responder_id) {
    // PM assigned but no Jira yet
    currentStageId = "under_review";
  }

  // Map stage IDs to their index for comparison
  const stageOrder: PizzaTrackerStage[] = TRACKER_STAGES.map((s) => s.id);
  const currentIndex = stageOrder.indexOf(currentStageId);

  return TRACKER_STAGES.map((stage, idx) => {
    let status: TrackerStep["status"];

    if (idx < currentIndex) {
      status = "complete";
    } else if (idx === currentIndex) {
      status = "current";
    } else {
      status = "upcoming";
    }

    // For closed tickets, everything is complete
    if (ticket.status === 5) {
      status = "complete";
    }

    const step: TrackerStep = {
      id: stage.id,
      label: stage.label,
      subtitle: stage.subtitle || undefined,
      status,
    };

    // Add dates where available
    if (stage.id === "submitted" && status !== "upcoming") {
      step.date = ticket.created_at;
    }

    if (
      stage.id === "development" &&
      jira?.sprint &&
      (status === "complete" || status === "current")
    ) {
      step.subtitle = jira.sprint;
    }

    if (stage.id === "uat" && jira?.sprintEndDate && status === "current") {
      step.subtitle = "Planned testing window";
    }

    if (stage.id === "released" && ticket.status === 5) {
      step.date = ticket.updated_at;
    }

    return step;
  });
}

// ─── Parse Ticket Metadata ────────────────────────────────
// Many teams encode metadata in the subject line:
// "DISH | US | #REQ-11918885 | Suppress Network Mismatch..."

function parseTicketMetadata(ticket: FreshserviceTicket): {
  client?: string;
  country?: string;
  category?: string;
} {
  const subject = ticket.subject || "";

  // Try to parse "CLIENT | COUNTRY | ... | Title" format
  const parts = subject.split("|").map((p) => p.trim());

  if (parts.length >= 3) {
    return {
      client: parts[0] || undefined,
      country: parts[1] || undefined,
      category: ticket.type || undefined,
    };
  }

  // Fall back to custom fields if available
  return {
    client: ticket.custom_fields?.cf_client || undefined,
    country: ticket.custom_fields?.cf_country || undefined,
    category: ticket.type || undefined,
  };
}
