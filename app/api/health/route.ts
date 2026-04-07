// app/api/health/route.ts
// Health check endpoint to test Jira API connection

import { NextResponse } from "next/server";

const DOMAIN = process.env.JIRA_DOMAIN;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_TOKEN;

export async function GET() {
  console.log("[health] Testing Jira connection...");
  console.log("[health] JIRA_DOMAIN:", DOMAIN);
  console.log("[health] JIRA_EMAIL:", EMAIL);
  console.log("[health] JIRA_API_TOKEN:", TOKEN ? "***" + TOKEN.slice(-4) : "NOT SET");

  if (!DOMAIN || !EMAIL || !TOKEN) {
    return NextResponse.json({
      status: "error",
      message: "Missing Jira configuration",
      config: {
        domain: !!DOMAIN,
        email: !!EMAIL,
        token: !!TOKEN,
      },
    }, { status: 500 });
  }

  try {
    const url = `https://${DOMAIN}/rest/api/3/myself`;
    console.log("[health] Testing URL:", url);

    const auth = Buffer.from(`${EMAIL}:${TOKEN}`).toString("base64");
    console.log("[health] Auth header:", "Basic " + auth.substring(0, 20) + "...");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    console.log("[health] Response status:", response.status, response.statusText);

    if (!response.ok) {
      const body = await response.text();
      console.error("[health] Error response body:", body);
      return NextResponse.json({
        status: "error",
        message: `Jira API returned ${response.status}: ${response.statusText}`,
        details: body,
      }, { status: response.status });
    }

    const data = await response.json();
    console.log("[health] Success! User data:", data);

    return NextResponse.json({
      status: "success",
      message: "Jira connection successful",
      user: {
        accountId: data.accountId,
        displayName: data.displayName,
        emailAddress: data.emailAddress,
        active: data.active,
      },
      config: {
        domain: DOMAIN,
        email: EMAIL,
      },
    });
  } catch (err: any) {
    console.error("[health] Exception:", err);
    return NextResponse.json({
      status: "error",
      message: "Failed to connect to Jira",
      error: err.message,
      stack: err.stack,
    }, { status: 500 });
  }
}
