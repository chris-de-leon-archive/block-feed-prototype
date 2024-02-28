import { Context, OPERATIONS } from "./constants"
import { createSelectSchema } from "drizzle-zod"
import { db } from "@api/shared/database"
import { TRPCError } from "@trpc/server"
import { trpc } from "@api/shared/trpc"
import { api } from "@api/api/core"
import { z } from "zod"

export const FindOneInput = z.object({
  id: z.string().uuid(),
})

export const FindOneOutput = createSelectSchema(db.schema.webhook)

export const findOne = (t: ReturnType<typeof trpc.createTRPC<Context>>) =>
  t.procedure
    .meta({
      openapi: {
        method: OPERATIONS.FIND_ONE.METHOD,
        path: OPERATIONS.FIND_ONE.PATH,
        protect: true,
      },
    })
    .input(FindOneInput)
    .output(FindOneOutput)
    .use(t.middleware(api.middleware.requireAuth))
    .query(async (params) => {
      const result = await db.queries.webhooks.findOne(
        params.ctx.database.drizzle,
        {
          where: {
            id: params.input.id,
            customerId: params.ctx.user.sub,
          },
        },
      )

      if (result == null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `record with id "${params.input.id}" does not exist`,
        })
      }

      return result
    })
