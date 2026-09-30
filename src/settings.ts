const bugs = requiredInput("#bugs");
const hunger = requiredInput("#hunger");
const reel = requiredInput("#reel");
const mute = requiredInput("#mute");
const output = requiredSelect("#output");
const bugsOut = requiredOutput("#bugs-out");
const hungerOut = requiredOutput("#hunger-out");

let outputDeviceId = "";
let outputs: PetAudioOutput[] = [];

function render(): void {
  bugsOut.textContent = bugs.value;
  hungerOut.textContent = hunger.value;
}

function renderOutputs(): void {
  output.replaceChildren();
  const entries: PetAudioOutput[] = [
    { id: "", label: "System default" },
    ...outputs,
  ];
  for (const entry of entries) {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.label;
    output.appendChild(option);
  }
  const known = entries.some((entry) => entry.id === outputDeviceId);
  output.value = known ? outputDeviceId : "";
}

async function loadOutputs(): Promise<void> {
  try {
    outputs = (await window.petBridge?.listAudioOutputs()) ?? [];
  } catch {
    outputs = [];
  }
  renderOutputs();
}

function push(): void {
  window.petBridge?.setSettings({
    bugCount: Number(bugs.value),
    hungerSpeed: Number(hunger.value),
    reelMode: reel.checked,
    muted: mute.checked,
    outputDeviceId: output.value,
  });
}

function apply(settings: PetSettings): void {
  bugs.value = String(settings.bugCount);
  hunger.value = String(settings.hungerSpeed);
  reel.checked = settings.reelMode;
  mute.checked = settings.muted;
  outputDeviceId = settings.outputDeviceId ?? "";
  render();
  renderOutputs();
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
mute.addEventListener("change", push);
output.addEventListener("change", () => {
  outputDeviceId = output.value;
  push();
});

render();
window.petBridge?.getSettings().then(apply).catch(() => {});
void loadOutputs();

function requiredInput(selector: string): HTMLInputElement {
  const element = document.querySelector<HTMLInputElement>(selector);
  if (!element) throw new Error(`${selector} is missing`);
  return element;
}

function requiredSelect(selector: string): HTMLSelectElement {
  const element = document.querySelector<HTMLSelectElement>(selector);
  if (!element) throw new Error(`${selector} is missing`);
  return element;
}

function requiredOutput(selector: string): HTMLOutputElement {
  const element = document.querySelector<HTMLOutputElement>(selector);
  if (!element) throw new Error(`${selector} is missing`);
  return element;
}

export {};
