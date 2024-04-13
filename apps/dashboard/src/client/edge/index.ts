import type { TypedDocumentNode } from "@graphql-typed-document-node/core"
import { ClientError, GraphQLClient } from "graphql-request"
import { env } from "../env"
import {
  AccessTokenErrorCode,
  AccessTokenError,
} from "@auth0/nextjs-auth0/edge"

// https://github.com/jasonkuhrt/graphql-request/issues/399#issuecomment-1278272186
const gqlClient = new GraphQLClient(env.NEXT_PUBLIC_API_URL, { fetch })

export async function makeRequest<
  TResult,
  TVariables extends Record<string, unknown> | undefined,
>(
  operation: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables,
  accessToken?: string,
) {
  return await gqlClient
    .request(operation, variables, {
      ...(accessToken != null
        ? { authorization: `Bearer ${accessToken}` }
        : {}),
    })
    .catch((err) => {
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
