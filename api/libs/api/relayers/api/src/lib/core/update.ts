import { CONSTANTS, Context, OPERATIONS } from "./constants"
import { database } from "@api/shared/database"
import { trpc } from "@api/shared/trpc"
import { api } from "@api/api/core"
import { z } from "zod"

export const UpdateInput = z.object({
  id: z.string().uuid(),
  name: z
    .string()
    .min(CONSTANTS.NAME.LEN.MIN)
    .max(CONSTANTS.NAME.LEN.MAX)
    .optional(),
})

export const UpdateOutput = z.object({
  count: z.number().nullable(),
})

export const update = (t: ReturnType<typeof trpc.createTRPC<Context>>) =>
  t.procedure
    .meta({
      openapi: {
        method: OPERATIONS.UPDATE.METHOD,
        path: OPERATIONS.UPDATE.PATH,
        protect: true,
      },
    })
    .input(UpdateInput)
    .output(UpdateOutput)
    .use(t.middleware(api.middleware.requireAuth))
    .mutation(async (params) => {
      const result = await database.queries.relayers.update(
        params.ctx.database,
        {
          where: {
            id: params.input.id,
            userId: params.ctx.user.sub,
          },
          data: {
            name: params.input.name,
          },
        },
      )

      if (result == null) {
        return { count: 0 }
      }

      return { count: result[0].affectedRows }
    })
