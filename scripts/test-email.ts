// scripts/test-email.ts
// Usage: source .env.local && tsx scripts/test-email.ts your@email.com
// Sends a test notification email to verify SMTP config

import { sendNotification } from "../lib/email";

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error("Usage: tsx scripts/test-email.ts your@email.com");
    process.exit(1);
  }

  console.log(`Sending test email to ${to}...`);

  const result = await sendNotification({
    to,
    requesterName: "Test User",
    jiraKey: "DPS-100999",
    requestSubject: "Suppress Network Mismatch Escalations For Active IMEI",
    eventType: "jira_status_changed",
    details: {
      fromStatus: "In Scope Review",
      toStatus: "In Progress",
      currentStatus: "In Progress",
      sprintInfo: "Current sprint: Sprint 24 (ends Apr 11)",
      lastModified: new Date().toLocaleString(),
      subscriptionType: "status_milestones",
    },
  });

  console.log("Result:", result);
}

main().catch(console.error);
