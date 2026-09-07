import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CONTACT_TO = "contact@webdoagency.com";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  business: z.string().trim().max(120).default(""),
  message: z.string().trim().max(2000).default(""),
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Saves the demo request (source of truth) and only then tries to email it.
 * The two outcomes are reported separately so the UI never claims a delivered
 * email when delivery failed — the stored row keeps the lead safe either way.
 */
export const submitContactRequestFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const createdAt = new Date().toISOString();
    const { error } = await supabase.from("contact_requests").insert({
      name: data.name,
      email: data.email,
      business: data.business,
      message: data.message,
    });
    if (error) {
      console.error("contact_requests insert failed:", error.message);
      return { saved: false as const, emailed: false as const };
    }

    const lovableKey = process.env["LOVABLE_API_KEY"];
    const resendKey = process.env["RESEND_API_KEY"];
    if (!lovableKey || !resendKey) {
      console.error("Contact email skipped: email provider is not configured");
      return { saved: true as const, emailed: false as const };
    }

    const rows: [string, string][] = [
      ["Name", data.name],
      ["Email", data.email],
      ["Business", data.business || "-"],
      ["Request type", "Demo request (krijo24.com/contact)"],
      ["Received", createdAt],
    ];

    const html = `<div style="font-family:Arial,sans-serif;color:#111">
<h2 style="margin:0 0 16px">New krijo24 demo request</h2>
<table style="border-collapse:collapse">${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#666">${escapeHtml(k)}</td><td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`,
      )
      .join("")}</table>
<p style="margin:20px 0 6px;color:#666">Message</p>
<p style="margin:0;white-space:pre-wrap">${escapeHtml(data.message || "-")}</p>
</div>`;

    try {
      const response = await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": resendKey,
        },
        body: JSON.stringify({
          from: "krijo24 <notifications@krijo24.com>",
          to: [CONTACT_TO],
          reply_to: data.email,
          subject: `Demo request: ${data.name}${data.business ? ` (${data.business})` : ""}`,
          html,
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        console.error(`Resend request failed [${response.status}]: ${body}`);
        return { saved: true as const, emailed: false as const };
      }
      return { saved: true as const, emailed: true as const };
    } catch (err) {
      console.error("Resend request threw:", err);
      return { saved: true as const, emailed: false as const };
    }
  });
