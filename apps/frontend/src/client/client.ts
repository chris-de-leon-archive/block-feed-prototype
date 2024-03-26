import { type TypedDocumentNode } from "@graphql-typed-document-node/core"
import { GetAccessTokenResult } from "@auth0/nextjs-auth0"
import { GraphQLClient } from "graphql-request"
import {
  UndefinedInitialDataOptions,
  UseMutationOptions,
  useMutation,
  useQuery,
} from "@tanstack/react-query"

export const gqlClient = new GraphQLClient("http://localhost:3000/api/graphql")

export async function getAccessToken() {
  const res = await fetch("/api/auth/token")
  const tok = (await res.json()) as GetAccessTokenResult
  if (tok.accessToken != null) {
    return tok.accessToken
  } else {
    throw new Error("invalid session")
  }
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
      UndefinedInitialDataOptions<TResult, Error, TResult, any[]>,
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
