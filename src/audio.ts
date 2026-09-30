import eat1 from "./sounds/eat1.wav";
import eat2 from "./sounds/eat2.wav";
import eat3 from "./sounds/eat3.wav";
import poopWiggle from "./sounds/funny25.wav";
import poopRelease from "./sounds/funny26.wav";

// The real bug sounds, taken from sc-dotfiles: the SuperDirt `mc_eat` bank for
// munching and `funny` 25/26 for the poop wiggle and release. They are played
// straight through WebAudio here instead of being sent to SuperDirt over OSC.
const MUNCH_SOURCES = [eat1, eat2, eat3];
const MASTER_GAIN = 0.8;

// Chromium ships AudioOutputDevice routing, but the bundled DOM lib predates it.
declare global {
  interface AudioContext {
    setSinkId(sinkId: string): Promise<void>;
  }
}

/**
 * The output devices the overlay may route its audio to. Device ids are salted
 * per origin, so this must be called in the window that owns the AudioContext.
 */
export async function listAudioOutputs(): Promise<PetAudioOutput[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return [];
  let devices: MediaDeviceInfo[];
  try {
    devices = await navigator.mediaDevices.enumerateDevices();
  } catch {
    return [];
  }
  const seen = new Set<string>();
  const outputs: PetAudioOutput[] = [];
  for (const device of devices) {
    if (device.kind !== "audiooutput") continue;
    // "default" / "communications" are aliases of the system default, which a
    // "" sink id already covers.
    if (!device.deviceId || device.deviceId === "default") continue;
    if (device.deviceId === "communications") continue;
    if (seen.has(device.deviceId)) continue;
    seen.add(device.deviceId);
    outputs.push({
      id: device.deviceId,
      label: device.label || `Output ${outputs.length + 1}`,
    });
  }
  return outputs;
}

export class SoundKit {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private sinkId = "";
  private readonly sources = [...MUNCH_SOURCES, poopWiggle, poopRelease];
  private readonly buffers: Array<AudioBuffer | null> = this.sources.map(
    () => null
  );
  private loading = false;

  prime(): void {
    const context = this.ensure();
    if (context) this.loadAll(context);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : MASTER_GAIN;
  }

  /**
   * Route the whole graph to an output device. "" means the system default.
   * Safe to call before the AudioContext exists; the sink is applied lazily.
   */
  setOutputDevice(deviceId: string): void {
    this.sinkId = deviceId;
    this.applySink();
  }

  /** Re-apply the current sink after the device list changes. */
  refreshOutputDevice(): void {
    this.applySink();
  }

  private applySink(): void {
    const context = this.context;
    if (!context) return;
    const requested = this.sinkId;
    context.setSinkId(requested).catch(() => {
      // The device vanished (unplugged, renamed). Fall back to the default,
      // unless a newer choice has already replaced this one.
      if (this.sinkId !== requested) return;
      this.sinkId = "";
      void context.setSinkId("").catch(() => {});
    });
  }

  munch(): void {
    this.play(
      MUNCH_SOURCES[Math.floor(Math.random() * MUNCH_SOURCES.length)],
      0.75
    );
  }

  wiggle(): void {
    this.play(poopWiggle, 0.85);
  }

  release(): void {
    this.play(poopRelease, 0.99);
  }

  private play(source: string, gain: number): void {
    if (this.muted) return;
    const context = this.ensure();
    if (!context || !this.master) return;
    const index = this.sources.indexOf(source);
    const buffer = index >= 0 ? this.buffers[index] : null;
    if (!buffer) {
      this.loadAll(context);
      return;
    }
    const node = context.createBufferSource();
    node.buffer = buffer;
    node.playbackRate.value = 1 + (Math.random() - 0.5) * 0.08;
    const envelope = context.createGain();
    envelope.gain.value = gain;
    node.connect(envelope);
    envelope.connect(this.master);
    node.start();
  }

  private ensure(): AudioContext | null {
    if (typeof AudioContext === "undefined") return null;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
      this.master.connect(this.context.destination);
      this.applySink();
    }
    if (this.context.state === "suspended") void this.context.resume();
    return this.context;
  }

  private loadAll(context: AudioContext): void {
    if (this.loading) return;
    this.loading = true;
    this.sources.forEach((source, index) => {
      fetch(source)
        .then((response) => response.arrayBuffer())
        .then((data) => context.decodeAudioData(data))
        .then((buffer) => {
          this.buffers[index] = buffer;
        })
        .catch(() => {});
    });
  }
}
