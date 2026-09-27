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

// A body pulse on every beat, like text.management's per-cycle rhythm
// reaction. 130 BPM is a metronome on the frame clock; the renderer turns each
// pulse into a damped-spring squash that travels head -> tail.
const BEAT_BPM = 130;
const BEAT_INTERVAL = 60000 / BEAT_BPM;
let nextBeatAt = performance.now();
let beatDirection: 1 | -1 = 1;
function metronome(): void {
  const now = performance.now();
  if (now >= nextBeatAt) {
    world.rhythmPulse({
      startedAt: nextBeatAt,
      intensity: 0.9,
      direction: beatDirection,
    });
    beatDirection = beatDirection === 1 ? -1 : 1;
    nextBeatAt += BEAT_INTERVAL;
    if (nextBeatAt < now) nextBeatAt = now + BEAT_INTERVAL;
  }
  requestAnimationFrame(metronome);
}
requestAnimationFrame(metronome);

function requiredCanvas(): HTMLCanvasElement {
  const element = document.querySelector<HTMLCanvasElement>("#stage");
  if (!element) throw new Error("#stage canvas is missing");
  return element;
}
