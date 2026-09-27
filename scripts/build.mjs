import { build } from "esbuild";
import { mkdir, rm } from "node:fs/promises";

const shared = {
  bundle: true,
  sourcemap: true,
  logLevel: "info",
  target: "es2022",
};

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

// Renderer: a single classic script (IIFE) so it loads over file:// without
// any module/CORS surprises inside Electron.
await build({
  ...shared,
  entryPoints: ["src/main.ts"],
  outfile: "dist/renderer.js",
  format: "iife",
  platform: "browser",
  loader: { ".wav": "dataurl" },
});

// Electron main + preload: CommonJS, with electron kept external.
await build({
  ...shared,
  entryPoints: ["electron/main.ts"],
  outfile: "dist/main.cjs",
  format: "cjs",
  platform: "node",
  external: ["electron"],
});

await build({
  ...shared,
  entryPoints: ["electron/preload.ts"],
  outfile: "dist/preload.cjs",
  format: "cjs",
  platform: "node",
  external: ["electron"],
});

console.log("build complete");
