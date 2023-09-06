import { ContextServices } from "./interfaces/context-services.interface"
import { createOpenApiAwsLambdaHandler } from "trpc-openapi"
import { createContext } from "./create-context"
import { createTRPC } from "./create-trpc"
import { AnyRouter } from "@trpc/server"

export const createHandler = (
  services: ContextServices,
  cb: (t: ReturnType<typeof createTRPC>) => AnyRouter
) => {
  return createOpenApiAwsLambdaHandler({
    createContext: createContext(services),
    router: cb(createTRPC()),
  })
}
