import { describe, expect, it } from "vitest";
import { CaterpillarBrain } from "../src/bug/brain";
import type { BrainSenses, EdibleCode } from "../src/bug/types";

const bounds = { x: 0, y: 0, width: 1200, height: 800 };

const food: EdibleCode = {
  id: "f1",
  from: 1,
  to: 2,
  text: "nibble",
  kind: "modifier",
  nutrition: 0.8,
  heat: 0,
  rect: { x: 300, y: 300, width: 30, height: 30 },
};

function senses(overrides: Partial<BrainSenses> = {}): BrainSenses {
  const base: BrainSenses = {
    now: 0,
    deltaSeconds: 1 / 60,
    head: { x: 600, y: 400 },
    bounds,
    pointer: {
      position: { x: -9999, y: -9999 },
      velocity: { x: 0, y: 0 },
      speed: 0,
      active: false,
    },
    foods: [food],
    activeLineRect: null,
    chewing: false,
    toiletTarget: null,
  };
  return { ...base, ...overrides };
}

describe("CaterpillarBrain", () => {
  it("flees when the pointer comes close", () => {
    const brain = new CaterpillarBrain();
    const decision = brain.update(
      senses({
        pointer: {
          position: { x: 610, y: 405 },
          velocity: { x: 0, y: 0 },
          speed: 0,
          active: true,
        },
      })
    );
    expect(decision.behaviour).toBe("fleeing");
    expect(decision.control.fear).toBe(1);
  });

  it("hunts the nearest bite site once past hatching", () => {
    const brain = new CaterpillarBrain();
    brain.starve();
    let foraged = false;
    for (let step = 0; step < 180; step += 1) {
      const decision = brain.update(senses());
      if (decision.behaviour === "foraging") {
        expect(decision.targetFoodId).toBe("f1");
        foraged = true;
        break;
      }
    }
    expect(foraged).toBe(true);
  });

  it("loses appetite after a meal", () => {
    const brain = new CaterpillarBrain();
    brain.starve();
    brain.onEat(0.8);
    expect(brain.hunger).toBeLessThan(0.78);
  });
});
