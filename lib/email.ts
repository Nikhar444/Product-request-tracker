// lib/email.ts
// SMTP email sender for M365 / Gmail

import nodemailer from "nodemailer";
import type { EmailNotification, NotificationEventType } from "@/types";
import { EMAIL_SUBJECTS, STATUS_EXPLANATIONS } from "@/config/constants";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error("SMTP not configured");

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: { user, pass },
    tls: { ciphers: "SSLv3", rejectUnauthorized: true },
    pool: true,
    maxConnections: 3,
  });
  return transporter;
}

export async function sendNotification(
  payload: EmailNotification
): Promise<{ success: boolean; error?: string }> {
  try {
    const from = `"${process.env.SMTP_FROM_NAME || "Product Updates"}" <${process.env.SMTP_USER}>`;
    const subject = `${payload.jiraKey} · ${EMAIL_SUBJECTS[payload.eventType] || "Update"}`;

    await getTransporter().sendMail({
      from,
      to: payload.to,
      subject,
      html: buildHtml(payload),
      text: buildText(payload),
      headers: { "X-Auto-Response-Suppress": "All", "Auto-Submitted": "auto-generated" },
    });

    console.log(`[email] Sent ${payload.eventType} for ${payload.jiraKey} to ${payload.to}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[email] Send failed:`, err.message);
    return { success: false, error: err.message };
  }
}

export async function sendBulk(
  emails: string[],
  payload: Omit<EmailNotification, "to">
): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;
  for (const email of emails) {
    const r = await sendNotification({ ...payload, to: email });
    r.success ? sent++ : failed++;
    if (emails.length > 5) await new Promise((r) => setTimeout(r, 200));
  }
  return { sent, failed };
}

// ─── HTML Template ────────────────────────────────────────

function buildHtml(p: EmailNotification): string {
  const { jiraKey, requestSubject, eventType, details } = p;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const portalUrl = `${appUrl}/intake-status?req=${jiraKey}`;
  const unsubUrl = `${appUrl}/api/unsubscribe?key=${jiraKey}&email=${encodeURIComponent(p.to)}`;
  const now = new Date().toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });

  const whatChanged = getWhatChanged(eventType, details);
  const statusColor = eventType === "request_closed" ? "#1D9E75" : eventType === "jira_status_changed" ? "#D97706" : "#5B2D8E";
  const explanation = details.toStatus ? STATUS_EXPLANATIONS[details.toStatus] || "" : "";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f3;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#5B2D8E;padding:20px 32px;">
    <span style="color:#fff;font-size:18px;font-weight:700;">likewize.</span>
  </div>
  <div style="padding:32px;">
    <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#9CA3AF;">Reference</p>
    <p style="margin:0 0 20px;font-size:20px;font-weight:700;color:#5B2D8E;">${jiraKey}</p>
    <h1 style="margin:0 0 16px;font-size:16px;font-weight:600;line-height:1.4;color:#1a1a18;">${requestSubject}</h1>
    <div style="margin-bottom:24px;">
      <span style="display:inline-block;padding:4px 14px;border-radius:12px;font-size:13px;font-weight:500;background:rgba(${statusColor === "#1D9E75" ? "29,158,117" : statusColor === "#D97706" ? "217,119,6" : "91,45,142"},0.12);color:${statusColor};">
        Current status · ${details.currentStatus || details.toStatus || "Updated"}
      </span>
    </div>
    <div style="background:#f9f9f7;border-radius:8px;padding:14px 18px;margin-bottom:24px;font-size:13px;color:#6b6a65;line-height:1.6;">
      <p style="margin:0;">Tracker last modified · ${details.lastModified || now}</p>
      <p style="margin:0;">Notification issued · ${now}</p>
    </div>
    <p style="margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#9CA3AF;">What changed</p>
    <div style="padding:14px 18px;border-left:3px solid ${statusColor};background:#fafaf8;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#1a1a18;line-height:1.5;">${whatChanged}</p>
    </div>
    ${explanation ? `<p style="margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#9CA3AF;">What this means</p><p style="margin:0 0 24px;font-size:14px;color:#6b6a65;line-height:1.5;">${explanation}</p>` : ""}
    <div style="margin:32px 0;">
      <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;background:#5B2D8E;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">View status portal</a>
    </div>
  </div>
  <div style="padding:20px 32px;border-top:1px solid #eeede8;font-size:12px;color:#9CA3AF;line-height:1.5;">
    <p style="margin:0 0 4px;">Subscription: ${details.subscriptionType === "full_activity" ? "Full activity summary" : "Status milestones only"} · Read-only notifications; no action is required unless you wish to review the portal.</p>
    <p style="margin:0;"><a href="${unsubUrl}" style="color:#5B2D8E;text-decoration:underline;">Unsubscribe from this request</a> · ${process.env.NEXT_PUBLIC_APP_NAME || "Product Request Tracker"}</p>
  </div>
</div></body></html>`;
}

function getWhatChanged(type: NotificationEventType, d: Record<string, string>): string {
  switch (type) {
    case "pm_assigned":
      return `Product manager <strong>${d.pmName}</strong> has been assigned.${d.pmEmail ? ` Reach them at <a href="mailto:${d.pmEmail}" style="color:#5B2D8E">${d.pmEmail}</a>.` : ""}`;
    case "jira_status_changed":
      return `Status changed from "${d.fromStatus}" to "<strong>${d.toStatus}</strong>".${d.sprintInfo ? ` ${d.sprintInfo}` : ""}`;
    case "jira_sprint_assigned":
      return `Scheduled for <strong>${d.sprintName}</strong>${d.sprintEndDate ? `, ending ${d.sprintEndDate}` : ""}.`;
    case "request_closed":
      return `This request has been completed and closed.`;
    default:
      return d.description || "Your request has been updated.";
  }
}

function buildText(p: EmailNotification): string {
  const d = p.details;
  let t = `${p.jiraKey} — ${p.requestSubject}\n\nStatus: ${d.currentStatus || d.toStatus || "Updated"}\n\n`;
  if (d.fromStatus) t += `Changed: ${d.fromStatus} → ${d.toStatus}\n`;
  if (d.toStatus && STATUS_EXPLANATIONS[d.toStatus]) t += `\n${STATUS_EXPLANATIONS[d.toStatus]}\n`;
  t += `\nView: ${process.env.NEXT_PUBLIC_APP_URL}/intake-status?req=${p.jiraKey}\n`;
  return t;
}

export async function notifyProductTeam(subject: string, body: string): Promise<void> {
  const to = process.env.PRODUCT_TEAM_EMAIL;
  if (!to) return;
  try {
    await getTransporter().sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "Request Tracker"}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;padding:24px;">${body}</div>`,
    });
  } catch (err: any) {
    console.error("[email] Team notify failed:", err.message);
  }
}
