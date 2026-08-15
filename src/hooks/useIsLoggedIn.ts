import { useSyncExternalStore } from "react";
import { AUTH_CHANGED_EVENT, isLoggedIn } from "../services/api";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(AUTH_CHANGED_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

/** Reactive login state: updates on login/logout (same tab) and cross-tab storage changes. */
export function useIsLoggedIn(): boolean {
  return useSyncExternalStore(subscribe, isLoggedIn, isLoggedIn);
}
