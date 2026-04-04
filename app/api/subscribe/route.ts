// app/api/subscribe/route.ts
// Handles email subscription for request updates

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSubscription, getSubscription, unsubscribe } from "@/lib/store";

const subscribeSchema = z.object({
  email: z.string().email("Invalid email address"),
  requestId: z.number().int().positive(),
  jiraKey: z.string().optional(),
  type: z.enum(["full_activity", "status_milestones"]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = subscribeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, requestId, jiraKey, type } = parsed.data;

    // Check if already subscribed
    const existing = await getSubscription(requestId, email);
    if (existing && existing.active) {
      return NextResponse.json({
        ok: true,
        message: "Already subscribed",
        subscription: existing,
      });
    }

    // Create subscription
    const sub = await createSubscription(email, requestId, type, jiraKey);

    console.log(
      `[subscribe] ${email} subscribed to #${requestId} (${type})`
    );

    return NextResponse.json({
      ok: true,
      message: "Subscribed successfully",
      subscription: sub,
    });
  } catch (err: any) {
    console.error("[subscribe] Error:", err);
    return NextResponse.json(
      { error: "Subscription failed", message: err.message },
      { status: 500 }
    );
  }
}

// ─── Unsubscribe via GET (for email links) ────────────────

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const email = req.nextUrl.searchParams.get("email");

  if (!id || !email) {
    return NextResponse.json(
      { error: "Missing id or email parameter" },
      { status: 400 }
    );
  }

  const requestId = parseInt(id);
  if (isNaN(requestId)) {
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
  }

  const result = await unsubscribe(requestId, email);

  if (result) {
    // Redirect to a confirmation page or return success
    return NextResponse.json({
      ok: true,
      message: "Unsubscribed successfully",
    });
  }

  return NextResponse.json(
    { error: "Subscription not found" },
    { status: 404 }
  );
}
