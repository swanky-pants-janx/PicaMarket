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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    // Verify caller is a known coordinator
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()
    if (!profile) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { to, subject, html } = await req.json()
    if (!to || !subject || !html) return new Response('Missing fields', { status: 400, headers: corsHeaders })
    if (!EMAIL_RE.test(to)) return new Response('Invalid recipient', { status: 400, headers: corsHeaders })

    const apiKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('RESEND_FROM') || 'PicaMarket <noreply@picamarket.site>'
    if (!apiKey) return new Response('Email not configured', { status: 503 })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ from, to, subject, html }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('Resend error:', res.status, body)
      return new Response('Email failed', { status: 502 })
    }

    return new Response('OK', { status: 200, headers: corsHeaders })

  } catch (err) {
    console.error('resend-email error:', err)
    return new Response('Server error', { status: 500 })
  }
})
