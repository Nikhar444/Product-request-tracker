// app/api/subscribe/route.ts

import { NextRequest, NextResponse } from "next/server";
import { subscribe } from "@/lib/store";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  jiraKey: z.string().min(1),
  type: z.enum(["full_activity", "status_milestones"]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const sub = await subscribe(data.email, data.jiraKey, data.type);
    return NextResponse.json({ ok: true, subscription: sub });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
