import { describe, expect, it } from "vitest";
import { DesktopHabitat } from "../src/adapters/desktopHabitat";

describe("DesktopHabitat", () => {
  it("always offers a handful of in-bounds bite sites", () => {
    const habitat = new DesktopHabitat();
    habitat.resize(1200, 800);
    const snapshot = habitat.snapshot(0);
    expect(snapshot.edibles.length).toBeGreaterThan(0);
    expect(snapshot.worldWidth).toBe(1200);
    expect(snapshot.worldHeight).toBe(800);
    for (const food of snapshot.edibles) {
      expect(food.rect.x).toBeGreaterThanOrEqual(0);
      expect(food.rect.x + food.rect.width).toBeLessThanOrEqual(1200);
      expect(food.rect.y + food.rect.height).toBeLessThanOrEqual(800);
    }
  });

  it("swaps an eaten site for a new one and never edits anything", () => {
    const habitat = new DesktopHabitat();
    habitat.resize(1000, 700);
    const food = habitat.snapshot(0).edibles[0];
    const matter = habitat.eat(food);
    expect(matter).not.toBeNull();
    expect(
      habitat.snapshot(0).edibles.find((item) => item.id === food.id)
    ).toBeUndefined();
    expect(habitat.canRestore()).toBe(true);
    expect(habitat.restore(matter!)).toBe(true);
  });
});
