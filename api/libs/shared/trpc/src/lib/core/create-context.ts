import { CreateAWSLambdaContextOptions } from "@trpc/server/adapters/aws-lambda"
import { ContextServices } from "./interfaces/context-services.interface"
import { inferAsyncReturnType } from "@trpc/server"
import { APIGatewayProxyEvent } from "aws-lambda"

export const createContext =
  (args: ContextServices) =>
  ({ event, context }: CreateAWSLambdaContextOptions<APIGatewayProxyEvent>) => {
    return { event, context, ...args }
  }

export type Context = inferAsyncReturnType<typeof createContext>
