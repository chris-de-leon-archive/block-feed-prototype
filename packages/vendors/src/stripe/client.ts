import Stripe from "stripe"
import { z } from "zod"

export type StripeVendor = ReturnType<typeof create>

export const zEnv = z.object({
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_ID: z.string().min(1),
  STRIPE_API_KEY: z.string().min(1),
  STRIPE_CHECKOUT_SUCCESS_URL: z.string().url().min(1),
  STRIPE_CHECKOUT_CANCEL_URL: z.string().url().min(1),
  STRIPE_BILLING_PORTAL_RETURN_URL: z.string().url().min(1),
  STRIPE_CUSTOMER_PORTAL_URL: z.string().url().min(1),
})

export const create = (env: z.infer<typeof zEnv>) => {
  const client = new Stripe(env.STRIPE_API_KEY)

  return {
    client,
    env,
  }
}
