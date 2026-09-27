import { SoundKit } from "./audio";
import { DesktopHabitat } from "./adapters/desktopHabitat";
import { BugWorld } from "./bug/world";

interface CursorMessage {
  x: number;
  y: number;
  active: boolean;
}

interface PetBridge {
  onCursor(callback: (message: CursorMessage) => void): void;
  onMute(callback: (muted: boolean) => void): void;
  onReset(callback: () => void): void;
}

declare global {
  interface Window {
    petBridge?: PetBridge;
  }
}

const canvas = requiredCanvas();

const habitat = new DesktopHabitat();
habitat.resize(window.innerWidth, window.innerHeight);

const world = new BugWorld(habitat, canvas);
const sound = new SoundKit();

world.onMunch = () => sound.munch();
world.onPoopSound = (kind) =>
  kind === "wiggle" ? sound.wiggle() : sound.release();

window.addEventListener("resize", () => {
  habitat.resize(window.innerWidth, window.innerHeight);
});

// The window is click-through on macOS, so the main process streams the global
// cursor position instead of the page receiving pointer events.
window.petBridge?.onCursor((message) => {
  if (!message.active) {
    world.pointerLeave();
    return;
  }
  world.pointerMove({ x: message.x, y: message.y }, performance.now());
});
window.petBridge?.onMute((muted) => sound.setMuted(muted));
window.petBridge?.onReset(() => world.reset());

// Fallback for `npm run dev` in a normal, interactive window.
window.addEventListener("pointermove", (event) => {
  world.pointerMove({ x: event.clientX, y: event.clientY }, event.timeStamp);
});
window.addEventListener("pointerleave", () => world.pointerLeave());
window.addEventListener("pointerdown", (event) => {
  sound.prime();
  world.pointerMove({ x: event.clientX, y: event.clientY }, event.timeStamp);
  world.pointerDown({ x: event.clientX, y: event.clientY });
});
window.addEventListener("keydown", () => sound.prime());

world.start();

function requiredCanvas(): HTMLCanvasElement {
  const element = document.querySelector<HTMLCanvasElement>("#stage");
  if (!element) throw new Error("#stage canvas is missing");
  return element;
}
