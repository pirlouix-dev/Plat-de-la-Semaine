import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { useEffect, useState } from "react";
import { DatabaseProvider, useDatabase } from "../db/DatabaseContext";
import { _resetDatabaseManager } from "../db/databaseManagerInstance";
import { claimLegacyDatabaseOwner } from "../db/databaseName";
import { AUTH_CHANGED_EVENT } from "../services/api";
import { insertDish } from "../repositories/dishRepository";
import type { DishDocType } from "../db/schemas/dishes";

// Opening an RxDB database can be slow when the whole suite runs in parallel.
const DB_TIMEOUT = 30_000;

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

describe("DatabaseProvider account scoping", () => {
  beforeEach(() => {
    localStorage.clear();
    // Keep the first open scoped to account switching: claiming the legacy
    // database for user A would run a full migration on top of it.
    claimLegacyDatabaseOwner(null);
  });

  afterEach(async () => {
    cleanup();
    await _resetDatabaseManager();
  }, DB_TIMEOUT);

  it("switches to the next account's database without leaking dishes", { timeout: DB_TIMEOUT * 4 }, async () => {
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
      { timeout: DB_TIMEOUT },
    );

    act(() => {
      screen.getByText("add").click();
    });
    await waitFor(
      () => {
        expect(screen.getByTestId("count")).toHaveTextContent("1");
      },
      { timeout: DB_TIMEOUT },
    );

    switchUser(userB);

    await waitFor(
      () => {
        expect(screen.getByTestId("user")).toHaveTextContent(userB);
      },
      { timeout: DB_TIMEOUT },
    );
    await waitFor(
      () => {
        expect(screen.getByTestId("count")).toHaveTextContent("0");
      },
      { timeout: DB_TIMEOUT },
    );

    switchUser(userA);

    await waitFor(
      () => {
        expect(screen.getByTestId("user")).toHaveTextContent(userA);
      },
      { timeout: DB_TIMEOUT },
    );
    await waitFor(
      () => {
        expect(screen.getByTestId("count")).toHaveTextContent("1");
      },
      { timeout: DB_TIMEOUT },
    );
  });
});
