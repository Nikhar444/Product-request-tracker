// app/api/search/route.ts
// Search Freshservice tickets and enrich with Jira data
// Called by the frontend search UI

import { NextRequest, NextResponse } from "next/server";
import { searchTickets, getTicketByDisplayId } from "@/lib/freshservice";
import { enrichRequest } from "@/lib/enrich";
import type { SearchResponse } from "@/types";

export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [], total: 0, query: "" });
  }

  const q = query.trim();

  try {
    // If it looks like a specific ticket ID, try direct lookup first
    const isTicketId = /^(REQ-?|SR-?|INC-?|#)?\d{4,}$/i.test(q);

    if (isTicketId) {
      const ticket = await getTicketByDisplayId(q);
      if (ticket) {
        const enriched = await enrichRequest(ticket);
        const response: SearchResponse = {
          results: [enriched],
          total: 1,
          query: q,
        };
        return NextResponse.json(response);
      }
    }

    // Keyword search across tickets
    const tickets = await searchTickets(q);

    // Enrich top results (limit to avoid timeout)
    const enrichedResults = await Promise.all(
      tickets.slice(0, 8).map(async (ticket) => {
        try {
          return await enrichRequest(ticket);
        } catch (err) {
          console.warn(`[search] Failed to enrich ticket #${ticket.id}:`, err);
          // Return a minimal result if enrichment fails
          return {
            id: ticket.id,
            subject: ticket.subject,
            description: ticket.description_text || "",
            status: "Open",
            statusRaw: ticket.status,
            priority: "Normal",
            type: ticket.type || "Service Request",
            createdAt: ticket.created_at,
            updatedAt: ticket.updated_at,
            requester: { name: "Unknown", email: "" },
            productManager: null,
            jira: null,
            tracker: [],
            recentNotes: [],
          };
        }
      })
    );

    const response: SearchResponse = {
      results: enrichedResults,
      total: tickets.length,
      query: q,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("[search] Error:", err);
    return NextResponse.json(
      { error: "Search failed", message: err.message },
      { status: 500 }
    );
  }
}
