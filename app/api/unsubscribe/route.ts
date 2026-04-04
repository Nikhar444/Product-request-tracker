// app/api/unsubscribe/route.ts
// Handles unsubscribe links from notification emails

import { NextRequest, NextResponse } from "next/server";
import { unsubscribe } from "@/lib/store";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const email = req.nextUrl.searchParams.get("email");

  if (!id || !email) {
    return new NextResponse(
      unsubscribePage("Missing parameters", false),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const requestId = parseInt(id);
  if (isNaN(requestId)) {
    return new NextResponse(
      unsubscribePage("Invalid request ID", false),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  try {
    const result = await unsubscribe(requestId, decodeURIComponent(email));

    return new NextResponse(
      unsubscribePage(
        result
          ? "You've been unsubscribed from updates for this request."
          : "No active subscription found for this email.",
        result
      ),
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    return new NextResponse(
      unsubscribePage("Something went wrong. Please try again.", false),
      { headers: { "Content-Type": "text/html" } }
    );
  }
}

function unsubscribePage(message: string, success: boolean): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribe</title>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafaf8; }
    .card { text-align: center; max-width: 400px; padding: 48px 32px; background: white; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { font-size: 20px; margin: 0 0 8px; color: #1a1a18; }
    p { font-size: 14px; color: #6b6a65; line-height: 1.5; margin: 0 0 24px; }
    a { display: inline-block; padding: 10px 24px; background: #5B2D8E; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "✓" : "⚠"}</div>
    <h1>${success ? "Unsubscribed" : "Oops"}</h1>
    <p>${message}</p>
    <a href="${appUrl}/intake-status">Back to portal</a>
  </div>
</body>
</html>`;
}
