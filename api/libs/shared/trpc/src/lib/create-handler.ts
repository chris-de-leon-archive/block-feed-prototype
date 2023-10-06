import { createOpenApiAwsLambdaHandler } from "trpc-openapi"
import { createContext } from "./create-context"
import { createTRPC } from "./create-trpc"
import { AnyRouter } from "@trpc/server"

export const createHandler = <T extends object>(
  services: T,
  cb: (t: ReturnType<typeof createTRPC<T>>) => AnyRouter
) => {
  return createOpenApiAwsLambdaHandler({
    createContext: createContext<T>(services),
    router: cb(createTRPC<T>()),
  })
}
