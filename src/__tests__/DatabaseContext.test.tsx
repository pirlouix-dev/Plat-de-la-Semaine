import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { useEffect, useState } from "react";
import { DatabaseProvider, useDatabase } from "../db/DatabaseContext";
import { _resetDatabaseManager } from "../db/databaseManagerInstance";
import { AUTH_CHANGED_EVENT } from "../services/api";
import { insertDish } from "../repositories/dishRepository";
import type { DishDocType } from "../db/schemas/dishes";

function makeDish(): DishDocType {
  return {
    id: crypto.randomUUID(),
    serverId: "",
    name: "Test Dish",
    description: "",
    course: 1,
    seasons: [0],
    updatedAt: "2026-01-01T00:00:00.000Z",
    isDeleted: false,
    syncStatus: "pending_create",
  };
}

function Probe() {
  const { db, dbUserId } = useDatabase();
  const [snapshot, setSnapshot] = useState<{
    db: unknown;
    count: number;
  } | null>(null);

  useEffect(() => {
    if (!db) return;
    const subscription = db.dishes.find().$.subscribe((docs) => {
      setSnapshot({ db, count: docs.length });
    });
    return () => subscription.unsubscribe();
  }, [db]);

  const count = snapshot?.db === db ? snapshot.count : null;

  return (
    <div>
      <div data-testid="user">{dbUserId ?? "guest"}</div>
      <div data-testid="count">{count === null ? "loading" : count}</div>
      <button
        onClick={() => {
          if (db) void insertDish(db, makeDish());
        }}
      >
        add
      </button>
    </div>
  );
}

function switchUser(userId: string | null) {
  act(() => {
    if (userId) {
      localStorage.setItem("user_id", userId);
    } else {
      localStorage.removeItem("user_id");
    }
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  });
}

describe("DatabaseProvider account scoping", { timeout: 30_000 }, () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(async () => {
    await _resetDatabaseManager();
  });

  it("switches to the next account's database without leaking dishes", async () => {
    const userA = "user-" + crypto.randomUUID();
    const userB = "user-" + crypto.randomUUID();
    localStorage.setItem("user_id", userA);

    render(
      <DatabaseProvider>
        <Probe />
      </DatabaseProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId("user")).toHaveTextContent(userA);
      },
      { timeout: 10_000 },
    );

    act(() => {
      screen.getByText("add").click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("1");
    });

    switchUser(userB);

    await waitFor(
      () => {
        expect(screen.getByTestId("user")).toHaveTextContent(userB);
      },
      { timeout: 10_000 },
    );
    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("0");
    });

    switchUser(userA);

    await waitFor(
      () => {
        expect(screen.getByTestId("user")).toHaveTextContent(userA);
      },
      { timeout: 10_000 },
    );
    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("1");
    });
  });
});
