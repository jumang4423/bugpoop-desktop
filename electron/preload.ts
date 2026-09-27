import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

interface CursorMessage {
  x: number;
  y: number;
  active: boolean;
}

interface Settings {
  bugCount: number;
  hungerSpeed: number;
  reelMode: boolean;
}

contextBridge.exposeInMainWorld("petBridge", {
  // Overlay window.
  onCursor(callback: (message: CursorMessage) => void): void {
    ipcRenderer.on("cursor", (_event: IpcRendererEvent, message: CursorMessage) =>
      callback(message)
    );
  },
  onMute(callback: (muted: boolean) => void): void {
    ipcRenderer.on("mute", (_event: IpcRendererEvent, muted: boolean) =>
      callback(muted)
    );
  },
  onSettings(callback: (settings: Settings) => void): void {
    ipcRenderer.on("settings", (_event: IpcRendererEvent, settings: Settings) =>
      callback(settings)
    );
  },
  // Settings window.
  getSettings(): Promise<Settings> {
    return ipcRenderer.invoke("settings:get") as Promise<Settings>;
  },
  setSettings(partial: Partial<Settings>): void {
    ipcRenderer.send("settings:set", partial);
  },
});
