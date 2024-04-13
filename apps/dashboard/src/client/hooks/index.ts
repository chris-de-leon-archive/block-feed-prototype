import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { type TypedDocumentNode } from "@graphql-typed-document-node/core"
import { GraphQLErrorCode, constants } from "@block-feed/shared"
import request, { ClientError } from "graphql-request"
import { isAccessTokenErrorCode } from "../node"
import { isGraphQLErrorCode } from "../errors"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { env } from "../env"
import {
  UseMutationOptions,
  UseQueryOptions,
  useMutation,
  useQuery,
} from "@tanstack/react-query"
import {
  AccessTokenErrorCode,
  GetAccessTokenResult,
  AccessTokenError,
} from "@auth0/nextjs-auth0"

export type ErrorCallbacks = Readonly<{
  onExpiredAccessTokenError?: (err: AccessTokenError) => void
  onInvalidSubscriptionError?: (err: ClientError) => void
  onNotSubscribedError?: (err: ClientError) => void
  onUnauthorizedError?: (err: ClientError) => void
  onError?: (err: Error) => void
}>

export async function getAccessToken() {
  const res = await fetch("/api/auth/token")

  if (res.ok) {
    const tok = (await res.json()) as GetAccessTokenResult
    if (tok.accessToken != null) {
      return tok.accessToken
    } else {
      throw new Error("invalid session")
    }
  }

  if (res.status === 401) {
    const err = (await res.json()) as AccessTokenError
    throw new AccessTokenError(
      err.code as AccessTokenErrorCode,
      err.message,
      err.cause,
    )
  }

  throw new Error("failed to fetch access token")
}

export async function makeAuthenticatedRequest<
  TResult,
  TVariables extends Record<string, unknown> | undefined,
>(document: TypedDocumentNode<TResult, TVariables>, variables: TVariables) {
  const accessToken = await getAccessToken()
  return await request(env.NEXT_PUBLIC_API_URL, document, variables, {
    authorization: `bearer ${accessToken}`,
  })
}

export const defaultQueryRetryHandler = (failureCount: number, err: Error) => {
  if (failureCount >= constants.reactquery.MAX_QUERY_RETRIES) {
    return false
  }

  if (err instanceof AccessTokenError) {
    if (
      isAccessTokenErrorCode(err, AccessTokenErrorCode.EXPIRED_ACCESS_TOKEN)
    ) {
      return false
    }
  }

  if (err instanceof ClientError) {
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
  if (err instanceof AccessTokenError) {
    if (
      isAccessTokenErrorCode(err, AccessTokenErrorCode.EXPIRED_ACCESS_TOKEN) &&
      callbacks.onExpiredAccessTokenError != null
    ) {
      callbacks.onExpiredAccessTokenError(err)
      return
    }
  }

  if (err instanceof ClientError) {
    if (
      isGraphQLErrorCode(err, GraphQLErrorCode.UNAUTHORIZED) &&
      callbacks.onUnauthorizedError != null
    ) {
      callbacks.onUnauthorizedError(err)
      return
    }
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
  }

  if (callbacks.onError != null) {
    callbacks.onError(err)
    return
  }
}

export const handleDashboardError = (router: AppRouterInstance, err: Error) => {
  handleError(err, {
    onExpiredAccessTokenError: () => {
      // The user's access token has expired - let's have them
      // log in again so they get another token.
      router.push("/api/auth/login")
    },
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
      // profile info (this can happen if the auth0 user was deleted).
      // In this case, let's have them log in / sign up again.
      router.push("/api/auth/logout")
    },
    onError: (err) => {
      // For any other type of error, redirect the user to an
      // error page.
      throw err
    },
  })
}

export function useGraphQLQuery<
  TResult,
  TVariables extends Record<string, unknown> | undefined,
>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables,
  options: Partial<
    Omit<
      UseQueryOptions<TResult, Error, TResult, any[]>,
      "queryKey" | "queryFn"
    >
  > = {},
) {
  const docName = (document.definitions.at(0) as any)?.name?.value
  return useQuery({
    ...options,
    queryKey: [docName, variables],
    queryFn: () => makeAuthenticatedRequest(document, variables),
  })
}

export function useGraphQLMutation<
  TResult,
  TVariables extends Record<string, unknown> | undefined,
>(
  document: TypedDocumentNode<TResult, TVariables>,
  options: Partial<
    Omit<UseMutationOptions<TResult, Error, TVariables, unknown>, "mutationFn">
  > = {},
) {
  return useMutation({
    ...options,
    mutationFn: (variables: TVariables) =>
      makeAuthenticatedRequest(document, variables),
  })
}

export function useGraphQLDashboardQuery<
  TResult,
  TVariables extends Record<string, unknown> | undefined,
>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables,
  options: Partial<
    Omit<
      UseQueryOptions<TResult, Error, TResult, any[]>,
      "queryKey" | "queryFn" | "retry"
    >
  > = {},
) {
  const router = useRouter()

  const query = useGraphQLQuery(document, variables, {
    ...options,
    retry: defaultQueryRetryHandler,
  })

  useEffect(() => {
    if (query.error != null) {
      handleDashboardError(router, query.error)
    }
  }, [query.error])

  return query
}

export function useGraphQLDashboardMutation<
  TResult,
  TVariables extends Record<string, unknown> | undefined,
>(
  document: TypedDocumentNode<TResult, TVariables>,
  options: Partial<
    Omit<
      UseMutationOptions<TResult, Error, TVariables, unknown>,
      "mutationFn" | "onError"
    >
  > = {},
) {
  const router = useRouter()
  return useGraphQLMutation(document, {
    ...options,
    onError: (err: Error) => {
      handleDashboardError(router, err)
    },
  })
}
