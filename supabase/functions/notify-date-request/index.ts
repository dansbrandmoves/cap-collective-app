// Supabase Edge Function: notify-date-request
// Sends a branded email to the project owner when a guest submits a date request.
//
// Required env vars (set in Supabase dashboard → Settings → Edge Functions):
//   RESEND_API_KEY              — resend.com key
//   SUPABASE_URL                — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY   — auto-injected
//   FROM_EMAIL                  — verified sender (defaults to notifications@app.coordie.com)
//   OWNER_EMAIL                 — fallback owner email when ownerId lookup fails

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Coordie <notifications@app.coordie.com>";
const OWNER_EMAIL_FALLBACK = Deno.env.get("OWNER_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(ds: string) {
  try {
    return new Date(ds + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return ds;
  }
}

function buildEmailHtml(opts: {
  requesterName: string;
  requesterEmail?: string;
  dates: string[];
  message?: string;
  groupName: string;
  productionName: string;
}) {
  const {
    requesterName,
    requesterEmail,
    dates,
    message,
    groupName,
    productionName,
  } = opts;

  const dateChips = (dates || [])
    .map(
      (d) =>
        `<span style="display:inline-block;background:rgba(139,92,246,0.08);color:#8b5cf6;border:1px solid rgba(139,92,246,0.20);border-radius:999px;padding:4px 10px;font-size:12px;font-weight:500;margin:0 6px 6px 0;letter-spacing:-0.005em;">${escapeHtml(formatDate(d))}</span>`,
    )
    .join("");

  const messageBlock = message
    ? `
    <tr>
      <td style="padding:0 0 28px 0;">
        <p class="message-card" style="margin:0;border-left:3px solid #8b5cf6;padding:2px 0 2px 12px;color:#52525b;font-size:14px;font-style:italic;line-height:1.55;">&ldquo;${escapeHtml(message)}&rdquo;</p>
      </td>
    </tr>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>New date request</title>
  <style>
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important;}
    @media (prefers-color-scheme: dark) {
      .email-bg{background:#0a0a0b!important;}
      .email-card{background:#131316!important;border-color:rgba(255,255,255,0.08)!important;}
      .text-primary{color:#f4f4f5!important;}
      .text-secondary{color:#a1a1aa!important;}
      .text-muted{color:#71717a!important;}
      .message-card{color:#a1a1aa!important;}
      .ghost-cta{color:#a1a1aa!important;}
      .divider{background:rgba(255,255,255,0.08)!important;}
      .footer-border{border-color:rgba(255,255,255,0.08)!important;}
    }
    @media (max-width: 540px) {
      .email-card{padding:28px 22px!important;border-radius:0!important;border-left:none!important;border-right:none!important;}
      .title{font-size:26px!important;}
      .cta-primary{display:block!important;text-align:center!important;margin:0 0 10px 0!important;}
      .cta-ghost{display:block!important;text-align:center!important;padding:12px 0!important;}
    }
  </style>
</head>
<body class="email-bg" style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(requesterName)} requested ${dates.length} date${dates.length === 1 ? "" : "s"} for ${escapeHtml(productionName)}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-bg" style="background:#ffffff;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" class="email-card" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e2e2e6;border-radius:20px;padding:40px 36px;">
        <tr><td style="padding:0 0 36px 0;">
          <span class="text-primary" style="font-size:15px;font-weight:700;letter-spacing:-0.02em;color:#18181b;">coordie</span>
          <span style="display:inline-block;width:3px;height:3px;background:#8b5cf6;border-radius:50%;vertical-align:middle;margin:0 8px 3px 8px;"></span>
          <span class="text-muted" style="font-size:12px;color:#a1a1aa;font-weight:500;letter-spacing:0.02em;">Date request</span>
        </td></tr>
        <tr><td style="padding:0 0 10px 0;">
          <h1 class="title text-primary" style="margin:0;color:#18181b;font-size:30px;font-weight:600;letter-spacing:-0.025em;line-height:1.1;">New date request</h1>
        </td></tr>
        <tr><td style="padding:0 0 28px 0;">
          <p class="text-secondary" style="margin:0;color:#52525b;font-size:15px;line-height:1.55;">
            <strong style="color:#18181b;font-weight:600;">${escapeHtml(requesterName)}</strong>${requesterEmail ? ` <span class="text-muted" style="color:#a1a1aa;">&middot; ${escapeHtml(requesterEmail)}</span>` : ""} requested time for <strong style="color:#18181b;font-weight:600;">${escapeHtml(productionName)}</strong> <span class="text-muted" style="color:#a1a1aa;">&middot; ${escapeHtml(groupName)}</span>.
          </p>
        </td></tr>
        <tr><td style="padding:0 0 28px 0;">
          <p class="text-muted" style="margin:0 0 10px 0;color:#a1a1aa;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Requested dates</p>
          <div>${dateChips || '<span style="color:#a1a1aa;font-size:14px;">No dates specified</span>'}</div>
        </td></tr>
        ${messageBlock}
        <tr><td style="padding:4px 0 28px 0;">
          <div class="divider" style="height:1px;background:#e4e4e7;line-height:1px;font-size:0;">&nbsp;</div>
        </td></tr>
        <tr><td style="padding:0 0 36px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:0 10px 0 0;">
                <a href="https://www.coordie.com/inbox" class="cta-primary" style="display:inline-block;background:#8b5cf6;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:-0.005em;padding:12px 20px;border-radius:12px;">Review in Inbox</a>
              </td>
              <td>
                <a href="https://www.coordie.com" class="cta-ghost ghost-cta" style="display:inline-block;color:#71717a;text-decoration:none;font-size:14px;font-weight:500;padding:12px 6px;">Open Coordie &rarr;</a>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td class="footer-border" style="padding:24px 0 0 0;border-top:1px solid #e4e4e7;">
          <p class="text-muted" style="margin:0;color:#a1a1aa;font-size:12px;line-height:1.5;">Sent by Coordie &middot; <a href="https://www.coordie.com" style="color:#8b5cf6;text-decoration:none;font-weight:500;">coordie.com</a></p>
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
    const {
      requesterName,
      requesterEmail,
      dates,
      message,
      groupName,
      productionName,
      ownerEmail,
      ownerId,
    } = await req.json();

    // Resolve the owner's email — prefer explicit ownerEmail, then look up by ownerId, then fall back to env var
    let toEmail: string | null = ownerEmail || null;

    if (!toEmail && ownerId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: { user } } = await supabase.auth.admin.getUserById(ownerId);
      toEmail = user?.email ?? null;
    }

    if (!toEmail) toEmail = OWNER_EMAIL_FALLBACK ?? null;

    if (!toEmail) {
      return new Response(
        JSON.stringify({ error: "Could not resolve owner email" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    if (!RESEND_API_KEY) {
      console.log("No RESEND_API_KEY — would send to:", toEmail);
      return new Response(
        JSON.stringify({ ok: true, note: "no RESEND_API_KEY" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const html = buildEmailHtml({
      requesterName: requesterName || "A guest",
      requesterEmail,
      dates: dates || [],
      message,
      groupName: groupName || "",
      productionName: productionName || "",
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [toEmail],
        subject: `Date request from ${requesterName || "a guest"}${productionName ? " \u2014 " + productionName : ""}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Resend error:", err);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("notify-date-request error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
