const eslintPrettier = require("eslint-config-prettier")
const onlyWarn = require("eslint-plugin-only-warn")
const { FlatCompat } = require("@eslint/eslintrc")
const { resolve } = require("node:path")
const eslint = require("@eslint/js")
const globals = require("globals")

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const project = resolve(process.cwd(), "tsconfig.json")

module.exports = [
  eslint.configs.recommended,
  eslintPrettier,
  ...compat.extends("eslint-config-turbo"),
  // TODO: This can be commented when eslint 9 is supported:
  // https://github.com/vercel/style-guide/issues/108
  // ...compat.extends(require.resolve("@vercel/style-guide/eslint/next")),
  {
    ignores: [
      // Ignore dotfiles
      "**/eslint.config.js",
      "**/.graphqlrc.ts",
      "**/.*.js",
      "**/node_modules/",
      "**/dist/",
      "**/.turbo",
      "**/.next",
    ],
  },
  {
    files: ["**/*.js?(x)", "**/*.ts?(x)"],
    plugins: {
      onlyWarn,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      "import/resolver": {
        typescript: {
          project,
        },
      },
    },
  },
]
