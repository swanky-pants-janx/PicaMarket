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
    const body = await req.json()
    const { coordinator_id, name, desc, email, markets, market_stall_types, images, custom_responses } = body

    const turnstile_token = body.turnstile_token
    if (!coordinator_id || !name || !email || !Array.isArray(markets) || markets.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Server-side Turnstile verification
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY')
    if (turnstileSecret) {
      if (!turnstile_token) {
        return new Response(JSON.stringify({ error: 'Missing CAPTCHA token' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      const tsRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: turnstileSecret, response: turnstile_token }),
      })
      const tsData = await tsRes.json()
      if (!tsData.success) {
        return new Response(JSON.stringify({ error: 'CAPTCHA verification failed' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Rate limiting: 3 submissions per email per coordinator per 10 minutes ──
    const rateLimitKey = `submit-vendor:${email.toLowerCase()}:${coordinator_id}`
    const windowStart = new Date(Date.now() - 10 * 60 * 1000).toISOString()

    const { count: recentCount } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('key', rateLimitKey)
      .gte('created_at', windowStart)

    if ((recentCount ?? 0) >= 3) {
      return new Response(JSON.stringify({
        error: 'rate_limited',
        message: 'You have submitted recently. Please wait a few minutes before trying again.'
      }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Log this submission attempt
    await supabase.from('rate_limits').insert({ key: rateLimitKey })

    // Check if this email is blocked by the coordinator
    const { data: coordProfile } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', coordinator_id)
      .single()

    const blockedEmails: string[] = coordProfile?.settings?.blocked_emails || []
    if (blockedEmails.includes(email.toLowerCase())) {
      return new Response(JSON.stringify({
        error: 'blocked',
        message: 'This email address is not able to submit applications. Please contact the market coordinator.'
      }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check for existing pending entry with same email for this coordinator (service role bypasses RLS)
    const { data: existing } = await supabase
      .from('vendors')
      .select('id, markets, market_stall_types')
      .eq('user_id', coordinator_id)
      .ilike('email', email)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      const existingMarkets: string[] = existing.markets || []
      const newMarkets = markets.filter((mid: string) => !existingMarkets.includes(mid))

      if (newMarkets.length === 0) {
        // Exact duplicate — all markets already applied for
        return new Response(JSON.stringify({ action: 'duplicate', id: existing.id }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Same vendor, new markets — merge into existing pending entry
      const updatedMarkets = [...existingMarkets, ...newMarkets]
      const updatedStallTypes = { ...(existing.market_stall_types || {}), ...(market_stall_types || {}) }

      const { error: updateError } = await supabase
        .from('vendors')
        .update({ markets: updatedMarkets, market_stall_types: updatedStallTypes })
        .eq('id', existing.id)

      if (updateError) {
        console.error('submit-vendor merge error:', updateError)
        return new Response(JSON.stringify({ error: 'Update failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ action: 'merged', id: existing.id }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // No existing entry — insert new vendor
    const vendorId = crypto.randomUUID()
    const insertData: Record<string, unknown> = {
      id: vendorId,
      user_id: coordinator_id,
      name,
      description: desc,
      email,
      markets,
      market_payments: {},
      market_methods: {},
      market_stall_types: market_stall_types || {},
      status: 'pending',
      pay_status: 'outstanding',
      pay_method: null,
      images: images || [],
      submitted_at: new Date().toISOString().slice(0, 10),
    }
    if (custom_responses && Object.keys(custom_responses).length) {
      insertData.custom_responses = custom_responses
    }

    const { error: insertError } = await supabase.from('vendors').insert(insertData)

    if (insertError) {
      console.error('submit-vendor insert error:', insertError)
      return new Response(JSON.stringify({ error: 'Insert failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Send notification email to coordinator (replaces standalone notify-vendor-submission)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('coordinator_email, market_name, settings')
        .eq('id', coordinator_id)
        .single()

      const notifyEnabled = !profile?.settings || profile.settings.notify_on_apply !== false
      const recipientEmail = profile?.coordinator_email
      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

      if (notifyEnabled && recipientEmail && EMAIL_RE.test(recipientEmail)) {
        const apiKey = Deno.env.get('RESEND_API_KEY')
        const from = Deno.env.get('RESEND_FROM') || 'PicaMarket <noreply@picamarket.site>'
        if (apiKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
            body: JSON.stringify({
              from, to: recipientEmail,
              subject: 'New vendor application — ' + name,
              html: '<p>A new vendor application has been submitted to <strong>' +
                profile.market_name + '</strong>.</p>' +
                '<p><strong>Stall name:</strong> ' + name + '<br>' +
                '<strong>Email:</strong> ' + email + '</p>' +
                '<p>Log in to your dashboard to review and approve.</p>',
            }),
          })
        }
      }
    } catch (notifyErr) {
      console.error('submit-vendor notify error (non-fatal):', notifyErr)
    }

    return new Response(JSON.stringify({ action: 'inserted', id: vendorId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('submit-vendor error:', err)
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
