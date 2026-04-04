// lib/webhook-auth.ts
import { NextRequest } from "next/server";

export function verifyWebhook(req: NextRequest): { valid: boolean; error?: string } {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return { valid: true }; // No secret = accept all (dev mode)

  const secret =
    req.headers.get("x-webhook-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    req.nextUrl.searchParams.get("secret");

  return secret === expected ? { valid: true } : { valid: false, error: "Unauthorized" };
}
