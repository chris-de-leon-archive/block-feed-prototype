import { GraphQLErrorCode } from "@block-feed/shared/enums/graphql-error.enum"
import { GraphQLError } from "graphql"

export const gqlBadRequestError = (msg: string) =>
  new GraphQLError(msg, {
    extensions: {
      code: GraphQLErrorCode.BAD_REQUEST,
      http: {
        status: 400,
      },
    },
  })

export const gqlUnauthorizedError = (msg: string) =>
  new GraphQLError(msg, {
    extensions: {
      code: GraphQLErrorCode.UNAUTHORIZED,
      http: {
        status: 401,
      },
    },
  })

export const gqlInternalServerError = (msg: string) =>
  new GraphQLError(msg, {
    extensions: {
      code: GraphQLErrorCode.INTERNAL_SERVER_ERROR,
      http: {
        status: 500,
      },
    },
  })
