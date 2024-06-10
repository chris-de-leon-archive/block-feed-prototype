import { maxDirectivesPlugin } from "@escape.tech/graphql-armor-max-directives"
import { maxAliasesPlugin } from "@escape.tech/graphql-armor-max-aliases"
import { maxTokensPlugin } from "@escape.tech/graphql-armor-max-tokens"
import { costLimitPlugin } from "@escape.tech/graphql-armor-cost-limit"
import { maxDepthPlugin } from "@escape.tech/graphql-armor-max-depth"
import { stripe, redis, clerk, db } from "@block-feed/node-vendors"
import { initContextCache } from "@pothos/core"
import { createYoga } from "graphql-yoga"
import { z } from "zod"
import {
  withStripeWebhookEventHandler,
  StripeWebhookEventProducer,
  requireStripeSubscription,
  RedisCacheFactory,
  LruCacheFactory,
  GraphQLContext,
  withClerkJWT,
  zStripeEnv,
  builder,
} from "@block-feed/node-api"

const envvars = z
  .object({
    REDIS_STREAM_URL: z.string().url().min(1),
    REDIS_CACHE_URL: z.string().url().min(1),
    REDIS_CACHE_EXP_MS: z.coerce.number().min(1),
  })
  .and(zStripeEnv)
  .parse(process.env)

const stripeVendor = stripe.client.create(stripe.client.zEnv.parse(process.env))

const clerkVendor = clerk.client.create(clerk.client.zEnv.parse(process.env))

const dbVendor = db.client.create(db.client.zEnv.parse(process.env))

const redisStreamVendor = redis.client.create({
  REDIS_URL: envvars.REDIS_STREAM_URL,
})

const redisCacheVendor = redis.client.create({
  REDIS_URL: envvars.REDIS_CACHE_URL,
})

const { handleRequest } = createYoga({
  graphqlEndpoint: "/api/graphql",
  schema: builder.toSchema(),
  fetchAPI: { Response },
  context: async (ctx) =>
    ({
      // Adding this will prevent any issues if you server implementation copies
      // or extends the context object before passing it to your resolvers
      ...initContextCache(),
      yoga: ctx,
      vendor: {
        stripe: stripeVendor,
        clerk: clerkVendor,
        db: dbVendor,
      },
      caches: {
        redisClusterConn: LruCacheFactory.createRedisClusterConnCache(),
        clerkUser: RedisCacheFactory.createClerkUsersCache(
          clerkVendor,
          redisCacheVendor,
          envvars.REDIS_CACHE_EXP_MS,
        ),
        stripeCheckoutSess: RedisCacheFactory.createCheckoutSessionCache(
          stripeVendor,
          redisCacheVendor,
          envvars.REDIS_CACHE_EXP_MS,
        ),
      },
      middlewares: {
        requireStripeSubscription,
      },
      env: {
        stripe: envvars,
      },
    }) satisfies GraphQLContext,
  plugins: [
    // Security plugins: https://the-guild.dev/graphql/yoga-server/docs/prepare-for-production#public-api
    maxDirectivesPlugin(),
    maxAliasesPlugin(),
    maxTokensPlugin(),
    costLimitPlugin(),
    maxDepthPlugin(),

    // Stripe webhook event handler: https://docs.stripe.com/webhooks#webhooks-summary
    // This does not need to be protected via JWTs since it verifies the stripe signature header
    withStripeWebhookEventHandler({
      stripeProducer: new StripeWebhookEventProducer(redisStreamVendor),
      stripeVendor: stripeVendor,
      webhookSecret: envvars.STRIPE_WEBHOOK_SECRET,
    }),

    // Verifies that each request has a valid JWT in the authorization header
    withClerkJWT({
      clerk: clerkVendor,
      db: dbVendor,
      cache: RedisCacheFactory.createClerkUsersCache(
        clerkVendor,
        redisCacheVendor,
      ),
    }),
  ],
})

export { handleRequest as OPTIONS, handleRequest as POST, handleRequest as GET }
