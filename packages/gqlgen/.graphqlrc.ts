import { CodegenConfig } from "@graphql-codegen/cli"
import type { IGraphQLConfig } from "graphql-config"
import { execSync } from "node:child_process"
import { builder } from "@block-feed/api"
import { printSchema } from "graphql"
import path from "node:path"

// NOTE: right now, this will output artifacts directly to other packages.
// Another way to do this would be to generate the codegen artifacts here,
// export them from this package, then import them from other packages.

const rootDir = execSync("git rev-parse --show-toplevel")
  .toString()
  .replace(new RegExp("\n", "g"), "")

const frontendOutputPath = path.join(
  rootDir,
  "apps",
  "web",
  "src",
  "client",
  "generated/",
)

const apiOutputPath = path.join(
  rootDir,
  "packages",
  "api",
  "tests",
  "utils",
  "api",
  "client.ts",
)

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
        [frontendOutputPath]: {
          preset: "client",
          config: {
            enumsAsTypes: true,
          },
        },
        [apiOutputPath]: {
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
