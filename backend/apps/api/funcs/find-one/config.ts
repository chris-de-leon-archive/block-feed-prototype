import { funcsAPI } from "../../../../libs/api"
import { AWS } from "@serverless/typescript"
import { sharedConfig } from "../config"
import * as path from "path"

export const funcsFindOneConfig: AWS["functions"] = {
  [funcsAPI.OPERATIONS.FIND_ONE.ID]: {
    ...sharedConfig,
    handler: path.join(
      path.dirname(path.relative(process.cwd(), __filename)),
      "handler.handler"
    ),
    events: [
      {
        http: {
          operationId: funcsAPI.OPERATIONS.FIND_ONE.NAME,
          path: funcsAPI.OPERATIONS.FIND_ONE.PATH,
          method: funcsAPI.OPERATIONS.FIND_ONE.METHOD,
        },
      },
    ],
  },
}
