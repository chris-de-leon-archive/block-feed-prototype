import { GraphQLErrorCode, doesObjectHaveKey } from "@block-feed/shared"
import { ClientError } from "graphql-request"

export const isGraphQLErrorCode = (
  err: ClientError,
  code: GraphQLErrorCode,
) => {
  const extensions = err.response.errors?.at(0)?.extensions
  return (
    extensions != null &&
    doesObjectHaveKey(extensions, "code") &&
    typeof extensions.code === "string" &&
    extensions.code === code
  )
}
