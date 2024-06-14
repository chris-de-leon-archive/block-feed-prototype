import { GraphQLErrorCode } from "@block-feed/node-shared"
import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { GraphQLError } from "graphql"
import {
  StripeSubscriptionDocument,
  isGraphQLErrorCode,
  makeRequest,
} from "./client"

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
export default clerkMiddleware(
  async (auth, req) => {
    // Gets the session info
    const sess = auth()

    // Handle unauthenticated users
    if (sess.userId == null) {
      return sess.redirectToSignIn({ returnBackUrl: req.url })
    }

    // If the user is not on the subscribe page, check their subscription status
    if (req.nextUrl.pathname !== "/subscribe") {
      const res = await makeRequest(
        StripeSubscriptionDocument,
        {},
        await sess.getToken(),
      )

      if (res instanceof GraphQLError) {
        const subscribeUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}/subscribe`
        if (
          isGraphQLErrorCode(res, GraphQLErrorCode.INVALID_SUBSCRIPTION_ERROR)
        ) {
          return NextResponse.redirect(subscribeUrl)
        }
        if (isGraphQLErrorCode(res, GraphQLErrorCode.NOT_SUBSCRIBED_ERROR)) {
          return NextResponse.redirect(subscribeUrl)
        }
        if (isGraphQLErrorCode(res, GraphQLErrorCode.UNAUTHORIZED)) {
          console.log("redirect")
          return sess.redirectToSignIn({ returnBackUrl: req.url })
        }
        return Response.json(res, { status: 500 })
      }
    }

    // Allow users to view the page if they are authenticated and subscribed
    return NextResponse.next()
  },
  { debug: process.env.NODE_ENV !== "production" },
)
