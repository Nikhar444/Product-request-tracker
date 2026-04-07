// lib/jira.ts
// Jira Cloud REST API v3 — the ONLY data source for this app

import type { JiraIssue, JiraComment, NoteEntry } from "@/types";
import { JIRA_STATUS_HUMAN, JIRA_STATUS_TO_STAGE } from "@/config/constants";

// ─── Config ───────────────────────────────────────────────

const DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_TOKEN;
const PROJECT_KEYS = (process.env.JIRA_PROJECT_KEYS || "").split(",").map((k) => k.trim()).filter(Boolean);
const REQUESTER_EMAIL_FIELD = process.env.JIRA_REQUESTER_EMAIL_FIELD || "";
const REQUESTER_NAME_FIELD = process.env.JIRA_REQUESTER_NAME_FIELD || "";
const CLIENT_FIELD = process.env.JIRA_CLIENT_FIELD || "";
const PRODUCT_OWNER_FIELD = process.env.JIRA_PRODUCT_OWNER_FIELD || "";
const SOLUTION_OWNER_FIELD = process.env.JIRA_SOLUTION_OWNER_FIELD || "";

function baseUrl(): string {
  if (!DOMAIN) throw new Error("JIRA_DOMAIN not set");
  return `https://${DOMAIN}/rest/api/3`;
}

function headers(): Record<string, string> {
  if (!EMAIL || !TOKEN) throw new Error("JIRA_EMAIL and JIRA_API_TOKEN must be set");
  return {
    Authorization: `Basic ${Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// ─── HTTP with retries ────────────────────────────────────

async function jiraFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${baseUrl()}${path}`;
  console.log("[jira] 3) Full Jira API URL:", url);
  console.log("[jira] Request method:", init.method || "GET");
  if (init.body) {
    console.log("[jira] Request body:", init.body);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { ...init, headers: { ...headers(), ...init.headers } });
      console.log("[jira] 4) Response status:", res.status, res.statusText);

      if (res.status === 429) {
        const wait = parseInt(res.headers.get("retry-after") || "5");
        console.warn(`[jira] Rate limited — retry in ${wait}s`);
        await sleep(wait * 1000);
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        console.error("[jira] 4) Error response body:", body);
        throw new Error(`Jira ${res.status}: ${body}`);
      }

      const data = await res.json();
      console.log("[jira] 4) Success response:", JSON.stringify(data).substring(0, 500) + "...");
      return data;
    } catch (err: any) {
      console.error(`[jira] Attempt ${attempt + 1}/3 failed:`, err.message);
      if (attempt === 2) throw err;
      await sleep(1000 * (attempt + 1));
    }
  }

  throw new Error("Jira request failed after 3 attempts");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Core fields we request on every query ────────────────

function issueFields(): string[] {
  const fields = [
    "summary", "description", "status", "assignee", "reporter",
    "priority", "issuetype", "project", "labels", "sprint",
    "comment", "updated", "created", "resolutiondate", "fixVersions",
  ];
  if (REQUESTER_EMAIL_FIELD) fields.push(REQUESTER_EMAIL_FIELD);
  if (REQUESTER_NAME_FIELD) fields.push(REQUESTER_NAME_FIELD);
  if (CLIENT_FIELD) fields.push(CLIENT_FIELD);
  if (PRODUCT_OWNER_FIELD) fields.push(PRODUCT_OWNER_FIELD);
  if (SOLUTION_OWNER_FIELD) fields.push(SOLUTION_OWNER_FIELD);
  return fields;
}

// ─── Get Single Issue ─────────────────────────────────────

export async function getIssue(key: string): Promise<JiraIssue> {
  return jiraFetch<JiraIssue>(`/issue/${key}?fields=${issueFields().join(",")}`);
}

// ─── Search by Text (JQL text search) ─────────────────────
// This is the main search the stakeholders use.
// JQL `text ~ "something"` searches summary + description + comments.

export async function searchByText(query: string, maxResults = 10): Promise<JiraIssue[]> {
  // Sanitize - only strip dangerous characters, keep # and -
  let sanitized = query.replace(/[\\"\[\]{}()]/g, "").trim();
  if (!sanitized) return [];

  const projectFilter = PROJECT_KEYS.length > 0
    ? `project in (${PROJECT_KEYS.join(",")}) AND `
    : "";

  // Build JQL
  let jql: string;

  // If the query looks like a Freshservice REQ number (e.g., "#REQ-11931267", "REQ-11931267", "11931267")
  if (/^#?REQ-?\d+$/i.test(sanitized)) {
    console.log("[jira] Detected Freshservice REQ number:", sanitized);

    // Normalize the REQ number to different formats for searching
    const numberOnly = sanitized.replace(/^#?REQ-?/i, "");
    const withHash = `#REQ-${numberOnly}`;
    const withoutHash = `REQ-${numberOnly}`;

    // Try 1: Search with #REQ-XXXXX (exact phrase match as it appears in titles)
    jql = `${projectFilter}text ~ "\\"${withHash}\\"" ORDER BY updated DESC`;
    console.log("[jira] Try 1 - Executing JQL:", jql);

    let data = await jiraFetch<{ issues: JiraIssue[]; total: number }>("/search/jql", {
      method: "POST",
      body: JSON.stringify({ jql, maxResults, fields: issueFields() }),
    });

    // Try 2: If nothing found, search with REQ-XXXXX (without #)
    if (!data.issues || data.issues.length === 0) {
      jql = `${projectFilter}text ~ "\\"${withoutHash}\\"" ORDER BY updated DESC`;
      console.log("[jira] Try 2 - Executing JQL:", jql);

      data = await jiraFetch<{ issues: JiraIssue[]; total: number }>("/search/jql", {
        method: "POST",
        body: JSON.stringify({ jql, maxResults, fields: issueFields() }),
      });
    }

    // Try 3: If still nothing, search with just the number
    if (!data.issues || data.issues.length === 0) {
      jql = `${projectFilter}text ~ "\\"${numberOnly}\\"" ORDER BY updated DESC`;
      console.log("[jira] Try 3 - Executing JQL:", jql);

      data = await jiraFetch<{ issues: JiraIssue[]; total: number }>("/search/jql", {
        method: "POST",
        body: JSON.stringify({ jql, maxResults, fields: issueFields() }),
      });
    }

    // Try 4: Last resort - try labels
    if (!data.issues || data.issues.length === 0) {
      jql = `${projectFilter}labels = "${withoutHash}" ORDER BY updated DESC`;
      console.log("[jira] Try 4 - Trying label search:", jql);

      data = await jiraFetch<{ issues: JiraIssue[]; total: number }>("/search/jql", {
        method: "POST",
        body: JSON.stringify({ jql, maxResults, fields: issueFields() }),
      });
    }

    return data.issues || [];
  }
  // If the query looks like a Jira key (e.g., "DPS-100999"), do an exact match
  else if (/^[A-Z]{2,4}-\d+$/i.test(sanitized)) {
    jql = `key = "${sanitized.toUpperCase()}"`;
  }
  // Otherwise, do a general text search
  else {
    jql = `${projectFilter}text ~ "${sanitized}" ORDER BY updated DESC`;
  }

  console.log("[jira] Executing JQL:", jql);

  const data = await jiraFetch<{ issues: JiraIssue[]; total: number }>("/search/jql", {
    method: "POST",
    body: JSON.stringify({ jql, maxResults, fields: issueFields() }),
  });

  return data.issues || [];
}

// ─── Search by Key ────────────────────────────────────────

export async function searchByKey(key: string): Promise<JiraIssue | null> {
  try {
    return await getIssue(key.toUpperCase());
  } catch {
    return null;
  }
}

// ─── Get Comments ─────────────────────────────────────────

export async function getComments(key: string, max = 10): Promise<JiraComment[]> {
  const data = await jiraFetch<{ comments: JiraComment[]; total: number }>(
    `/issue/${key}/comment?maxResults=${max}&orderBy=-created`
  );
  return data.comments || [];
}

// ─── ADF → Plain Text ─────────────────────────────────────

export function adfToText(adf: any): string {
  if (!adf) return "";
  if (typeof adf === "string") return adf;

  function extract(node: any): string {
    if (!node) return "";
    if (node.type === "text") return node.text || "";
    if (node.type === "mention") return `@${node.attrs?.text || "someone"}`;
    if (node.type === "hardBreak") return "\n";
    if (node.type === "emoji") return node.attrs?.shortName || "";
    if (Array.isArray(node.content)) return node.content.map(extract).join("");
    return "";
  }

  if (adf.type === "doc" && Array.isArray(adf.content)) {
    return adf.content
      .map((block: any) => {
        const text = extract(block);
        if (block.type === "paragraph" || block.type === "heading") return text + "\n";
        if (block.type === "bulletList" || block.type === "orderedList") {
          return (block.content || []).map((li: any) => `  • ${extract(li)}`).join("\n") + "\n";
        }
        return text;
      })
      .join("")
      .trim();
  }

  return extract(adf);
}

// ─── Transform Comments → NoteEntry ───────────────────────

export function toNotes(comments: JiraComment[]): NoteEntry[] {
  return comments.map((c) => ({
    id: c.id,
    author: {
      name: c.author.displayName,
      initials: c.author.displayName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2),
      avatarUrl: c.author.avatarUrls?.["32x32"],
    },
    body: adfToText(c.body),
    createdAt: c.created,
  }));
}

// ─── Product Owner from Issue ─────────────────────────────
// The Product Owner is the Product Manager (from custom field)

export function getProductOwner(issue: JiraIssue): { name: string; initials: string } | null {
  if (!PRODUCT_OWNER_FIELD) return null;

  const productOwner = issue.fields[PRODUCT_OWNER_FIELD];
  if (!productOwner) return null;

  // Product Owner field is a person field with displayName
  const name = productOwner.displayName || productOwner.name || String(productOwner);
  return {
    name,
    initials: name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2),
  };
}

// ─── Solution Owner from Issue ────────────────────────────
// The Solution Owner is the Tech Lead (from custom field)

export function getSolutionOwner(issue: JiraIssue): { name: string; initials: string } | null {
  if (!SOLUTION_OWNER_FIELD) return null;

  const solutionOwner = issue.fields[SOLUTION_OWNER_FIELD];
  if (!solutionOwner) return null;

  // Solution Owner field is a person field with displayName
  const name = solutionOwner.displayName || solutionOwner.name || String(solutionOwner);
  return {
    name,
    initials: name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2),
  };
}

// ─── Requester from Issue ─────────────────────────────────
// The requester is the stakeholder who submitted the original request.
// This is NOT the reporter (the reporter might be the PM who created the Jira ticket).
// The requester email should come from a custom field like JIRA_REQUESTER_EMAIL_FIELD.

export function getRequester(issue: JiraIssue): { name: string; email: string } | null {
  // Try custom requester email field first - this is the correct source for the actual requester
  const customEmail = REQUESTER_EMAIL_FIELD ? issue.fields[REQUESTER_EMAIL_FIELD] : null;
  const customName = REQUESTER_NAME_FIELD ? issue.fields[REQUESTER_NAME_FIELD] : null;

  if (customEmail) {
    return {
      email: String(customEmail).trim(),
      name: customName ? String(customName).trim() : customEmail.split("@")[0],
    };
  }

  // Try Product Owner as a fallback source for requester email
  if (PRODUCT_OWNER_FIELD) {
    const productOwner = issue.fields[PRODUCT_OWNER_FIELD];
    if (productOwner?.emailAddress) {
      return {
        email: productOwner.emailAddress,
        name: productOwner.displayName || productOwner.emailAddress.split("@")[0],
      };
    }
  }

  // Last resort: fall back to reporter
  // TODO: The reporter might be the PM, not the requester (stakeholder).
  // We should check for a "Requested For" or similar custom field.
  if (issue.fields.reporter) {
    return {
      name: issue.fields.reporter.displayName,
      email: issue.fields.reporter.emailAddress,
    };
  }

  return null;
}

// ─── Client from Issue ────────────────────────────────────

export function getClient(issue: JiraIssue): string | undefined {
  if (CLIENT_FIELD && issue.fields[CLIENT_FIELD]) {
    return String(issue.fields[CLIENT_FIELD]);
  }
  // Try labels (common pattern: label like "client:DISH")
  const clientLabel = issue.fields.labels?.find((l: string) => l.startsWith("client:"));
  return clientLabel ? clientLabel.replace("client:", "") : undefined;
}

// ─── Status Helpers ───────────────────────────────────────

export function humanizeStatus(status: string): string {
  return JIRA_STATUS_HUMAN[status] || status;
}

export function getStage(status: string): string {
  return JIRA_STATUS_TO_STAGE[status] || "under_review";
}

export function humanizeSprint(sprint: JiraIssue["fields"]["sprint"]): string | null {
  if (!sprint) return null;
  if (sprint.state === "active") {
    const end = sprint.endDate
      ? ` (ends ${new Date(sprint.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`
      : "";
    return `Current sprint: ${sprint.name}${end}`;
  }
  if (sprint.state === "future") return `Upcoming sprint: ${sprint.name}`;
  return `Completed in: ${sprint.name}`;
}

export function getJiraUrl(key: string): string {
  return DOMAIN ? `https://${DOMAIN}/browse/${key}` : "#";
}
