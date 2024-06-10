import {
  StripeWebhookEventConsumer,
  RedisCacheFactory,
} from "@block-feed/node-api"
import { db, redis, stripe } from "@block-feed/node-vendors"
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

  const dbVendor = db.client.create(db.client.zEnv.parse(process.env))

  const redisStreamVendor = redis.client.create({
    REDIS_URL: envvars.REDIS_STREAM_URL,
  })

  const redisCacheVendor = redis.client.create({
    REDIS_URL: envvars.REDIS_CACHE_URL,
  })

  const stripeVendor = stripe.client.create(
    stripe.client.zEnv.parse(process.env),
  )

  const consumer = await StripeWebhookEventConsumer.build(
    RedisCacheFactory.createCheckoutSessionCache(
      stripeVendor,
      redisCacheVendor,
    ),
    stripeVendor,
    redisStreamVendor,
    dbVendor,
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
