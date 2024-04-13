import { isGraphQLErrorCode } from "@block-feed/dashboard/client/errors"
import { graphql } from "@block-feed/dashboard/client/generated"
import { makeRequest } from "@block-feed/dashboard/client/node"
import { GraphQLErrorCode } from "@block-feed/shared"
import { getSession } from "@auth0/nextjs-auth0"
import { ClientError } from "graphql-request"
import { redirect } from "next/navigation"

export default async function Billing() {
  const session = await getSession()

  const result = await makeRequest(
    graphql(
      "mutation CreateBillingPortalSession {\n  createBillingPortalSession {\n    url\n  }\n}",
    ),
    {},
    session?.accessToken,
  )

  if (result instanceof ClientError) {
    if (
      isGraphQLErrorCode(result, GraphQLErrorCode.INVALID_SUBSCRIPTION_ERROR)
    ) {
      redirect("/subscribe")
    }
    if (isGraphQLErrorCode(result, GraphQLErrorCode.NOT_SUBSCRIBED_ERROR)) {
      redirect("/subscribe")
    }
    if (isGraphQLErrorCode(result, GraphQLErrorCode.UNAUTHORIZED)) {
      redirect("/api/auth/logout")
    }
    throw result
  }

  redirect(result.createBillingPortalSession.url)
}
