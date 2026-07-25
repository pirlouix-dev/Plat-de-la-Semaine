import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

describe("Asset files — unused .png removed (issue #16)", () => {
  const assetsDir = resolve(__dirname, "../../assets");

  it("should keep the used logo.png", () => {
    expect(existsSync(resolve(assetsDir, "logo.png"))).toBe(true);
  });

  it("should keep all five used .webp assets", () => {
    expect(existsSync(resolve(assetsDir, "book.webp"))).toBe(true);
    expect(existsSync(resolve(assetsDir, "add.webp"))).toBe(true);
    expect(existsSync(resolve(assetsDir, "pencil.webp"))).toBe(true);
    expect(existsSync(resolve(assetsDir, "wheel.webp"))).toBe(true);
    expect(existsSync(resolve(assetsDir, "textbox.webp"))).toBe(true);
  });

  it("should have removed the unused add.png", () => {
    expect(existsSync(resolve(assetsDir, "add.png"))).toBe(false);
  });

  it("should have removed the unused book.png", () => {
    expect(existsSync(resolve(assetsDir, "book.png"))).toBe(false);
  });

  it("should have removed the unused pencil.png", () => {
    expect(existsSync(resolve(assetsDir, "pencil.png"))).toBe(false);
  });

  it("should have removed the unused wheel.png", () => {
    expect(existsSync(resolve(assetsDir, "wheel.png"))).toBe(false);
  });

  it("should only reference .webp and logo.png in MainMenuPage.tsx imports", () => {
    const mainMenuPath = resolve(__dirname, "../pages/MainMenuPage.tsx");
    const content = readFileSync(mainMenuPath, "utf-8");
    // Extract all asset imports
    const assetImports = content.match(/from\s+"[./]+assets\/([^"]+)"/g) || [];
    expect(assetImports.length).toBe(6);
    expect(assetImports.some((imp) => imp.includes("logo.png"))).toBe(true);
    expect(assetImports.some((imp) => imp.includes("book.webp"))).toBe(true);
    expect(assetImports.some((imp) => imp.includes("add.webp"))).toBe(true);
    expect(assetImports.some((imp) => imp.includes("pencil.webp"))).toBe(true);
    expect(assetImports.some((imp) => imp.includes("wheel.webp"))).toBe(true);
    expect(assetImports.some((imp) => imp.includes("textbox.webp"))).toBe(true);
    // No .png imports other than logo.png
    const pngImports = assetImports.filter(
      (imp) => imp.includes(".png") && !imp.includes("logo.png")
    );
    expect(pngImports.length).toBe(0);
  });
});
