/**
 * Maps the 0..100 hunger-speed slider to the brain's metabolism multiplier.
 * `0` freezes appetite, `35` is the bug's original pace, and `100` is a
 * literal chain of meals: as soon as a bite finishes it is hungry again, so
 * it eats, poops, and eats again.
 */
export function hungerScaleFor(value: number): number {
  const speed = Math.max(0, Math.min(100, value));
  if (speed <= 0) return 0;
  if (speed >= 100) return Infinity;
  return Math.pow(10, ((speed - 35) / 65) * 2.5);
}
