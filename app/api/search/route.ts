// app/api/search/route.ts
// Frontend calls this — searches Jira by ticket key or text in summary/description

import { NextRequest, NextResponse } from "next/server";
import { searchByText, searchByKey } from "@/lib/jira";
import { enrichIssue } from "@/lib/enrich";
import type { SearchResponse } from "@/types";

export const maxDuration = 15;

export async function GET(req: NextRequest) {
  let query = req.nextUrl.searchParams.get("q")?.trim();
  console.log("[search] 1) Incoming query:", query);

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [], total: 0, query: "" });
  }

  try {
    const PROJECT_KEYS = (process.env.JIRA_PROJECT_KEYS || "").split(",").map((k) => k.trim()).filter(Boolean);
    const defaultProjectKey = PROJECT_KEYS.length > 0 ? PROJECT_KEYS[0] : null;

    // Smart query detection
    let queryType: string;
    let searchStrategy: string;

    // Jira key pattern: 2-4 uppercase letters, dash, digits (e.g., DPS-12345)
    // This should NOT match REQ-11931267
    const isJiraKey = /^[A-Z]{2,4}-\d+$/i.test(query.replace(/^#/, ""));
    const isReqNumber = /^#?REQ-?\d+$/i.test(query);
    const isNumericOnly = /^\d+$/.test(query.replace(/^#/, ""));

    // Strategy 1: If query is purely digits, prepend default project key and try direct lookup
    if (isNumericOnly && defaultProjectKey) {
      queryType = "NUMERIC_JIRA_KEY";
      const jiraKey = `${defaultProjectKey}-${query}`;
      searchStrategy = `Numeric only → prepend project key → try direct lookup for ${jiraKey}`;
      console.log("[search] 2) Strategy:", searchStrategy);

      const issue = await searchByKey(jiraKey);
      if (issue) {
        console.log("[search] 3) ✓ Direct key lookup succeeded:", issue.key);
        const enriched = await enrichIssue(issue);
        return NextResponse.json({ results: [enriched], total: 1, query: jiraKey } as SearchResponse);
      } else {
        console.log("[search] 3) ✗ Direct key lookup failed, falling back to text search for:", query);
        // Fall through to text search - might be a REQ number
        queryType = "TEXT_SEARCH";
        searchStrategy = "Numeric only → key lookup failed → text search (might be REQ number)";
      }
    }
    // Strategy 2: If query matches Jira key pattern (letters-digits), direct lookup
    else if (isJiraKey) {
      queryType = "JIRA_KEY";
      // Strip # and uppercase for Jira key lookup
      query = query.replace(/^#/, "").toUpperCase();
      searchStrategy = `Jira key pattern detected → direct lookup for ${query}`;
      console.log("[search] 2) Strategy:", searchStrategy);

      const issue = await searchByKey(query);
      if (issue) {
        console.log("[search] 3) ✓ Direct key lookup succeeded:", issue.key);
        const enriched = await enrichIssue(issue);
        return NextResponse.json({ results: [enriched], total: 1, query } as SearchResponse);
      } else {
        console.log("[search] 3) ✗ No issue found for key:", query);
      }
    }
    // Strategy 3: If query contains REQ pattern, text search for REQ number
    else if (isReqNumber) {
      queryType = "REQ_NUMBER";
      searchStrategy = `REQ pattern detected → text search for Freshservice REQ number`;
      console.log("[search] 2) Strategy:", searchStrategy);
    }
    // Strategy 4: Otherwise, general text search by keywords
    else {
      queryType = "TEXT_SEARCH";
      // For general text search, strip # prefix
      query = query.replace(/^#/, "");
      searchStrategy = `General keywords → text search for "${query}"`;
      console.log("[search] 2) Strategy:", searchStrategy);
    }

    // Text search (handles REQ numbers and general text queries)
    console.log("[search] 3) Performing text search for:", query);
    const issues = await searchByText(query, 10);
    console.log("[search] 4) Text search returned", issues.length, "issues");

    const results = await Promise.all(
      issues.slice(0, 8).map(async (issue) => {
        try {
          return await enrichIssue(issue);
        } catch (err) {
          console.warn(`[search] Enrich failed for ${issue.key}:`, err);
          return {
            jiraKey: issue.key,
            summary: issue.fields.summary,
            description: "",
            status: issue.fields.status?.name || "Unknown",
            statusCategory: issue.fields.status?.statusCategory?.name || "",
            priority: issue.fields.priority?.name || "Normal",
            issueType: issue.fields.issuetype?.name || "Task",
            project: issue.fields.project?.name || "",
            createdAt: issue.fields.created,
            updatedAt: issue.fields.updated,
            requester: null,
            assignee: null,
            productManager: null,
            sprint: null,
            sprintEndDate: null,
            url: "#",
            tracker: [],
            recentNotes: [],
          };
        }
      })
    );

    return NextResponse.json({ results, total: issues.length, query } as SearchResponse);
  } catch (err: any) {
    console.error("[search] 5) Error occurred:", err);
    console.error("[search] Full error details:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
