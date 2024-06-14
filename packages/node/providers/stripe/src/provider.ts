import Stripe from "stripe"
import { z } from "zod"

export const zMetadata = z.object({
  userId: z.string(),
})

export const zEnv = z.object({
  STRIPE_API_KEY: z.string().min(1),
})

export class Provider {
  public readonly client: Stripe

  constructor(public readonly env: z.infer<typeof zEnv>) {
    this.client = new Stripe(env.STRIPE_API_KEY)
  }

  public get constants() {
    return {
      STREAMING: {
        WEBHOOK_EVENT_STREAM_NAME: "block-feed:stripe:webhook-event",
        EVENT_FIELD: "event",
      },
    }
  }

  public parseMetadata(obj: unknown) {
    return zMetadata.parse(obj)
  }

  public makeMetadata(
    metadata: z.infer<typeof zMetadata>,
  ): z.infer<typeof zMetadata> {
    return metadata
  }

  public async extractStripeSubscription(sess: Stripe.Checkout.Session) {
    if (sess.subscription == null) {
      return null
    }

    // If the 'subscription' field is expanded when retrieving a
    // checkout session, then this code will never execute and an
    // additional API call will not be made
    if (typeof sess.subscription === "string") {
      return await this.client.subscriptions.retrieve(sess.subscription)
    }

    return sess.subscription
  }

  public async extractStripeCustomer(sess: Stripe.Checkout.Session) {
    if (sess.customer == null) {
      return null
    }

    // If the 'customer' field is expanded when retrieving a
    // checkout session, then this code will never execute and an
    // additional API call will not be made
    if (typeof sess.customer === "string") {
      return await this.client.customers.retrieve(sess.customer)
    }

    return sess.customer
  }
}
