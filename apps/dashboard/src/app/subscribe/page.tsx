import { isGraphQLErrorCode } from "@block-feed/dashboard/client/errors"
import { graphql } from "@block-feed/dashboard/client/generated"
import { makeRequest } from "@block-feed/dashboard/client/node"
import { GraphQLErrorCode } from "@block-feed/shared"
import { getSession } from "@auth0/nextjs-auth0"
import { ClientError } from "graphql-request"
import { redirect } from "next/navigation"

export default async function Subscribe() {
  // Gets the session
  const session = await getSession()

  // Creates a checkout session
  const result = await makeRequest(
    graphql(
      "mutation CreateCheckoutSession {\n  createCheckoutSession {\n    url\n  }\n}",
    ),
    {},
    session?.accessToken,
  )

  // Handles any API errors
  if (result instanceof ClientError) {
    // NOTE: we don't need to handle NOT_SUBSCRIBED or INVALID_SUBSCRIPTION
    // errors here since the user is currently in the process of subscribing
    if (isGraphQLErrorCode(result, GraphQLErrorCode.UNAUTHORIZED)) {
      redirect("http://localhost:3000/api/auth/logout")
    }
    throw result
  }

  // Redirects to the checkout session
  redirect(result.createCheckoutSession.url)
}
