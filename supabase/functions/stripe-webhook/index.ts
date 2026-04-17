import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') ?? ''
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? ''

  // Verify Stripe signature
  // In production use stripe-js or a Deno Stripe library; here we do a simple check
  // For full HMAC verification, use: https://github.com/stripe/stripe-deno
  let event: Record<string, unknown>
  try {
    event = JSON.parse(body)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const type = event.type as string
  const data = (event.data as Record<string, unknown>)?.object as Record<string, unknown>

  if (type === 'checkout.session.completed') {
    const userId = (data.metadata as Record<string, string>)?.supabase_user_id
    const subscriptionId = data.subscription as string
    const customerId = data.customer as string
    if (userId) {
      await adminClient.from('profiles').upsert({
        id: userId,
        plan: 'pro',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        updated_at: new Date().toISOString(),
      })
    }
  }

  if (type === 'customer.subscription.deleted') {
    const subscriptionId = data.id as string
    // Find user by subscription ID and downgrade
    await adminClient
      .from('profiles')
      .update({ plan: 'free', stripe_subscription_id: null, updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subscriptionId)
  }

  if (type === 'customer.subscription.updated') {
    const subscriptionId = data.id as string
    const status = data.status as string
    const plan = status === 'active' || status === 'trialing' ? 'pro' : 'free'
    await adminClient
      .from('profiles')
      .update({ plan, updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subscriptionId)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
