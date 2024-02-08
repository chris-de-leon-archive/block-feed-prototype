import { CONSTANTS, Context, OPERATIONS } from "./constants"
import { database } from "@api/shared/database"
import { TRPCError } from "@trpc/server"
import { trpc } from "@api/shared/trpc"
import { api } from "@api/api/core"
import { z } from "zod"

export const CreateInput = z.object({
  url: z.string().url(),
  maxBlocks: z
    .number()
    .int()
    .min(CONSTANTS.MAX_BLOCKS.MIN)
    .max(CONSTANTS.MAX_BLOCKS.MAX),
  maxRetries: z
    .number()
    .int()
    .min(CONSTANTS.MAX_RETRIES.MIN)
    .max(CONSTANTS.MAX_BLOCKS.MAX),
  timeoutMs: z
    .number()
    .int()
    .min(CONSTANTS.TIMEOUT_MS.MIN)
    .max(CONSTANTS.TIMEOUT_MS.MAX),
  blockchainId: z
    .string()
    .min(CONSTANTS.BLOCKCHAIN_ID.MIN)
    .max(CONSTANTS.BLOCKCHAIN_ID.MAX),
})

export const CreateOutput = z.object({
  id: z.string().nullable(),
})

export const create = (t: ReturnType<typeof trpc.createTRPC<Context>>) =>
  t.procedure
    .meta({
      openapi: {
        method: OPERATIONS.CREATE.METHOD,
        path: OPERATIONS.CREATE.PATH,
        protect: true,
      },
    })
    .input(CreateInput)
    .output(CreateOutput)
    .use(t.middleware(api.middleware.requireAuth))
    .mutation(async (params) => {
      const blockchainExists = await database.queries.blockchains.findOne(
        params.ctx.database.drizzle,
        {
          where: {
            id: params.input.blockchainId,
          },
        },
      )
      if (blockchainExists == null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `invalid blockchain ID "${params.input.blockchainId}"`,
        })
      }

      // TODO: cache clean up may cause no blocks to be found
      // for a particular chain. We may want to leave at least
      // the latest block  in the cache in these scenarios
      const latestCachedBlock =
        await database.queries.blockCache.findLatestBlock(
          params.ctx.database.drizzle,
          {
            where: {
              blockchainId: params.input.blockchainId,
            },
          },
        )
      if (latestCachedBlock == null) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "blockchain is not available",
        })
      }

      return await params.ctx.database.drizzle.transaction(async (tx) => {
        const webhook = await database.queries.webhooks.create(tx, {
          data: {
            url: params.input.url,
            maxBlocks: params.input.maxBlocks,
            maxRetries: params.input.maxRetries,
            timeoutMs: params.input.timeoutMs,
            customerId: params.ctx.user.sub,
            blockchainId: params.input.blockchainId,
          },
        })

        if (webhook.id == null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "failed to create webhook",
          })
        }

        const webhookJob = await database.queries.webhookJob.create(tx, {
          data: {
            blockHeight: latestCachedBlock.blockHeight,
            webhookId: webhook.id,
          },
        })

        if (webhookJob.data === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "failed to activate webhook",
          })
        }

        return { id: webhook.id }
      })
    })
