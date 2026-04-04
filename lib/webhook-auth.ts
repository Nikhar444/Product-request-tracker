// lib/webhook-auth.ts
// Webhook authentication and verification

import { NextRequest } from "next/server";

/**
 * Verify that a webhook request is authentic.
 * Checks for the secret in headers or query params.
 */
export function verifyWebhook(req: NextRequest): {
  valid: boolean;
  error?: string;
} {
  const expectedSecret = process.env.WEBHOOK_SECRET;

  if (!expectedSecret) {
    console.warn("[webhook] WEBHOOK_SECRET not set — accepting all webhooks");
    return { valid: true };
  }

  // Check header first (preferred)
  const headerSecret =
    req.headers.get("x-webhook-secret") ||
    req.headers.get("x-hook-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");

  if (headerSecret === expectedSecret) {
    return { valid: true };
  }

  // Check query param (Freshservice often uses this)
  const paramSecret = req.nextUrl.searchParams.get("secret");
  if (paramSecret === expectedSecret) {
    return { valid: true };
  }

  return { valid: false, error: "Invalid webhook secret" };
}

/**
 * Safely parse JSON body from a webhook request.
 * Returns null if parsing fails.
 */
export async function parseWebhookBody<T>(
  req: NextRequest
): Promise<T | null> {
  try {
    const body = await req.json();
    return body as T;
  } catch (err) {
    console.error("[webhook] Failed to parse request body:", err);
    return null;
  }
}
