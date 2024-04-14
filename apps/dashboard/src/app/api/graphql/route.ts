import { maxDirectivesPlugin } from "@escape.tech/graphql-armor-max-directives"
import { maxAliasesPlugin } from "@escape.tech/graphql-armor-max-aliases"
import { maxTokensPlugin } from "@escape.tech/graphql-armor-max-tokens"
import { costLimitPlugin } from "@escape.tech/graphql-armor-cost-limit"
import { maxDepthPlugin } from "@escape.tech/graphql-armor-max-depth"
import { stripe, redis, clerk, db } from "@block-feed/vendors"
import { initContextCache } from "@pothos/core"
import { createYoga } from "graphql-yoga"
import Stripe from "stripe"
import { z } from "zod"
import {
  STRIPE_CHECKOUT_SESSION_CACHE_KEY_PREFIX,
  withStripeWebhookEventHandler,
  requireStripeSubscription,
  handleStripeWebhookEvent,
  GraphQLContext,
  withClerkJWT,
  ApiCache,
  builder,
} from "@block-feed/api"

const envvars = z
  .object({
    CACHE_EXP_SEC: z.coerce.number().int().min(0),
  })
  .parse(process.env)

const redisWebhookLoadBalancerClient = redis.client.create(
  redis.client.zEnv.parse({
    ...process.env,
    REDIS_URL: process.env["REDIS_WEBHOOK_LB_URL"],
  }),
)

const redisCacheClient = redis.client.create(
  redis.client.zEnv.parse({
    ...process.env,
    REDIS_URL: process.env["REDIS_CACHE_URL"],
  }),
)

const stripeClient = stripe.client.create(stripe.client.zEnv.parse(process.env))

const clerkClient = clerk.client.create(clerk.client.zEnv.parse(process.env))

const dbClient = db.client.create(db.client.zEnv.parse(process.env))

const stripeCache = new ApiCache<Stripe.Response<Stripe.Checkout.Session>>(
  redisCacheClient,
  envvars.CACHE_EXP_SEC,
  STRIPE_CHECKOUT_SESSION_CACHE_KEY_PREFIX,
)

const { handleRequest } = createYoga({
  graphqlEndpoint: "/api/graphql",
  schema: builder.toSchema(),
  fetchAPI: { Response },
  context: async (ctx) =>
    ({
      // Adding this will prevent any issues if you server implementation copies
      // or extends the context object before passing it to your resolvers
      ...initContextCache(),
      env: envvars,
      yoga: ctx,
      vendor: {
        redisWebhookLB: redisWebhookLoadBalancerClient,
        stripe: stripeClient,
        clerk: clerkClient,
        db: dbClient,
      },
      caches: {
        stripe: stripeCache,
      },
      middlewares: {
        requireStripeSubscription,
      },
    }) satisfies GraphQLContext,
  plugins: [
    // Security plugins: https://the-guild.dev/graphql/yoga-server/docs/prepare-for-production#public-api
    maxDirectivesPlugin(),
    maxAliasesPlugin(),
    maxTokensPlugin(),
    costLimitPlugin(),
    maxDepthPlugin(),

    // Stripe webhook handler: https://docs.stripe.com/webhooks#webhooks-summary
    // This does not need to be protected via JWTs since it verifies the stripe signature header
    withStripeWebhookEventHandler({
      stripe: stripeClient,
      context: {
        stripe: stripeClient,
        cache: stripeCache,
        db: dbClient,
      },
      handler: handleStripeWebhookEvent,
    }),

    // Verifies that each request has a valid JWT in the authorization header.
    // If the JWT is valid, then we'll use it to retrieve the user's profile
    // data and attach it to the context.
    withClerkJWT({
      clerk: clerkClient,
      db: dbClient,
    }),
  ],
})

export { handleRequest as OPTIONS, handleRequest as POST, handleRequest as GET }
