# Plat de la Semaine — Frontend

Offline-first PWA for managing weekly meal plans. Built with React 19, RxDB, and Vite.

## Features

- **Dish management** — Add, edit, and organize dishes by course (starter/main/dessert) and season
- **Offline-first** — Local RxDB/IndexedDB database with background sync to a .NET backend
- **Auto-sync** — Push pending changes and pull remote updates on connectivity & visibility changes
- **Resilient API client** — Timeouts, combined abort signals, and `ApiResult<T>` discriminated unions
- **Menu planning** — Coming soon: choose a menu for the week
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

The dev server starts at `http://localhost:5173` by default. Set `VITE_SERVER_URL` in `.env` to point the API client at your backend (default: `http://localhost:5126`).

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check + production build |
| `npm test` | Run tests (Vitest) |
| `npm run lint` | Lint all source files |
| `npm run preview` | Preview production build |
| `npm run gen:api-types` | Regenerate `src/schema.d.ts` from `openapi.yml` |

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

GitHub Actions runs lint, type-check, build, and tests on every push to `main` and on pull requests.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_SERVER_URL` | `http://localhost:5126` | Backend API base URL |
