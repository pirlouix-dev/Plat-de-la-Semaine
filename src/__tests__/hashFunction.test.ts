import { describe, it, expect } from "vitest";
import { hashFunction } from "../db/hashFunction";

describe("hashFunction", () => {
  it("returns a hex string for a string input", async () => {
    const result = await hashFunction("hello");
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("returns the same hash for the same input", async () => {
    const a = await hashFunction("dishes-data");
    const b = await hashFunction("dishes-data");
    expect(a).toBe(b);
  });

  it("returns different hashes for different inputs", async () => {
    const a = await hashFunction("foo");
    const b = await hashFunction("bar");
    expect(a).not.toBe(b);
  });

  it("handles ArrayBuffer input", async () => {
    const buf = new TextEncoder().encode("hello").buffer;
    const result = await hashFunction(buf);
    expect(result).toMatch(/^[0-9a-f]+$/);
    const fromString = await hashFunction("hello");
    expect(result).toBe(fromString);
  });

  it("handles Blob input", async () => {
    const blob = new Blob(["hello"]);
    const result = await hashFunction(blob);
    expect(result).toMatch(/^[0-9a-f]+$/);
    const fromString = await hashFunction("hello");
    expect(result).toBe(fromString);
  });

  it("produces a SHA-256 length hex string when crypto.subtle is available", async () => {
    const result = await hashFunction("test");
    // SHA-256 produces 64 hex chars
    expect(result).toHaveLength(64);
  });

  it("handles empty string", async () => {
    const result = await hashFunction("");
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("handles empty ArrayBuffer", async () => {
    const result = await hashFunction(new ArrayBuffer(0));
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it("handles empty Blob", async () => {
    const result = await hashFunction(new Blob([]));
    expect(result).toMatch(/^[0-9a-f]+$/);
  });
});
