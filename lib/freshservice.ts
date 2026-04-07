// lib/freshservice.ts
// Freshservice API v2 client — read-only access to tickets, requesters, agents

import type {
  FreshserviceTicket,
  FreshserviceRequester,
  FreshserviceAgent,
} from "@/types";

// ─── Configuration ────────────────────────────────────────

const DOMAIN = process.env.FRESHSERVICE_DOMAIN;
const API_KEY = process.env.FRESHSERVICE_API_KEY;
const JIRA_FIELD = process.env.FRESHSERVICE_JIRA_FIELD || "cf_jira_ticket";

function getBaseUrl(): string {
  if (!DOMAIN) throw new Error("FRESHSERVICE_DOMAIN is not configured");
  return `https://${DOMAIN}/api/v2`;
}

function getHeaders(): Record<string, string> {
  if (!API_KEY) throw new Error("FRESHSERVICE_API_KEY is not configured");
  return {
    Authorization: `Basic ${Buffer.from(`${API_KEY}:X`).toString("base64")}`,
    "Content-Type": "application/json",
  };
}

// ─── HTTP Helper with retry logic ─────────────────────────

async function freshserviceFetch<T>(
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

      // Rate limited — wait and retry
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("retry-after") || "5");
        console.warn(
          `[freshservice] Rate limited. Retrying in ${retryAfter}s (attempt ${attempt + 1}/3)`
        );
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `Freshservice API ${res.status}: ${res.statusText} — ${body}`
        );
      }

      return res.json();
    } catch (err: any) {
      lastError = err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("Freshservice API request failed after retries");
}

// ─── Ticket Operations ────────────────────────────────────

export async function getTicket(
  ticketId: number
): Promise<FreshserviceTicket> {
  const data = await freshserviceFetch<{ ticket: FreshserviceTicket }>(
    `/tickets/${ticketId}`
  );
  return data.ticket;
}

export async function getTicketByDisplayId(
  displayId: string
): Promise<FreshserviceTicket | null> {
  // Freshservice display IDs might have prefixes like "REQ-" or "SR-"
  // Strip the prefix to get the numeric ID
  const numericId = displayId.replace(/^(REQ-|SR-|INC-|#)/i, "");

  // First try as a direct ticket ID
  if (/^\d+$/.test(numericId)) {
    try {
      return await getTicket(parseInt(numericId));
    } catch {
      // Not found by ID, try search
    }
  }

  // Fall back to search
  const results = await searchTickets(displayId);
  return results[0] || null;
}

// ─── Search ───────────────────────────────────────────────

export async function searchTickets(
  query: string
): Promise<FreshserviceTicket[]> {
  // Sanitize the query for Freshservice's filter API
  const sanitized = query.replace(/['"]/g, "").trim();

  if (!sanitized) return [];

  try {
    // Try the filter API first (supports query syntax)
    const filterQuery = encodeURIComponent(
      `"subject:'${sanitized}' OR description:'${sanitized}'"`
    );
    const data = await freshserviceFetch<{ tickets: FreshserviceTicket[] }>(
      `/tickets/filter?query=${filterQuery}`
    );
    return data.tickets || [];
  } catch {
    // Filter API can be finicky — fall back to listing recent tickets
    // and filtering client-side
    console.warn(
      "[freshservice] Filter API failed, falling back to list + filter"
    );
    return searchTicketsFallback(sanitized);
  }
}

async function searchTicketsFallback(
  query: string
): Promise<FreshserviceTicket[]> {
  const q = query.toLowerCase();
  const data = await freshserviceFetch<{ tickets: FreshserviceTicket[] }>(
    "/tickets?per_page=100&order_by=updated_at&order_type=desc"
  );

  const tickets = data.tickets || [];
  return tickets.filter(
    (t) =>
      t.subject?.toLowerCase().includes(q) ||
      t.description_text?.toLowerCase().includes(q) ||
      String(t.id).includes(q)
  );
}

export async function listRecentRequests(
  page = 1,
  perPage = 30
): Promise<FreshserviceTicket[]> {
  const data = await freshserviceFetch<{ tickets: FreshserviceTicket[] }>(
    `/tickets?per_page=${perPage}&page=${page}&order_by=updated_at&order_type=desc`
  );
  return data.tickets || [];
}

// ─── Requester & Agent Operations ─────────────────────────

export async function getRequester(
  requesterId: number
): Promise<FreshserviceRequester> {
  const data = await freshserviceFetch<{ requester: FreshserviceRequester }>(
    `/requesters/${requesterId}`
  );
  return data.requester;
}

export async function getAgent(agentId: number): Promise<FreshserviceAgent> {
  const data = await freshserviceFetch<{ agent: FreshserviceAgent }>(
    `/agents/${agentId}`
  );
  return data.agent;
}

// ─── Custom Field Helpers ─────────────────────────────────

export function getJiraKeyFromTicket(
  ticket: FreshserviceTicket
): string | null {
  const value = ticket.custom_fields?.[JIRA_FIELD];
  if (!value || typeof value !== "string") return null;

  // Clean up — might have whitespace or URL format
  const cleaned = value.trim();

  // If it's a full Jira URL, extract just the key
  const urlMatch = cleaned.match(/\/browse\/([A-Z]+-\d+)/);
  if (urlMatch) return urlMatch[1];

  // If it looks like a Jira key (PROJECT-123), return it
  if (/^[A-Z]+-\d+$/.test(cleaned)) return cleaned;

  return cleaned;
}

export async function updateTicketCustomField(
  ticketId: number,
  fieldName: string,
  value: string
): Promise<void> {
  await freshserviceFetch(`/tickets/${ticketId}`, {
    method: "PUT",
    body: JSON.stringify({
      custom_fields: { [fieldName]: value },
    }),
  });
}

// ─── Get Requester Email from Ticket ─────────────────────

export async function getRequesterEmail(ticket: FreshserviceTicket): Promise<string | null> {
  try {
    if (!ticket.requester_id) {
      console.warn("[freshservice] No requester_id on ticket", ticket.id);
      return null;
    }
    const requester = await getRequester(ticket.requester_id);
    return requester.primary_email || null;
  } catch (err) {
    console.error(`[freshservice] Failed to get requester email for ticket ${ticket.id}:`, err);
    return null;
  }
}

// ─── Get Requester Name from Ticket ───────────────────────

export async function getRequesterName(ticket: FreshserviceTicket): Promise<string | null> {
  try {
    if (!ticket.requester_id) return null;
    const requester = await getRequester(ticket.requester_id);
    return `${requester.first_name} ${requester.last_name}`.trim();
  } catch (err) {
    console.error(`[freshservice] Failed to get requester name for ticket ${ticket.id}:`, err);
    return null;
  }
}

// ─── Get Service Request (Catalog Item) ──────────────────

export async function getServiceRequest(ticketId: number): Promise<any> {
  const data = await freshserviceFetch<any>(`/tickets/${ticketId}/requested_items`);
  return data;
}

// ─── Get Product Owner from Ticket ───────────────────────

export function getProductOwner(ticket: FreshserviceTicket): string | null {
  // Product Owner is a custom field
  if (ticket.custom_fields && typeof ticket.custom_fields === "object") {
    const productOwner = (ticket.custom_fields as any).product_owner;
    if (productOwner) {
      return String(productOwner).trim();
    }
  }
  return null;
}

// ─── Get Region from Ticket ───────────────────────────────

export function getRegion(ticket: FreshserviceTicket): string | null {
  if (ticket.custom_fields && typeof ticket.custom_fields === "object") {
    const region = (ticket.custom_fields as any).region;
    if (region) {
      return String(region).trim();
    }
  }
  return null;
}

// ─── Get Client Name from Ticket ──────────────────────────

export function getClientName(ticket: FreshserviceTicket): string | null {
  if (ticket.custom_fields && typeof ticket.custom_fields === "object") {
    const clientName = (ticket.custom_fields as any).client_name;
    if (clientName) {
      return String(clientName).trim();
    }
  }
  return null;
}

// ─── Utility ──────────────────────────────────────────────

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
}
