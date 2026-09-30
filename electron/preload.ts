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
  muted: boolean;
  outputDeviceId: string;
}

interface AudioOutput {
  id: string;
  label: string;
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
  // The overlay answers device-list requests because it owns the audio graph.
  onAudioList(callback: () => void): void {
    ipcRenderer.on("audio:list", () => callback());
  },
  sendAudioOutputs(devices: AudioOutput[]): void {
    ipcRenderer.send("audio:outputs", devices);
  },
  // Settings window.
  getSettings(): Promise<Settings> {
    return ipcRenderer.invoke("settings:get") as Promise<Settings>;
  },
  listAudioOutputs(): Promise<AudioOutput[]> {
    return ipcRenderer.invoke("audio:devices") as Promise<AudioOutput[]>;
  },
  setSettings(partial: Partial<Settings>): void {
    ipcRenderer.send("settings:set", partial);
  },
});
