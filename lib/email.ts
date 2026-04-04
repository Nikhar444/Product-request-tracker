// lib/email.ts
// Email sender via SMTP (M365 Outlook or Gmail)
// Produces HTML emails matching the Likewize-style notification format

import nodemailer from "nodemailer";
import type { EmailNotification, NotificationEventType } from "@/types";
import { EMAIL_SUBJECTS, STATUS_EXPLANATIONS } from "@/config/constants";

// ─── SMTP Transporter ─────────────────────────────────────

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP configuration incomplete. Set SMTP_HOST, SMTP_USER, SMTP_PASS."
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: {
      // Required for M365
      ciphers: "SSLv3",
      rejectUnauthorized: true,
    },
    // Connection pooling for webhook bursts
    pool: true,
    maxConnections: 3,
    maxMessages: 50,
  });

  return transporter;
}

// ─── Send Notification ────────────────────────────────────

export async function sendNotification(
  payload: EmailNotification
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const subject = buildSubject(payload);
    const html = buildEmailHtml(payload);
    const fromName = process.env.SMTP_FROM_NAME || "Product Request Updates";
    const fromEmail = process.env.SMTP_USER;

    const result = await getTransporter().sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: payload.to,
      subject,
      html,
      // Plain text fallback
      text: buildPlainText(payload),
      headers: {
        // Prevent auto-replies
        "X-Auto-Response-Suppress": "All",
        "Auto-Submitted": "auto-generated",
      },
    });

    console.log(
      `[email] Sent ${payload.eventType} for #${payload.requestId} to ${payload.to} — ${result.messageId}`
    );

    return { success: true, messageId: result.messageId };
  } catch (err: any) {
    console.error(
      `[email] Failed to send ${payload.eventType} for #${payload.requestId}:`,
      err.message
    );
    return { success: false, error: err.message };
  }
}

// ─── Send to Multiple Subscribers ─────────────────────────

export async function sendToSubscribers(
  emails: string[],
  payload: Omit<EmailNotification, "to">
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    const result = await sendNotification({ ...payload, to: email });
    if (result.success) sent++;
    else failed++;

    // Small delay between sends to avoid SMTP throttling
    if (emails.length > 5) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return { sent, failed };
}

// ─── Subject Builder ──────────────────────────────────────

function buildSubject(payload: EmailNotification): string {
  const prefix = payload.jiraKey || `REQ-${payload.requestId}`;
  const base =
    EMAIL_SUBJECTS[payload.eventType] || "Update on your product request";
  return `${prefix} · ${base}`;
}

// ─── HTML Email Template ──────────────────────────────────

function buildEmailHtml(payload: EmailNotification): string {
  const {
    requesterName,
    requestId,
    requestSubject,
    eventType,
    jiraKey,
    details,
  } = payload;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "#";
  const statusPortalUrl = `${appUrl}/intake-status?req=${requestId}`;
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?id=${requestId}&email=${encodeURIComponent(payload.to)}`;
  const now = new Date();
  const timestamp = now.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  // What changed section
  const whatChanged = buildWhatChanged(eventType, details);

  // Status color
  const statusColor =
    eventType === "request_closed"
      ? "#1D9E75"
      : eventType === "jira_status_changed"
        ? "#D97706"
        : "#5B2D8E";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f3; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Purple header bar -->
    <div style="background: #5B2D8E; padding: 20px 32px;">
      <span style="color: #ffffff; font-size: 18px; font-weight: 700; letter-spacing: -0.01em;">likewize.</span>
    </div>

    <div style="padding: 32px;">
      <!-- Reference block -->
      <div style="margin-bottom: 24px;">
        <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #9CA3AF;">
          Reference
        </p>
        ${jiraKey ? `<p style="margin: 0; font-size: 20px; font-weight: 700; color: #5B2D8E;">${jiraKey}</p>` : ""}
      </div>

      <!-- Request title -->
      <h1 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; line-height: 1.4; color: #1a1a18;">
        ${requestSubject}
      </h1>

      <!-- Status pill -->
      <div style="margin-bottom: 24px;">
        <span style="display: inline-block; padding: 4px 14px; border-radius: 12px; font-size: 13px; font-weight: 500; background: ${hexToRgba(statusColor, 0.12)}; color: ${statusColor};">
          Current status · ${details.currentStatus || details.toStatus || "Updated"}
        </span>
      </div>

      <!-- Metadata box -->
      <div style="background: #f9f9f7; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; font-size: 13px; color: #6b6a65; line-height: 1.6;">
        <p style="margin: 0;">Tracker last modified · ${details.lastModified || timestamp}</p>
        <p style="margin: 0;">Notification issued · ${timestamp}</p>
      </div>

      <!-- What changed -->
      <div style="margin-bottom: 28px;">
        <p style="margin: 0 0 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #9CA3AF;">
          What changed
        </p>
        <div style="padding: 14px 18px; border-left: 3px solid ${statusColor}; background: #fafaf8; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-size: 14px; color: #1a1a18; line-height: 1.5;">
            ${whatChanged}
          </p>
        </div>
      </div>

      <!-- Explanation for stakeholders -->
      ${
        details.toStatus && STATUS_EXPLANATIONS[details.toStatus]
          ? `
      <div style="margin-bottom: 28px;">
        <p style="margin: 0 0 8px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #9CA3AF;">
          What this means
        </p>
        <p style="margin: 0; font-size: 14px; color: #6b6a65; line-height: 1.5;">
          ${STATUS_EXPLANATIONS[details.toStatus]}
        </p>
      </div>
      `
          : ""
      }

      <!-- CTA button -->
      <div style="margin: 32px 0;">
        <a href="${statusPortalUrl}"
           style="display: inline-block; padding: 12px 28px; background: #5B2D8E; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
          View status portal
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding: 20px 32px; border-top: 1px solid #eeede8; font-size: 12px; color: #9CA3AF; line-height: 1.5;">
      <p style="margin: 0 0 4px;">
        Subscription: ${details.subscriptionType === "full_activity" ? "Full activity summary" : "Status milestones only"} · 
        Read-only notifications; no action is required unless you wish to review the portal.
      </p>
      <p style="margin: 0;">
        <a href="${unsubscribeUrl}" style="color: #5B2D8E; text-decoration: underline;">Unsubscribe from this request</a>
        &nbsp;&middot;&nbsp; ${process.env.NEXT_PUBLIC_APP_NAME || "Product Request Tracker"}
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── What Changed Text ────────────────────────────────────

function buildWhatChanged(
  eventType: NotificationEventType,
  details: Record<string, string>
): string {
  switch (eventType) {
    case "pm_assigned":
      return `Product manager <strong>${details.pmName}</strong> has been assigned to this request.${
        details.pmEmail
          ? ` You can reach them at <a href="mailto:${details.pmEmail}" style="color:#5B2D8E">${details.pmEmail}</a>.`
          : ""
      }`;

    case "jira_linked":
      return `This request is now tracked in our development system as <strong>${details.jiraKey}</strong>${
        details.jiraSummary ? ` — ${details.jiraSummary}` : ""
      }. You'll receive updates as it progresses through development.`;

    case "jira_status_changed":
      return `Status changed from "${details.fromStatus}" to "<strong>${details.toStatus}</strong>".${
        details.sprintInfo ? ` ${details.sprintInfo}` : ""
      }`;

    case "jira_sprint_assigned":
      return `This request has been scheduled for <strong>${details.sprintName}</strong>${
        details.sprintEndDate
          ? `, expected to end ${details.sprintEndDate}`
          : ""
      }.`;

    case "request_closed":
      return `This request has been completed and closed.${
        details.resolution ? ` Resolution: ${details.resolution}` : ""
      }`;

    default:
      return details.description || "Your request has been updated.";
  }
}

// ─── Plain Text Fallback ──────────────────────────────────

function buildPlainText(payload: EmailNotification): string {
  const { requesterName, requestId, requestSubject, eventType, details } =
    payload;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  let body = `Hi ${requesterName},\n\n`;
  body += `Regarding your request: ${requestSubject} (REQ-${requestId})\n\n`;

  switch (eventType) {
    case "pm_assigned":
      body += `A product manager (${details.pmName}) has been assigned to your request.\n`;
      break;
    case "jira_linked":
      body += `Your request is now tracked in development as ${details.jiraKey}.\n`;
      break;
    case "jira_status_changed":
      body += `Status changed: ${details.fromStatus} → ${details.toStatus}\n`;
      if (details.sprintInfo) body += `${details.sprintInfo}\n`;
      break;
    case "jira_sprint_assigned":
      body += `Scheduled for sprint: ${details.sprintName}\n`;
      break;
    case "request_closed":
      body += `This request has been completed and closed.\n`;
      break;
  }

  if (details.toStatus && STATUS_EXPLANATIONS[details.toStatus]) {
    body += `\nWhat this means: ${STATUS_EXPLANATIONS[details.toStatus]}\n`;
  }

  body += `\nView your request: ${appUrl}/intake-status?req=${requestId}\n`;
  body += `\n---\nThis is an automated notification. No action is required unless you wish to review the portal.\n`;

  return body;
}

// ─── Utility ──────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Internal Team Notification ───────────────────────────

export async function notifyProductTeam(
  subject: string,
  body: string
): Promise<void> {
  const teamEmail = process.env.PRODUCT_TEAM_EMAIL;
  if (!teamEmail) {
    console.warn("[email] PRODUCT_TEAM_EMAIL not set — skipping team notification");
    return;
  }

  try {
    await getTransporter().sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "Request Tracker"}" <${process.env.SMTP_USER}>`,
      to: teamEmail,
      subject,
      html: `<div style="font-family: -apple-system, sans-serif; max-width: 600px; padding: 24px;">
        ${body}
      </div>`,
      text: body.replace(/<[^>]+>/g, ""),
    });
  } catch (err: any) {
    console.error("[email] Failed to notify product team:", err.message);
  }
}
