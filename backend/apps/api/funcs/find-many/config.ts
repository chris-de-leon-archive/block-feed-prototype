import { funcsAPI } from "../../../../libs/api"
import { AWS } from "@serverless/typescript"
import { sharedConfig } from "../config"
import * as path from "path"

export const funcsFindManyConfig: AWS["functions"] = {
  [funcsAPI.OPERATIONS.FIND_MANY.ID]: {
    ...sharedConfig,
    handler: path.join(
      path.dirname(path.relative(process.cwd(), __filename)),
      "handler.handler"
    ),
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
