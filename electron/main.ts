import { app, BrowserWindow, Menu, Tray, nativeImage, screen } from "electron";
import path from "node:path";

const DEV = process.env.BUGBUG_DEV === "1";
const projectRoot = path.join(__dirname, "..");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

if (app.dock) app.dock.hide();

let overlay: BrowserWindow | null = null;
let tray: Tray | null = null;
let cursorTimer: NodeJS.Timeout | null = null;
let muted = false;

function displayUnion(): Electron.Rectangle {
  const displays = screen.getAllDisplays();
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const display of displays) {
    left = Math.min(left, display.bounds.x);
    top = Math.min(top, display.bounds.y);
    right = Math.max(right, display.bounds.x + display.bounds.width);
    bottom = Math.max(bottom, display.bounds.y + display.bounds.height);
  }
  if (!Number.isFinite(left)) return { x: 0, y: 0, width: 1280, height: 720 };
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function createOverlay(): void {
  if (overlay && !overlay.isDestroyed()) return;
  const bounds = DEV
    ? { x: 140, y: 140, width: 960, height: 640 }
    : displayUnion();

  overlay = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: !DEV,
    backgroundColor: DEV ? "#20242b" : "#00000000",
    hasShadow: false,
    resizable: DEV,
    movable: DEV,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: DEV,
    skipTaskbar: true,
    show: false,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      backgroundThrottling: false,
    },
  });

  if (!DEV) {
    // Click-through, above everything, on every macOS Space.
    overlay.setIgnoreMouseEvents(true);
    overlay.setAlwaysOnTop(true, "screen-saver");
    overlay.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    });
  }

  overlay.loadFile(path.join(projectRoot, "index.html"));
  overlay.once("ready-to-show", () => {
    if (!overlay || overlay.isDestroyed()) return;
    if (DEV) overlay.show();
    else overlay.showInactive();
  });
  overlay.on("closed", () => {
    overlay = null;
  });
}

function applyDisplayBounds(): void {
  if (DEV || !overlay || overlay.isDestroyed()) return;
  overlay.setBounds(displayUnion());
}

function startCursorStream(): void {
  if (cursorTimer) clearInterval(cursorTimer);
  cursorTimer = setInterval(() => {
    const window = overlay;
    if (!window || window.isDestroyed()) return;
    const point = screen.getCursorScreenPoint();
    const bounds = window.getBounds();
    window.webContents.send("cursor", {
      x: point.x - bounds.x,
      y: point.y - bounds.y,
      active: true,
    });
  }, 16);
}

function createTray(): void {
  const icon = nativeImage
    .createFromPath(path.join(projectRoot, "assets", "bug-dropping.png"))
    .resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip("Bugpoop");

  const rebuild = (): void => {
    if (!tray) return;
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: muted ? "Unmute" : "Mute",
          click: () => {
            muted = !muted;
            overlay?.webContents.send("mute", muted);
            rebuild();
          },
        },
        {
          label: "Reset pet",
          click: () => overlay?.webContents.send("reset"),
        },
        { type: "separator" },
        { role: "quit" },
      ])
    );
  };
  rebuild();
}

app.whenReady().then(() => {
  createOverlay();
  startCursorStream();
  createTray();

  screen.on("display-added", applyDisplayBounds);
  screen.on("display-removed", applyDisplayBounds);
  screen.on("display-metrics-changed", applyDisplayBounds);

  app.on("activate", () => createOverlay());
});

// A pet lives in the tray, so closing the overlay must not quit the app.
app.on("window-all-closed", () => {});

app.on("before-quit", () => {
  if (cursorTimer) clearInterval(cursorTimer);
  cursorTimer = null;
});
