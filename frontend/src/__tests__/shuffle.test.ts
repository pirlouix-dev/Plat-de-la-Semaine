import { describe, it, expect, vi, afterEach } from "vitest";
import { shuffle } from "../utils/shuffle";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shuffle", () => {
  it("returns a permutation of the input", () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result).toHaveLength(input.length);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it("does not mutate the input array", () => {
    const input = [1, 2, 3];
    shuffle(input);
    expect(input).toEqual([1, 2, 3]);
  });

  it("is deterministic for a given Math.random sequence", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    // Fisher-Yates with random() === 0 always swaps index i with index 0
    expect(shuffle([1, 2, 3])).toEqual([2, 3, 1]);
  });

  it("handles empty and single-element arrays", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([42])).toEqual([42]);
  });
});
