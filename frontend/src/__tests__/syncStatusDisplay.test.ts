import { describe, it, expect } from "vitest";
import { deriveSyncDisplay, formatAge } from "../hooks/useSyncStatus";
import type { SyncState } from "../services/syncStatusStore";
import { createTranslator } from "../i18n";

const t = createTranslator("en");
const fr = createTranslator("fr");

function makeState(overrides: Partial<SyncState> = {}): SyncState {
  return {
    phase: "idle",
    online: true,
    lastSyncAt: null,
    lastErrorAt: null,
    retryCount: 0,
    ...overrides,
  };
}

const NOW = 1_700_000_000_000;

describe("formatAge", () => {
  it.each([
    [0, t("sync.age.now")],
    [30_000, t("sync.age.now")],
    [59_999, t("sync.age.now")],
    [60_000, t("sync.age.minutes", { count: 1 })],
    [5 * 60_000, t("sync.age.minutes", { count: 5 })],
    [59 * 60_000, t("sync.age.minutes", { count: 59 })],
    [60 * 60_000, t("sync.age.hours", { count: 1 })],
    [23 * 60 * 60_000, t("sync.age.hours", { count: 23 })],
    [24 * 60 * 60_000, t("sync.age.days", { count: 1 })],
    [3 * 24 * 60 * 60_000, t("sync.age.days", { count: 3 })],
  ])("formats %d ms as %s", (ms, expected) => {
    expect(formatAge(ms, t)).toBe(expected);
  });

  it("uses the French catalogue when asked", () => {
    expect(formatAge(5 * 60_000, fr)).toBe(
      fr("sync.age.minutes", { count: 5 }),
    );
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
      NOW,
      t,
    );

    expect(display.isError).toBe(true);
    expect(display.text).toBe(t("sync.offline"));
  });

  it("shows syncing message while a sync is running", () => {
    const display = deriveSyncDisplay(
      makeState({ phase: "syncing" }),
      NOW,
      t,
    );

    expect(display.isError).toBe(false);
    expect(display.text).toBe(t("sync.syncing"));
  });

  it("shows error with attempt count when retrying", () => {
    const display = deriveSyncDisplay(
      makeState({
        lastErrorAt: new Date(NOW).toISOString(),
        retryCount: 3,
      }),
      NOW,
      t,
    );

    expect(display.isError).toBe(true);
    expect(display.text).toBe(t("sync.failedRetry", { count: 3 }));
  });

  it("shows static error when retryCount is 0", () => {
    const display = deriveSyncDisplay(
      makeState({
        lastErrorAt: new Date(NOW).toISOString(),
        retryCount: 0,
      }),
      NOW,
      t,
    );

    expect(display.isError).toBe(true);
    expect(display.text).toBe(t("sync.failed"));
  });

  it("falls back to a static message when no retry is scheduled", () => {
    const display = deriveSyncDisplay(
      makeState({ lastErrorAt: new Date(NOW).toISOString() }),
      NOW,
      t,
    );

    expect(display.isError).toBe(true);
    expect(display.text).toBe(t("sync.failed"));
  });

  it("ignores an error that predates the last successful sync", () => {
    const display = deriveSyncDisplay(
      makeState({
        lastSyncAt: new Date(NOW).toISOString(),
        lastErrorAt: new Date(NOW - 60_000).toISOString(),
        retryCount: 3,
      }),
      NOW,
      t,
    );

    expect(display.isError).toBe(false);
    expect(display.text).toBe(
      t("sync.synced", { age: t("sync.age.now") }),
    );
  });

  it("shows relative time since the last successful sync", () => {
    const display = deriveSyncDisplay(
      makeState({ lastSyncAt: new Date(NOW - 5 * 60_000).toISOString() }),
      NOW,
      t,
    );

    expect(display.isError).toBe(false);
    expect(display.text).toBe(
      t("sync.synced", { age: t("sync.age.minutes", { count: 5 }) }),
    );
  });

  it("shows the 'just now' age right after a successful sync", () => {
    const display = deriveSyncDisplay(
      makeState({ lastSyncAt: new Date(NOW - 4_000).toISOString() }),
      NOW,
      t,
    );

    expect(display.text).toBe(
      t("sync.synced", { age: t("sync.age.now") }),
    );
  });

  it("clamps negative ages caused by clock skew", () => {
    const display = deriveSyncDisplay(
      makeState({ lastSyncAt: new Date(NOW + 120_000).toISOString() }),
      NOW,
      t,
    );

    expect(display.text).toContain(t("sync.age.now"));
  });

  it("shows waiting message when never synced and idle", () => {
    const display = deriveSyncDisplay(makeState(), NOW, t);

    expect(display.isError).toBe(false);
    expect(display.text).toBe(t("sync.waiting"));
  });

  it("localises the display with the French catalogue", () => {
    const display = deriveSyncDisplay(makeState(), NOW, fr);

    expect(display.text).toBe(fr("sync.waiting"));
    expect(display.text).not.toBe(t("sync.waiting"));
  });
});
