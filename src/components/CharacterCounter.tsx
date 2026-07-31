import type { CharacterCounterOptions } from "./characterCounterUtils";
import { shouldShowCharacterCounter } from "./characterCounterUtils";

interface CharacterCounterProps extends CharacterCounterOptions {
  value: string;
  maxLength: number;
}

function CharacterCounter({
  value,
  maxLength,
  threshold,
  alwaysVisible,
}: CharacterCounterProps) {
  const count = value.length;
  if (!shouldShowCharacterCounter(count, maxLength, { threshold, alwaysVisible })) {
    return null;
  }

  const isOverLimit = count > maxLength;

  return (
    <span
      className={`character-counter ${isOverLimit ? "over" : ""}`}
      aria-live="polite"
    >
      {count}/{maxLength}
    </span>
  );
}

export default CharacterCounter;
