import { type TypedDocumentNode } from "@graphql-typed-document-node/core"
import { handleDashboardError, defaultQueryRetryHandler } from "./errors"
import { GraphQLClient } from "graphql-request"
import { useRouter } from "next/router"
import { useEffect } from "react"
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

export const gqlClient = new GraphQLClient("http://localhost:3000/api/graphql")

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

  if (res.status >= 400 && res.status < 500) {
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
  return await gqlClient.request(document, variables, {
    authorization: `bearer ${accessToken}`,
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
