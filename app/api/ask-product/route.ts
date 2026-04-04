// app/api/ask-product/route.ts
// Handles "Ask product to review" form when a request isn't found

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { notifyProductTeam } from "@/lib/email";

const askProductSchema = z.object({
  email: z.string().email("Invalid email address"),
  requestNumber: z.string().min(1, "Request number is required"),
  message: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = askProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, requestNumber, message } = parsed.data;

    // Send internal email to product team
    await notifyProductTeam(
      `Request lookup: ${requestNumber} — from ${email}`,
      `
        <h2 style="margin:0 0 16px; font-size:18px; color:#1a1a18;">Request Lookup</h2>
        <p style="margin:0 0 8px; font-size:14px; color:#6b6a65;">
          A stakeholder searched for a request that wasn't found in the portal.
        </p>
        <table style="width:100%; border-collapse:collapse; margin:16px 0;">
          <tr>
            <td style="padding:8px 12px; font-size:13px; font-weight:600; color:#9CA3AF; border-bottom:1px solid #eeede8; width:140px;">Request Number</td>
            <td style="padding:8px 12px; font-size:14px; color:#1a1a18; border-bottom:1px solid #eeede8;">${requestNumber}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px; font-size:13px; font-weight:600; color:#9CA3AF; border-bottom:1px solid #eeede8;">Requester Email</td>
            <td style="padding:8px 12px; font-size:14px; color:#1a1a18; border-bottom:1px solid #eeede8;">
              <a href="mailto:${email}" style="color:#5B2D8E;">${email}</a>
            </td>
          </tr>
          ${
            message
              ? `<tr>
            <td style="padding:8px 12px; font-size:13px; font-weight:600; color:#9CA3AF;">Message</td>
            <td style="padding:8px 12px; font-size:14px; color:#1a1a18;">${message}</td>
          </tr>`
              : ""
          }
        </table>
        <p style="margin:16px 0 0; font-size:13px; color:#9CA3AF;">
          Please verify if this request exists in Freshservice and ensure the Jira mapping field is populated if applicable.
        </p>
      `
    );

    console.log(
      `[ask-product] Escalated lookup for ${requestNumber} from ${email}`
    );

    return NextResponse.json({
      ok: true,
      message: "Your request has been sent to the product team.",
    });
  } catch (err: any) {
    console.error("[ask-product] Error:", err);
    return NextResponse.json(
      { error: "Failed to send", message: err.message },
      { status: 500 }
    );
  }
}
