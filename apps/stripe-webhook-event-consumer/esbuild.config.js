const esbuild = require("esbuild")
const path = require("node:path")
const pkg = require("./package.json")

// NOTE: esbuild should compile our local workspace packages and add them to the final bundle
// AND exclude any third party dependencies (e.g. zod) from the final bundle. To achieve this,
// we cannot use `--packages=external`. If we do, then esbuild assumes all our local workspace
// packages are third party packages and excludes them from the final bundle. The consequence
// of this is that the uncompiled typescript code of our local pnpm workspace packages will be
// added to node_modules when we run pnpm deploy, which will cause the program to crash when it
// is started. To fix this, we use this custom esbuild script which ensures that our local pnpm
// workspace packages are included in the final bundle and any prod dependencies (i.e. the ones
// listed in the `dependencies` field in package.json) are excluded from the bundle (these will
// be installed to node_modules via pnpm deploy).
esbuild.build({
  entryPoints: [path.join(__dirname, "src", "main.ts")],
  bundle: true,
  outfile: path.join(__dirname, "dist", "main.js"),
  platform: "node",
  external: Object.keys(pkg.dependencies),
})
