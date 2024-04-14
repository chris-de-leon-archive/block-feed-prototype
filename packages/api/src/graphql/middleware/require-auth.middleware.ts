import type { DatabaseVendor, ClerkVendor } from "@block-feed/vendors"
import { gqlUnauthorizedError } from "../errors"
import * as schema from "@block-feed/drizzle"

export type RequireAuthContext = Readonly<{
  clerk: ClerkVendor
  db: DatabaseVendor
  req: Request
}>

export const requireAuth = async (ctx: RequireAuthContext) => {
  // Gets the authorization header value
  const authorization =
    ctx.req.headers.get("authorization") ?? ctx.req.headers.get("Authorization")

  // Checks that the authorization header exists
  if (authorization == null) {
    throw gqlUnauthorizedError("request is missing authorization header")
  }

  // Checks that the authorization header is a string
  if (typeof authorization !== "string") {
    throw gqlUnauthorizedError(
      "authorization header cannot have multiple values",
    )
  }

  // Checks that the authorization header value starts with 'bearer' (case insensitive)
  const value = authorization.trim()
  if (!value.toLowerCase().startsWith("bearer")) {
    throw gqlUnauthorizedError(
      'authorization header value is missing "bearer" prefix',
    )
  }

  // Parses the authorization header
  const tokens = value.split(" ")
  if (tokens.at(tokens.length - 1) == null) {
    throw gqlUnauthorizedError("authorization header value is malformed")
  }

  // Validates the JWT:
  //
  //  https://clerk.com/docs/references/backend/sessions/authenticate-request#examples
  //
  // This is networkless since we pass in the JWT key:
  //
  //  https://clerk.com/docs/references/nodejs/token-verification#networkless-token-verification
  //
  const result = await ctx.clerk.client.authenticateRequest({
    request: ctx.req,
    secretKey: ctx.clerk.env.CLERK_SECRET_KEY,
    jwtKey: ctx.clerk.env.JWT_KEY,
  })
  if (!result.isSignedIn || result.token == null) {
    throw gqlUnauthorizedError(result.message)
  }

  // Inserts the user in the database (or ignores if one already exists)
  const auth = result.toAuth()
  await ctx.db.drizzle
    .insert(schema.customer)
    .ignore()
    .values({ id: auth.sessionClaims.sub })

  // Returns the auth info
  return auth
}
