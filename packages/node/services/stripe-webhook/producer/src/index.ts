import { stripe } from "@block-feed/node-providers-stripe"
import { redis } from "@block-feed/node-providers-redis"
import { Stripe } from "stripe"

export class StripeWebhookEventProducer {
  constructor(
    private readonly stripeProvider: stripe.Provider,
    private readonly redisProvider: redis.Provider,
  ) {}

  async produce(event: Stripe.Event) {
    return await this.redisProvider.client.xadd(
      this.stripeProvider.constants.STREAMING.WEBHOOK_EVENT_STREAM_NAME,
      "*",
      this.stripeProvider.constants.STREAMING.EVENT_FIELD,
      JSON.stringify(event),
    )
  }
}
