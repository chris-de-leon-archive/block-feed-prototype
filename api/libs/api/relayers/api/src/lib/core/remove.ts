import { Context, OPERATIONS } from "./constants"
import { database } from "@api/shared/database"
import { trpc } from "@api/shared/trpc"
import { api } from "@api/api/core"
import { z } from "zod"

export const RemoveInput = z.object({
  id: z.string().uuid(),
})

export const RemoveOutput = z.object({
  count: z.number().nullable(),
})

export const remove = (t: ReturnType<typeof trpc.createTRPC<Context>>) =>
  t.procedure
    .meta({
      openapi: {
        method: OPERATIONS.REMOVE.METHOD,
        path: OPERATIONS.REMOVE.PATH,
        protect: true,
      },
    })
    .input(RemoveInput)
    .output(RemoveOutput)
    .use(t.middleware(api.middleware.requireAuth))
    .mutation(async (params) => {
      return await database.queries.relayers
        .remove(params.ctx.database, {
          where: {
            id: params.input.id,
          },
        })
        .then((result) => ({ count: result[0].affectedRows }))
    })
