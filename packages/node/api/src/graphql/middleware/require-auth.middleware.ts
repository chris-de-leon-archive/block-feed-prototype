import { DatabaseVendor, ClerkVendor, ClerkUser } from "@block-feed/vendors"
import { gqlUnauthorizedError } from "../errors"
import * as schema from "@block-feed/node-db"
import { User } from "@clerk/clerk-sdk-node"
import { AsyncCache } from "../../caching"
import * as jwt from "jsonwebtoken"

export type RequireAuthContext = Readonly<{
  cache: AsyncCache<User>
  clerk: ClerkVendor
  db: DatabaseVendor
  req: Request
}>

export const requireAuth = async (
  ctx: RequireAuthContext,
): Promise<ClerkUser> => {
  // Gets the authorization header values (headers.get(...) is case insensitive)
  const authorization = ctx.req.headers.get("authorization")
  if (authorization == null) {
    throw gqlUnauthorizedError("request is missing authorization header")
  }

  // Validates the header value
  if (authorization.match(/^bearer\s\S+$/g) == null) {
    throw gqlUnauthorizedError("authorization header is malformed")
  }

  // Extracts the JWT token
  const token = authorization.trim().split(" ").at(1)
  if (token == null) {
    throw gqlUnauthorizedError("authorization header has no token")
  }

  // NOTE: we need to do manual JWT verification bc this code is raising some strange errors related to undici: https://github.com/clerk/javascript/blob/7fca4a524b4e4e7e35305ec046dd51a0f09cd61c/packages/backend/src/tokens/clerkRequest.ts#L11
  //
  // Validates the JWT:
  //
  //  https://clerk.com/docs/references/backend/sessions/authenticate-request#example
  //
  // This is networkless since we pass in the JWT key:
  //
  //  https://clerk.com/docs/references/nodejs/token-verification#networkless-token-verification
  //
  // const result = await ctx.clerk.client.authenticateRequest(ctx.req, {
  //   secretKey: ctx.clerk.env.CLERK_SECRET_KEY,
  //   jwtKey: ctx.clerk.env.JWT_KEY,
  // })
  // if (!result.isSignedIn || result.token == null) {
  //   throw gqlUnauthorizedError(result.message)
  // }

  // Verifies the JWT: https://clerk.com/docs/backend-requests/handling/manual-jwt#example-usage
  const result = await new Promise<string | jwt.JwtPayload>((res, rej) => {
    jwt.verify(
      token,
      ctx.clerk.env.JWT_KEY,
      { algorithms: ["RS256"] },
      (err, decoded) => {
        if (err != null) {
          rej(err)
          return
        }
        if (decoded != null) {
          res(decoded)
          return
        }
        rej(new Error("could not verify JWT"))
      },
    )
  }).catch(() => {
    throw gqlUnauthorizedError("could not verify token")
  })

  // The JWT should be an object
  if (typeof result === "string") {
    throw gqlUnauthorizedError(
      `received unexpected string from JWT verification: ${result}`,
    )
  }

  // If the `sub` field is missing, throw an error
  const userId = result.sub
  if (userId == null) {
    throw gqlUnauthorizedError('JWT is missing "sub" field')
  }

  // Inserts the user in the database (or ignores if one already exists)
  const user = await ctx.cache.get(userId)
  if (user == null) {
    await ctx.db.drizzle.insert(schema.customer).ignore().values({ id: userId })
  }

  // Returns the auth info
  return {
    id: userId,
  }
}
