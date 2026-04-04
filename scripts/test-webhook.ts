// scripts/test-webhook.ts
// Usage: WEBHOOK_SECRET=xxx tsx scripts/test-webhook.ts
// Simulates a Jira status change webhook hitting your local/deployed app

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const SECRET = process.env.WEBHOOK_SECRET || "test";

async function main() {
  const payload = {
    timestamp: Date.now(),
    webhookEvent: "jira:issue_updated",
    issue: {
      id: "10001",
      key: "DPS-100999",
      fields: {
        summary: "Suppress Network Mismatch Escalations For Active IMEI",
        status: { name: "In Progress", statusCategory: { key: "indeterminate", name: "In Progress" } },
      },
    },
    changelog: {
      id: "12345",
      items: [
        {
          field: "status",
          fieldtype: "jira",
          from: "10000",
          fromString: "In Scope Review",
          to: "10001",
          toString: "In Progress",
        },
      ],
    },
  };

  console.log(`Sending test webhook to ${APP_URL}/api/webhooks/jira`);

  const res = await fetch(`${APP_URL}/api/webhooks/jira?secret=${SECRET}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log(`Response (${res.status}):`, JSON.stringify(data, null, 2));
}

main().catch(console.error);
