import { describe, it, expect } from "vitest";
import { areDishesReady } from "../utils/dishesReady";

const base = {
  isLoaded: true,
  hasDishes: false,
  isLoggedIn: true,
  online: true,
  hasSyncedOnce: false,
};

describe("areDishesReady", () => {
  it("is not ready until the collection has loaded", () => {
    expect(areDishesReady({ ...base, isLoaded: false })).toBe(false);
  });

  it("is ready as soon as dishes are cached locally", () => {
    expect(areDishesReady({ ...base, hasDishes: true })).toBe(true);
  });

  it("is ready for guests even without dishes", () => {
    expect(areDishesReady({ ...base, isLoggedIn: false })).toBe(true);
  });

  it("is ready when offline, since nothing else will arrive", () => {
    expect(areDishesReady({ ...base, online: false })).toBe(true);
  });

  it("waits for the first sync when online and empty", () => {
    expect(areDishesReady(base)).toBe(false);
  });

  it("is ready once a sync cycle has completed", () => {
    expect(areDishesReady({ ...base, hasSyncedOnce: true })).toBe(true);
  });
});
