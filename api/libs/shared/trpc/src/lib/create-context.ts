import { CreateAWSLambdaContextOptions } from "@trpc/server/adapters/aws-lambda"
import { APIGatewayProxyEvent } from "aws-lambda"

export const createContext =
  <T extends Record<string, unknown>>(ctx: T) =>
  (awsCtx: CreateAWSLambdaContextOptions<APIGatewayProxyEvent>) => {
    return { ...awsCtx, ...ctx }
  }
