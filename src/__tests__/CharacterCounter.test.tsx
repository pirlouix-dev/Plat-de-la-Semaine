import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CharacterCounter from "../components/CharacterCounter";
import { shouldShowCharacterCounter } from "../components/characterCounterUtils";
import {
  MAX_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_FEEDBACK_LENGTH,
  MAX_USERNAME_LENGTH,
  CHAR_LIMIT_THRESHOLD,
} from "../types";

// ── Pure visibility logic ────────────────────────────────────────────────────

describe("shouldShowCharacterCounter", () => {
  it("shows when 20 or fewer characters remain", () => {
    expect(shouldShowCharacterCounter(180, 200)).toBe(true);
    expect(shouldShowCharacterCounter(181, 200)).toBe(true);
    expect(shouldShowCharacterCounter(200, 200)).toBe(true);
  });

  it("hides when more than 20 characters remain", () => {
    expect(shouldShowCharacterCounter(179, 200)).toBe(false);
    expect(shouldShowCharacterCounter(0, 200)).toBe(false);
  });

  it("respects the configured threshold", () => {
    expect(shouldShowCharacterCounter(990, 1000, { threshold: 10 })).toBe(true);
    expect(shouldShowCharacterCounter(989, 1000, { threshold: 10 })).toBe(false);
  });

  it("uses the shared CHAR_LIMIT_THRESHOLD as default", () => {
    expect(CHAR_LIMIT_THRESHOLD).toBe(20);
    expect(shouldShowCharacterCounter(180, MAX_NAME_LENGTH)).toBe(true);
    expect(shouldShowCharacterCounter(179, MAX_NAME_LENGTH)).toBe(false);
  });

  it("always shows when alwaysVisible is set, even when far from the limit", () => {
    expect(shouldShowCharacterCounter(0, 2000, { alwaysVisible: true })).toBe(true);
    expect(shouldShowCharacterCounter(500, 2000, { alwaysVisible: true })).toBe(true);
  });
});

// ── Component behaviour ──────────────────────────────────────────────────────

describe("CharacterCounter", () => {
  it("renders count/max when within the threshold", () => {
    render(<CharacterCounter value={"a".repeat(185)} maxLength={200} />);
    expect(screen.getByText("185/200")).toBeTruthy();
  });

  it("is not in the DOM when far from the limit", () => {
    render(<CharacterCounter value="abc" maxLength={200} />);
    expect(screen.queryByText(/^\d+\/200$/)).toBeNull();
  });

  it("still renders when over the limit, showing the exceeded count", () => {
    render(<CharacterCounter value={"a".repeat(205)} maxLength={200} />);
    expect(screen.getByText("205/200")).toBeTruthy();
  });

  it("renders even for an empty value when alwaysVisible is set", () => {
    render(<CharacterCounter value="" maxLength={2000} alwaysVisible />);
    expect(screen.getByText("0/2000")).toBeTruthy();
  });

  it("respects the max length constants", () => {
    expect(MAX_NAME_LENGTH).toBe(200);
    expect(MAX_DESCRIPTION_LENGTH).toBe(5000);
    expect(MAX_FEEDBACK_LENGTH).toBe(2000);
    expect(MAX_USERNAME_LENGTH).toBe(100);
  });
});
