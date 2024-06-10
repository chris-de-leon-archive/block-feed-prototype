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

/*
 * This is a custom ESLint configuration for use with
 * internal (bundled by their consumer) libraries
 * that utilize React.
 *
 * This config extends the Vercel Engineering Style Guide.
 * For more information, see https://github.com/vercel/style-guide
 *
 */

module.exports = [
  eslint.configs.recommended,
  eslintPrettier,
  ...compat.extends("eslint-config-turbo"),
  {
    ignores: [
      // Ignore dotfiles
      "**/eslint.config.js",
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
