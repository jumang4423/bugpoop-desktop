import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  screen,
} from "electron";
import fs from "node:fs";
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
let settingsWindow: BrowserWindow | null = null;

interface Settings {
  /** How many bugs wander the desktop (1..50). */
  bugCount: number;
  /** Metabolism multiplier 0..100. 0 = never hungry, 100 = instant meals. */
  hungerSpeed: number;
  /** Video mode: a narrow, full-height strip on the left quarter of the screen. */
  reelMode: boolean;
  /** Silence the chewing / poop sounds. */
  muted: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  bugCount: 1,
  hungerSpeed: 35,
  reelMode: false,
  muted: false,
};

function settingsFile(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function clampSettings(input: Partial<Settings>): Settings {
  const bugCount = Math.round(Number(input.bugCount));
  const hungerSpeed = Math.round(Number(input.hungerSpeed));
  return {
    bugCount: Number.isFinite(bugCount)
      ? Math.max(1, Math.min(50, bugCount))
      : DEFAULT_SETTINGS.bugCount,
    hungerSpeed: Number.isFinite(hungerSpeed)
      ? Math.max(0, Math.min(100, hungerSpeed))
      : DEFAULT_SETTINGS.hungerSpeed,
    reelMode:
      typeof input.reelMode === "boolean"
        ? input.reelMode
        : DEFAULT_SETTINGS.reelMode,
    muted:
      typeof input.muted === "boolean" ? input.muted : DEFAULT_SETTINGS.muted,
  };
}

function loadSettings(): Settings {
  try {
    const raw = JSON.parse(
      fs.readFileSync(settingsFile(), "utf8")
    ) as Partial<Settings>;
    return clampSettings(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let settings: Settings = { ...DEFAULT_SETTINGS };

function saveSettings(): void {
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  } catch {
    // Ignore persistence failures; the pet still works for this session.
  }
}

function broadcastSettings(): void {
  overlay?.webContents.send("settings", settings);
}

function broadcastMute(): void {
  overlay?.webContents.send("mute", settings.muted);
}

function openSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 460,
    height: 426,
    useContentSize: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Bugpoop Settings",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  // Sit above the always-on-top pet so the form is never drawn over.
  settingsWindow.setAlwaysOnTop(true, "screen-saver");
  settingsWindow.loadFile(path.join(projectRoot, "settings.html"));
  settingsWindow.once("ready-to-show", () => settingsWindow?.show());
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

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

/**
 * Reel mode is a narrow vertical strip on the left quarter of the primary
 * display, at full height, for capturing phone-shaped video.
 */
function overlayBounds(): Electron.Rectangle {
  if (DEV) return { x: 140, y: 140, width: 960, height: 640 };
  if (settings.reelMode) {
    const display = screen.getPrimaryDisplay();
    return {
      x: display.bounds.x,
      y: display.bounds.y,
      width: Math.max(200, Math.round(display.bounds.width / 4)),
      height: display.bounds.height,
    };
  }
  return displayUnion();
}

function createOverlay(): void {
  if (overlay && !overlay.isDestroyed()) return;
  const bounds = overlayBounds();

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
  overlay.webContents.on("did-finish-load", () => {
    broadcastSettings();
    broadcastMute();
  });
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
  overlay.setBounds(overlayBounds());
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
          label: settings.muted ? "Unmute" : "Mute",
          click: () => {
            settings = { ...settings, muted: !settings.muted };
            saveSettings();
            broadcastMute();
            rebuild();
          },
        },
        {
          label: "Settings…",
          click: () => openSettings(),
        },
        { type: "separator" },
        { role: "quit" },
      ])
    );
  };
  rebuild();
}

app.whenReady().then(() => {
  settings = loadSettings();

  ipcMain.handle("settings:get", () => settings);
  ipcMain.on("settings:set", (_event, partial: Partial<Settings>) => {
    const previous = settings;
    settings = clampSettings({ ...settings, ...partial });
    saveSettings();
    if (settings.reelMode !== previous.reelMode) applyDisplayBounds();
    if (settings.muted !== previous.muted) broadcastMute();
    broadcastSettings();
  });

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
