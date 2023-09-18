import { CreateAWSLambdaContextOptions } from "@trpc/server/adapters/aws-lambda"
import { inferAsyncReturnType } from "@trpc/server"
import { APIGatewayProxyEvent } from "aws-lambda"

export const createContext =
  <T extends object>(args: T) =>
  ({ event, context }: CreateAWSLambdaContextOptions<APIGatewayProxyEvent>) => {
    return { event, context, ...args }
  }

export type Context<T extends object> = inferAsyncReturnType<
  typeof createContext<T>
>
