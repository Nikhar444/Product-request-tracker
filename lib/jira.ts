// lib/jira.ts
// Jira Cloud REST API v3 client — read-only access to issues, comments, sprints

import type { JiraIssue, JiraComment, NoteEntry } from "@/types";
import { JIRA_STATUS_HUMAN, JIRA_STATUS_TO_STAGE } from "@/config/constants";

// ─── Configuration ────────────────────────────────────────

const DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_TOKEN;
const FS_FIELD = process.env.JIRA_FRESHSERVICE_FIELD || "customfield_10050";

function getBaseUrl(): string {
  if (!DOMAIN) throw new Error("JIRA_DOMAIN is not configured");
  return `https://${DOMAIN}/rest/api/3`;
}

function getHeaders(): Record<string, string> {
  if (!EMAIL || !TOKEN)
    throw new Error("JIRA_EMAIL and JIRA_API_TOKEN must be configured");
  return {
    Authorization: `Basic ${Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64")}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// ─── HTTP Helper ──────────────────────────────────────────

async function jiraFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const headers = getHeaders();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers },
      });

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("retry-after") || "5");
        console.warn(
          `[jira] Rate limited. Retrying in ${retryAfter}s (attempt ${attempt + 1}/3)`
        );
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Jira API ${res.status}: ${res.statusText} — ${body}`);
      }

      return res.json();
    } catch (err: any) {
      lastError = err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("Jira API request failed after retries");
}

// ─── Issue Operations ─────────────────────────────────────

export async function getIssue(issueKey: string): Promise<JiraIssue> {
  // Request the fields we need, including our custom FS link field
  const fields = [
    "summary",
    "description",
    "status",
    "assignee",
    "reporter",
    "priority",
    "issuetype",
    "project",
    "sprint",
    "comment",
    "updated",
    "created",
    "resolutiondate",
    FS_FIELD,
  ].join(",");

  return jiraFetch<JiraIssue>(`/issue/${issueKey}?fields=${fields}`);
}

export async function getIssueComments(
  issueKey: string,
  maxResults = 10
): Promise<JiraComment[]> {
  const data = await jiraFetch<{ comments: JiraComment[]; total: number }>(
    `/issue/${issueKey}/comment?maxResults=${maxResults}&orderBy=-created`
  );
  return data.comments || [];
}

// ─── Search ───────────────────────────────────────────────

export async function searchIssues(jql: string): Promise<JiraIssue[]> {
  const data = await jiraFetch<{ issues: JiraIssue[]; total: number }>(
    "/search",
    {
      method: "POST",
      body: JSON.stringify({
        jql,
        maxResults: 20,
        fields: [
          "summary",
          "status",
          "assignee",
          "priority",
          "issuetype",
          "project",
          "sprint",
          "updated",
          "created",
          "resolutiondate",
          FS_FIELD,
        ],
      }),
    }
  );
  return data.issues || [];
}

// ─── Custom Field: Freshservice ID ────────────────────────

export function getFreshserviceIdFromIssue(issue: JiraIssue): string | null {
  const value = issue.fields?.[FS_FIELD];
  if (!value) return null;

  // Handle both string and number types
  const str = String(value).trim();
  const numericMatch = str.match(/(\d+)/);
  return numericMatch ? numericMatch[1] : null;
}

// ─── ADF (Atlassian Document Format) → Plain Text ─────────

export function adfToPlainText(adf: any): string {
  if (!adf) return "";
  if (typeof adf === "string") return adf;

  function extractText(node: any): string {
    if (!node) return "";

    // Text node
    if (node.type === "text") {
      return node.text || "";
    }

    // Node with content array
    if (Array.isArray(node.content)) {
      return node.content.map(extractText).join("");
    }

    // Mention
    if (node.type === "mention") {
      return `@${node.attrs?.text || "someone"}`;
    }

    // Hard break
    if (node.type === "hardBreak") {
      return "\n";
    }

    return "";
  }

  if (adf.type === "doc" && Array.isArray(adf.content)) {
    return adf.content
      .map((block: any) => {
        const text = extractText(block);
        // Add paragraph breaks
        if (block.type === "paragraph") return text + "\n";
        if (block.type === "heading") return text + "\n";
        if (block.type === "bulletList" || block.type === "orderedList") {
          return (
            (block.content || [])
              .map((item: any) => `  • ${extractText(item)}`)
              .join("\n") + "\n"
          );
        }
        return text;
      })
      .join("")
      .trim();
  }

  return extractText(adf);
}

// ─── Transform Jira Comments → App NoteEntry format ───────

export function transformComments(comments: JiraComment[]): NoteEntry[] {
  return comments.map((c) => ({
    id: c.id,
    author: {
      name: c.author.displayName,
      initials: c.author.displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2),
      avatarUrl: c.author.avatarUrls?.["32x32"],
    },
    body: adfToPlainText(c.body),
    createdAt: c.created,
  }));
}

// ─── Status Helpers ───────────────────────────────────────

export function humanizeStatus(status: string): string {
  return JIRA_STATUS_HUMAN[status] || status;
}

export function getStageFromStatus(status: string): string {
  return JIRA_STATUS_TO_STAGE[status] || "under_review";
}

export function humanizeSprint(
  sprint: JiraIssue["fields"]["sprint"]
): string | null {
  if (!sprint) return null;

  if (sprint.state === "active") {
    const end = sprint.endDate
      ? ` (ends ${new Date(sprint.endDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })})`
      : "";
    return `In current sprint: ${sprint.name}${end}`;
  }

  if (sprint.state === "future") {
    return `Scheduled for upcoming sprint: ${sprint.name}`;
  }

  return `Completed in sprint: ${sprint.name}`;
}

// ─── Build Jira Browse URL ────────────────────────────────

export function getJiraUrl(issueKey: string): string {
  if (!DOMAIN) return "#";
  return `https://${DOMAIN}/browse/${issueKey}`;
}
