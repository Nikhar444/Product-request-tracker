// app/api/webhooks/freshservice/route.ts
// Receives webhooks from Freshservice observer rules
// Trigger 1: PM (agent) assigned to a service request
// Trigger 2: Jira ticket key linked via custom field

import { NextRequest, NextResponse } from "next/server";
import type {
  FreshserviceWebhookPayload,
  NotificationEventType,
} from "@/types";
import { verifyWebhook, parseWebhookBody } from "@/lib/webhook-auth";
import {
  getTicket,
  getRequester,
  getAgent,
  getJiraKeyFromTicket,
  getInitials,
} from "@/lib/freshservice";
import { getIssue } from "@/lib/jira";
import { sendNotification } from "@/lib/email";
import {
  getSubscribersForRequest,
  logNotification,
  sendToSubscribers,
} from "@/lib/store";

export const maxDuration = 30; // Vercel serverless timeout

export async function POST(req: NextRequest) {
  // ── Verify webhook authenticity ──
  const auth = verifyWebhook(req);
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  // ── Parse payload ──
  const body = await parseWebhookBody<FreshserviceWebhookPayload>(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Freshservice sends data in different formats depending on the webhook config
  const payload = body.freshdesk_webhook || body;
  const ticketId = payload.ticket_id || body.ticket_id;

  if (!ticketId) {
    return NextResponse.json(
      { error: "No ticket_id in payload" },
      { status: 400 }
    );
  }

  try {
    // Fetch full ticket details from Freshservice
    const ticket = await getTicket(ticketId);
    const requester = await getRequester(ticket.requester_id);
    const requesterName = requester.first_name;
    const requesterEmail = requester.primary_email;

    // Determine which event triggered this webhook
    const eventType = detectEventType(payload, ticket);
    console.log(
      `[webhook/freshservice] Event: ${eventType} for ticket #${ticketId}`
    );

    // ── TRIGGER 1: Product Manager assigned ──
    if (eventType === "pm_assigned" && ticket.responder_id) {
      const agent = await getAgent(ticket.responder_id);
      const pmName = `${agent.first_name} ${agent.last_name}`;

      // Send email to the requester
      const result = await sendNotification({
        to: requesterEmail,
        requesterName,
        requestId: ticketId,
        requestSubject: ticket.subject,
        eventType: "pm_assigned",
        details: {
          pmName,
          pmEmail: agent.email,
          currentStatus: "PM Assigned",
          subscriptionType: "status_milestones",
        },
      });

      await logNotification({
        requestId: ticketId,
        email: requesterEmail,
        eventType: "pm_assigned",
        success: result.success,
      });

      // Also notify any subscribers
      const subscribers = await getSubscribersForRequest(ticketId);
      if (subscribers.length > 0) {
        const subEmails = subscribers
          .map((s) => s.email)
          .filter((e) => e !== requesterEmail);

        if (subEmails.length > 0) {
          await sendToSubscribers(subEmails, {
            requesterName: "Subscriber",
            requestId: ticketId,
            requestSubject: ticket.subject,
            eventType: "pm_assigned",
            details: {
              pmName,
              pmEmail: agent.email,
              currentStatus: "PM Assigned",
              subscriptionType: "status_milestones",
            },
          });
        }
      }

      return NextResponse.json({
        ok: true,
        event: "pm_assigned",
        pm: pmName,
      });
    }

    // ── TRIGGER 2: Jira ticket linked ──
    if (eventType === "jira_linked") {
      const jiraKey = getJiraKeyFromTicket(ticket);

      if (!jiraKey) {
        return NextResponse.json({
          ok: true,
          event: "jira_linked",
          message: "No Jira key found in custom field",
        });
      }

      // Fetch Jira issue details
      let jiraSummary = "";
      let jiraStatus = "";
      try {
        const issue = await getIssue(jiraKey);
        jiraSummary = issue.fields.summary;
        jiraStatus = issue.fields.status.name;
      } catch (err) {
        console.warn(`[webhook/freshservice] Could not fetch Jira issue ${jiraKey}:`, err);
      }

      const result = await sendNotification({
        to: requesterEmail,
        requesterName,
        requestId: ticketId,
        requestSubject: ticket.subject,
        eventType: "jira_linked",
        jiraKey,
        details: {
          jiraKey,
          jiraSummary,
          jiraStatus,
          currentStatus: jiraStatus || "In Development",
          subscriptionType: "status_milestones",
        },
      });

      await logNotification({
        requestId: ticketId,
        email: requesterEmail,
        eventType: "jira_linked",
        success: result.success,
      });

      return NextResponse.json({
        ok: true,
        event: "jira_linked",
        jiraKey,
      });
    }

    // ── Default: log but don't email ──
    return NextResponse.json({
      ok: true,
      event: "ignored",
      message: `Event type "${eventType}" not configured for notifications`,
    });
  } catch (err: any) {
    console.error(`[webhook/freshservice] Error processing ticket #${ticketId}:`, err);
    return NextResponse.json(
      { error: "Internal error", message: err.message },
      { status: 500 }
    );
  }
}

// ─── Event Detection ──────────────────────────────────────

function detectEventType(
  payload: any,
  ticket: any
): NotificationEventType | "unknown" {
  // Explicit event type from webhook config
  if (payload.event_type) return payload.event_type;

  // Check what field triggered the webhook
  const trigger = payload.triggered_by;
  const changes = payload.changes || {};

  // PM/Agent assignment
  if (
    trigger === "responder_id" ||
    changes.responder_id ||
    changes.agent_id
  ) {
    return "pm_assigned";
  }

  // Jira field linked
  const jiraField = process.env.FRESHSERVICE_JIRA_FIELD || "cf_jira_ticket";
  if (trigger === jiraField || changes[jiraField]) {
    return "jira_linked";
  }

  // Status change
  if (trigger === "status" || changes.status) {
    return "jira_status_changed";
  }

  return "unknown";
}
