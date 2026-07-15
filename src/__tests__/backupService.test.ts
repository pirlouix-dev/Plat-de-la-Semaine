import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getBackups, restoreBackup } from "../services/backupService";
import { setBaseUrl } from "../services/api";
import type { BackupSummary, RestoreBackupResponse } from "../types";

// ── Test data ────────────────────────────────────────────────────────────────

const FAKE_BASE_URL = "http://test.local:5126";

const SAMPLE_BACKUPS: BackupSummary[] = [
  {
    id: "back-1",
    label: "Before edit: Carbonara",
    createdAt: "2026-07-14T17:48:00Z",
    dishCount: 12,
  },
  {
    id: "back-2",
    label: "Before delete: Salade",
    createdAt: "2026-07-14T18:00:00Z",
    dishCount: 11,
  },
];

const SAMPLE_RESTORE_RESPONSE: RestoreBackupResponse = {
  backupId: "back-1",
  restoredCount: 12,
  safetyBackupCreatedAt: "2026-07-14T18:05:00Z",
};

// ── Mock helpers ─────────────────────────────────────────────────────────────

function mockFetchResponse(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: vi.fn().mockResolvedValue(body),
    } as Response)
  );
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  setBaseUrl(FAKE_BASE_URL);
  vi.useFakeTimers();
});

afterEach(() => {
  setBaseUrl(undefined);
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("getBackups", () => {
  it("returns a list of backup summaries on success", async () => {
    mockFetchResponse(200, { data: SAMPLE_BACKUPS, total: 2 });

    const result = await getBackups();
    expect(result).toEqual({ ok: true, data: SAMPLE_BACKUPS });
  });

  it("returns an empty array when no backups exist", async () => {
    mockFetchResponse(200, { data: [], total: 0 });

    const result = await getBackups();
    expect(result).toEqual({ ok: true, data: [] });
  });

  it("propagates API errors", async () => {
    mockFetchResponse(500, {
      code: "SERVER_ERROR",
      message: "Internal server error",
    });

    const result = await getBackups();
    expect(result).toEqual({
      ok: false,
      error: { code: "SERVER_ERROR", message: "Internal server error" },
    });
  });

  it("calls GET /api/backups", async () => {
    mockFetchResponse(200, { data: [], total: 0 });

    await getBackups();
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    const options = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;

    expect(url).toBe(`${FAKE_BASE_URL}/api/backups`);
    expect(options.method ?? "GET").toBe("GET");
  });
});

describe("restoreBackup", () => {
  it("restores a backup and returns the result", async () => {
    mockFetchResponse(200, { data: SAMPLE_RESTORE_RESPONSE });

    const result = await restoreBackup("back-1");
    expect(result).toEqual({ ok: true, data: SAMPLE_RESTORE_RESPONSE });
  });

  it("calls POST /api/backups/restore/:id", async () => {
    mockFetchResponse(200, { data: SAMPLE_RESTORE_RESPONSE });

    await restoreBackup("back-1");
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    const options = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;

    expect(url).toBe(`${FAKE_BASE_URL}/api/backups/restore/back-1`);
    expect(options.method).toBe("POST");
    expect(options.body).toBeUndefined();
  });

  it("encodes special characters in backup ID", async () => {
    mockFetchResponse(200, { data: SAMPLE_RESTORE_RESPONSE });

    await restoreBackup("backup/id+special");
    const url = vi.mocked(fetch).mock.calls[0]?.[0] as string;
    expect(url).toBe(
      `${FAKE_BASE_URL}/api/backups/restore/backup%2Fid%2Bspecial`
    );
  });

  it("propagates not-found errors", async () => {
    mockFetchResponse(404, {
      code: "NOT_FOUND",
      message: "Backup not found",
    });

    const result = await restoreBackup("nonexistent");
    expect(result).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "Backup not found" },
    });
  });

  it("handles invalid backup data (malformed response)", async () => {
    // Backend returns malformed data — service still wraps it as-is
    mockFetchResponse(200, { data: { unexpected: "shape" } });

    const result = await restoreBackup("back-1");
    if (result.ok) {
      expect(result.data).toHaveProperty("unexpected", "shape");
    }
  });
});
