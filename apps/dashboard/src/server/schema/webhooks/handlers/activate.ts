import { constants } from "@block-feed/dashboard/utils/constants"
import { gqlInternalServerError } from "../../../graphql/errors"
import { GraphQLAuthContext } from "../../../graphql/types"
import { and, eq, inArray } from "drizzle-orm"
import * as schema from "@block-feed/node-db"
import { z } from "zod"

export const zInput = z.object({
  ids: z
    .array(z.string().uuid())
    .min(constants.webhooks.limits.MAX_UUIDS.MIN)
    .max(constants.webhooks.limits.MAX_UUIDS.MAX),
})

export const handler = async (
  args: z.infer<typeof zInput>,
  ctx: GraphQLAuthContext,
) => {
  // Exits early if no ids were passed in
  if (args.ids.length === 0) {
    return { count: 0 }
  }

  // Gets the webhooks and their corresponding redis cluster connection info
  const results = await ctx.providers.mysql.drizzle.query.webhook.findMany({
    where: and(
      eq(schema.webhook.customerId, ctx.clerk.user.id),
      eq(schema.webhook.isActive, 0),
      inArray(schema.webhook.id, args.ids),
    ),
    with: {
      blockchain: true,
    },
  })

  // Exits early if no data was retrieved
  if (results.length === 0) {
    return { count: 0 }
  }

  // Groups the webhooks into a nested map: Redis Cluster URL -> Shard ID -> Webhook IDs
  const clusterMap = new Map<string, Map<number, string[]>>()
  results.forEach((result) => {
    const shards = clusterMap.get(result.blockchain.redisClusterUrl)
    if (shards == null) {
      clusterMap.set(
        result.blockchain.redisClusterUrl,
        new Map([[result.shardId, [result.id]]]),
      )
    } else {
      const webhookIds = shards.get(result.shardId)
      if (webhookIds == null) {
        shards.set(result.shardId, [result.id])
      } else {
        shards.set(result.shardId, webhookIds.concat(result.id))
      }
    }
  })

  // Collects all promises into an array
  const promises = Array.from(Array.from(clusterMap.entries()))
    .map(([url, shards]) => {
      const redisClusterProvider = ctx.caches.redisClusterConn.getOrSet(url, {
        REDIS_CLUSTER_URL: url,
      })

      return Array.from(shards.entries()).map(async ([shardId, webhookIds]) => {
        // NOTE: these key names are case sensitive and should
        // match the names in the Go backend
        //
        // TODO: it may be better to add these to a single configuration
        // file that is read by both the Go code and the Typescript code
        // instead of hardcoding it in two places
        await redisClusterProvider.client.activate(
          `block-feed:{s${shardId}}:webhook-set`,
          `block-feed:{s${shardId}}:pending-set`,
          ...webhookIds,
        )

        // TODO: if the request above succeeds but this query fails then
        // this will cause the dashboard to display a misleading status
        await ctx.providers.mysql.drizzle
          .update(schema.webhook)
          .set({ isActive: 1 })
          .where(
            and(
              eq(schema.webhook.customerId, ctx.clerk.user.id),
              inArray(schema.webhook.id, webhookIds),
            ),
          )
      })
    })
    .flat()

  // Idempotently activates the webhooks
  await Promise.allSettled(promises).then((results) => {
    results.forEach((result) => {
      if (result.status === "rejected") {
        throw gqlInternalServerError(result.reason)
      }
    })
  })

  // Returns a successful response if no errors occurred
  return { count: 1 }
}
