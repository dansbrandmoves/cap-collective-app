// Supabase Edge Function: send-invite
// Emails a person their personal invite link to share availability for a project.
//
// Required env vars:
//   RESEND_API_KEY  — resend.com key
//   FROM_EMAIL      — verified sender (defaults to notifications@app.coordie.com)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Coordie <notifications@app.coordie.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(s: string) {
  return (s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function buildEmailHtml(opts: { toName: string; inviteLink: string; projectName: string; fromName: string }) {
  const { toName, inviteLink, projectName, fromName } = opts;
  const greeting = toName ? `Hi ${escapeHtml(toName)},` : "Hi there,";
  const who = fromName ? escapeHtml(fromName) : "Someone";
  const proj = projectName ? `<strong class="text-primary" style="color:#18181b;font-weight:600;">${escapeHtml(projectName)}</strong>` : "a project";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>You're invited to share your availability</title>
  <style>
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;}
    @media (prefers-color-scheme: dark) {
      .text-primary{color:#f4f4f5!important;}
      .text-secondary{color:#a1a1aa!important;}
      .text-muted{color:#71717a!important;}
      .divider{background:rgba(255,255,255,0.08)!important;}
      .footer-border{border-color:rgba(255,255,255,0.08)!important;}
    }
    @media (max-width: 540px) { .title{font-size:26px!important;} }
  </style>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${who} invited you to share your availability${projectName ? " for " + escapeHtml(projectName) : ""}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr><td style="padding:0 0 40px 0;">
          <span class="text-primary" style="font-size:15px;font-weight:700;letter-spacing:-0.02em;color:#18181b;">coordie</span>
          <span style="display:inline-block;width:3px;height:3px;background:#5e9c8c;border-radius:50%;vertical-align:middle;margin:0 8px 3px 8px;"></span>
          <span class="text-muted" style="font-size:12px;color:#71717a;font-weight:500;letter-spacing:0.02em;">Invitation</span>
        </td></tr>
        <tr><td style="padding:0 0 12px 0;">
          <h1 class="title text-primary" style="margin:0;color:#18181b;font-size:30px;font-weight:600;letter-spacing:-0.025em;line-height:1.1;">Share your availability</h1>
        </td></tr>
        <tr><td style="padding:0 0 32px 0;">
          <p class="text-secondary" style="margin:0;color:#52525b;font-size:15px;line-height:1.6;">
            ${greeting} ${who} invited you to share when you're free for ${proj}. It takes a few seconds &mdash; connect your calendar or just tap your free days.
          </p>
        </td></tr>
        <tr><td style="padding:0 0 40px 0;">
          <a href="${escapeHtml(inviteLink)}" style="display:inline-block;background:#5e9c8c;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:-0.005em;padding:13px 24px;border-radius:12px;">Share my availability &rarr;</a>
        </td></tr>
        <tr><td style="padding:0 0 32px 0;">
          <div class="divider" style="height:1px;background:#e4e4e7;line-height:1px;font-size:0;">&nbsp;</div>
        </td></tr>
        <tr><td style="padding:0 0 8px 0;">
          <p class="text-muted" style="margin:0;color:#71717a;font-size:12px;line-height:1.5;">Or paste this link into your browser:</p>
          <p style="margin:6px 0 0 0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${escapeHtml(inviteLink)}" style="color:#5e9c8c;text-decoration:none;">${escapeHtml(inviteLink)}</a></p>
        </td></tr>
        <tr><td class="footer-border" style="padding:20px 0 0 0;border-top:1px solid #e4e4e7;">
          <p class="text-muted" style="margin:0;color:#71717a;font-size:12px;line-height:1.5;">Sent by Coordie &middot; <a href="https://www.coordie.com" style="color:#5e9c8c;text-decoration:none;font-weight:500;">coordie.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { toEmail, toName, inviteLink, projectName, fromName } = await req.json();

    if (!toEmail || !inviteLink) {
      return new Response(JSON.stringify({ error: "toEmail and inviteLink are required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!RESEND_API_KEY) {
      console.log("No RESEND_API_KEY — would invite:", toEmail);
      return new Response(JSON.stringify({ ok: true, note: "no RESEND_API_KEY" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const html = buildEmailHtml({
      toName: toName || "",
      inviteLink,
      projectName: projectName || "",
      fromName: fromName || "",
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [toEmail],
        subject: `${fromName || "You're"} invited you to share your availability${projectName ? " — " + projectName : ""}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("send-invite error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
