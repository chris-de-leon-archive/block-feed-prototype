"use server"

import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { GraphQLErrorCode } from "@block-feed/dashboard/utils/enums/graphql-error.enum"
import { doesObjectHaveKey } from "@block-feed/dashboard/utils/util"
import { constants } from "@block-feed/dashboard/utils/constants"
import { auth } from "@clerk/nextjs/server"
import { GraphQLError } from "graphql"
import { env } from "./env"

export type ErrorCallbacks = Readonly<{
  onInvalidSubscriptionError?: (err: GraphQLError) => void
  onNotSubscribedError?: (err: GraphQLError) => void
  onUnauthorizedError?: (err: GraphQLError) => void
  onError?: (err: Error) => void
}>

export const isGraphQLErrorCode = (
  err: GraphQLError,
  code: GraphQLErrorCode,
) => {
  const extensions = err.extensions
  return (
    extensions != null &&
    doesObjectHaveKey(extensions, "code") &&
    typeof extensions.code === "string" &&
    extensions.code === code
  )
}

export const defaultQueryRetryHandler = (failureCount: number, err: Error) => {
  if (failureCount >= constants.reactquery.MAX_QUERY_RETRIES) {
    return false
  }

  if (err instanceof GraphQLError) {
    if (isGraphQLErrorCode(err, GraphQLErrorCode.INVALID_SUBSCRIPTION_ERROR)) {
      return false
    }
    if (isGraphQLErrorCode(err, GraphQLErrorCode.NOT_SUBSCRIBED_ERROR)) {
      return false
    }
    if (isGraphQLErrorCode(err, GraphQLErrorCode.UNAUTHORIZED)) {
      return false
    }
  }

  return true
}

export const handleError = (err: Error, callbacks: ErrorCallbacks) => {
  if (err instanceof GraphQLError) {
    if (
      isGraphQLErrorCode(err, GraphQLErrorCode.INVALID_SUBSCRIPTION_ERROR) &&
      callbacks.onInvalidSubscriptionError != null
    ) {
      callbacks.onInvalidSubscriptionError(err)
      return
    }
    if (
      isGraphQLErrorCode(err, GraphQLErrorCode.NOT_SUBSCRIBED_ERROR) &&
      callbacks.onNotSubscribedError != null
    ) {
      callbacks.onNotSubscribedError(err)
      return
    }
    if (
      isGraphQLErrorCode(err, GraphQLErrorCode.UNAUTHORIZED) &&
      callbacks.onUnauthorizedError != null
    ) {
      callbacks.onUnauthorizedError(err)
      return
    }
  }

  if (callbacks.onError != null) {
    callbacks.onError(err)
    return
  }
}

export const handleDashboardError = (router: AppRouterInstance, err: Error) => {
  handleError(err, {
    onInvalidSubscriptionError: () => {
      // The user's subscription is invalid either because the
      // free trial is over, they failed to pay for usage, etc.
      // Let's redirect them to their customer portal.
      router.push(env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL)
    },
    onNotSubscribedError: () => {
      // The user hasn't signed up for a subscription to use the
      // service. Let's redirect them to the sign up page.
      router.push("/subscribe")
    },
    onUnauthorizedError: () => {
      // The user's access token could not be used to fetch their
      // profile info (this can happen if the user was deleted).
      // In this case, let's have them log in / sign up again.
      auth().redirectToSignIn()
    },
    onError: (err) => {
      // For any other type of error, redirect the user to an
      // error page.
      throw err
    },
  })
}
