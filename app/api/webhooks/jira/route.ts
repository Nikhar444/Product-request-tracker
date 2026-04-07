// app/api/webhooks/jira/route.ts
// Jira fires webhooks on issue_updated → we send email to requester + subscribers
// Also searches Freshservice for linked tickets to notify the original stakeholder

import { NextRequest, NextResponse } from "next/server";
import type { JiraWebhookPayload } from "@/types";
import { verifyWebhook } from "@/lib/webhook-auth";
import { getIssue, getRequester, humanizeSprint } from "@/lib/jira";
import { sendNotification, sendBulk } from "@/lib/email";
import { getSubscribers, logNotification } from "@/lib/store";
import { searchTickets, getJiraKeyFromTicket, getRequesterEmail } from "@/lib/freshservice";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const auth = verifyWebhook(req);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: 401 });

  let body: JiraWebhookPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { issue, changelog } = body;
  if (!issue?.key) return NextResponse.json({ error: "No issue key" }, { status: 400 });

  const changes = changelog?.items || [];
  const statusChange = changes.find((c) => c.field === "status");
  const sprintChange = changes.find((c) => c.field === "Sprint");
  const assigneeChange = changes.find((c) => c.field === "assignee");
  const fixVersionChange = changes.find((c) => c.field === "Fix Version");

  // Skip if nothing we care about changed
  if (!statusChange && !sprintChange && !assigneeChange && !fixVersionChange) {
    return NextResponse.json({ ok: true, event: "ignored" });
  }

  try {
    const jiraIssue = await getIssue(issue.key);

    // Try to get requester from Jira first, then fallback to Freshservice
    let requester = getRequester(jiraIssue);
    let freshserviceRequesterEmail: string | null = null;

    // If no requester in Jira, search Freshservice for a linked ticket
    if (!requester) {
      console.log(`[webhook/jira] No requester in Jira for ${issue.key}, checking Freshservice...`);

      try {
        // Search Freshservice tickets where the Jira ID field matches this key
        const fsTickets = await searchTickets(issue.key);

        for (const ticket of fsTickets) {
          const linkedJiraKey = getJiraKeyFromTicket(ticket);
          if (linkedJiraKey === issue.key) {
            // Found a matching Freshservice ticket!
            freshserviceRequesterEmail = await getRequesterEmail(ticket);
            if (freshserviceRequesterEmail) {
              console.log(`[webhook/jira] Found Freshservice requester: ${freshserviceRequesterEmail}`);
              requester = {
                name: "Requester",
                email: freshserviceRequesterEmail,
              };
              break;
            }
          }
        }
      } catch (err) {
        console.warn(`[webhook/jira] Could not search Freshservice for ${issue.key}:`, err);
      }
    }

    if (!requester) {
      console.log(`[webhook/jira] No requester email found for ${issue.key} — skipping`);
      return NextResponse.json({ ok: true, event: "no_requester" });
    }

    // Determine event type
    let eventType: "pm_assigned" | "jira_status_changed" | "jira_sprint_assigned" | "request_closed" | "version_assigned";

    if (fixVersionChange && !statusChange) {
      // Fix version was added or changed
      eventType = "version_assigned";
    } else if (assigneeChange && !statusChange && !sprintChange) {
      eventType = "pm_assigned";
    } else if (sprintChange && !statusChange) {
      eventType = "jira_sprint_assigned";
    } else if (statusChange?.toString === "Done" || statusChange?.toString === "Closed") {
      eventType = "request_closed";
    } else {
      eventType = "jira_status_changed";
    }

    const fromStatus = statusChange?.fromString || "";
    const toStatus = statusChange?.toString || jiraIssue.fields.status.name;
    const sprintInfo = humanizeSprint(jiraIssue.fields.sprint) || "";
    const lastModified = new Date(jiraIssue.fields.updated).toLocaleString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });

    // Get fix version information
    const fixVersionName = jiraIssue.fields.fixVersions && jiraIssue.fields.fixVersions.length > 0
      ? jiraIssue.fields.fixVersions[0].name
      : "";

    const details: Record<string, string> = {
      fromStatus,
      toStatus,
      currentStatus: toStatus,
      sprintInfo,
      sprintName: jiraIssue.fields.sprint?.name || "",
      sprintEndDate: jiraIssue.fields.sprint?.endDate
        ? new Date(jiraIssue.fields.sprint.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "",
      lastModified,
      assignee: jiraIssue.fields.assignee?.displayName || "Unassigned",
      pmName: assigneeChange?.toString || jiraIssue.fields.assignee?.displayName || "",
      pmEmail: jiraIssue.fields.assignee?.emailAddress || "",
      versionName: fixVersionName,
      subscriptionType: "status_milestones",
    };

    // 1. Send to the original requester
    const result = await sendNotification({
      to: requester.email,
      requesterName: requester.name,
      jiraKey: issue.key,
      requestSubject: jiraIssue.fields.summary,
      eventType,
      details,
    });

    await logNotification({ jiraKey: issue.key, email: requester.email, event: eventType, ok: result.success });

    // 2. Send to subscribers (deduped, excluding requester)
    const milestoneStatuses = ["In Progress", "In Scope Review", "In Scope", "Ready for Release", "Done", "Closed", "UAT", "Ready for QA"];
    const isMilestone = milestoneStatuses.includes(toStatus);

    const fullSubs = await getSubscribers(issue.key, "full_activity");
    const milestoneSubs = isMilestone ? await getSubscribers(issue.key, "status_milestones") : [];
    const subEmails = [...new Set([...fullSubs, ...milestoneSubs].map((s) => s.email))].filter(
      (e) => e !== requester.email
    );

    let subsNotified = 0;
    if (subEmails.length > 0) {
      const r = await sendBulk(subEmails, {
        requesterName: "Subscriber",
        jiraKey: issue.key,
        requestSubject: jiraIssue.fields.summary,
        eventType,
        details,
      });
      subsNotified = r.sent;
    }

    console.log(`[webhook/jira] ${issue.key}: ${eventType} → emailed ${requester.email} + ${subsNotified} subs`);

    return NextResponse.json({
      ok: true,
      event: eventType,
      jiraKey: issue.key,
      from: fromStatus,
      to: toStatus,
      subscribersNotified: subsNotified,
    });
  } catch (err: any) {
    console.error(`[webhook/jira] ${issue.key}:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
