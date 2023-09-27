import { TAuth0Ctx, TDatabaseCtx } from "../types"
import { database } from "@api/shared/database"
import { createTRPC } from "../create-trpc"
import { TRPCError } from "@trpc/server"
import { sql } from "drizzle-orm"

export const requireAuth = (
  t: ReturnType<typeof createTRPC<TAuth0Ctx & TDatabaseCtx>>
) => {
  return t.middleware(async (opts) => {
    // Gets the authorization header value
    const authorization =
      opts.ctx.event.headers["authorization"] ??
      opts.ctx.event.headers["Authorization"]

    // Checks that the authorization header exists
    if (authorization == null) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "request is missing authorization header",
      })
    }

    // Checks that the authorization header value starts with 'bearer' (case insensitive)
    const value = authorization.trim()
    if (!value.toLowerCase().startsWith("bearer")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: 'authorization header value is missing "bearer" prefix',
      })
    }

    // Parses the authorization header
    const tokens = value.split(" ")
    if (tokens.length <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "authorization header value is malformed",
      })
    }

    // Extracts the auth token
    const accessToken = tokens[tokens.length - 1]

    // Uses the auth token to get the user profile info
    const profile = await opts.ctx.auth0.userInfo
      .getUserInfo(accessToken)
      .then(({ data }) => data)
      .catch((err) => {
        if (process.env["NODE_ENV"] !== "production") {
          console.log(err)
        }
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "invalid access token",
        })
      })

    // Prepare insert parameters
    const inputs = {
      placeholders: {
        id: sql.placeholder(database.schema.users.id.name),
      },
      values: {
        [database.schema.users.id.name]: profile.sub,
      },
    }

    // Prepare insert query
    const query = opts.ctx.database
      .insert(database.schema.users)
      .values({ id: inputs.placeholders.id })
      .onConflictDoNothing()

    // Execute the query
    await query
      .prepare(database.core.getPreparedStmtName(query.toSQL().sql))
      .execute(inputs.values)

    // Adds the profile info to the context
    return opts.next({
      ctx: {
        user: profile,
      },
    })
  })
}
