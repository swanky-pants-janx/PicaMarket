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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify the token and get the requesting user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return new Response('Unauthorized', { status: 401 })

    // Delete the auth user — cascades to profiles/vendor_profiles via FK
    const { error } = await supabase.auth.admin.deleteUser(user.id)
    if (error) {
      console.error('delete-account: admin.deleteUser failed', user.id, error)
      return new Response('Delete failed', { status: 500 })
    }

    return new Response('OK', { status: 200, headers: corsHeaders })

  } catch (err) {
    console.error('delete-account error:', err)
    return new Response('Server error', { status: 500 })
  }
})
