# Offline-First Architecture Plan

## Goals

- Every feature that can be done offline or without an account will be available
- Local storage limited to dishes the user owns and preferences (e.g. theme)
- If the user has an account, every change is replicated to the backend and local DB reflects backend changes
- If no account or offline, changes happen locally and are replicated once online or once an account is created

## Decisions

| Decision | Choice |
|---|---|
| Primary key | Client-generated UUID (`crypto.randomUUID()`) |
| Conflict resolution | Last-write-wins (`updatedAt` timestamp) |
| Sync strategy | Push-then-pull |
| Preferences storage | Separate RxDB collection |
| Backend ID strategy | Server accepts client-generated `id` in `POST /api/dishes` |
| Soft-delete | Backend switches from hard-delete to soft-delete |
| Auth token storage | `localStorage` |

## Backend Changes Required

### 1. Soft-Delete Support

`DELETE /api/dishes/{id}` must soft-delete instead of hard-delete. Set `isDeleted = true` and `deletedAt = now()`. The row must remain in the database.

`GET /api/dishes` must return soft-deleted dishes (with `isDeleted: true`) so the frontend can sync deletions.

### 2. Accept Client-Generated IDs

`POST /api/dishes` must accept an optional `id` field (string, UUID format) in `CreateDishPayload`. If provided, use it as the dish's primary key. If not provided, generate server-side (backward compatible).

### 3. Auth Endpoints

Already exist on the backend, now documented in `openapi.yml`:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`

## RxDB Schema (Version 1)

### `dishes` collection

```typescript
{
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id:           { type: "string", maxLength: 36 },     // client UUID
    serverId:     { type: "string", maxLength: 36 },     // backend ID (nullable)
    name:         { type: "string" },
    description:  { type: "string" },
    course:       { type: "number" },
    seasons:      { type: "array", items: { type: "number" } },
    updatedAt:    { type: "string", format: "date-time" },
    isDeleted:    { type: "boolean" },
    syncStatus:   { type: "string" },                     // "synced" | "pending_create" | "pending_update" | "pending_delete"
  },
  required: ["id", "name", "description", "course", "seasons", "updatedAt", "isDeleted", "syncStatus"],
}
```

### `preferences` collection

```typescript
{
  version: 0,
  primaryKey: "key",
  type: "object",
  properties: {
    key:       { type: "string", maxLength: 50 },
    value:     { type: "string" },
    updatedAt: { type: "string", format: "date-time" },
  },
  required: ["key", "value", "updatedAt"],
}
```

## Data Flow

```
UI Components
  (subscribe to RxDB observables via useLiveQuery)
       | write locally              | read (reactive)
       v                            v
RxDB (IndexedDB via Dexie)
  dishes collection  +  preferences
       | sync reads pending changes
       v
Sync Service
  - pushPendingChanges() -> API services
  - pullAndMerge()       -> merge into RxDB
  - online/offline detection
  - retry with exponential backoff
       | HTTP
       v
Backend API (.NET)
```

**Key principle:** UI always writes to RxDB first (instant, offline-capable). Sync is a background process that runs when online.

## Sync Protocol (Push-then-Pull)

### Push phase

Query dishes where `syncStatus !== "synced"`:

| syncStatus | Action | API call |
|---|---|---|
| `pending_create` | Create on server | `POST /api/dishes` (with `id`) |
| `pending_update` | Update on server | `PUT /api/dishes/{serverId}` |
| `pending_delete` | Delete on server | `DELETE /api/dishes/{serverId}` |

After each successful push:
- Set `serverId` from response (if create)
- Set `syncStatus = "synced"`

### Pull phase

After push completes:

1. `GET /api/dishes` (returns all, including soft-deleted)
2. For each server dish, find local by `serverId`
3. Merge logic:
   - **No local match** -> insert as new (`syncStatus: "synced"`)
   - **Local match, server `updatedAt` >= local `updatedAt`** -> overwrite local
   - **Local match, local `updatedAt` > server `updatedAt`** -> keep local (re-push on next sync)

### syncStatus Transition Rules

```
On create (offline):
  syncStatus = "pending_create"

On edit while syncStatus === "pending_create":
  Keep syncStatus = "pending_create" (local doc is the draft)

On edit while syncStatus === "synced":
  syncStatus = "pending_update"

On edit while syncStatus === "pending_update":
  Keep syncStatus = "pending_update", bump updatedAt

On delete while syncStatus === "pending_create":
  Remove local document entirely

On delete while syncStatus === "synced" or "pending_update":
  syncStatus = "pending_delete", isDeleted = true

On delete while syncStatus === "pending_delete":
  No change (already pending delete)
```

## UI Integration

### Pattern

Components subscribe to RxDB observables:

```tsx
import { useLiveQuery } from "rxdb-react";

function DishList() {
  const dishes = useLiveQuery(() =>
    db.dishes.find().sort("name").$
  );
  // dishes updates automatically when RxDB data changes
}
```

### AddDishPage flow

1. User fills form, hits "Sauvegarder"
2. Generate `crypto.randomUUID()` for `id`
3. Insert into RxDB with `syncStatus: "pending_create"`
4. Navigate back (instant, no network wait)
5. Sync service picks up the pending create in background

### EditDishPage flow

1. Load dish from RxDB by `id`
2. User edits, hits save
3. Update RxDB document, set `syncStatus = "pending_update"` (or keep `pending_create`), bump `updatedAt`
4. Navigate back

### Delete flow

1. Set `isDeleted: true`, set appropriate `syncStatus`
2. Sync service pushes the delete to backend

## File Structure

### New files

```
src/
  db/
    schemas/
      dishes.ts              # RxDB schema definition for dishes
      preferences.ts         # RxDB schema definition for preferences
    collections.ts           # Collection type exports
  services/
    syncService.ts           # Sync orchestration
  repositories/
    dishRepository.ts        # RxDB CRUD operations for dishes
    preferencesRepository.ts # RxDB CRUD operations for preferences
  hooks/
    useSync.ts               # React hook for sync status/triggering
    useDishes.ts             # React hook wrapping reactive dish queries
```

### Modified files

```
src/
  db/
    DatabaseContext.tsx       # Updated schemas, add preferences collection
  services/
    api.ts                   # Add Authorization header from localStorage
    dishService.ts           # Keep as-is (HTTP layer, used by syncService)
  pages/
    AddDishPage.tsx          # Wire to RxDB via repository
    EditDishPage.tsx         # Implement with RxDB reads/writes
  types/
    dish.ts                  # Add DishDocType export, sync-related types
```

## Implementation Phases

| Phase | Scope | Complexity |
|---|---|---|
| 1 | RxDB schema redesign + `dishRepository.ts` | Low |
| 2 | Wire `AddDishPage` to RxDB (offline-only CRUD) | Low |
| 3 | Backend changes: soft-delete, accept client `id`, include deleted in GET | Medium |
| 4 | `syncService.ts` — push, pull, merge | High |
| 5 | Auth header in `api.ts` + localStorage token | Low |
| 6 | Wire `EditDishPage` + delete flow | Medium |
| 7 | `preferencesRepository.ts` + settings UI | Low |
| 8 | Auto-sync triggers (online event, visibility change) | Low |
| 9 | Tests | Medium |

## Sync Service Responsibilities

`src/services/syncService.ts`:

- `pushPendingChanges(db)` — query dishes where `syncStatus !== "synced"`, push each via API services
- `pullAndMerge(db)` — fetch remote dishes, merge into local (last-write-wins)
- `sync(db)` — orchestrates push then pull sequence
- `startAutoSync(db)` — watches online status, triggers sync on reconnect
- Retry logic with exponential backoff on failure

## Connectivity Detection

- `navigator.onLine` + `online`/`offline` events
- On `online` event -> trigger sync
- On app foreground (`visibilitychange`) -> trigger sync if online
- Manual pull-to-refresh -> trigger sync

## Error Handling

- If push fails for one dish, continue with others (don't block entire sync)
- Track failed syncs, retry on next opportunity
- Never lose local data — failed pushes stay in `pending_*` status

## What This Enables

| Scenario | Behavior |
|---|---|
| No account, offline | Full CRUD on dishes, stored in IndexedDB |
| No account, online | Same as offline (no backend interaction without auth) |
| Has account, offline | Full CRUD. Changes queued locally with `pending_*` status |
| Has account, online | CRUD writes to RxDB instantly, sync pushes to backend in background |
| Multi-device | Last-write-wins ensures eventual consistency |
