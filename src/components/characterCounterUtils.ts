import { CHAR_LIMIT_THRESHOLD } from "../types";

export interface CharacterCounterOptions {
  /** Number of characters left at which the counter becomes visible (default 20) */
  threshold?: number;
  /** Always show the counter, regardless of proximity to the limit */
  alwaysVisible?: boolean;
}

export function shouldShowCharacterCounter(
  count: number,
  maxLength: number,
  { threshold = CHAR_LIMIT_THRESHOLD, alwaysVisible = false }: CharacterCounterOptions = {},
): boolean {
  if (alwaysVisible) return true;
  return maxLength - count <= threshold;
}
