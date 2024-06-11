import { StripeWebhookEventConsumer } from "@block-feed/node-services-stripe-webhook-consumer"
import { RedisCacheFactory } from "@block-feed/node-caching"
import { stripe } from "@block-feed/node-providers-stripe"
import { redis } from "@block-feed/node-providers-redis"
import { mysql } from "@block-feed/node-providers-mysql"
import { z } from "zod"

async function main() {
  const envvars = z
    .object({
      STRIPE_WEBHOOK_EVENT_WORKER_CONSUMER_GROUP_NAME: z.string().min(1),
      STRIPE_WEBHOOK_EVENT_WORKER_CONSUMER_NAME: z.string().min(1),
      REDIS_STREAM_URL: z.string().url().min(1),
      REDIS_CACHE_URL: z.string().url().min(1),
    })
    .parse(process.env)

  const stripeProvider = new stripe.Provider(stripe.zEnv.parse(process.env))

  const dbProvider = new mysql.Provider(mysql.zEnv.parse(process.env))

  const redisStreamProvider = new redis.Provider({
    REDIS_URL: envvars.REDIS_STREAM_URL,
  })

  const redisCacheProvider = new redis.Provider({
    REDIS_URL: envvars.REDIS_CACHE_URL,
  })

  const consumer = await StripeWebhookEventConsumer.build(
    RedisCacheFactory.createCheckoutSessionCache(
      stripeProvider,
      redisCacheProvider,
    ),
    stripeProvider,
    redisStreamProvider,
    dbProvider,
    envvars.STRIPE_WEBHOOK_EVENT_WORKER_CONSUMER_GROUP_NAME,
    envvars.STRIPE_WEBHOOK_EVENT_WORKER_CONSUMER_NAME,
  )

  const controller = new AbortController()
  process.on("SIGTERM", () => {
    controller.abort()
    process.exit()
  })
  process.on("SIGINT", () => {
    controller.abort()
    process.exit()
  })
  process.on("exit", () => {
    controller.abort()
  })

  console.log("Ready to consume messages\n")
  for await (const events of consumer.consume(controller, 1000)) {
    console.log(
      JSON.stringify(
        events,
        (_, v) => (v instanceof Error ? v.message : v),
        2,
      ).concat("\n"),
    )
  }
}

main()
