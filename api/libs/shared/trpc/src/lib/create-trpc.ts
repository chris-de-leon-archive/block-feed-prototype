import { createContext } from "./create-context"
import { OpenApiMeta } from "trpc-openapi"
import { initTRPC } from "@trpc/server"

export const createTRPC = <T extends Record<string, unknown>>() => {
  return initTRPC
    .meta<OpenApiMeta>()
    .context<ReturnType<typeof createContext<T>>>()
    .create()
}
