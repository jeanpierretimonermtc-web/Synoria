import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { stripe } from '../_shared/stripe.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing authorization header' }, 401)
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (memberError || !member) {
    return json({ error: 'Organization not found' }, 404)
  }

  const { data: sub, error: subError } = await supabaseAdmin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('organization_id', member.organization_id)
    .single()

  if (subError || !sub?.stripe_customer_id) {
    return json({ error: 'No Stripe customer found. Please subscribe first.' }, 404)
  }

  const returnUrl = `${Deno.env.get('SITE_URL') ?? 'https://logiciel-synoria.fr'}/landing/abonnement.html`

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: returnUrl,
  })

  return json({ url: portalSession.url })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
