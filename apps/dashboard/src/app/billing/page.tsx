import { GraphQLErrorCode } from "@block-feed/node-shared"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { GraphQLError } from "graphql"
import {
  CreateBillingPortalSessionDocument,
  isGraphQLErrorCode,
  makeRequest,
} from "@block-feed/dashboard/client"

export default async function Billing() {
  const { getToken } = auth()

  const result = await makeRequest(
    CreateBillingPortalSessionDocument,
    {},
    await getToken(),
  )

  if (result instanceof GraphQLError) {
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
