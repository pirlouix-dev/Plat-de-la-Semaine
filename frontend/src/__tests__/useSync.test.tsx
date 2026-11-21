import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useSync } from "../hooks/useSync";
import { AUTH_CHANGED_EVENT } from "../services/api";

const { mockStartAutoSync, mockSync, mockDb, mockDbState } = vi.hoisted(() => ({
  mockStartAutoSync: vi.fn(() => vi.fn()),
  mockSync: vi.fn(),
  mockDb: { name: "test-db" },
  mockDbState: { dbUserId: null as string | null },
}));

vi.mock("../services/syncService", () => ({
  startAutoSync: mockStartAutoSync,
  sync: mockSync,
}));

vi.mock("../db/DatabaseContext", () => ({
  useDatabase: () => ({ db: mockDb, dbUserId: mockDbState.dbUserId }),
}));

function Harness() {
  useSync();
  return null;
}

function login(userId = "user-1") {
  act(() => {
    localStorage.setItem("user_id", userId);
    mockDbState.dbUserId = userId;
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  });
}

function logout() {
  act(() => {
    localStorage.removeItem("user_id");
    mockDbState.dbUserId = null;
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  });
}

describe("useSync", () => {
  beforeEach(() => {
    localStorage.clear();
    mockDbState.dbUserId = null;
    mockStartAutoSync.mockClear();
    mockSync.mockClear();
  });

  it("does not start auto-sync when logged out", () => {
    render(<Harness />);
    expect(mockStartAutoSync).not.toHaveBeenCalled();
  });

  it("starts auto-sync when the user logs in", () => {
    render(<Harness />);
    expect(mockStartAutoSync).not.toHaveBeenCalled();

    login();

    expect(mockStartAutoSync).toHaveBeenCalledTimes(1);
    expect(mockStartAutoSync).toHaveBeenCalledWith(mockDb);
  });

  it("stops auto-sync when the user logs out", () => {
    render(<Harness />);
    login();
    const cleanup = mockStartAutoSync.mock.results[0].value;

    logout();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("does not start auto-sync while the database belongs to another account", () => {
    localStorage.setItem("user_id", "user-2");
    mockDbState.dbUserId = "user-1";

    render(<Harness />);

    expect(mockStartAutoSync).not.toHaveBeenCalled();
  });
});
