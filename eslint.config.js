// This configuration only applies to the package manager root.
module.exports = [
  ...require("@block-feed/node-config-eslint/library"),
  {
    ignores: ["apps/**", "packages/**"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        project: true,
      },
    },
  },
]
