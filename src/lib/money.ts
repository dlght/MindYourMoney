// Integer-cent conversion so summing/comparing amounts never accumulates
// native-float rounding error (constitution VI).
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
