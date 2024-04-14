import type { TypedDocumentNode } from "@graphql-typed-document-node/core"
import request, { ClientError } from "graphql-request"
import { env } from "../env"

export async function makeRequest<
  TResult,
  TVariables extends Record<string, unknown> | undefined,
>(
  operation: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables,
  accessToken?: string | null | undefined,
) {
  return await request(
    env.NEXT_PUBLIC_API_URL,
    operation,
    variables,
    accessToken != null ? { authorization: `Bearer ${accessToken}` } : {},
  ).catch((err) => {
    if (err instanceof ClientError) {
      return err
    }
    throw err
  })
}
