import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHash } from 'node:crypto'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// PayFast production IP ranges (https://developers.payfast.co.za/docs#step_4_confirm_payment)
// Sandbox IP added: 144.126.193.139 (observed from sandbox ITN callbacks)
const PAYFAST_CIDRS = [
  ['197.97.145.144', 28],
  ['41.74.179.192', 27],
  ['144.126.193.139', 32],
] as const

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, oct) => (acc << 8) | parseInt(oct), 0) >>> 0
}

function inCidr(ip: string, [base, bits]: readonly [string, number]): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipToInt(ip) & mask) === (ipToInt(base) & mask)
}

function isPayFastIp(ip: string): boolean {
  return PAYFAST_CIDRS.some(cidr => inCidr(ip, cidr))
}

// PHP urlencode() encodes some chars that JS encodeURIComponent() doesn't (!, ', (, ), *, ~)
function phpUrlencode(str: string): string {
  return encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A')
    .replace(/~/g, '%7E')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verify request comes from PayFast IP ranges
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
    if (!isPayFastIp(clientIp)) {
      console.error('PayFast ITN: rejected IP', clientIp)
      return new Response('Forbidden', { status: 403 })
    }

    const text = await req.text()
    const params = new URLSearchParams(text)

    // Build signature verification string — preserve received order, exclude signature
    const parts: string[] = []
    const data: Record<string, string> = {}
    for (const [k, v] of params.entries()) {
      data[k] = v
      if (k !== 'signature') {
        parts.push(`${k}=${phpUrlencode(v.trim())}`)
      }
    }

    // Append passphrase if configured
    const passphrase = Deno.env.get('PAYFAST_PASSPHRASE')
    if (passphrase) {
      parts.push(`passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`)
    }

    const computed = createHash('md5').update(parts.join('&')).digest('hex')
    if (computed !== data['signature']) {
      console.error('PayFast ITN: signature mismatch', computed, 'vs', data['signature'])
      return new Response('Invalid signature', { status: 400 })
    }

    // Only process completed payments
    if (data['payment_status'] !== 'COMPLETE') {
      return new Response('OK', { status: 200 })
    }

    // m_payment_id = "vendorId:marketId"
    const [vendorId, marketId] = (data['m_payment_id'] || '').split(':')
    if (!vendorId || !marketId) {
      console.error('PayFast ITN: bad m_payment_id', data['m_payment_id'])
      return new Response('Bad payment ID', { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: vendor, error } = await supabase
      .from('vendors')
      .select('name, email, market_payments, market_methods, markets, user_id')
      .eq('id', vendorId)
      .single()

    if (error || !vendor) {
      console.error('PayFast ITN: vendor not found', vendorId, error)
      return new Response('Not found', { status: 404 })
    }

    const mp: Record<string, string> = { ...(vendor.market_payments || {}), [marketId]: 'paid' }
    const mm: Record<string, string> = { ...(vendor.market_methods || {}), [marketId]: 'payfast' }
    const markets: string[] = vendor.markets || []
    const paidCount = markets.filter(m => mp[m] === 'paid').length
    const payStatus = paidCount === markets.length ? 'paid' : paidCount > 0 ? 'partial' : 'outstanding'

    await supabase.from('vendors').update({
      market_payments: mp,
      market_methods: mm,
      pay_status: payStatus,
      pay_method: payStatus === 'paid' ? 'payfast' : payStatus === 'partial' ? 'partial' : null,
    }).eq('id', vendorId)

    console.log('PayFast ITN: marked vendor', vendorId, 'market', marketId, 'as paid')

    // Notify coordinator
    const { data: profile } = await supabase
      .from('profiles')
      .select('coordinator_email, market_name')
      .eq('id', vendor.user_id)
      .single()

    const apiKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('RESEND_FROM') || 'PicaMarket <noreply@picamarket.site>'
    if (profile?.coordinator_email && apiKey) {
      const subject = 'Payment received — ' + vendor.name
      const html = '<p>A payment has been received from <strong>' + vendor.name + '</strong> (' + vendor.email + ').</p>' +
        '<p><strong>Status:</strong> ' + payStatus + '</p>' +
        '<p>Log in to your dashboard to view the update.</p>'
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({ from, to: profile.coordinator_email, subject, html }),
      }).catch(err => console.error('PayFast ITN: email error', err))
    }

    return new Response('OK', { status: 200 })

  } catch (err) {
    console.error('PayFast ITN error:', err)
    return new Response('Server error', { status: 500 })
  }
})
