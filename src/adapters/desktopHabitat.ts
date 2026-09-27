import { Random, type Vec2 } from "../bug/math";
import type {
  EdibleCode,
  EatenMatter,
  HabitatAdapter,
  HabitatSnapshot,
} from "../bug/types";

const FOOD_COUNT = 5;
const FOOD_SIZE = 30;
const EDGE_MARGIN = 96;

/**
 * The desktop "habitat": screen space plus a handful of invisible bite sites.
 *
 * The creature is the editor bug, unchanged; the only thing this replaces is
 * CodeMirror. `eat()` never edits anything, it just removes one imaginary
 * point, so the pet nibbles empty space and the desktop is untouched.
 */
export class DesktopHabitat implements HabitatAdapter {
  private readonly random = new Random(0x5eedb00);
  private edibles: EdibleCode[] = [];
  private width = 1280;
  private height = 720;
  private counter = 0;

  resize(width: number, height: number): void {
    this.width = Math.max(180, Math.round(width));
    this.height = Math.max(180, Math.round(height));
    // Drop anything that ended up outside the new screen.
    this.edibles = this.edibles.filter((food) => this.insideScreen(food));
    this.refill();
  }

  snapshot(_now: number): HabitatSnapshot {
    this.refill();
    return {
      worldWidth: this.width,
      worldHeight: this.height,
      viewportWidth: this.width,
      viewportHeight: this.height,
      scrollX: 0,
      scrollY: 0,
      canvasOffsetX: 0,
      canvasOffsetY: 0,
      activeLineRect: null,
      edibles: this.edibles,
    };
  }

  syncCamera(): void {
    // The overlay never scrolls.
  }

  stageToWorld(point: Vec2): Vec2 {
    return { x: point.x, y: point.y };
  }

  setChewing(): void {
    // There is no editor highlight to draw.
  }

  eat(edible: EdibleCode): EatenMatter | null {
    const index = this.edibles.findIndex((food) => food.id === edible.id);
    if (index < 0) return null;
    this.edibles.splice(index, 1);
    this.refill();
    return {
      id: `matter-${(this.counter += 1)}`,
      text: edible.text,
      mutatedText: edible.text,
      kind: edible.kind,
      nutrition: edible.nutrition,
    };
  }

  canRestore(): boolean {
    // Everything can be "restored": a dropping always spins away when touched.
    return true;
  }

  restore(_matter: EatenMatter): boolean {
    // Nothing to put back on the desktop.
    return true;
  }

  pulseRandom(): { position: Vec2; strength: number } | null {
    return null;
  }

  undoLastBite(): void {
    // No editor history.
  }

  private insideScreen(food: EdibleCode): boolean {
    return (
      food.rect.x > 0 &&
      food.rect.y > 0 &&
      food.rect.x + food.rect.width < this.width &&
      food.rect.y + food.rect.height < this.height
    );
  }

  private refill(): void {
    while (this.edibles.length < FOOD_COUNT) {
      this.edibles.push(this.makeFood());
    }
  }

  private makeFood(): EdibleCode {
    const x = this.random.between(
      EDGE_MARGIN,
      Math.max(EDGE_MARGIN + 1, this.width - EDGE_MARGIN)
    );
    const y = this.random.between(
      EDGE_MARGIN,
      Math.max(EDGE_MARGIN + 1, this.height - EDGE_MARGIN)
    );
    const from = (this.counter += 1);
    return {
      id: `bite-${from}`,
      from,
      to: from + 1,
      text: "nibble",
      kind: this.random.pick(["modifier", "function", "argument"] as const),
      nutrition: 0.5 + this.random.next() * 0.4,
      heat: 0,
      rect: {
        x: x - FOOD_SIZE / 2,
        y: y - FOOD_SIZE / 2,
        width: FOOD_SIZE,
        height: FOOD_SIZE,
      },
    };
  }
}
