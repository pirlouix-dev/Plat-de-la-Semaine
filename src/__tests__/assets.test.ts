import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

describe("Asset files — unused .png removed (issue #16)", () => {
  const assetsDir = resolve(__dirname, "../../assets");

  it("should keep the used logo.png", () => {
    expect(existsSync(resolve(assetsDir, "logo.png"))).toBe(true);
  });

  it("should keep all four used .webp assets", () => {
    expect(existsSync(resolve(assetsDir, "choose_menu.webp"))).toBe(true);
    expect(existsSync(resolve(assetsDir, "add_dish.webp"))).toBe(true);
    expect(existsSync(resolve(assetsDir, "edit_dish.webp"))).toBe(true);
    expect(existsSync(resolve(assetsDir, "settings.webp"))).toBe(true);
  });

  it("should have removed the unused add_dish.png", () => {
    expect(existsSync(resolve(assetsDir, "add_dish.png"))).toBe(false);
  });

  it("should have removed the unused choose_menu.png", () => {
    expect(existsSync(resolve(assetsDir, "choose_menu.png"))).toBe(false);
  });

  it("should have removed the unused edit_dish.png", () => {
    expect(existsSync(resolve(assetsDir, "edit_dish.png"))).toBe(false);
  });

  it("should have removed the unused settings.png", () => {
    expect(existsSync(resolve(assetsDir, "settings.png"))).toBe(false);
  });

  it("should only reference .webp and logo.png in MainMenu.tsx imports", () => {
    const mainMenuPath = resolve(__dirname, "../MainMenu.tsx");
    const content = readFileSync(mainMenuPath, "utf-8");
    // Extract all asset imports
    const assetImports = content.match(/from\s+"\.\.\/assets\/([^"]+)"/g) || [];
    expect(assetImports.length).toBe(5);
    expect(assetImports.some((imp) => imp.includes("logo.png"))).toBe(true);
    expect(assetImports.some((imp) => imp.includes("choose_menu.webp"))).toBe(true);
    expect(assetImports.some((imp) => imp.includes("add_dish.webp"))).toBe(true);
    expect(assetImports.some((imp) => imp.includes("edit_dish.webp"))).toBe(true);
    expect(assetImports.some((imp) => imp.includes("settings.webp"))).toBe(true);
    // No .png imports other than logo.png
    const pngImports = assetImports.filter(
      (imp) => imp.includes(".png") && !imp.includes("logo.png")
    );
    expect(pngImports.length).toBe(0);
  });
});
