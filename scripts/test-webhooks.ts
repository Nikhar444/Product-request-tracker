// scripts/test-webhooks.ts
// Simulates Jira and Freshservice webhooks locally
// Run: npx tsx scripts/test-webhooks.ts

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const SECRET = process.env.WEBHOOK_SECRET || "test-secret";

async function testFreshserviceWebhook() {
  console.log("\n── Testing Freshservice Webhook: PM Assigned ──");

  const res = await fetch(`${BASE}/api/webhooks/freshservice?secret=${SECRET}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      freshdesk_webhook: {
        ticket_id: 11918885,
        ticket_subject: "Suppress Network Mismatch Escalations",
        triggered_by: "responder_id",
        changes: {
          responder_id: { from: null, to: 12345 },
        },
      },
    }),
  });

  console.log(`Status: ${res.status}`);
  console.log("Response:", await res.json());
}

async function testJiraWebhook() {
  console.log("\n── Testing Jira Webhook: Status Change ──");

  const res = await fetch(`${BASE}/api/webhooks/jira?secret=${SECRET}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      timestamp: Date.now(),
      webhookEvent: "jira:issue_updated",
      issue: {
        id: "10001",
        key: "DPS-100999",
        fields: {
          summary: "Suppress Network Mismatch Escalations",
          status: { name: "In Progress" },
        },
      },
      changelog: {
        id: "10001",
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
      user: {
        displayName: "Test User",
        emailAddress: "test@example.com",
      },
    }),
  });

  console.log(`Status: ${res.status}`);
  console.log("Response:", await res.json());
}

async function testSearch() {
  console.log("\n── Testing Search API ──");

  const res = await fetch(`${BASE}/api/search?q=network+mismatch`);
  console.log(`Status: ${res.status}`);
  const data = await res.json();
  console.log(`Results: ${data.results?.length || 0}`);
  if (data.results?.[0]) {
    console.log("First result:", data.results[0].subject);
  }
}

async function main() {
  console.log(`Testing against: ${BASE}`);
  console.log("─".repeat(50));

  try {
    await testSearch();
    await testFreshserviceWebhook();
    await testJiraWebhook();
  } catch (err) {
    console.error("Test failed:", err);
  }
}

main();
