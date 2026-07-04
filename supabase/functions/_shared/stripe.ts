import Stripe from 'npm:stripe@17'

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2025-05-28.basil',
  httpClient: Stripe.createFetchHttpClient(),
})
