const bugs = requiredInput("#bugs");
const hunger = requiredInput("#hunger");
const reel = requiredInput("#reel");
const bugsOut = requiredOutput("#bugs-out");
const hungerOut = requiredOutput("#hunger-out");

function render(): void {
  bugsOut.textContent = bugs.value;
  hungerOut.textContent = hunger.value;
}

function push(): void {
  window.petBridge?.setSettings({
    bugCount: Number(bugs.value),
    hungerSpeed: Number(hunger.value),
    reelMode: reel.checked,
  });
}

function apply(settings: PetSettings): void {
  bugs.value = String(settings.bugCount);
  hunger.value = String(settings.hungerSpeed);
  reel.checked = settings.reelMode;
  render();
}

bugs.addEventListener("input", () => {
  render();
  push();
});
hunger.addEventListener("input", () => {
  render();
  push();
});
reel.addEventListener("change", push);

render();
window.petBridge?.getSettings().then(apply).catch(() => {});

function requiredInput(selector: string): HTMLInputElement {
  const element = document.querySelector<HTMLInputElement>(selector);
  if (!element) throw new Error(`${selector} is missing`);
  return element;
}

function requiredOutput(selector: string): HTMLOutputElement {
  const element = document.querySelector<HTMLOutputElement>(selector);
  if (!element) throw new Error(`${selector} is missing`);
  return element;
}

export {};
