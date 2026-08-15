import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { useSync } from "../hooks/useSync";
import { AUTH_CHANGED_EVENT } from "../services/api";

const { mockStartAutoSync, mockSync, mockDb } = vi.hoisted(() => ({
  mockStartAutoSync: vi.fn(() => vi.fn()),
  mockSync: vi.fn(),
  mockDb: { name: "test-db" },
}));

vi.mock("../services/syncService", () => ({
  startAutoSync: mockStartAutoSync,
  sync: mockSync,
}));

vi.mock("../db/DatabaseContext", () => ({
  useDatabase: () => ({ db: mockDb }),
}));

function Harness() {
  useSync();
  return null;
}

function login() {
  act(() => {
    localStorage.setItem("user_id", "user-1");
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  });
}

function logout() {
  act(() => {
    localStorage.removeItem("user_id");
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  });
}

describe("useSync", () => {
  beforeEach(() => {
    localStorage.clear();
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
});
