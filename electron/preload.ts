import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

interface CursorMessage {
  x: number;
  y: number;
  active: boolean;
}

contextBridge.exposeInMainWorld("petBridge", {
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
  onReset(callback: () => void): void {
    ipcRenderer.on("reset", () => callback());
  },
});
