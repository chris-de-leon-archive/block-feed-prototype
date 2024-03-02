import { db } from "@block-feed/server/vendor/database"
import { trpc } from "@block-feed/server/trpc"
import { constants } from "../constants"
import { TRPCError } from "@trpc/server"
import { z } from "zod"

const zInput = z.object({
  id: z.string().uuid(),
})

const zOutput = z.object({
  queued: z.boolean(),
})

export const name = "activate"

export const procedure = trpc.procedures.authedProcedure
  .meta({
    openapi: {
      method: "POST",
      path: `/${constants.NAMESPACE}/{id}/activate`,
      protect: true,
    },
  })
  .input(zInput)
  .output(zOutput)
  .mutation(async (params) => {
    // Queries the webhook data
    const webhook = await db.queries.webhooks.findOneWithRelations(
      params.ctx.inner.db.drizzle,
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
    await params.ctx.inner.redis.client.xadd(
      // NOTE: these fields are case sensitive and should
      // match the names configured in the Go backend
      params.ctx.inner.env.WEBHOOK_REDIS_STREAM_NAME,
      "*",
      "data",
      JSON.stringify({
        WebhookID: params.input.id,
      }),
    )

    // Returns a successful response if no errors occurred
    return { queued: true }
  })
