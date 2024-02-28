import { Context, OPERATIONS } from "./constants"
import { db } from "@api/shared/database"
import { redis } from "@api/shared/redis"
import { TRPCError } from "@trpc/server"
import { trpc } from "@api/shared/trpc"
import { api } from "@api/api/core"
import { z } from "zod"

export const ActivateInput = z.object({
  id: z.string().uuid(),
})

export const ActivateOutput = z.object({
  queued: z.boolean(),
})

export const ActivateEnv = z.object({
  WEBHOOK_REDIS_STREAM_NAME: z.string().min(1),
})

export type ActivateContext = Context &
  Readonly<{
    redis: ReturnType<typeof redis.core.createClient>
    env: z.infer<typeof ActivateEnv>
  }>

export const activate = (
  t: ReturnType<typeof trpc.createTRPC<ActivateContext>>,
) =>
  t.procedure
    .meta({
      openapi: {
        method: OPERATIONS.ACTIVATE.METHOD,
        path: OPERATIONS.ACTIVATE.PATH,
        protect: true,
      },
    })
    .input(ActivateInput)
    .output(ActivateOutput)
    .use(t.middleware(api.middleware.requireAuth))
    .mutation(async (params) => {
      // Queries the webhook data
      const webhook = await db.queries.webhooks.findOneWithRelations(
        params.ctx.database.drizzle,
        {
          where: {
            customerId: params.ctx.user.sub,
            id: params.input.id,
          },
        },
      )

      // Makes sure the webhook exists
      if (webhook == null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "webhook does not exist",
        })
      }

      // Rejects the request if the webhook is already active
      if (webhook.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "webhook is already active",
        })
      }

      // Rejects the request if the webhook has been claimed but not assigned to a node yet
      if (webhook.webhookClaim != null && webhook.webhookLocation == null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "webhook is being provisioned - please wait",
        })
      }

      // Rejects the request if the webhook has been claimed and assigned to a node, but pending activation
      if (webhook.webhookClaim != null && webhook.webhookLocation != null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "webhook is being activated - please wait",
        })
      }

      // Forwards the request to the webhook load balancer
      await params.ctx.redis.client.xadd(
        // NOTE: these fields are case sensitive and should
        // match the names configured in the Go backend
        params.ctx.env.WEBHOOK_REDIS_STREAM_NAME,
        "*",
        "data",
        JSON.stringify({
          WebhookID: params.input.id,
        }),
      )

      // Returns a successful response if no errors occurred
      return { queued: true }
    })
