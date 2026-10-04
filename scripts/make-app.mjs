// Build a real macOS .app bundle for Bugpoop and drop it into an Applications
// folder so launchers (e.g. Simple Spotlight) can find it.
//
// Usage:
//   npm run app                 -> builds + packages + installs to ~/Applications
//   BUGBUG_SYSTEM_APPS=1 npm run app   -> installs to /Applications instead
//
// Re-runnable: it overwrites the previously installed Bugpoop.app only.

import { packager } from "@electron/packager";
import { execFileSync } from "node:child_process";
import { access, mkdir, readdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = os.homedir();

const destRoot =
  process.env.BUGBUG_SYSTEM_APPS === "1"
    ? "/Applications"
    : path.join(home, "Applications");

const arch = process.arch === "x64" ? "x64" : "arm64";

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function which(cmd) {
  try {
    return execFileSync("command", ["-v", cmd], { shell: true })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

/**
 * Build assets/icon.icns from the pixel-art face with nearest-neighbour
 * upscaling, unless it already exists. Returns null if ImageMagick is missing
 * (packager then falls back to the stock Electron icon).
 */
async function ensureIcon() {
  const icns = path.join(root, "assets", "icon.icns");
  if (await exists(icns)) return icns;

  if (!which("magick") || !which("iconutil")) {
    console.warn("! ImageMagick/iconutil not found - using the default icon");
    return null;
  }

  const iconset = path.join(root, "assets", "icon.iconset");
  await rm(iconset, { recursive: true, force: true });
  await mkdir(iconset, { recursive: true });

  const sizes = [
    [16, "16x16"],
    [32, "16x16@2x"],
    [32, "32x32"],
    [64, "32x32@2x"],
    [128, "128x128"],
    [256, "128x128@2x"],
    [256, "256x256"],
    [512, "256x256@2x"],
    [512, "512x512"],
    [1024, "512x512@2x"],
  ];
  for (const [px, name] of sizes) {
    execFileSync("magick", [
      path.join(root, "assets", "bug-face.png"),
      "-filter",
      "point",
      "-resize",
      `${px}x${px}`,
      path.join(iconset, `icon_${name}.png`),
    ]);
  }
  execFileSync("iconutil", ["-c", "icns", iconset, "-o", icns]);
  await rm(iconset, { recursive: true, force: true });
  console.log("icon: built assets/icon.icns");
  return icns;
}

/**
 * macOS packaging nests the bundle: `<out>/<name>-darwin-<arch>/<name>.app`.
 * Resolve the actual `.app` whether packager hands back the bundle or its
 * containing folder.
 */
async function resolveBundle(p) {
  if (p.endsWith(".app")) return p;
  const app = (await readdir(p)).find((entry) => entry.endsWith(".app"));
  if (!app) throw new Error(`no .app bundle found in ${p}`);
  return path.join(p, app);
}

async function main() {
  // 1. Compile the renderer, settings and Electron main into dist/.
  execFileSync(process.execPath, [path.join(root, "scripts", "build.mjs")], {
    cwd: root,
    stdio: "inherit",
  });

  // 2. Package a real .app bundle.
  const icon = await ensureIcon();
  const out = path.join(root, "release");

  const [outPath] = await packager({
    dir: root,
    name: "Bugpoop",
    platform: "darwin",
    arch,
    out,
    overwrite: true,
    asar: true,
    prune: true,
    icon: icon ?? undefined,
    appBundleId: "com.jumang4423.bugpoop",
    appCategoryType: "public.app-category.entertainment",
    appCopyright: `Copyright © ${new Date().getFullYear()} jumang4423`,
    // Tray-only pet: no Dock icon, no app switcher entry.
    extendInfo: { LSUIElement: true },
    // Only ship what the runtime needs: html, assets, dist, package.json.
    ignore: [
      /^\/release($|\/)/,
      /^\/src($|\/)/,
      /^\/electron($|\/)/,
      /^\/scripts($|\/)/,
      /^\/tests($|\/)/,
      /^\/plan($|\/)/,
      /^\/\.git($|\/)/,
      /^\/\.github($|\/)/,
      /^\/node_modules($|\/)/,
      /^\/tsconfig\.json$/,
      /^\/.*\.md$/,
      /^\/LICENSE$/,
      /\.map$/,
    ],
  });

  const builtApp = await resolveBundle(outPath);

  // 3. Install into the Applications folder, replacing any previous build.
  const dest = path.join(destRoot, "Bugpoop.app");
  if (!(await exists(destRoot))) {
    await mkdir(destRoot, { recursive: true });
  }
  if (await exists(dest)) {
    await rm(dest, { recursive: true, force: true });
  }
  // ditto preserves symlinks, permissions and bundle metadata correctly.
  execFileSync("ditto", [builtApp, dest]);

  console.log(`\npackaged: ${builtApp}`);
  console.log(`installed: ${dest}`);
}

await main();
