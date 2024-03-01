import { db } from "@block-feed/server/vendor/database"
import { TRPCError } from "@trpc/server"
import { sql } from "drizzle-orm"
import { t } from "../trpc"

export const authedProcedure = t.procedure.use(
  async function requireAuth(opts) {
    // Gets the authorization header value
    const authorization =
      opts.ctx.req.headers["authorization"] ??
      opts.ctx.req.headers["Authorization"]

    // Checks that the authorization header exists
    if (authorization == null) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "request is missing authorization header",
      })
    }

    // Checks that the authorization header is a string
    if (typeof authorization !== "string") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "authorization header cannot have multiple values",
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
    // TODO: cache info somewhere?
    const profile = await opts.ctx.inner.auth.userInfo
      .getUserInfo(accessToken)
      .then(({ data }) => data)
      .catch(() => {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "invalid access token",
        })
      })

    // Prepares insert parameters
    const inputs = {
      placeholders: {
        id: sql.placeholder(db.schema.customer.id.name),
      },
      values: {
        [db.schema.customer.id.name]: profile.sub,
      },
    }

    // Inserts the user (or ignores if one already exists)
    await opts.ctx.inner.db.drizzle
      .insert(db.schema.customer)
      .values({ id: inputs.placeholders.id })
      .onDuplicateKeyUpdate({
        set: { id: sql`id` },
      })
      .prepare()
      .execute(inputs.values)

    // Adds the auth0 profile info to the context
    return opts.next({
      ctx: { user: profile },
    })
  },
)
