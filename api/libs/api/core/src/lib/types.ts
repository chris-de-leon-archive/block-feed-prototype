import { trpc } from "@api/shared/trpc"

export type MiddlewareOpts<T extends Record<string, unknown>> = Parameters<
  Parameters<ReturnType<typeof trpc.createTRPC<T>>["middleware"]>[number]
>[number]
