import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDishes } from "../hooks/useDishes";

const mockDb = { name: "test-db" };

const { mockUseDatabase } = vi.hoisted(() => ({
  mockUseDatabase: vi.fn(),
}));

vi.mock("../db/DatabaseContext", () => ({
  useDatabase: (...args: unknown[]) => mockUseDatabase(...args),
}));

vi.mock("../repositories/dishRepository", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../repositories/dishRepository")>();
  return {
    ...actual,
    insertDish: vi.fn(),
    editDish: vi.fn(),
    softDeleteDish: vi.fn(),
    insertManyDishes: vi.fn(),
    observeDishes: vi.fn(() => ({
      subscribe: () => ({ unsubscribe: vi.fn() }),
    })),
  };
});

vi.mock("../services/syncService", () => ({
  requestDishFlush: vi.fn(),
}));

import * as dishRepository from "../repositories/dishRepository";
import { requestDishFlush } from "../services/syncService";

const mockRequestDishFlush = vi.mocked(requestDishFlush);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseDatabase.mockReturnValue({
    db: mockDb,
    isLoading: false,
    error: null,
  });
});

describe("useDishes", () => {
  describe("editDish", () => {
    it("calls repository editDish with correct arguments", async () => {
      const { result } = renderHook(() => useDishes());
      const fields = {
        name: "Updated",
        description: "desc",
        course: 1,
        seasons: [0, 1],
      };

      await act(async () => {
        await result.current.editDish("dish-1", fields);
      });

      expect(dishRepository.editDish).toHaveBeenCalledWith(
        mockDb,
        "dish-1",
        fields,
      );
      expect(mockRequestDishFlush).toHaveBeenCalledWith(mockDb);
    });

    it("does not trigger a flush when the write fails", async () => {
      vi.mocked(dishRepository.editDish).mockRejectedValueOnce(
        new Error("write failed"),
      );
      const { result } = renderHook(() => useDishes());

      await expect(
        result.current.editDish("dish-1", {
          name: "X",
          description: "",
          course: 0,
          seasons: [],
        }),
      ).rejects.toThrow("write failed");

      expect(mockRequestDishFlush).not.toHaveBeenCalled();
    });

    it("does not trigger a flush when database is not ready", async () => {
      mockUseDatabase.mockReturnValue({
        db: null,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => useDishes());

      await expect(
        result.current.editDish("dish-1", {
          name: "X",
          description: "",
          course: 0,
          seasons: [],
        }),
      ).rejects.toThrow("Database not ready");

      expect(mockRequestDishFlush).not.toHaveBeenCalled();
    });
  });

  describe("removeDish", () => {
    it("calls repository softDeleteDish with correct id", async () => {
      const { result } = renderHook(() => useDishes());

      await act(async () => {
        await result.current.removeDish("dish-2");
      });

      expect(dishRepository.softDeleteDish).toHaveBeenCalledWith(
        mockDb,
        "dish-2",
      );
      expect(mockRequestDishFlush).toHaveBeenCalledWith(mockDb);
    });

    it("throws when database is not ready", async () => {
      mockUseDatabase.mockReturnValue({
        db: null,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => useDishes());

      await expect(result.current.removeDish("dish-2")).rejects.toThrow(
        "Database not ready",
      );
    });
  });

  describe("importLocalDishes", () => {
    it("builds pending_create docs and bulk-inserts them", async () => {
      const { result } = renderHook(() => useDishes());
      const items = [
        {
          name: "Ratatouille",
          description: "Légumes",
          course: 1,
          seasons: [1, 2],
        },
      ] as Parameters<typeof result.current.importLocalDishes>[0];

      await act(async () => {
        await result.current.importLocalDishes(items);
      });

      expect(dishRepository.insertManyDishes).toHaveBeenCalledTimes(1);
      const [calledDb, docs] = vi.mocked(dishRepository.insertManyDishes).mock
        .calls[0];
      expect(calledDb).toBe(mockDb);
      expect(docs).toHaveLength(1);
      expect(docs[0]).toMatchObject({
        name: "Ratatouille",
        description: "Légumes",
        course: 1,
        seasons: [1, 2],
        serverId: "",
        isDeleted: false,
        syncStatus: "pending_create",
      });
      expect(mockRequestDishFlush).toHaveBeenCalledWith(mockDb);
    });

    it("throws when database is not ready", async () => {
      mockUseDatabase.mockReturnValue({
        db: null,
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(() => useDishes());

      await expect(
        result.current.importLocalDishes([]),
      ).rejects.toThrow("Database not ready");
    });
  });

  describe("addDish", () => {
    it("calls repository insertDish with correct dish", async () => {
      const { result } = renderHook(() => useDishes());
      const dish = {
        id: "new-1",
        serverId: "",
        name: "New",
        description: "",
        course: 1,
        seasons: [0],
        updatedAt: "2025-01-01T00:00:00Z",
        isDeleted: false,
        syncStatus: "pending_create" as const,
      };

      await act(async () => {
        await result.current.addDish(dish);
      });

      expect(dishRepository.insertDish).toHaveBeenCalledWith(mockDb, dish);
      expect(mockRequestDishFlush).toHaveBeenCalledWith(mockDb);
    });
  });
});
