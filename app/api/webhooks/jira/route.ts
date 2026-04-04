// app/api/webhooks/jira/route.ts
// Receives webhooks from Jira (jira:issue_updated events)
// Trigger 3: Jira status changes → email requester via Freshservice lookup

import { NextRequest, NextResponse } from "next/server";
import type { JiraWebhookPayload } from "@/types";
import { verifyWebhook, parseWebhookBody } from "@/lib/webhook-auth";
import { getIssue, getFreshserviceIdFromIssue, humanizeSprint } from "@/lib/jira";
import { getTicket, getRequester } from "@/lib/freshservice";
import { sendNotification } from "@/lib/email";
import {
  getSubscribersForRequest,
  logNotification,
  sendToSubscribers,
} from "@/lib/store";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // ── Verify ──
  const auth = verifyWebhook(req);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const body = await parseWebhookBody<JiraWebhookPayload>(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { issue, changelog } = body;

  if (!issue?.key) {
    return NextResponse.json({ error: "No issue key in payload" }, { status: 400 });
  }

  // ── Check what changed ──
  const changes = changelog?.items || [];

  const statusChange = changes.find((item) => item.field === "status");
  const sprintChange = changes.find((item) => item.field === "Sprint");

  // Only process status or sprint changes
  if (!statusChange && !sprintChange) {
    return NextResponse.json({
      ok: true,
      event: "ignored",
      message: "No status or sprint change detected",
    });
  }

  try {
    console.log(
      `[webhook/jira] Processing ${issue.key}: ${
        statusChange
          ? `status ${statusChange.fromString} → ${statusChange.toString}`
          : `sprint changed`
      }`
    );

    // ── Get full Jira issue to find linked Freshservice ticket ──
    const jiraIssue = await getIssue(issue.key);
    const freshserviceId = getFreshserviceIdFromIssue(jiraIssue);

    if (!freshserviceId) {
      console.log(
        `[webhook/jira] No Freshservice ID found on ${issue.key} — skipping notification`
      );
      return NextResponse.json({
        ok: true,
        event: "no_fs_link",
        message: `No Freshservice ticket linked to ${issue.key}`,
      });
    }

    // ── Fetch Freshservice ticket and requester ──
    const ticketId = parseInt(freshserviceId);
    const ticket = await getTicket(ticketId);
    const requester = await getRequester(ticket.requester_id);

    const fromStatus = statusChange?.fromString || "Unknown";
    const toStatus = statusChange?.toString || jiraIssue.fields.status.name;
    const sprintInfo = humanizeSprint(jiraIssue.fields.sprint);
    const lastModified = new Date(
      jiraIssue.fields.updated
    ).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    // ── Determine notification type ──
    const eventType = sprintChange && !statusChange
      ? "jira_sprint_assigned"
      : "jira_status_changed";

    // ── Check if this is a milestone status (for milestone-only subscribers) ──
    const milestoneStatuses = [
      "In Progress",
      "In Scope Review",
      "In Scope",
      "Ready for Release",
      "Done",
      "Closed",
      "UAT",
      "Ready for QA",
    ];
    const isMilestone = milestoneStatuses.includes(toStatus);

    // ── Send to requester (always) ──
    const result = await sendNotification({
      to: requester.primary_email,
      requesterName: requester.first_name,
      requestId: ticketId,
      requestSubject: ticket.subject,
      eventType,
      jiraKey: issue.key,
      details: {
        fromStatus,
        toStatus,
        currentStatus: toStatus,
        sprintInfo: sprintInfo || "",
        sprintName: jiraIssue.fields.sprint?.name || "",
        sprintEndDate: jiraIssue.fields.sprint?.endDate
          ? new Date(jiraIssue.fields.sprint.endDate).toLocaleDateString(
              "en-US",
              { month: "long", day: "numeric", year: "numeric" }
            )
          : "",
        lastModified,
        assignee: jiraIssue.fields.assignee?.displayName || "Unassigned",
        subscriptionType: "status_milestones",
      },
    });

    await logNotification({
      requestId: ticketId,
      email: requester.primary_email,
      eventType,
      success: result.success,
    });

    // ── Send to subscribers ──
    // Full activity subscribers get everything
    const fullSubs = await getSubscribersForRequest(ticketId, "full_activity");
    // Milestone subscribers only get milestone statuses
    const milestoneSubs = isMilestone
      ? await getSubscribersForRequest(ticketId, "status_milestones")
      : [];

    const allSubEmails = [
      ...fullSubs.map((s) => s.email),
      ...milestoneSubs.map((s) => s.email),
    ].filter(
      (email, idx, arr) =>
        // Deduplicate and exclude the requester (already sent above)
        arr.indexOf(email) === idx && email !== requester.primary_email
    );

    if (allSubEmails.length > 0) {
      const subResult = await sendToSubscribers(allSubEmails, {
        requesterName: "Subscriber",
        requestId: ticketId,
        requestSubject: ticket.subject,
        eventType,
        jiraKey: issue.key,
        details: {
          fromStatus,
          toStatus,
          currentStatus: toStatus,
          sprintInfo: sprintInfo || "",
          lastModified,
          subscriptionType: "status_milestones",
        },
      });

      console.log(
        `[webhook/jira] Notified ${subResult.sent} subscribers (${subResult.failed} failed)`
      );
    }

    return NextResponse.json({
      ok: true,
      event: eventType,
      jiraKey: issue.key,
      freshserviceId: ticketId,
      from: fromStatus,
      to: toStatus,
      subscribersNotified: allSubEmails.length,
    });
  } catch (err: any) {
    console.error(`[webhook/jira] Error processing ${issue.key}:`, err);
    return NextResponse.json(
      { error: "Internal error", message: err.message },
      { status: 500 }
    );
  }
}
