import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetMenuStorageState,
  applyRemoteMenu,
  beginMenuSave,
  getPendingRemoteMenu,
  isMenuDirty,
  keepLocalMenu,
  loadStoredMenu,
  markMenuMatchesRemote,
  markMenuModified,
  markMenuPushSucceeded,
  setPendingRemoteMenu,
  storeMenu,
  subscribeMenuEvents,
  type SavedMenuState,
} from "../services/menuStorage";

const GUEST_KEY = "pdls_choose_menu_state_v2";
const USER_KEY = "pdls_menu_state_v2:u1";

function menu(overrides: Partial<SavedMenuState> = {}): SavedMenuState {
  return {
    queueIds: [],
    selectedIds: [],
    history: [],
    mode: "editing",
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  _resetMenuStorageState();
});

describe("loadStoredMenu", () => {
  it("returns null when nothing is stored", () => {
    expect(loadStoredMenu("u1")).toBeNull();
    expect(loadStoredMenu(null)).toBeNull();
  });

  it("adopts a guest selection for a logged-in user", () => {
    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify({
        ...menu({ selectedIds: ["g"], mode: "recap" }),
        serverUpdatedAt: null,
        localRevision: 1,
        reconciledRevision: 1,
      }),
    );

    const stored = loadStoredMenu("u1");

    expect(stored?.selectedIds).toEqual(["g"]);
    expect(stored?.mode).toBe("recap");
  });

  it("reads the per-user slot for a logged-in user", () => {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        ...menu({ selectedIds: ["u"] }),
        serverUpdatedAt: null,
        localRevision: 0,
        reconciledRevision: 0,
      }),
    );

    expect(loadStoredMenu("u1")?.selectedIds).toEqual(["u"]);
  });

  it("migrates a legacy recap menu as a pending save", () => {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        ...menu({ selectedIds: ["a"], mode: "recap" }),
        updatedAt: "2026-01-01T00:00:00Z",
        syncStatus: "synced",
      }),
    );

    const stored = loadStoredMenu("u1");
    expect(stored?.savedIds).toEqual(["a"]);
    expect(stored?.pendingSave).toBe(false);
    expect(stored?.serverUpdatedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("does not migrate a legacy editing draft into a pending save", () => {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({
        ...menu({ selectedIds: ["a"], mode: "editing" }),
        syncStatus: "pending_update",
      }),
    );

    const stored = loadStoredMenu("u1");
    expect(stored?.savedIds).toEqual([]);
    expect(stored?.pendingSave).toBe(false);
  });
});

describe("local modifications", () => {
  it("does not mark a freshly stored menu dirty", () => {
    storeMenu("u1", menu());

    const stored = loadStoredMenu("u1");
    expect(stored?.pendingSave).toBe(false);
    expect(isMenuDirty(stored!)).toBe(false);
  });

  it("marks any working modification dirty without pending a save", () => {
    storeMenu("u1", menu());
    markMenuModified("u1");

    const stored = loadStoredMenu("u1");
    expect(isMenuDirty(stored!)).toBe(true);
    expect(stored?.pendingSave).toBe(false);
  });

  it("keeps the menu dirty after a review-only change", () => {
    storeMenu("u1", menu({ selectedIds: ["a"] }));
    markMenuModified("u1");
    storeMenu("u1", menu({ selectedIds: ["a"], queueIds: ["b"] }));

    const stored = loadStoredMenu("u1");
    expect(isMenuDirty(stored!)).toBe(true);
    expect(stored?.pendingSave).toBe(false);
  });

  it("snapshots the saved ids only on an explicit save", () => {
    storeMenu("u1", menu({ selectedIds: ["a", "b"] }));
    const saved = beginMenuSave(
      "u1",
      menu({ selectedIds: ["a", "b"], mode: "recap" }),
      ["a", "b"],
    );

    expect(saved.pendingSave).toBe(true);
    expect(saved.savedIds).toEqual(["a", "b"]);
    expect(saved.saveRevision).toBe(1);
  });
});

describe("markMenuPushSucceeded", () => {
  it("clears the pending save and records the server version", () => {
    storeMenu("u1", menu({ selectedIds: ["a"] }));
    const saved = beginMenuSave(
      "u1",
      menu({ selectedIds: ["a"], mode: "recap" }),
      ["a"],
    );

    markMenuPushSucceeded(
      "u1",
      {
        saveRevision: saved.saveRevision,
        localRevision: saved.pendingLocalRevision!,
      },
      { selectedDishIds: ["a"], updatedAt: "2026-05-01T00:00:00Z" },
    );

    const stored = loadStoredMenu("u1");
    expect(stored?.pendingSave).toBe(false);
    expect(stored?.serverUpdatedAt).toBe("2026-05-01T00:00:00Z");
    expect(isMenuDirty(stored!)).toBe(false);
  });

  it("does not clear a newer pending save when an older response arrives", () => {
    storeMenu("u1", menu({ selectedIds: ["a"] }));
    const first = beginMenuSave(
      "u1",
      menu({ selectedIds: ["a"], mode: "recap" }),
      ["a"],
    );
    const second = beginMenuSave(
      "u1",
      menu({ selectedIds: ["a", "b"], mode: "recap" }),
      ["a", "b"],
    );

    markMenuPushSucceeded(
      "u1",
      {
        saveRevision: first.saveRevision,
        localRevision: first.pendingLocalRevision!,
      },
      { selectedDishIds: ["a"], updatedAt: "2026-05-01T00:00:00Z" },
    );

    const stored = loadStoredMenu("u1");
    expect(stored?.saveRevision).toBe(second.saveRevision);
    expect(stored?.pendingSave).toBe(true);
    expect(stored?.savedIds).toEqual(["a", "b"]);
  });
});

describe("remote resolution", () => {
  it("adopts a remote menu and resets the review session", () => {
    storeMenu(
      "u1",
      menu({
        selectedIds: ["old"],
        queueIds: ["old"],
        history: [{ action: "accept", dishId: "old" }],
      }),
    );

    const applied = applyRemoteMenu("u1", {
      selectedDishIds: ["remote"],
      updatedAt: "2026-02-01T00:00:00Z",
    });

    expect(applied?.selectedIds).toEqual(["remote"]);
    expect(applied?.savedIds).toEqual(["remote"]);
    expect(applied?.queueIds).toEqual([]);
    expect(applied?.history).toEqual([]);
    expect(applied?.mode).toBe("recap");
    expect(applied?.serverUpdatedAt).toBe("2026-02-01T00:00:00Z");
    expect(isMenuDirty(applied!)).toBe(false);
  });

  it("uses editing mode when the remote menu is empty", () => {
    storeMenu("u1", menu({ selectedIds: ["old"], mode: "recap" }));

    const applied = applyRemoteMenu("u1", {
      selectedDishIds: [],
      updatedAt: "2026-02-01T00:00:00Z",
    });

    expect(applied?.mode).toBe("editing");
  });

  it("acknowledges a matching remote snapshot", () => {
    storeMenu("u1", menu({ selectedIds: ["a"] }));
    beginMenuSave("u1", menu({ selectedIds: ["a"], mode: "recap" }), ["a"]);

    markMenuMatchesRemote("u1", {
      selectedDishIds: ["a"],
      updatedAt: "2026-03-01T00:00:00Z",
    });

    const stored = loadStoredMenu("u1");
    expect(stored?.pendingSave).toBe(false);
    expect(stored?.serverUpdatedAt).toBe("2026-03-01T00:00:00Z");
  });

  it("keeps the local menu while acknowledging the remote version", () => {
    storeMenu("u1", menu({ selectedIds: ["local"], mode: "recap" }));

    keepLocalMenu("u1", {
      selectedDishIds: ["remote"],
      updatedAt: "2026-04-01T00:00:00Z",
    });

    const stored = loadStoredMenu("u1");
    expect(stored?.selectedIds).toEqual(["local"]);
    expect(stored?.serverUpdatedAt).toBe("2026-04-01T00:00:00Z");
  });
});

describe("conflict store", () => {
  it("stores and clears the pending remote menu", () => {
    const events: string[] = [];
    const unsubscribe = subscribeMenuEvents((event) => events.push(event.type));

    setPendingRemoteMenu("u1", {
      selectedDishIds: ["remote"],
      updatedAt: "2026-01-01T00:00:00Z",
    });

    expect(getPendingRemoteMenu("u1")?.selectedDishIds).toEqual(["remote"]);
    expect(getPendingRemoteMenu("u2")).toBeNull();

    keepLocalMenu("u1", {
      selectedDishIds: ["remote"],
      updatedAt: "2026-01-01T00:00:00Z",
    });

    expect(getPendingRemoteMenu("u1")).toBeNull();
    expect(events).toEqual(["conflict", "conflict-cleared"]);
    unsubscribe();
  });
});
