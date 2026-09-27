import { SoundKit } from "./audio";
import { DesktopHabitat } from "./adapters/desktopHabitat";
import { BugWorld } from "./bug/world";
import { hungerScaleFor } from "./hunger";

const canvas = requiredCanvas();

const habitat = new DesktopHabitat();
habitat.resize(window.innerWidth, window.innerHeight);

const world = new BugWorld(habitat, canvas);
const sound = new SoundKit();
sound.prime();

world.onMunch = () => sound.munch();
world.onPoopSound = (kind) =>
  kind === "wiggle" ? sound.wiggle() : sound.release();

function applySettings(settings: PetSettings): void {
  world.setPopulation(settings.bugCount);
  world.setHungerScale(hungerScaleFor(settings.hungerSpeed));
}

window.petBridge?.onSettings((settings) => applySettings(settings));
window.petBridge?.getSettings().then(applySettings).catch(() => {});

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
