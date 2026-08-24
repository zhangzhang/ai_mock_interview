const esbuild = require("esbuild");
const watch = process.argv.includes("--watch");
const opts = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "out/extension.js",
  platform: "node",
  format: "cjs",
  target: "node18",
  external: ["vscode"],
  sourcemap: true,
  logLevel: "info",
};
(async () => {
  if (watch) { const ctx = await esbuild.context(opts); await ctx.watch(); }
  else { await esbuild.build(opts); }
})();
