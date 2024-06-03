module.exports = [
  ...require("@block-feed/config-eslint/next"),
  {
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        project: true,
      },
    },
  },
]
