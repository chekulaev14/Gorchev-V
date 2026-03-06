type DecimalLike = { toNumber(): number } | { toNumber?(): number } | number;

export function toNumber(value: DecimalLike): number;
export function toNumber(value: DecimalLike | null | undefined): number | null;
export function toNumber(value: DecimalLike | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}
