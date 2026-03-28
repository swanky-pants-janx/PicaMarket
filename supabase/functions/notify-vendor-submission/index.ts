import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { vendor_id } = await req.json()
    if (!vendor_id || typeof vendor_id !== 'string') {
      return new Response('Missing vendor_id', { status: 400 })
    }

    // Use service role to look up vendor and coordinator server-side
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: vendor, error: vErr } = await supabase
      .from('vendors')
      .select('name, email, markets, user_id')
      .eq('id', vendor_id)
      .single()

    if (vErr || !vendor) {
      console.error('notify-vendor-submission: vendor not found', vendor_id, vErr)
      return new Response('Not found', { status: 404 })
    }

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('coordinator_email, market_name, settings')
      .eq('id', vendor.user_id)
      .single()

    if (pErr || !profile) {
      console.error('notify-vendor-submission: profile not found', vendor.user_id, pErr)
      return new Response('Not found', { status: 404 })
    }

    // Respect coordinator's notify_on_apply preference
    const notifyEnabled = !profile.settings || profile.settings.notify_on_apply !== false
    if (!notifyEnabled) return new Response('OK', { status: 200, headers: corsHeaders })

    const recipientEmail = profile.coordinator_email
    if (!recipientEmail || !EMAIL_RE.test(recipientEmail)) {
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    const apiKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('RESEND_FROM') || 'PicaMarket <noreply@picamarket.site>'
    if (!apiKey) return new Response('Email not configured', { status: 503 })

    const subject = 'New vendor application — ' + vendor.name
    const html = '<p>A new vendor application has been submitted to <strong>' +
      profile.market_name + '</strong>.</p>' +
      '<p><strong>Stall name:</strong> ' + vendor.name + '<br>' +
      '<strong>Email:</strong> ' + vendor.email + '</p>' +
      '<p>Log in to your dashboard to review and approve.</p>'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ from, to: recipientEmail, subject, html }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('Resend error:', res.status, body)
      return new Response('Email failed', { status: 502 })
    }

    return new Response('OK', { status: 200, headers: corsHeaders })

  } catch (err) {
    console.error('notify-vendor-submission error:', err)
    return new Response('Server error', { status: 500 })
  }
})
