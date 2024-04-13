import { GraphQLErrorCode } from "@block-feed/shared"
import { isGraphQLErrorCode } from "./client/errors"
import { ClientError } from "graphql-request"
import { graphql } from "./client/generated"
import { makeRequest } from "./client/edge"
import { NextResponse } from "next/server"
import {
  withMiddlewareAuthRequired,
  getSession,
} from "@auth0/nextjs-auth0/edge"

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}

// All middleware code here must be compatible with the edge runtime!
//
//  https://nextjs.org/docs/app/building-your-application/routing/middleware#runtime
//
export default withMiddlewareAuthRequired(async (req) => {
  if (req.nextUrl.pathname !== "/subscribe") {
    const response = NextResponse.next()
    const session = await getSession(req, response)
    const result = await makeRequest(
      graphql(
        "query StripeSubscription {\n  stripeSubscription {\n    id\n    status\n  }\n}",
      ),
      {},
      session?.accessToken,
    )

    if (result instanceof ClientError) {
      if (
        isGraphQLErrorCode(result, GraphQLErrorCode.INVALID_SUBSCRIPTION_ERROR)
      ) {
        return NextResponse.redirect(
          `${req.nextUrl.protocol}//${req.nextUrl.host}/subscribe`,
        )
      }
      if (isGraphQLErrorCode(result, GraphQLErrorCode.NOT_SUBSCRIBED_ERROR)) {
        return NextResponse.redirect(
          `${req.nextUrl.protocol}//${req.nextUrl.host}/subscribe`,
        )
      }
      if (isGraphQLErrorCode(result, GraphQLErrorCode.UNAUTHORIZED)) {
        return NextResponse.redirect(
          `${req.nextUrl.protocol}//${req.nextUrl.host}/api/auth/logout`,
        )
      }
      return Response.json(result, { status: 500 })
    }
  }
  return NextResponse.next()
})
