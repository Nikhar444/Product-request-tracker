// lib/enrich.ts
// Transforms a raw Jira issue into the EnrichedRequest the UI needs

import type { JiraIssue, EnrichedRequest, TrackerStep, PizzaTrackerStage } from "@/types";
import {
  getComments,
  toNotes,
  adfToText,
  getRequester,
  getClient,
  getProductOwner,
  getSolutionOwner,
  getStage,
  humanizeSprint,
  getJiraUrl,
} from "./jira";
import { TRACKER_STAGES } from "@/config/constants";

export async function enrichIssue(issue: JiraIssue): Promise<EnrichedRequest> {
  // Fetch comments
  let recentNotes = [];
  try {
    // Use inline comments if already present, otherwise fetch
    if (issue.fields.comment?.comments?.length) {
      recentNotes = toNotes(
        issue.fields.comment.comments.sort(
          (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
        ).slice(0, 10)
      );
    } else {
      const comments = await getComments(issue.key, 10);
      recentNotes = toNotes(comments);
    }
  } catch (err) {
    console.warn(`[enrich] Could not fetch comments for ${issue.key}:`, err);
  }

  const requester = getRequester(issue);
  const client = getClient(issue);
  const sprintInfo = humanizeSprint(issue.fields.sprint);
  const assigneeName = issue.fields.assignee?.displayName || null;

  // Product manager comes from the Product Owner custom field
  const productManager = getProductOwner(issue);

  // Solution owner (tech lead) from custom field
  const solutionOwner = getSolutionOwner(issue);

  const tracker = buildTracker(issue);

  return {
    jiraKey: issue.key,
    summary: issue.fields.summary,
    description: adfToText(issue.fields.description),
    status: issue.fields.status.name,
    statusCategory: issue.fields.status.statusCategory.name,
    priority: issue.fields.priority?.name || "Normal",
    issueType: issue.fields.issuetype?.name || "Task",
    project: issue.fields.project?.name || issue.fields.project?.key || "",
    createdAt: issue.fields.created,
    updatedAt: issue.fields.updated,
    requester,
    client,
    assignee: assigneeName,
    productManager,
    solutionOwner,
    sprint: sprintInfo,
    sprintEndDate: issue.fields.sprint?.endDate || null,
    url: getJiraUrl(issue.key),
    tracker,
    recentNotes,
  };
}

// ─── Pizza Tracker ────────────────────────────────────────

function buildTracker(issue: JiraIssue): TrackerStep[] {
  const currentStageName = getStage(issue.fields.status.name) as PizzaTrackerStage;
  const isDone = issue.fields.status.statusCategory.key === "done";

  const stageOrder: PizzaTrackerStage[] = TRACKER_STAGES.map((s) => s.id);
  const currentIdx = stageOrder.indexOf(currentStageName);

  return TRACKER_STAGES.map((stage, idx) => {
    let status: TrackerStep["status"];

    if (isDone) {
      status = "complete";
    } else if (idx < currentIdx) {
      status = "complete";
    } else if (idx === currentIdx) {
      status = "current";
    } else {
      status = "upcoming";
    }

    const step: TrackerStep = {
      id: stage.id,
      label: stage.label,
      subtitle: stage.subtitle || undefined,
      status,
    };

    // Attach dates and dynamic subtitles
    if (stage.id === "submitted" && status !== "upcoming") {
      step.date = issue.fields.created;
    }

    // For in_sprint stage, show the sprint name
    if (stage.id === "in_sprint" && issue.fields.sprint && (status === "complete" || status === "current")) {
      step.subtitle = issue.fields.sprint.name || undefined;
    }

    // For in_uat stage, override the subtitle
    if (stage.id === "in_uat" && (status === "complete" || status === "current")) {
      step.subtitle = "With product manager for UAT";
    }

    // For released stage, show fix version and date
    if (stage.id === "released" && isDone) {
      step.date = issue.fields.resolutiondate || issue.fields.updated;
      // Try to show the Fix Version
      if (issue.fields.fixVersions && issue.fields.fixVersions.length > 0) {
        const fixVersion = issue.fields.fixVersions[0].name;
        step.subtitle = fixVersion ? `Released in ${fixVersion}` : "Available in production";
      }
    }

    return step;
  });
}
