/**
 * The one way this app sends mail.
 *
 * There were two copies of this before - the contact form had one and the
 * signup notification had the other - and both went through Lovable's connector
 * gateway, which needs two keys to be present and correct: Lovable's own, and
 * Resend's. Neither was set in production, so for weeks every email the product
 * believed it had sent had gone nowhere, and the two call sites each reported it
 * differently.
 *
 * Resend's own API needs one key and no intermediary, so that is what this
 * tries first. The gateway stays as a fallback for a deployment that holds the
 * Lovable pair and not a plain Resend key, because removing it would break such
 * a deployment for no gain.
 */

const RESEND_URL = "https://api.resend.com/emails";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend/emails";

/** Who the mail comes from. A verified sending domain is required by Resend; if
 * krijo24.com is not verified in the Resend account, delivery fails here with a
 * 403 that says so, which is far easier to read than silence. */
const FROM = "krijo24 <notifications@krijo24.com>";

export type EmailResult =
  { sent: true } | { sent: false; reason: "unconfigured" | "provider" | "threw"; detail: string };

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A table of label/value pairs, the shape every internal notification takes. */
export function detailsTable(title: string, rows: [string, string][], note?: string) {
  const body = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666">${escapeHtml(k)}</td><td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`,
    )
    .join("");
  const extra = note
    ? `<p style="margin:20px 0 6px;color:#666">Message</p><p style="margin:0;white-space:pre-wrap">${escapeHtml(note)}</p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;color:#111">
<h2 style="margin:0 0 16px">${escapeHtml(title)}</h2>
<table style="border-collapse:collapse">${body}</table>
${extra}
</div>`;
}

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (response.ok) return null;
  return `${response.status} ${(await response.text()).slice(0, 300)}`;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string | undefined;
}): Promise<EmailResult> {
  const resendKey = process.env["RESEND_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!resendKey) {
    console.error("Email skipped: RESEND_API_KEY is not set");
    return { sent: false, reason: "unconfigured", detail: "RESEND_API_KEY is not set" };
  }

  const payload = {
    from: FROM,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    ...(input.replyTo ? { reply_to: input.replyTo } : {}),
  };

  try {
    const direct = await post(RESEND_URL, { Authorization: `Bearer ${resendKey}` }, payload);
    if (!direct) return { sent: true };

    // Only worth a second attempt when the second route uses different
    // credentials. Without the Lovable key it is the same request to the same
    // provider, and a retry of a rejected send is just a slower rejection.
    if (!lovableKey) {
      console.error(`Resend rejected the send: ${direct}`);
      return { sent: false, reason: "provider", detail: direct };
    }

    const viaGateway = await post(
      GATEWAY_URL,
      { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": resendKey },
      payload,
    );
    if (!viaGateway) return { sent: true };
    console.error(`Both send routes failed. Resend: ${direct}. Gateway: ${viaGateway}`);
    return { sent: false, reason: "provider", detail: `${direct} / ${viaGateway}` };
  } catch (err) {
    console.error("Sending mail threw:", err);
    return { sent: false, reason: "threw", detail: String(err).slice(0, 300) };
  }
}
