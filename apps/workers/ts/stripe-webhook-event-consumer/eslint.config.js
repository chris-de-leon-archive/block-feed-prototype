module.exports = [
  ...require("@block-feed/config-eslint/library"),
  {
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        project: true,
      },
    },
  },
]
