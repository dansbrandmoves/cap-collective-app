// Called on billing page load. Checks the user's current subscription
// status in Stripe and syncs profile.plan accordingly. Webhook-less
// replacement for customer.subscription.updated / deleted events — any
// cancellation or payment failure will be caught next time the user
// opens the billing page.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY not configured')

    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .single()

    // No Stripe customer yet — nothing to sync
    if (!profile?.stripe_customer_id) {
      return new Response(JSON.stringify({ plan: profile?.plan || 'free', changed: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch active subscriptions for this customer
    const subsRes = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${profile.stripe_customer_id}&status=active&limit=1`,
      { headers: { 'Authorization': `Bearer ${stripeKey}` } }
    )
    const subs = await subsRes.json()
    if (subs.error) throw new Error(subs.error.message)

    const activeSub = subs.data?.[0]
    const newPlan = activeSub ? 'pro' : 'free'
    const newSubId = activeSub?.id || null

    const changed =
      profile.plan !== newPlan ||
      profile.stripe_subscription_id !== newSubId

    if (changed) {
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      await adminClient.from('profiles').update({
        plan: newPlan,
        stripe_subscription_id: newSubId,
      }).eq('id', user.id)
    }

    return new Response(JSON.stringify({
      plan: newPlan,
      changed,
      activeSubscription: !!activeSub,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
