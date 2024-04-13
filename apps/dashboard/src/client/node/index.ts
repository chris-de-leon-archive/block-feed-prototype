import { AccessTokenErrorCode, AccessTokenError } from "@auth0/nextjs-auth0"
import type { TypedDocumentNode } from "@graphql-typed-document-node/core"
import request, { ClientError } from "graphql-request"
import { env } from "../env"

export async function makeRequest<
  TResult,
  TVariables extends Record<string, unknown> | undefined,
>(
  operation: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables,
  accessToken?: string,
) {
  return await request(env.NEXT_PUBLIC_API_URL, operation, variables, {
    ...(accessToken != null ? { authorization: `Bearer ${accessToken}` } : {}),
  }).catch((err) => {
    if (err instanceof ClientError) {
      return err
    }
    throw err
  })
}

export const isAccessTokenErrorCode = (
  err: unknown,
  code: AccessTokenErrorCode,
): err is AccessTokenError => {
  if (!(err instanceof AccessTokenError)) {
    return false
  }
  return err.code === code
}
