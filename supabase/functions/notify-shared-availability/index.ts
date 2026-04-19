// Supabase Edge Function: notify-shared-availability
// Sends a branded email to the owner when a guest shares their calendar availability.
//
// Required env vars:
//   RESEND_API_KEY              — resend.com key
//   SUPABASE_URL                — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY   — auto-injected
//   FROM_EMAIL                  — verified sender (defaults to notifications@app.coordie.com)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "Coordie <notifications@app.coordie.com>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      weekday: "short", month: "short", day: "numeric",
    });
  } catch { return ds; }
}

function buildEmailHtml(opts: {
  guestName: string;
  dateCount: number;
  dates: string[];
  groupName: string;
  productionName: string;
}) {
  const { guestName, dateCount, dates, groupName, productionName } = opts;

  const dateChips = (dates.slice(0, 8))
    .map((d) =>
      `<span style="display:inline-block;background:rgba(139,92,246,0.08);color:#8b5cf6;border:1px solid rgba(139,92,246,0.20);border-radius:999px;padding:4px 10px;font-size:12px;font-weight:500;margin:0 6px 6px 0;letter-spacing:-0.005em;">${escapeHtml(formatDate(d))}</span>`
    )
    .join("") + (dates.length > 8 ? `<span style="font-size:12px;color:#a1a1aa;margin-left:4px;">+${dates.length - 8} more</span>` : "");

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
  <title>Availability shared</title>
  <style>
    a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important;}
    @media (prefers-color-scheme: dark) {
      .email-bg{background:#0a0a0b!important;}
      .email-card{background:#131316!important;border-color:rgba(255,255,255,0.08)!important;}
      .text-primary{color:#f4f4f5!important;}
      .text-secondary{color:#a1a1aa!important;}
      .text-muted{color:#71717a!important;}
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
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(guestName)} shared ${dateCount} free day${dateCount === 1 ? "" : "s"} for ${escapeHtml(productionName)}.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-bg" style="background:#ffffff;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" class="email-card" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e2e2e6;border-radius:20px;padding:40px 36px;">

        <!-- Brand mark -->
        <tr><td style="padding:0 0 36px 0;">
          <span class="text-primary" style="font-size:15px;font-weight:700;letter-spacing:-0.02em;color:#18181b;">coordie</span>
          <span style="display:inline-block;width:3px;height:3px;background:#8b5cf6;border-radius:50%;vertical-align:middle;margin:0 8px 3px 8px;"></span>
          <span class="text-muted" style="font-size:12px;color:#a1a1aa;font-weight:500;letter-spacing:0.02em;">Availability shared</span>
        </td></tr>

        <!-- Title -->
        <tr><td style="padding:0 0 10px 0;">
          <h1 class="title text-primary" style="margin:0;color:#18181b;font-size:30px;font-weight:600;letter-spacing:-0.025em;line-height:1.1;">Availability shared</h1>
        </td></tr>
        <tr><td style="padding:0 0 28px 0;">
          <p class="text-secondary" style="margin:0;color:#52525b;font-size:15px;line-height:1.55;">
            <strong style="color:#18181b;font-weight:600;">${escapeHtml(guestName)}</strong> connected their calendar and shared <strong style="color:#18181b;font-weight:600;">${dateCount} free day${dateCount === 1 ? "" : "s"}</strong> for <strong style="color:#18181b;font-weight:600;">${escapeHtml(productionName)}</strong> <span class="text-muted" style="color:#a1a1aa;">&middot; ${escapeHtml(groupName)}</span>.
          </p>
        </td></tr>

        <!-- Date chips -->
        <tr><td style="padding:0 0 28px 0;">
          <p class="text-muted" style="margin:0 0 10px 0;color:#a1a1aa;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;">Free days</p>
          <div>${dateChips}</div>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:4px 0 28px 0;">
          <div class="divider" style="height:1px;background:#e4e4e7;line-height:1px;font-size:0;">&nbsp;</div>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 0 36px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:0 10px 0 0;">
                <a href="https://www.coordie.com" class="cta-primary" style="display:inline-block;background:#8b5cf6;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:-0.005em;padding:12px 20px;border-radius:12px;">Open Coordie</a>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Footer -->
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
    const { guestName, ownerId, groupId, dates } = await req.json();

    if (!ownerId || !groupId || !guestName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up owner email + group/production names in parallel
    const [{ data: { user } }, { data: group }] = await Promise.all([
      supabase.auth.admin.getUserById(ownerId),
      supabase.from("groups").select("name, productions(name)").eq("id", groupId).single(),
    ]);

    const toEmail = user?.email ?? null;
    if (!toEmail) {
      return new Response(
        JSON.stringify({ error: "Could not resolve owner email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const groupName = group?.name ?? "";
    const productionName = (group?.productions as { name: string } | null)?.name ?? "";
    const safeDates: string[] = Array.isArray(dates) ? dates : [];

    if (!RESEND_API_KEY) {
      console.log("No RESEND_API_KEY — would send to:", toEmail);
      return new Response(
        JSON.stringify({ ok: true, note: "no RESEND_API_KEY" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const html = buildEmailHtml({
      guestName,
      dateCount: safeDates.length,
      dates: safeDates,
      groupName,
      productionName,
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
        subject: `${guestName} shared their availability${productionName ? " \u2014 " + productionName : ""}`,
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
    console.error("notify-shared-availability error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
