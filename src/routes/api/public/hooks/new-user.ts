import { createFileRoute } from "@tanstack/react-router";

/**
 * Tells the owner that somebody registered.
 *
 * Called by the database, once per account, from the trigger on auth.users -
 * see the migration that creates `signup_notifications`. The browser never
 * calls this: a notification that depends on a form finishing in a tab is one
 * that goes missing exactly when an account is created another way.
 *
 * Nothing in the request is believed except the id. Everything the email says
 * is read back from the database with the service role, and a notification is
 * only ever sent for a row that is already recorded there and not yet sent. So
 * the worst anybody can do by calling this themselves is make the owner be told
 * once, about a registration that really happened, which is what the owner
 * asked for in the first place.
 */

/** Where the notification goes. The owner's address, not a brand's: this is
 * about the product having a new customer, not about the customer's posts. */
const NOTIFY = "admin@krijo24.com";

export const Route = createFileRoute("/api/public/hooks/new-user")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await handle(request);
        } catch (err) {
          // Said out loud rather than swallowed into a blank 500.
          //
          // Only a caller holding the shared secret ever gets this far, and the
          // only thing on the other end is the database, so the text is of use
          // to whoever is fixing it and to nobody else. A hook that fails
          // silently is a hook that is diagnosed by guesswork, which is what
          // two wrong fixes before this one were.
          console.error("Signup notification handler threw:", err);
          return Response.json({ sent: false, error: String(err).slice(0, 300) }, { status: 500 });
        }
      },
    },
  },
});

async function handle(request: Request): Promise<Response> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendEmail, detailsTable } = await import("@/lib/email.server");

  // A secret the database made and the site reads back, rather than a key
  // somebody had to put in the right place twice.
  //
  // This was the project's own api key first, and it failed in the dullest
  // possible way: a project has two keys that both identify it, this deployment
  // holds both, and the one a database trigger can safely carry is not the one
  // that happened to be compared against. The first real registration came back
  // 401 - the row was written, the request was posted, and the endpoint turned
  // it away. Guessing which variable holds which key is not authentication.
  //
  // Both ends now read the same row of app_secrets, which only the service role
  // can see. Nothing to configure, nothing to paste, and nothing in the
  // repository.
  const { data: secretRow } = await supabaseAdmin
    .from("app_secrets")
    .select("value")
    .eq("name", "signup_hook")
    .maybeSingle();
  const expected = (secretRow as { value: string } | null)?.value;
  const presented = request.headers.get("x-signup-secret");
  if (!expected || !presented || presented !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  let userId = "";
  try {
    const body = (await request.json()) as { user_id?: unknown };
    userId = typeof body.user_id === "string" ? body.user_id : "";
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!userId) return new Response("Bad request", { status: 400 });

  // Read, do not trust. The row has to exist, which means the database wrote it
  // when the account was made, and it has to be unsent.
  const { data: row } = await supabaseAdmin
    .from("signup_notifications")
    .select("user_id, email, display_name, created_at, notified_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row) return Response.json({ sent: false, reason: "unknown" });
  if ((row as { notified_at: string | null }).notified_at) {
    return Response.json({ sent: false, reason: "already" });
  }

  const signup = row as {
    email: string | null;
    display_name: string | null;
    created_at: string;
  };

  const who = signup.display_name || signup.email || "unknown";
  const result = await sendEmail({
    to: NOTIFY,
    subject: `New account: ${who}`,
    html: detailsTable("New krijo24 account", [
      ["Name", signup.display_name || "-"],
      ["Email", signup.email || "-"],
      ["Registered", signup.created_at],
      ["Account id", userId],
    ]),
    replyTo: signup.email ?? undefined,
  });

  if (!result.sent) {
    // Written down rather than swallowed, and notified_at left null, so the
    // registration is still there to be sent on once whatever went wrong is
    // fixed.
    await supabaseAdmin
      .from("signup_notifications")
      .update({ error: result.detail.slice(0, 200) })
      .eq("user_id", userId);
    return Response.json({ sent: false, reason: result.reason });
  }

  await supabaseAdmin
    .from("signup_notifications")
    .update({ notified_at: new Date().toISOString(), error: null })
    .eq("user_id", userId);
  return Response.json({ sent: true });
}
