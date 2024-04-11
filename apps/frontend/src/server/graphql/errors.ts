import { GraphQLErrorCode } from "@block-feed/shared/enums/graphql-error.enum"
import { GraphQLError } from "graphql"

const gqlMakeError = (
  opts: Readonly<{
    code: GraphQLErrorCode
    status: number
    msg: string
  }>,
) =>
  new GraphQLError(opts.msg, {
    extensions: {
      code: opts.code,
      http: {
        status: opts.status,
      },
    },
  })

export const gqlNotSubscribedError = (msg: string) =>
  gqlMakeError({
    code: GraphQLErrorCode.NOT_SUBSCRIBED_ERROR,
    status: 400,
    msg,
  })

export const gqlInvalidSubscriptionError = (msg: string) =>
  gqlMakeError({
    code: GraphQLErrorCode.INVALID_SUBSCRIPTION_ERROR,
    status: 400,
    msg,
  })

export const gqlBadRequestError = (msg: string) =>
  gqlMakeError({
    code: GraphQLErrorCode.BAD_REQUEST,
    status: 400,
    msg,
  })

export const gqlUnauthorizedError = (msg: string) =>
  gqlMakeError({
    code: GraphQLErrorCode.UNAUTHORIZED,
    status: 401,
    msg,
  })

export const gqlInternalServerError = (msg: string) =>
  gqlMakeError({
    code: GraphQLErrorCode.INTERNAL_SERVER_ERROR,
    status: 500,
    msg,
  })
