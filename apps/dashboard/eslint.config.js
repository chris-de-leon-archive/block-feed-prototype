module.exports = [
  ...require("@block-feed/node-config-eslint/next"),
  {
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        project: true,
      },
    },
  },
]
