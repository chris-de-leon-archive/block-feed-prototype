import { OpenApiMeta } from "trpc-openapi"
import { Context } from "./create-context"
import { initTRPC } from "@trpc/server"

export const createTRPC = <T extends object>() => {
  return initTRPC.meta<OpenApiMeta>().context<Context<T>>().create()
}
