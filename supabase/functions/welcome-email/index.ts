import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = ['https://picamarket.site', 'https://www.picamarket.site']
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Authenticate via JWT
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !authUser) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { type } = await req.json()
    const user_id = authUser.id

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
