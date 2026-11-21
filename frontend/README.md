# Plat de la Semaine — Frontend

Offline-first PWA for managing weekly meal plans. Built with React 19, RxDB, and Vite.

This is the `frontend/` package of the Plat de la Semaine monorepo. Run the
commands below from this directory.

## Features

- **Dish management** — Add, edit, and organize dishes by course (starter/main/dessert) and season
- **Offline-first** — Local RxDB/IndexedDB database with background sync to a .NET backend
- **Auto-sync** — Push pending changes and pull remote updates on connectivity & visibility changes
- **Resilient API client** — Timeouts, combined abort signals, and `ApiResult<T>` discriminated unions
- **Dish planning** — Pick dishes for the week by accepting/rejecting cards from an in-season deck, with undo, a course-by-course recap, and sessions persisted across visits
- **Authentication** — Register, log in/out, with tokens stored locally and transparent refresh on expiry
- **Backup & restore** — Cloud backup/restore via REST API

## Tech Stack

| Layer | |
|---|---|
| **Framework** | React 19 |
| **Build** | Vite 8 + TypeScript 6 |
| **Database** | RxDB 17 (IndexedDB) + RxJS 7 |
| **Routing** | react-router-dom v7 |
| **Testing** | Vitest 4 + Testing Library |
| **API** | REST (fetch), OpenAPI types via `openapi-typescript` |
| **Linting** | ESLint 10 (flat config) |

## Getting Started

**Prerequisites:** Node 22 (see `.nvmrc`)

```sh
npm ci
npm run dev
```

The dev server starts at `http://localhost:5173` by default. In development, `/api` requests are proxied to the backend at `http://localhost:5126` (see `vite.config.ts`), so the app uses relative API URLs. Leave `VITE_SERVER_URL` empty in `.env` to use the proxy.

To open the app from another device on the same network (e.g. a phone), run `npm run dev:host` and browse to `http://<your-computer-ip>:5173`. The proxy forwards API calls server-side, so no CORS setup or backend rebinding is needed.

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run dev:host` | Start dev server, reachable from other devices on the LAN |
| `npm run build` | Type-check + production build |
| `npm test` | Run tests (Vitest) |
| `npm run lint` | Lint all source files |
| `npm run preview` | Preview production build |
| `npm run gen:api-types` | Regenerate `src/schema.d.ts` from the root `openapi.yml` |

## Architecture

```
src/
├── main.tsx                  # Entry point (BrowserRouter)
├── App.tsx                   # Routes + DatabaseProvider + sync init
├── pages/                    # Route-level page components
├── components/               # Shared UI components
├── db/                       # RxDB database context, schemas, collections
├── repositories/             # Data access layer
├── services/                 # API client, sync engine, backup, settings
├── hooks/                    # React hooks (useDishes, useSync)
├── types/                    # TypeScript types & validation helpers
└── __tests__/                # Test suite
```

Data flows: **UI → hooks → repository → RxDB (local)** ↔ **sync service → REST API (remote)**.

## CI

The repository workflow in `.github/workflows/ci.yml` runs lint, type-check,
build, and tests for the frontend on every push to `main`/`develop` and on pull
requests. The same workflow runs the backend build and tests.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_SERVER_URL` | `http://localhost:5126` | Backend API base URL. Empty in dev to use the Vite `/api` proxy. |

## Deployment

The app is deployed on Vercel as static files, with the project root directory
set to `frontend/`. Routing is entirely client-side (`BrowserRouter`).
`vercel.json` therefore rewrites every unmatched path to `/index.html` so the
router can resolve it. Real files (`/assets/*`, icons, the web manifest) are still served directly, since Vercel applies rewrites only after the filesystem check.

Do not remove that rewrite: without it, opening or refreshing any sub-route (`/login`, `/register`, `/settings`, …) returns a 404.
