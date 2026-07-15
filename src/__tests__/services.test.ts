import { describe, it, expect } from "vitest";

/**
 * Barrel export tests for src/services/index.ts
 *
 * These tests verify that all expected exports are accessible
 * from the barrel module.
 */

describe("services barrel exports", () => {
  it("exports all API request builders and setBaseUrl", async () => {
    const services = await import("../services");
    expect(typeof services.apiGet).toBe("function");
    expect(typeof services.apiPost).toBe("function");
    expect(typeof services.apiPut).toBe("function");
    expect(typeof services.apiDelete).toBe("function");
    expect(typeof services.setBaseUrl).toBe("function");
  });

  it("exports all dish service functions", async () => {
    const services = await import("../services");
    expect(typeof services.getDishes).toBe("function");
    expect(typeof services.createDish).toBe("function");
    expect(typeof services.updateDish).toBe("function");
    expect(typeof services.deleteDish).toBe("function");
    expect(typeof services.sortDishes).toBe("function");
  });

  it("exports all backup service functions", async () => {
    const services = await import("../services");
    expect(typeof services.getBackups).toBe("function");
    expect(typeof services.restoreBackup).toBe("function");
  });

  it("exports all settings service functions", async () => {
    const services = await import("../services");
    expect(typeof services.getVersionInfo).toBe("function");
    expect(typeof services.submitFeedback).toBe("function");
  });

  it("module loads without error", async () => {
    const services = await import("../services");
    expect(services).toBeDefined();
  });
});
