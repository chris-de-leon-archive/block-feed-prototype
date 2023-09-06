import { Context } from "./create-context"
import { OpenApiMeta } from "trpc-openapi"
import { initTRPC } from "@trpc/server"

export const createTRPC = () => {
  return initTRPC.meta<OpenApiMeta>().context<Context>().create()
}
