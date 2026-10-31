import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Where a demo request lands. This used to be the address of the agency that
 * first built the app, so every lead krijo24 collected was being mailed to
 * somebody else's inbox. */
const CONTACT_TO = "admin@krijo24.com";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  business: z.string().trim().max(120).default(""),
  message: z.string().trim().max(2000).default(""),
});

/**
 * Saves the demo request (source of truth) and only then tries to email it.
 * The two outcomes are reported separately so the UI never claims a delivered
 * email when delivery failed — the stored row keeps the lead safe either way.
 */
export const submitContactRequestFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const { sendEmail, detailsTable } = await import("@/lib/email.server");
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

    const result = await sendEmail({
      to: CONTACT_TO,
      subject: `Demo request: ${data.name}${data.business ? ` (${data.business})` : ""}`,
      replyTo: data.email,
      html: detailsTable(
        "New krijo24 demo request",
        [
          ["Name", data.name],
          ["Email", data.email],
          ["Business", data.business || "-"],
          ["Request type", "Demo request (krijo24.com/contact)"],
          ["Received", createdAt],
        ],
        data.message || "-",
      ),
    });

    return { saved: true as const, emailed: result.sent };
  });
