import { CONSTANTS, Context, OPERATIONS } from "./constants"
import { database } from "@api/shared/database"
import { TRPCError } from "@trpc/server"
import { trpc } from "@api/shared/trpc"
import { api } from "@api/api/core"
import { z } from "zod"

const relayerStaticOpts = {
  RELAYER_REDIS_CONNECTION_URL: true,
  RELAYER_REDIS_PREFIX: true,
} as const

const zRelayerHttpOpts = database.schema.zHttpOptions
  .omit(relayerStaticOpts)
  .partial()

const zRelayerSmtpOpts = database.schema.zSmtpOptions
  .omit(relayerStaticOpts)
  .partial()

export const CreateInput = z.object({
  name: z.string().min(CONSTANTS.NAME.LEN.MIN).max(CONSTANTS.NAME.LEN.MAX),
  transport: z.nativeEnum(database.schema.RelayerTransports),
  chain: z.nativeEnum(database.schema.Blockchains),
  options: zRelayerHttpOpts.or(zRelayerSmtpOpts),
})

export const CreateOutput = z.object({
  id: z.string().nullable(),
})

export const create = (t: ReturnType<typeof trpc.createTRPC<Context>>) => {
  return {
    [OPERATIONS.CREATE.NAME]: t.procedure
      .meta({
        openapi: {
          method: OPERATIONS.CREATE.METHOD,
          path: OPERATIONS.CREATE.PATH,
        },
      })
      .input(CreateInput)
      .output(CreateOutput)
      .use(api.middleware.requireAuth(t))
      .mutation(async (params) => {
        // TODO: make these configurable
        const staticOptions: Record<keyof typeof relayerStaticOpts, string> = {
          RELAYER_REDIS_CONNECTION_URL: "host.docker.internal:6379",
          RELAYER_REDIS_PREFIX: "relayer",
        }

        // Creates a map from each relayer transport method
        // to its corresponding zod parsing function
        const transportToValidation: Record<
          database.schema.RelayerTransports,
          () => z.SafeParseReturnType<
            object,
            z.infer<typeof database.schema.zRelayerOptions>
          >
        > = {
          [database.schema.RelayerTransports.HTTP]: () =>
            database.schema.zHttpOptions.safeParse({
              ...params.input.options,
              ...staticOptions,
            }),
          [database.schema.RelayerTransports.SMTP]: () =>
            database.schema.zSmtpOptions.safeParse({
              ...params.input.options,
              ...staticOptions,
            }),
        }

        // Validates the shape of the input options
        const relayerOptions = transportToValidation[params.input.transport]()
        if (!relayerOptions.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: relayerOptions.error.message,
            cause: relayerOptions.error.name,
          })
        }

        // TODO: call k8s API to spin up the relayer
        return await database.queries.relayers
          .create(params.ctx.database, {
            name: params.input.name,
            transport: params.input.transport,
            options: relayerOptions.data,
            chain: params.input.chain,
            userId: params.ctx.user.sub,
          })
          .then((result) => ({ id: result.id }))
      }),
  }
}
