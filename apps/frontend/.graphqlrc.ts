import { builder } from "./src/server/graphql/builder"
import { CodegenConfig } from "@graphql-codegen/cli"
import type { IGraphQLConfig } from "graphql-config"
import { printSchema } from "graphql"

import "./src/server/api"

/**
 * https://github.com/neovim/nvim-lspconfig/blob/master/doc/server_configurations.md#graphql
 * https://the-guild.dev/graphql/config/docs/user/usage#extensions
 */
export default {
  schema: printSchema(builder.toSchema()),
  documents: ["graphql/**/*.gql"],
  extensions: {
    codegen: {
      generates: {
        "./src/client/generated/": {
          preset: "client",
          config: {
            enumsAsTypes: true,
          },
        },
        "./tests/utils/api/client.ts": {
          plugins: [
            "typescript",
            "typescript-operations",
            "typescript-graphql-request",
          ],
          config: {
            rawRequest: true,
            documentMode: "documentNode",
          },
        },
        "schema.graphql": {
          plugins: ["schema-ast"],
        },
      },
    } satisfies CodegenConfig,
  },
} satisfies IGraphQLConfig
