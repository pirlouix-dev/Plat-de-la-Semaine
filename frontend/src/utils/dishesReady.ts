/**
 * Whether the local dish set is settled enough to build the review queue.
 *
 * Dishes already cached locally are ready immediately. On a fresh device the
 * collection starts empty and fills in through the sync engine, so an empty
 * collection is only considered ready once a sync cycle has completed (or when
 * there is nothing to sync).
 */
export function areDishesReady(options: {
  isLoaded: boolean;
  hasDishes: boolean;
  isLoggedIn: boolean;
  online: boolean;
  hasSyncedOnce: boolean;
}): boolean {
  if (!options.isLoaded) return false;
  if (options.hasDishes) return true;
  if (!options.isLoggedIn || !options.online) return true;
  return options.hasSyncedOnce;
}
