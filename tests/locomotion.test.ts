import { describe, expect, it } from "vitest";
import { CaterpillarBody } from "../src/bug/body";
import type { BodyControl } from "../src/bug/types";

// The desktop app uses the "compact" preset from appearance.ts.
const BODY_OPTIONS = { segmentCount: 4, legPairNodes: [1, 2, 3] };

// Match the world loop: LOCOMOTION_TIME_SCALE body updates per fixed step.
const WORLD_SUBSTEPS = 5;
const FIXED_STEP = 1 / 60;

// Far from any wall so edge steering never interferes.
const BOUNDS = { x: -20000, y: -20000, width: 40000, height: 40000 };

export interface LocomotionMetrics {
  speed: number;
  /** Mean along-track speed (px/s). */
  meanSpeed: number;
  /** Coefficient of variation of the per-step along-track speed. */
  speedCv: number;
  /** RMS sideways drift per step (px). */
  lateralRms: number;
  /** Mean sideways drift per step (px). A steady curve, not a wobble. */
  meanLateral: number;
  /** Wobble: sideways deviation from that mean (px). */
  lateralStd: number;
  driveMean: number;
  driveCv: number;
  supportMean: number;
  reachMean: number;
  maxReachMean: number;
}

function control(speed: number, direction = { x: 1, y: 0 }): BodyControl {
  return {
    direction,
    speed,
    gaitHz: 4.2,
    wriggle: 0.55,
    sleep: 0,
    fear: 0,
    gut: 0,
    chew: 0,
    poop: 0,
    edgeAvoidance: 1,
  };
}

function meanOf(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function cv(values: number[]): number {
  const mean = meanOf(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / Math.max(1e-6, Math.abs(mean));
}

function makeBody(): CaterpillarBody {
  const body = new CaterpillarBody({ x: 0, y: 0 }, { ...BODY_OPTIONS });
  body.growth = 1;
  return body;
}

export function measureLocomotion(speed: number, seconds = 6): LocomotionMetrics {
  const body = makeBody();
  const ctrl = control(speed);
  const advance = () => {
    for (let substep = 0; substep < WORLD_SUBSTEPS; substep += 1) {
      body.update(FIXED_STEP, ctrl, BOUNDS);
    }
  };
  for (let step = 0; step < 180; step += 1) advance();

  const along: number[] = [];
  const lateral: number[] = [];
  const drive: number[] = [];
  const support: number[] = [];
  const reach: number[] = [];
  const maxReach: number[] = [];
  let previous = { ...body.head };
  for (let step = 0; step < seconds * 60; step += 1) {
    advance();
    const head = body.head;
    along.push(head.x - previous.x);
    lateral.push(head.y - previous.y);
    previous = { ...head };
    drive.push(body.debug.commandedSpeed);
    support.push(body.debug.support);
    reach.push(body.debug.reach);
    maxReach.push(body.debug.maxReach);
  }

  const meanLateral = meanOf(lateral);
  return {
    speed,
    meanSpeed: meanOf(along) * 60,
    speedCv: cv(along),
    lateralRms: Math.sqrt(meanOf(lateral.map((value) => value * value))),
    meanLateral,
    lateralStd: Math.sqrt(
      meanOf(lateral.map((value) => (value - meanLateral) ** 2))
    ),
    driveMean: meanOf(drive),
    driveCv: cv(drive),
    supportMean: meanOf(support),
    reachMean: meanOf(reach),
    maxReachMean: meanOf(maxReach),
  };
}

/** Drives the body along a constant-radius circle and reports the turn taken. */
export function measureTurning(speed: number, turnRadPerSecond: number) {
  const body = makeBody();
  let angle = 0;
  const advance = () => {
    for (let substep = 0; substep < WORLD_SUBSTEPS; substep += 1) {
      body.update(
        FIXED_STEP,
        control(speed, { x: Math.cos(angle), y: Math.sin(angle) }),
        BOUNDS
      );
    }
    angle += turnRadPerSecond * (WORLD_SUBSTEPS * FIXED_STEP);
  };
  for (let step = 0; step < 180; step += 1) advance();
  const start = body.head;
  let travelled = 0;
  let previous = { ...start };
  for (let step = 0; step < 6 * 60; step += 1) {
    advance();
    travelled += Math.hypot(
      body.head.x - previous.x,
      body.head.y - previous.y
    );
    previous = { ...body.head };
  }
  return { angle, travelled, heading: body.headingAngle };
}

const SPEEDS = [15, 25, 40, 60, 110, 150, 220];

describe("CaterpillarBody locomotion", () => {
  it("moves straight without speed ripple", () => {
    const metrics = SPEEDS.map((speed) => measureLocomotion(speed));
    for (const metric of metrics) {
      console.log(
        `speed=${metric.speed} mean=${metric.meanSpeed.toFixed(1)}px/s cv=${metric.speedCv.toFixed(3)} lateralStd=${metric.lateralStd.toFixed(2)}px driveCv=${metric.driveCv.toFixed(3)} support=${metric.supportMean.toFixed(2)} reach=${metric.reachMean.toFixed(2)} maxReach=${metric.maxReachMean.toFixed(2)}`
      );
    }
    for (const metric of metrics) {
      // The whole point: no speed-dependent surge.
      expect(metric.speedCv).toBeLessThan(0.07);
      expect(metric.driveCv).toBeLessThan(0.05);
      // No sideways wobble (a gentle steady curve is fine).
      expect(metric.lateralStd).toBeLessThan(1.5);
      // Support never collapses.
      expect(metric.supportMean).toBeGreaterThan(0.9);
      // The reach brake should stay out of the way.
      expect(metric.reachMean).toBeGreaterThan(0.9);
    }
  });

  it("still turns when asked", () => {
    const result = measureTurning(130, 1.2);
    // It should actually turn (not just cut a straight line) and keep moving.
    expect(Math.abs(result.heading)).toBeGreaterThan(0.1);
    expect(result.travelled).toBeGreaterThan(2500);
  });
});
