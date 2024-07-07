module.exports = [
  ...require("@block-feed/node-config-eslint/library"),
  {
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        project: true,
      },
    },
  },
]
