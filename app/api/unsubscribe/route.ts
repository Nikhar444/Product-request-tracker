// app/api/unsubscribe/route.ts

import { NextRequest, NextResponse } from "next/server";
import { unsubscribe } from "@/lib/store";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const email = req.nextUrl.searchParams.get("email");

  if (!key || !email) {
    return NextResponse.json({ error: "Missing key or email" }, { status: 400 });
  }

  const success = await unsubscribe(key, email);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  // Redirect to a confirmation page (or just show a message)
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
    <body style="font-family:-apple-system,sans-serif;max-width:500px;margin:60px auto;text-align:center;color:#1a1a18;">
      <h2 style="color:#5B2D8E;">${success ? "Unsubscribed" : "Not found"}</h2>
      <p style="color:#6b6a65;">${success
        ? `You've been unsubscribed from updates on ${key}. You won't receive further emails for this request.`
        : "We couldn't find that subscription. You may have already unsubscribed."
      }</p>
      <a href="${appUrl}/intake-status" style="color:#5B2D8E;">Back to tracker</a>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
