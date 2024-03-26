import { gqlBadRequestError, gqlUnauthorizedError } from "../errors"
import * as schema from "@block-feed/drizzle"
import { UserInfoResponse } from "auth0"
import { Context } from "../types"
import { sql } from "drizzle-orm"

export const requireAuth = async (headers: Headers, ctx: Context) => {
  // Gets the authorization header value
  const authorization =
    headers.get("authorization") ?? headers.get("Authorization")

  // Checks that the authorization header exists
  if (authorization == null) {
    throw gqlBadRequestError("request is missing authorization header")
  }

  // Checks that the authorization header is a string
  if (typeof authorization !== "string") {
    throw gqlBadRequestError("authorization header cannot have multiple values")
  }

  // Checks that the authorization header value starts with 'bearer' (case insensitive)
  const value = authorization.trim()
  if (!value.toLowerCase().startsWith("bearer")) {
    throw gqlBadRequestError(
      'authorization header value is missing "bearer" prefix',
    )
  }

  // Parses the authorization header
  const tokens = value.split(" ")
  if (tokens.length <= 0) {
    throw gqlBadRequestError("authorization header value is malformed")
  }

  // Extracts the auth token
  const accessToken = tokens[tokens.length - 1]

  // Check the cache for the user's profile info
  const cached = await ctx.redisCache.client.get(accessToken)
  if (cached != null) {
    return JSON.parse(cached) as UserInfoResponse
  }

  // Uses the auth token to get the user profile info
  const profile = await ctx.auth.userInfo
    .getUserInfo(accessToken)
    .then(({ data }) => data)
    .catch(() => null)

  // If the access token is not valid, return an error
  // Otherwise cache the info for next time
  if (profile == null) {
    throw gqlUnauthorizedError("invalid access token")
  } else {
    await ctx.redisCache.client.setex(
      accessToken,
      ctx.env.REDIS_CACHE_EXP_SEC,
      JSON.stringify(profile),
    )
  }

  // Inserts the user (or ignores if one already exists)
  await ctx.db.drizzle
    .insert(schema.customer)
    .values({ id: profile.sub })
    .onDuplicateKeyUpdate({
      set: { id: sql`id` },
    })
    .execute()

  // Adds the auth0 profile info to the context
  return profile
}
