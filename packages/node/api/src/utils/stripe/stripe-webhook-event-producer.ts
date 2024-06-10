import { RedisVendor } from "@block-feed/vendors"
import { STRIPE_CONSTANTS } from "./constants"
import { Stripe } from "stripe"

export class StripeWebhookEventProducer {
  constructor(private readonly redisVendor: RedisVendor) {}

  async produce(event: Stripe.Event) {
    return await this.redisVendor.client.xadd(
      STRIPE_CONSTANTS.STREAMING.WEBHOOK_EVENT_STREAM_NAME,
      "*",
      STRIPE_CONSTANTS.STREAMING.EVENT_FIELD,
      JSON.stringify(event),
    )
  }
}
