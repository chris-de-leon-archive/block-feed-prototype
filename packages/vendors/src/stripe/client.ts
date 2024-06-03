import Stripe from "stripe"
import { z } from "zod"

export type StripeVendor = ReturnType<typeof create>

export const zEnv = z.object({
  STRIPE_API_KEY: z.string().min(1),
})

export const create = (env: z.infer<typeof zEnv>) => {
  const client = new Stripe(env.STRIPE_API_KEY)

  return {
    client,
    env,
  }
}
