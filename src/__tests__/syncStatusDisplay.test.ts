import { describe, it, expect } from "vitest";
import { deriveSyncDisplay, formatAge } from "../hooks/useSyncStatus";
import type { SyncState } from "../services/syncStatusStore";

function makeState(overrides: Partial<SyncState> = {}): SyncState {
  return {
    phase: "idle",
    online: true,
    lastSyncAt: null,
    lastErrorAt: null,
    nextRetryAt: null,
    ...overrides,
  };
}

const NOW = 1_700_000_000_000;

describe("formatAge", () => {
  it.each([
    [0, "à l'instant"],
    [30_000, "à l'instant"],
    [59_999, "à l'instant"],
    [60_000, "il y a 1 min"],
    [5 * 60_000, "il y a 5 min"],
    [59 * 60_000, "il y a 59 min"],
    [60 * 60_000, "il y a 1 h"],
    [23 * 60 * 60_000, "il y a 23 h"],
    [24 * 60 * 60_000, "il y a 1 j"],
    [3 * 24 * 60 * 60_000, "il y a 3 j"],
  ])("formats %d ms as %s", (ms, expected) => {
    expect(formatAge(ms)).toBe(expected);
  });
});

describe("deriveSyncDisplay", () => {
  it("shows offline message even while syncing or with pending errors", () => {
    const display = deriveSyncDisplay(
      makeState({
        online: false,
        phase: "syncing",
        lastErrorAt: new Date(NOW).toISOString(),
      }),
      NOW
    );

    expect(display.isError).toBe(true);
    expect(display.text).toBe(
      "Hors ligne — synchronisation dès le retour de la connexion"
    );
  });

  it("shows syncing message while a sync is running", () => {
    const display = deriveSyncDisplay(makeState({ phase: "syncing" }), NOW);

    expect(display.isError).toBe(false);
    expect(display.text).toBe("Synchronisation en cours…");
  });

  it("shows error with countdown when a retry is scheduled", () => {
    const display = deriveSyncDisplay(
      makeState({
        lastErrorAt: new Date(NOW).toISOString(),
        nextRetryAt: NOW + 8_000,
      }),
      NOW
    );

    expect(display.isError).toBe(true);
    expect(display.text).toBe(
      "Échec de la synchronisation · nouvelle tentative dans 8s"
    );
  });

  it("rounds the countdown up to the next second", () => {
    const display = deriveSyncDisplay(
      makeState({
        lastErrorAt: new Date(NOW).toISOString(),
        nextRetryAt: NOW + 8_400,
      }),
      NOW
    );

    expect(display.text).toContain("nouvelle tentative dans 9s");
  });

  it("shows the countdown in minutes for waits of a minute or more", () => {
    const display = deriveSyncDisplay(
      makeState({
        lastErrorAt: new Date(NOW).toISOString(),
        nextRetryAt: NOW + 60_000,
      }),
      NOW
    );

    expect(display.text).toBe(
      "Échec de la synchronisation · nouvelle tentative dans 1 min"
    );
  });

  it("falls back to a static message once the countdown expires", () => {
    const display = deriveSyncDisplay(
      makeState({
        lastErrorAt: new Date(NOW).toISOString(),
        nextRetryAt: NOW - 1,
      }),
      NOW
    );

    expect(display.isError).toBe(true);
    expect(display.text).toBe("Échec de la synchronisation");
  });

  it("falls back to a static message when no retry is scheduled", () => {
    const display = deriveSyncDisplay(
      makeState({ lastErrorAt: new Date(NOW).toISOString() }),
      NOW
    );

    expect(display.isError).toBe(true);
    expect(display.text).toBe("Échec de la synchronisation");
  });

  it("ignores an error that predates the last successful sync", () => {
    const display = deriveSyncDisplay(
      makeState({
        lastSyncAt: new Date(NOW).toISOString(),
        lastErrorAt: new Date(NOW - 60_000).toISOString(),
        nextRetryAt: NOW + 8_000,
      }),
      NOW
    );

    expect(display.isError).toBe(false);
    expect(display.text).toContain("Vos plats sont synchronisés");
  });

  it("shows relative time since the last successful sync", () => {
    const display = deriveSyncDisplay(
      makeState({ lastSyncAt: new Date(NOW - 5 * 60_000).toISOString() }),
      NOW
    );

    expect(display.isError).toBe(false);
    expect(display.text).toBe("Vos plats sont synchronisés · il y a 5 min");
  });

  it("shows 'à l'instant' right after a successful sync", () => {
    const display = deriveSyncDisplay(
      makeState({ lastSyncAt: new Date(NOW - 4_000).toISOString() }),
      NOW
    );

    expect(display.text).toBe("Vos plats sont synchronisés · à l'instant");
  });

  it("clamps negative ages caused by clock skew", () => {
    const display = deriveSyncDisplay(
      makeState({ lastSyncAt: new Date(NOW + 120_000).toISOString() }),
      NOW
    );

    expect(display.text).toContain("à l'instant");
  });

  it("shows waiting message when never synced and idle", () => {
    const display = deriveSyncDisplay(makeState(), NOW);

    expect(display.isError).toBe(false);
    expect(display.text).toBe("Synchronisation en attente…");
  });
});
