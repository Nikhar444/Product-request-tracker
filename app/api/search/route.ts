// app/api/search/route.ts
// Frontend calls this — searches Jira by ticket key or text in summary/description

import { NextRequest, NextResponse } from "next/server";
import { searchByText, searchByKey } from "@/lib/jira";
import { enrichIssue } from "@/lib/enrich";
import type { SearchResponse } from "@/types";

export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [], total: 0, query: "" });
  }

  try {
    // If it looks like a Jira key (e.g., DPS-100999), try exact lookup first
    const isKey = /^[A-Z]+-\d+$/i.test(query);

    if (isKey) {
      const issue = await searchByKey(query);
      if (issue) {
        const enriched = await enrichIssue(issue);
        return NextResponse.json({ results: [enriched], total: 1, query } as SearchResponse);
      }
    }

    // Text search
    const issues = await searchByText(query, 10);

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
    console.error("[search]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
