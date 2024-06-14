import { GraphQLErrorCode } from "@block-feed/node-shared"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { GraphQLError } from "graphql"
import {
  CreateCheckoutSessionDocument,
  isGraphQLErrorCode,
  makeRequest,
} from "@block-feed/dashboard/client"

export default async function Subscribe() {
  // Gets the session
  const sess = auth()

  // Creates a checkout session
  const result = await makeRequest(
    CreateCheckoutSessionDocument,
    {},
    await sess.getToken(),
  )

  // Handles any API errors
  if (result instanceof GraphQLError) {
    // NOTE: we don't need to handle NOT_SUBSCRIBED or INVALID_SUBSCRIPTION
    // errors here since the user is currently in the process of subscribing
    if (isGraphQLErrorCode(result, GraphQLErrorCode.UNAUTHORIZED)) {
      sess.redirectToSignIn()
      return
    }
    throw result
  }

  // Redirects to the checkout session
  redirect(result.createCheckoutSession.url)
}
