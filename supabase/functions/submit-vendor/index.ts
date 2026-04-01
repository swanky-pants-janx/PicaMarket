import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { coordinator_id, name, desc, email, markets, market_stall_types, images, custom_responses } = body

    if (!coordinator_id || !name || !email || !Array.isArray(markets) || markets.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
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
