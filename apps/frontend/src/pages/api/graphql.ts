import { builder } from "@block-feed/server/graphql/builder"
import { Context } from "@block-feed/server/graphql/types"
import { redis } from "@block-feed/server/vendor/redis"
import { db } from "@block-feed/server/vendor/database"
import { auth } from "@block-feed/server/vendor/auth0"
import { NextApiRequest, NextApiResponse } from "next"
import { initContextCache } from "@pothos/core"
import { createYoga } from "graphql-yoga"
import { z } from "zod"

import "@block-feed/server/api"

const redisWebhookLoadBalancerClient = redis.client.create({
  REDIS_URL: process.env["REDIS_WEBHOOK_LB_URL"],
})

const redisCacheClient = redis.client.create({
  REDIS_URL: process.env["REDIS_CACHE_URL"],
})

const auth0Client = auth.client.create(auth.client.zEnv.parse(process.env))

const dbClient = db.client.create(db.client.zEnv.parse(process.env))

const envvars = z
  .object({
    REDIS_WEBHOOK_STREAM_NAME: z.string().min(1),
    REDIS_CACHE_EXP_SEC: z.coerce.number().int().min(0),
  })
  .parse(process.env)

export default createYoga<{
  req: NextApiRequest
  res: NextApiResponse
}>({
  graphqlEndpoint: "/api/graphql",
  schema: builder.toSchema(),
  context: async (ctx) =>
    ({
      // Adding this will prevent any issues if you server implementation copies
      // or extends the context object before passing it to your resolvers
      ...initContextCache(),
      redisWebhookLB: redisWebhookLoadBalancerClient,
      redisCache: redisCacheClient,
      auth: auth0Client,
      db: dbClient,
      env: envvars,
      yoga: {
        request: ctx.request,
        params: ctx.params,
      },
    }) satisfies Context,
})
