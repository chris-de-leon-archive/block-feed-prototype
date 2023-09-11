const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin")
const nodeExternals = require("webpack-node-externals")
const slsw = require("serverless-webpack")
const path = require("path")

// https://github.com/serverless-heaven/serverless-webpack
// https://stackoverflow.com/a/35820388/22520608

/**
 * @type {import('webpack').Configuration}
 */
const config = {
  mode: slsw.lib.webpack.isLocal ? "development" : "production",
  devtool: "inline-source-map",
  externals: [nodeExternals()],
  target: "node",
  entry: slsw.lib.entries,
  output: {
    libraryTarget: "commonjs",
    path: path.resolve(__dirname, ".build"),
    filename: "[name].js",
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    plugins: [new TsconfigPathsPlugin()],
  },
  externalsPresets: {
    node: true, // in order to ignore built-in modules like path, fs, etc.
  },
  optimization: {
    minimize: false,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              configFile: "tsconfig.json",
            },
          },
        ],
      },
    ],
  },
}

module.exports = config
