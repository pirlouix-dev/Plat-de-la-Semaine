import { describe, it, expect, beforeEach } from "vitest";
import {
  loadStoredMenu,
  storeMenu,
  markMenuSynced,
  applyRemoteMenu,
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
});

describe("loadStoredMenu", () => {
  it("returns null when nothing is stored", () => {
    expect(loadStoredMenu("u1")).toBeNull();
    expect(loadStoredMenu(null)).toBeNull();
  });

  it("adopts a guest selection for a logged-in user", () => {
    localStorage.setItem(
      GUEST_KEY,
      JSON.stringify(menu({ selectedIds: ["g"], mode: "recap" })),
    );

    const stored = loadStoredMenu("u1");

    expect(stored?.selectedIds).toEqual(["g"]);
    expect(stored?.mode).toBe("recap");
  });

  it("reads the per-user slot for a logged-in user", () => {
    localStorage.setItem(
      USER_KEY,
      JSON.stringify(menu({ selectedIds: ["u"] })),
    );

    expect(loadStoredMenu("u1")?.selectedIds).toEqual(["u"]);
  });
});

describe("storeMenu", () => {
  it("does not mark the menu dirty for review-only changes", () => {
    storeMenu("u1", menu({ queueIds: ["a", "b"] }));

    expect(loadStoredMenu("u1")?.syncStatus).toBe("synced");
  });

  it("marks the menu dirty when the selection changes", () => {
    storeMenu("u1", menu({ selectedIds: ["a"] }));

    expect(loadStoredMenu("u1")?.syncStatus).toBe("pending_update");
  });

  it("keeps a pending menu dirty after subsequent review changes", () => {
    storeMenu("u1", menu({ selectedIds: ["a"] }));
    storeMenu("u1", menu({ selectedIds: ["a"], queueIds: ["b"] }));

    expect(loadStoredMenu("u1")?.syncStatus).toBe("pending_update");
  });

  it("marks the menu dirty when only the mode changes", () => {
    storeMenu("u1", menu({ selectedIds: ["a"] }));
    markMenuSynced("u1", "2026-01-01T00:00:00Z");

    storeMenu("u1", menu({ selectedIds: ["a"], mode: "recap" }));

    expect(loadStoredMenu("u1")?.syncStatus).toBe("pending_update");
  });
});

describe("markMenuSynced", () => {
  it("records the server timestamp and clears the pending state", () => {
    storeMenu("u1", menu({ selectedIds: ["a"] }));

    markMenuSynced("u1", "2026-05-01T00:00:00Z");

    const stored = loadStoredMenu("u1");
    expect(stored?.syncStatus).toBe("synced");
    expect(stored?.updatedAt).toBe("2026-05-01T00:00:00Z");
  });
});

describe("applyRemoteMenu", () => {
  it("adopts a newer remote menu when the local copy is clean", () => {
    storeMenu("u1", menu());
    markMenuSynced("u1", "2026-01-01T00:00:00Z");

    applyRemoteMenu("u1", {
      selectedDishIds: ["remote"],
      mode: "recap",
      updatedAt: "2026-02-01T00:00:00Z",
    });

    const stored = loadStoredMenu("u1");
    expect(stored?.selectedIds).toEqual(["remote"]);
    expect(stored?.mode).toBe("recap");
    expect(stored?.syncStatus).toBe("synced");
    expect(stored?.updatedAt).toBe("2026-02-01T00:00:00Z");
  });

  it("ignores a remote menu older than the local copy", () => {
    storeMenu("u1", menu({ selectedIds: ["local"] }));
    markMenuSynced("u1", "2026-03-01T00:00:00Z");

    applyRemoteMenu("u1", {
      selectedDishIds: ["remote"],
      mode: "recap",
      updatedAt: "2026-02-01T00:00:00Z",
    });

    expect(loadStoredMenu("u1")?.selectedIds).toEqual(["local"]);
  });

  it("keeps local pending changes over a newer remote menu", () => {
    storeMenu("u1", menu({ selectedIds: ["local"] }));

    applyRemoteMenu("u1", {
      selectedDishIds: ["remote"],
      mode: "recap",
      updatedAt: "2030-01-01T00:00:00Z",
    });

    const stored = loadStoredMenu("u1");
    expect(stored?.selectedIds).toEqual(["local"]);
    expect(stored?.syncStatus).toBe("pending_update");
  });

  it("ignores a remote menu with no timestamp", () => {
    applyRemoteMenu("u1", {
      selectedDishIds: [],
      mode: "editing",
      updatedAt: null,
    });

    expect(loadStoredMenu("u1")).toBeNull();
  });

  it("does nothing for guests", () => {
    applyRemoteMenu(null, {
      selectedDishIds: ["remote"],
      mode: "recap",
      updatedAt: "2030-01-01T00:00:00Z",
    });

    expect(loadStoredMenu(null)).toBeNull();
  });
});
