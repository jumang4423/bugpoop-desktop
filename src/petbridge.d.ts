// Shared types for the preload bridge, used by both the overlay and the
// settings window.

interface PetCursorMessage {
  x: number;
  y: number;
  active: boolean;
}

interface PetSettings {
  bugCount: number;
  hungerSpeed: number;
  reelMode: boolean;
  muted: boolean;
}

interface PetBridgeApi {
  onCursor(callback: (message: PetCursorMessage) => void): void;
  onMute(callback: (muted: boolean) => void): void;
  onSettings(callback: (settings: PetSettings) => void): void;
  getSettings(): Promise<PetSettings>;
  setSettings(partial: Partial<PetSettings>): void;
}

interface Window {
  petBridge?: PetBridgeApi;
}
