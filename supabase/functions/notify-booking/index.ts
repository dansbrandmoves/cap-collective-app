// Supabase Edge Function: notify-booking
// Sends a branded email to the owner when a guest books a meeting.
//
// Required env vars:
//   RESEND_API_KEY              — resend.com key
//   SUPABASE_URL                — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY   — auto-injected

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${period}`;
}

function toGcalDate(date: string, time: string) {
  return date.replace(/-/g, "") + "T" + time.replace(/:/g, "") + "00";
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(opts: {
  guestName: string;
  guestEmail?: string;
  guestMessage?: string;
  pageName?: string;
  dateFormatted: string;
  timeRange: string;
  duration?: number;
  gcalLink: string;
}) {
  const {
    guestName,
    guestEmail,
    guestMessage,
    pageName,
    dateFormatted,
    timeRange,
    duration,
    gcalLink,
  } = opts;

  const pageFragment = pageName
    ? ` via <strong style="color:#18181b;font-weight:600;">${escapeHtml(pageName)}</strong>`
    : "";
  const durationFragment = duration ? ` · ${duration} min` : "";

  const guestInfoBlock =
    guestEmail || guestMessage
      ? `
    <tr>
      <td style="padding:0 0 32px 0;">
        ${
          guestEmail
            ? `<p class="text-secondary" style="margin:0 0 16px 0;color:#52525b;font-size:14px;line-height:1.5;">Guest <span class="text-primary" style="color:#18181b;">${escapeHtml(guestEmail)}</span></p>`
            : ""
        }
        ${
          guestMessage
            ? `<p class="quote" style="margin:0;padding:4px 0 4px 16px;border-left:3px solid #d4d4d8;color:#52525b;font-size:15px;font-style:italic;line-height:1.6;">&ldquo;${escapeHtml(
                guestMessage,
              )}&rdquo;</p>`
            : ""
        }
      </td>
    </tr>`
      : "";

  // eslint-disable-next-line
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
  <title>New booking</title>
  <!--[if mso]>
    <style>table,td,div,p,a{font-family:Arial,sans-serif!important;}</style>
  <![endif]-->
  <style>
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }

    @media (prefers-color-scheme: dark) {
      .text-primary { color: #f4f4f5 !important; }
      .text-secondary { color: #a1a1aa !important; }
      .text-muted { color: #71717a !important; }
      .accent-date { color: #a78bfa !important; }
      .quote { border-left-color: #3f3f46 !important; color: #a1a1aa !important; }
      .ghost-cta { color: #a1a1aa !important; }
      .divider { background: rgba(255,255,255,0.08) !important; }
      .footer-border { border-color: rgba(255,255,255,0.08) !important; }
    }

    @media (max-width: 540px) {
      .title { font-size: 26px !important; }
      .cta-primary { display: block !important; text-align: center !important; margin: 0 0 10px 0 !important; }
      .cta-ghost { display: block !important; text-align: center !important; padding: 12px 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(guestName)} booked ${pageName ? escapeHtml(pageName) + " " : ""}on ${dateFormatted} at ${timeRange}.</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <!-- Brand mark -->
          <tr>
            <td style="padding:0 0 40px 0;">
              <span class="text-primary" style="font-size:15px;font-weight:700;letter-spacing:-0.02em;color:#18181b;">coordie</span>
              <span style="display:inline-block;width:3px;height:3px;background:#8b5cf6;border-radius:50%;vertical-align:middle;margin:0 8px 3px 8px;"></span>
              <span class="text-muted" style="font-size:12px;color:#71717a;font-weight:500;letter-spacing:0.02em;">Booking confirmed</span>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:0 0 12px 0;">
              <h1 class="title text-primary" style="margin:0;color:#18181b;font-size:30px;font-weight:600;letter-spacing:-0.025em;line-height:1.1;">New booking</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 32px 0;">
              <p class="text-secondary" style="margin:0;color:#52525b;font-size:15px;line-height:1.55;">
                <strong class="text-primary" style="color:#18181b;font-weight:600;">${escapeHtml(guestName)}</strong> booked a meeting${pageFragment}${durationFragment ? `<span class="text-muted" style="color:#71717a;">${durationFragment}</span>` : ""}.
              </p>
            </td>
          </tr>

          <!-- Event detail — typography only, no background -->
          <tr>
            <td style="padding:0 0 32px 0;">
              <p class="accent-date" style="margin:0 0 4px 0;color:#8b5cf6;font-size:18px;font-weight:600;letter-spacing:-0.015em;line-height:1.3;">
                ${escapeHtml(dateFormatted)}
              </p>
              <p class="text-secondary" style="margin:0;color:#52525b;font-size:15px;line-height:1.4;">
                ${escapeHtml(timeRange)}
              </p>
            </td>
          </tr>

          ${guestInfoBlock}

          <!-- Divider -->
          <tr>
            <td style="padding:0 0 32px 0;">
              <div class="divider" style="height:1px;background:#e4e4e7;line-height:1px;font-size:0;">&nbsp;</div>
            </td>
          </tr>

          <!-- CTAs -->
          <tr>
            <td style="padding:0 0 40px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:0 10px 0 0;">
                    <a href="${gcalLink}" class="cta-primary" style="display:inline-block;background:#8b5cf6;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:-0.005em;padding:12px 20px;border-radius:12px;mso-padding-alt:0;">
                      <!--[if mso]>&nbsp;&nbsp;&nbsp;&nbsp;<![endif]-->Add to Google Calendar<!--[if mso]>&nbsp;&nbsp;&nbsp;&nbsp;<![endif]-->
                    </a>
                  </td>
                  <td>
                    <a href="https://www.coordie.com" class="cta-ghost ghost-cta" style="display:inline-block;color:#71717a;text-decoration:none;font-size:14px;font-weight:500;padding:12px 6px;">
                      Open Coordie &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer-border" style="padding:20px 0 0 0;border-top:1px solid #e4e4e7;">
              <p class="text-muted" style="margin:0;color:#71717a;font-size:12px;line-height:1.5;">
                Sent by Coordie &middot; <a href="https://www.coordie.com" style="color:#8b5cf6;text-decoration:none;font-weight:500;">coordie.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      guestName,
      guestEmail,
      guestMessage,
      date,
      startTime,
      endTime,
      duration,
      pageName,
      bookingPageId,
    } = body;

    if (!guestName || !date || !startTime) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let toEmail: string | null = null;
    let resolvedPageName: string | undefined = pageName;

    if (bookingPageId) {
      const { data: page } = await supabase
        .from("booking_pages")
        .select("owner_id, name")
        .eq("id", bookingPageId)
        .single();

      if (page?.owner_id) {
        const { data: { user } } = await supabase.auth.admin.getUserById(
          page.owner_id,
        );
        toEmail = user?.email ?? null;
      }
      if (!resolvedPageName && page?.name) resolvedPageName = page.name;
    }

    if (!toEmail) {
      return new Response(
        JSON.stringify({ error: "Could not resolve owner email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const dateFormatted = new Date(date + "T00:00:00").toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      },
    );

    const timeRange = endTime
      ? `${formatTime(startTime)} \u2013 ${formatTime(endTime)}`
      : formatTime(startTime);

    const gcalStart = toGcalDate(date, startTime);
    const gcalEnd = toGcalDate(date, endTime || startTime);
    const gcalTitle = encodeURIComponent(`Meeting with ${guestName}`);
    const gcalDetails = encodeURIComponent(
      `Booked via Coordie${resolvedPageName ? " (" + resolvedPageName + ")" : ""}\n` +
        (guestEmail ? `Guest: ${guestEmail}\n` : "") +
        (guestMessage ? `Message: ${guestMessage}\n` : ""),
    );
    const gcalLink =
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${gcalTitle}&dates=${gcalStart}/${gcalEnd}&details=${gcalDetails}`;

    const html = buildEmailHtml({
      guestName,
      guestEmail,
      guestMessage,
      pageName: resolvedPageName,
      dateFormatted,
      timeRange,
      duration,
      gcalLink,
    });

    if (!RESEND_API_KEY) {
      console.log("No RESEND_API_KEY \u2014 would send to:", toEmail);
      return new Response(
        JSON.stringify({ success: true, note: "no RESEND_API_KEY" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Coordie <notifications@app.coordie.com>",
        to: [toEmail],
        subject: `New booking from ${guestName}`,
        html,
      }),
    });

    const emailData = await emailRes.json();
    if (!emailRes.ok) {
      console.error("Resend error:", emailData);
      return new Response(
        JSON.stringify({ error: "Email send failed", details: emailData }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ success: true, email: emailData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("notify-booking error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
