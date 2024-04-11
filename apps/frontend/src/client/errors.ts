import { GraphQLErrorCode } from "@block-feed/shared/enums/graphql-error.enum"
import { AccessTokenError, AccessTokenErrorCode } from "@auth0/nextjs-auth0"
import { doesObjectHaveKey } from "@block-feed/shared/utils"
import { constants } from "@block-feed/shared/constants"
import { ClientError } from "graphql-request"
import * as client from "@block-feed/client"
import { NextRouter } from "next/router"

export type ErrorCallbacks = Readonly<{
  onExpiredAccessTokenError?: (err: AccessTokenError) => void
  onInvalidSubscriptionError?: (err: ClientError) => void
  onNotSubscribedError?: (err: ClientError) => void
  onUnauthorizedError?: (err: ClientError) => void
  onError?: (err: Error) => void
}>

export const isGraphQLError = (
  err: Error,
  code: GraphQLErrorCode,
): err is ClientError => {
  if (!(err instanceof ClientError)) {
    return false
  }

  const extensions = err.response.errors?.at(0)?.extensions
  return (
    extensions != null &&
    doesObjectHaveKey(extensions, "code") &&
    typeof extensions.code === "string" &&
    extensions.code === code
  )
}

export const isAccessTokenError = (
  err: Error,
  code: AccessTokenErrorCode,
): err is AccessTokenError => {
  if (!(err instanceof AccessTokenError)) {
    return false
  }
  return err.code === code
}

export const handleError = (err: Error, callbacks: ErrorCallbacks) => {
  if (
    isAccessTokenError(err, AccessTokenErrorCode.EXPIRED_ACCESS_TOKEN) &&
    callbacks.onExpiredAccessTokenError != null
  ) {
    callbacks.onExpiredAccessTokenError(err)
    return
  }

  if (
    isGraphQLError(err, GraphQLErrorCode.UNAUTHORIZED) &&
    callbacks.onUnauthorizedError != null
  ) {
    callbacks.onUnauthorizedError(err)
    return
  }

  if (
    isGraphQLError(err, GraphQLErrorCode.INVALID_SUBSCRIPTION_ERROR) &&
    callbacks.onInvalidSubscriptionError != null
  ) {
    callbacks.onInvalidSubscriptionError(err)
    return
  }

  if (
    isGraphQLError(err, GraphQLErrorCode.NOT_SUBSCRIBED_ERROR) &&
    callbacks.onNotSubscribedError != null
  ) {
    callbacks.onNotSubscribedError(err)
    return
  }

  if (callbacks.onError != null) {
    callbacks.onError(err)
    return
  }
}

export const handleDashboardError = (router: NextRouter, err: Error) => {
  handleError(err, {
    onExpiredAccessTokenError: () => {
      // The user's access token has expired - let's have them
      // log in again so they get another token.
      router.push("/api/auth/login?returnTo=/dashboard")
    },
    onInvalidSubscriptionError: () => {
      // The user's subscription is invalid either because the
      // free trial is over, they failed to pay for usage, etc.
      // Let's redirect them to their customer portal.
      router.push(client.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL)
    },
    onNotSubscribedError: () => {
      // The user hasn't signed up for a subscription to use the
      // service. Let's redirect them to the sign up page.
      router.push("/subscribe")
    },
    onUnauthorizedError: () => {
      // The user's access token could not be used to fetch their
      // profile info (this can happen if the auth0 user was deleted).
      // In this case, let's have them log in / sign up again.
      router.push("/api/auth/logout")
    },
    onError: () => {
      // For any other type of error, redirect the user to an
      // error page.
      router.push("/dashboard/error")
    },
  })
}

export const defaultQueryRetryHandler = (failureCount: number, err: Error) => {
  return (
    failureCount < constants.reactquery.MAX_QUERY_RETRIES &&
    !isAccessTokenError(err, AccessTokenErrorCode.EXPIRED_ACCESS_TOKEN) &&
    !isGraphQLError(err, GraphQLErrorCode.INVALID_SUBSCRIPTION_ERROR) &&
    !isGraphQLError(err, GraphQLErrorCode.NOT_SUBSCRIBED_ERROR) &&
    !isGraphQLError(err, GraphQLErrorCode.UNAUTHORIZED)
  )
}
