import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { user_id, type } = await req.json()
    if (!user_id) return new Response('Missing user_id', { status: 400 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const apiKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('RESEND_FROM') || 'PicaMarket <noreply@picamarket.site>'
    if (!apiKey) return new Response('Email not configured', { status: 503 })

    let toEmail: string, html: string

    if (type === 'vendor') {
      const { data: profile, error } = await supabase
        .from('vendor_profiles')
        .select('email, stall_name')
        .eq('user_id', user_id)
        .single()

      if (error || !profile) {
        console.error('welcome-email: vendor profile not found', user_id, error)
        return new Response('Not found', { status: 404 })
      }

      toEmail = profile.email
      html = '<p>Hi there,</p>' +
        '<p>Welcome to PicaMarket! Your vendor account for <strong>' + profile.stall_name + '</strong> has been created successfully.</p>' +
        '<p>You can now log in to your vendor dashboard to manage your profile and browse markets to apply to.</p>' +
        '<p>Thanks,<br>The PicaMarket Team</p>'
    } else {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('coordinator_email, coordinator_name, market_name')
        .eq('id', user_id)
        .single()

      if (error || !profile) {
        console.error('welcome-email: profile not found', user_id, error)
        return new Response('Not found', { status: 404 })
      }

      toEmail = profile.coordinator_email
      html = '<p>Hi ' + profile.coordinator_name + ',</p>' +
        '<p>Welcome to PicaMarket! Your account for <strong>' + profile.market_name + '</strong> has been created successfully.</p>' +
        '<p>You can now log in to your dashboard to set up your markets, manage vendor applications, and more.</p>' +
        '<p>Thanks,<br>The PicaMarket Team</p>'
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        from,
        to: toEmail,
        subject: 'Welcome to PicaMarket!',
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('Resend error:', res.status, body)
      return new Response('Email failed', { status: 502 })
    }

    return new Response('OK', { status: 200, headers: corsHeaders })

  } catch (err) {
    console.error('welcome-email error:', err)
    return new Response('Server error', { status: 500 })
  }
})
