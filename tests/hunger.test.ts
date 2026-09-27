import { describe, expect, it } from "vitest";
import { hungerScaleFor } from "../src/hunger";

describe("hungerScaleFor", () => {
  it("freezes appetite at 0", () => {
    expect(hungerScaleFor(0)).toBe(0);
  });

  it("matches the original pace at 35", () => {
    expect(hungerScaleFor(35)).toBeCloseTo(1, 6);
  });

  it("makes meals instant at 100", () => {
    expect(hungerScaleFor(100)).toBe(Infinity);
  });

  it("rises monotonically and clamps out-of-range input", () => {
    let previous = -1;
    for (let value = 0; value <= 100; value += 5) {
      const scale = hungerScaleFor(value);
      expect(scale).toBeGreaterThanOrEqual(previous);
      previous = scale;
    }
    expect(hungerScaleFor(-20)).toBe(0);
    expect(hungerScaleFor(999)).toBe(Infinity);
  });
});
