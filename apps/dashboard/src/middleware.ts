import { authMiddleware, redirectToSignIn } from "@clerk/nextjs"
import { GraphQLErrorCode } from "@block-feed/shared"
import { isGraphQLErrorCode } from "./client/errors"
import { ClientError } from "graphql-request"
import { graphql } from "./client/generated"
import { makeRequest } from "./client/edge"
import { NextResponse } from "next/server"

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
export default authMiddleware({
  afterAuth: async (auth, req) => {
    // Handle unauthenticated users
    if (auth.userId == null) {
      return redirectToSignIn({ returnBackUrl: req.url })
    }

    // If the user is not on the subscribe page, check their subscription status
    if (req.nextUrl.pathname !== "/subscribe") {
      const result = await makeRequest(
        graphql(
          "query StripeSubscription {\n  stripeSubscription {\n    id\n    status\n  }\n}",
        ),
        {},
        await auth.getToken(),
      )

      if (result instanceof ClientError) {
        if (
          isGraphQLErrorCode(
            result,
            GraphQLErrorCode.INVALID_SUBSCRIPTION_ERROR,
          )
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
          return redirectToSignIn({ returnBackUrl: req.url })
        }
        return Response.json(result, { status: 500 })
      }
    }

    // Allow users to view the page if they are authenticated and subscribed
    return NextResponse.next()
  },
})
