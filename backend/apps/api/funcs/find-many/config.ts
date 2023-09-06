import { funcsAPI } from "../../../../libs/api"
import { AWS } from "@serverless/typescript"
import { sharedConfig } from "../config"

export const funcsFindManyConfig: AWS["functions"] = {
  [funcsAPI.OPERATIONS.FIND_MANY.NAME]: {
    ...sharedConfig,
    handler: "./apps/api/funcs/find-many/handler.handler",
    events: [
      {
        http: {
          operationId: funcsAPI.OPERATIONS.FIND_MANY.NAME,
          path: funcsAPI.OPERATIONS.FIND_MANY.PATH,
          method: funcsAPI.OPERATIONS.FIND_MANY.METHOD,
        },
      },
    ],
  },
}
