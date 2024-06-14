import { StripeWebhookEventProducer } from "@block-feed/node-services-stripe-webhook-producer"
import { maxDirectivesPlugin } from "@escape.tech/graphql-armor-max-directives"
import { RedisCacheFactory, LruCacheFactory } from "@block-feed/node-caching"
import { maxAliasesPlugin } from "@escape.tech/graphql-armor-max-aliases"
import { maxTokensPlugin } from "@escape.tech/graphql-armor-max-tokens"
import { costLimitPlugin } from "@escape.tech/graphql-armor-cost-limit"
import { maxDepthPlugin } from "@escape.tech/graphql-armor-max-depth"
import { stripe } from "@block-feed/node-providers-stripe"
import { redis } from "@block-feed/node-providers-redis"
import { mysql } from "@block-feed/node-providers-mysql"
import { clerk } from "@block-feed/node-providers-clerk"
import { initContextCache } from "@pothos/core"
import { createYoga } from "graphql-yoga"
import { z } from "zod"
import {
  withStripeWebhookEventHandler,
  requireStripeSubscription,
  GraphQLContext,
  withClerkJWT,
  zStripeEnv,
  builder,
} from "@block-feed/dashboard/server"

const envvars = z
  .object({
    REDIS_STREAM_URL: z.string().url().min(1),
    REDIS_CACHE_URL: z.string().url().min(1),
    REDIS_CACHE_EXP_MS: z.coerce.number().min(1),
  })
  .and(zStripeEnv)
  .parse(process.env)

const stripeProvider = new stripe.Provider(stripe.zEnv.parse(process.env))

const clerkProvider = new clerk.Provider(clerk.zEnv.parse(process.env))

const dbProvider = new mysql.Provider(mysql.zEnv.parse(process.env))

const redisStreamProvider = new redis.Provider({
  REDIS_URL: envvars.REDIS_STREAM_URL,
})

const redisCacheProvider = new redis.Provider({
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
      providers: {
        stripe: stripeProvider,
        clerk: clerkProvider,
        mysql: dbProvider,
      },
      caches: {
        redisClusterConn: LruCacheFactory.createRedisClusterConnCache(),
        clerkUser: RedisCacheFactory.createClerkUsersCache(
          clerkProvider,
          redisCacheProvider,
          envvars.REDIS_CACHE_EXP_MS,
        ),
        stripeCheckoutSess: RedisCacheFactory.createCheckoutSessionCache(
          stripeProvider,
          redisCacheProvider,
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
      stripeProvider: stripeProvider,
      webhookSecret: envvars.STRIPE_WEBHOOK_SECRET,
      stripeProducer: new StripeWebhookEventProducer(
        stripeProvider,
        redisStreamProvider,
      ),
    }),

    // Verifies that each request has a valid JWT in the authorization header
    withClerkJWT({
      clerk: clerkProvider,
      db: dbProvider,
      cache: RedisCacheFactory.createClerkUsersCache(
        clerkProvider,
        redisCacheProvider,
      ),
    }),
  ],
})

export { handleRequest as OPTIONS, handleRequest as POST, handleRequest as GET }
