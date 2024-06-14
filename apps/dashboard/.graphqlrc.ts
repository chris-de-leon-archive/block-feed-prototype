import { CodegenConfig } from "@graphql-codegen/cli"
import { IGraphQLConfig } from "graphql-config"
import { builder } from "./src/server"
import { printSchema } from "graphql"
import path from "node:path"

const outputPath = path.join("src", "client", "generated/")

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
        [outputPath]: {
          preset: "client",
          config: {
            enumsAsTypes: true,
          },
        },
        "schema.graphql": {
          plugins: ["schema-ast"],
        },
      },
    } satisfies CodegenConfig,
  },
} satisfies IGraphQLConfig
