// Supabase Edge Function: notify-date-request
// Sends an email to the project owner when a guest submits a date request.
//
// Required env vars (set in Supabase dashboard → Settings → Edge Functions):
//   RESEND_API_KEY  — get a free key at resend.com
//   FROM_EMAIL      — verified sender address (e.g. hello@yourdomain.com)
//   OWNER_EMAIL     — the owner's email to notify (or fetch from Supabase auth)
//
// Deploy: supabase functions deploy notify-date-request

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Coordie <noreply@coordie.app>'
const OWNER_EMAIL = Deno.env.get('OWNER_EMAIL')

serve(async (req) => {
  // Allow preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
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
    } = await req.json()

    const toEmail = ownerEmail || OWNER_EMAIL
    if (!toEmail) {
      return new Response(JSON.stringify({ error: 'No owner email configured' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not set')
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const dateList = (dates || []).join(', ')
    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0c0c0e; color: #f4f4f5; border-radius: 12px;">
        <h2 style="margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #f4f4f5;">New date request</h2>
        <p style="margin: 0 0 24px; font-size: 14px; color: #a1a1aa;">${productionName} &rsaquo; ${groupName}</p>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #71717a; width: 120px;">From</td>
            <td style="padding: 8px 0; color: #f4f4f5; font-weight: 500;">${requesterName}${requesterEmail ? ` &lt;${requesterEmail}&gt;` : ''}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #71717a;">Dates</td>
            <td style="padding: 8px 0; color: #f59e0b; font-weight: 500;">${dateList || 'No dates specified'}</td>
          </tr>
          ${message ? `
          <tr>
            <td style="padding: 8px 0; color: #71717a; vertical-align: top;">Message</td>
            <td style="padding: 8px 0; color: #d4d4d8;">${message}</td>
          </tr>` : ''}
        </table>

        <p style="margin: 24px 0 0; font-size: 12px; color: #52525b;">Sent via Coordie</p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [toEmail],
        subject: `Date request from ${requesterName} — ${productionName}`,
        html: htmlBody,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', err)
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notify-date-request error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
