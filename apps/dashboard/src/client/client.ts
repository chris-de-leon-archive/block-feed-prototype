import { TypedDocumentNode } from "@graphql-typed-document-node/core"
import { ExecutionResult, GraphQLError, print } from "graphql"
import { env } from "./env"

export async function makeRequest<
  TResult,
  TVariables extends Record<string, unknown> | undefined,
>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables,
  accessToken?: string | null | undefined,
) {
  const result = await fetch(env.NEXT_PUBLIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken != null
        ? { authorization: `bearer ${accessToken}` }
        : {}),
    },
    body: JSON.stringify({
      query: print(document),
      variables,
    }),
  })

  // NOTE: `await result.json()` returns a plain javascript object - it does not create any class(es)!
  // As a result, using the `instanceof` keyword to check object prototypes may not work as expected.
  // We'll need to manually recreate the class(es) to ensure these types of checks are consistent.
  const body: ExecutionResult<TResult> = await result.json()

  const err = body.errors?.at(0)
  if (err != null) {
    return new GraphQLError(err.message, err)
  }

  const data = body.data
  if (data == null) {
    throw new Error(
      `unexpectedly received no data: ${JSON.stringify(body, null, 2)}`,
    )
  }

  return data
}

export async function makeRequestOrThrow<
  TResult,
  TVariables extends Record<string, unknown> | undefined,
>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables,
  accessToken?: string | null | undefined,
) {
  const result = await makeRequest(document, variables, accessToken)
  if (result instanceof GraphQLError) {
    throw result
  }
  return result
}
