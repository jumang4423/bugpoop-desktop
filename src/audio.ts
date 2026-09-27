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

export class SoundKit {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
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

  munch(): void {
    this.play(
      MUNCH_SOURCES[Math.floor(Math.random() * MUNCH_SOURCES.length)],
      1
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
