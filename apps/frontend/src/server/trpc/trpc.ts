/**
 * This is the entry point to setup the root configuration for tRPC on the server.
 * - `initTRPC` should only be used once per app.
 * - We export only the functionality that we use so we can enforce which base procedures should be used
 *
 */
import { OpenApiMeta } from "trpc-openapi"
import { initTRPC } from "@trpc/server"
import { Context } from "./context"

export const t = initTRPC
  .context<Context>()
  .meta<OpenApiMeta>()
  .create({
    errorFormatter({ shape }) {
      return shape
    },
  })

export const router = t.router
