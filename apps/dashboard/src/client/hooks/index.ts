"use client"

import { type TypedDocumentNode } from "@graphql-typed-document-node/core"
import { defaultQueryRetryHandler, handleDashboardError } from "../errors"
import { makeRequestOrThrow } from "../client"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { useEffect } from "react"
import {
  UseMutationOptions,
  UseQueryOptions,
  useMutation,
  useQuery,
} from "@tanstack/react-query"

export function useGraphQLQuery<
  TResult,
  TVariables extends Record<string, unknown> | undefined,
>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables,
  getToken: ReturnType<typeof useAuth>["getToken"],
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
    queryFn: async () => {
      return await makeRequestOrThrow(document, variables, await getToken())
    },
  })
}

export function useGraphQLMutation<
  TResult,
  TVariables extends Record<string, unknown> | undefined,
>(
  document: TypedDocumentNode<TResult, TVariables>,
  getToken: ReturnType<typeof useAuth>["getToken"],
  options: Partial<
    Omit<UseMutationOptions<TResult, Error, TVariables, unknown>, "mutationFn">
  > = {},
) {
  return useMutation({
    ...options,
    mutationFn: async (variables: TVariables) => {
      return await makeRequestOrThrow(document, variables, await getToken())
    },
  })
}

export function useGraphQLDashboardQuery<
  TResult,
  TVariables extends Record<string, unknown> | undefined,
>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables,
  getToken: ReturnType<typeof useAuth>["getToken"],
  options: Partial<
    Omit<
      UseQueryOptions<TResult, Error, TResult, any[]>,
      "queryKey" | "queryFn" | "retry"
    >
  > = {},
) {
  const router = useRouter()

  const query = useGraphQLQuery(document, variables, getToken, {
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
  getToken: ReturnType<typeof useAuth>["getToken"],
  options: Partial<
    Omit<
      UseMutationOptions<TResult, Error, TVariables, unknown>,
      "mutationFn" | "onError"
    >
  > = {},
) {
  const router = useRouter()
  return useGraphQLMutation(document, getToken, {
    ...options,
    onError: (err: Error) => {
      handleDashboardError(router, err)
    },
  })
}
