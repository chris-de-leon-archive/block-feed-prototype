import { AuthContext } from "@block-feed/server/graphql/types"
import { and, eq, inArray, notInArray } from "drizzle-orm"
import { constants } from "@block-feed/shared/constants"
import * as schema from "@block-feed/drizzle"
import { z } from "zod"

export const zInput = z.object({
  ids: z
    .array(z.string().uuid())
    .min(constants.webhooks.limits.MAX_UUIDS.MIN)
    .max(constants.webhooks.limits.MAX_UUIDS.MAX),
})

export const handler = async (
  args: z.infer<typeof zInput>,
  ctx: AuthContext,
) => {
  // Exits early if no IDs were passed in
  if (args.ids.length === 0) {
    return { count: 0 }
  }

  // Gets all webhooks that:
  //
  //  1. belong to the user making the request
  //  2. have an ID that exists in the list of input ids
  //  3. are not active
  //  4. have not been queued already
  //
  const candidates = ctx.db.drizzle.$with("candidates").as(
    ctx.db.drizzle
      .select()
      .from(schema.webhook)
      .where(
        and(
          eq(schema.webhook.customerId, ctx.user.sub),
          inArray(schema.webhook.id, args.ids),
          eq(schema.webhook.isActive, 0),
          eq(schema.webhook.isQueued, 0),
        ),
      ),
  )

  // Removes any candidate webhooks that have already been claimed or assigned to a node
  const webhooks = await ctx.db.drizzle
    .with(candidates)
    .select()
    .from(candidates)
    .where(
      and(
        notInArray(
          candidates.id,
          ctx.db.drizzle
            .selectDistinct({ webhookId: schema.webhookClaim.webhookId })
            .from(schema.webhookClaim),
        ),
        notInArray(
          candidates.id,
          ctx.db.drizzle
            .selectDistinct({ webhookId: schema.webhookLocation.webhookId })
            .from(schema.webhookLocation),
        ),
      ),
    )
    .execute()

  // Exits early if no webhooks remain after filtering
  if (webhooks.length === 0) {
    return { count: 0 }
  }

  // Forwards the request to the webhook load balancer
  await ctx.redisWebhookLB.client.xaddbatch(
    // NOTE: these fields are case sensitive and should match the names configured in the Go backend
    ctx.env.REDIS_WEBHOOK_STREAM_NAME,
    "data",
    ...args.ids.map((id) => JSON.stringify({ WebhookID: id })),
  )

  // Webhook activation is asynchronous so the `is_active` field might not be set to true immediately
  // after this request completes. As a result, the frontend cannot rely on the `is_active` field alone
  // to determine whether the activate button has already been clicked by the user. Thus, we need a way
  // to indicate that the webhook is in the process of being activated so that the activate is not shown
  // again after it has been pressed once. For this we use the `is_queued` field (which is purely meant
  // for frontend rendering purposes and has no meaning on the backend side). It is trivially set to true
  // after the job has been sent to redis.
  await ctx.db.drizzle
    .update(schema.webhook)
    .set({ isQueued: 1 })
    .where(
      and(
        eq(schema.webhook.customerId, ctx.user.sub),
        inArray(schema.webhook.id, args.ids),
      ),
    )

  // Returns a successful response if no errors occurred
  return { count: webhooks.length }
}
