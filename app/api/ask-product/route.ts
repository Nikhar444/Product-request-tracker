// app/api/ask-product/route.ts

import { NextRequest, NextResponse } from "next/server";
import { notifyProductTeam } from "@/lib/email";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  requestNumber: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    await notifyProductTeam(
      `[Request Tracker] Stakeholder can't find: ${data.requestNumber}`,
      `<h3>Request lookup failed</h3>
       <p>A stakeholder searched for <strong>${data.requestNumber}</strong> but it wasn't found in the tracker.</p>
       <p>Their email: <a href="mailto:${data.email}">${data.email}</a></p>
       <p>Please check if this request exists and ensure it's properly linked in Jira.</p>`
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
