import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

describe("App.tsx — dead code removed (issue #2)", () => {
  const appPath = resolve(__dirname, "../App.tsx");
  const content = readFileSync(appPath, "utf-8");

  it("should not contain the fetchHelloMessage function", () => {
    expect(content).not.toMatch(/fetchHelloMessage/);
  });

  it("should not contain the ApiResponse interface", () => {
    expect(content).not.toMatch(/interface ApiResponse/);
  });

  it("should not contain the AI instruction comment", () => {
    expect(content).not.toMatch(/GEMINI INSTRUCTION/);
  });

  it("should not contain unused useState for setMessage or setError", () => {
    expect(content).not.toMatch(/\bsetMessage\b/);
    expect(content).not.toMatch(/\bsetError\b/);
  });

  it("should not import useState (no longer needed)", () => {
    expect(content).not.toMatch(/\buseState\b/);
  });

  it("should still use useEffect for database initialization", () => {
    expect(content).toMatch(/useEffect/);
    expect(content).toMatch(/dishDB\.addCollections/);
  });

  it("should still render MainMenu", () => {
    expect(content).toMatch(/return\s*<\s*MainMenu\s*\/>/);
  });

  it("should still export App as default", () => {
    expect(content).toMatch(/export default App/);
  });
});
