# Plat de la Semaine

Offline-first PWA for managing weekly meal plans, with a React frontend and an
ASP.NET Core backend in a single repository.

## Layout

| Path | Stack | Description |
|---|---|---|
| `frontend/` | React 19, TypeScript, Vite 8, RxDB 17 | Offline-first PWA |
| `backend/` | ASP.NET Core (.NET 10), Firebase/Firestore | REST API |
| `openapi.yml` | OpenAPI 3.1 | Backend contract snapshot, generated from the backend |
| `docs/` | Markdown | Development and repository conventions |

## Prerequisites

- Node 22 (see `frontend/.nvmrc`)
- .NET 10 SDK
- A Firebase project with Firestore enabled, for the backend

## Getting started

The backend reads its configuration from `backend/.env` (see
`backend/.env.example`). The frontend uses `frontend/.env` when it needs an
explicit API URL; in development it proxies `/api` to `http://localhost:5126`,
so leave `VITE_SERVER_URL` empty.

Run the backend:

```sh
cd backend
cp .env.example .env   # first time only
dotnet restore
dotnet run
```

Run the frontend in another terminal:

```sh
cd frontend
npm ci
npm run dev
```

The app is served at `http://localhost:5173`.

## Testing

```sh
cd frontend && npm test
cd backend && dotnet test
```

## API contract

`openapi.yml` at the repository root is the single source of truth for the REST
contract. Regenerate it from the backend, then regenerate the TypeScript types:

```sh
cd backend && ./generate-openapi.sh
cd frontend && npm run gen:api-types
```

Commit both `openapi.yml` and `frontend/src/schema.d.ts` when the contract
changes.

## Deployment

- The frontend is deployed on Vercel. The Vercel project root directory is
  `frontend/`; `frontend/vercel.json` rewrites unmatched paths to
  `/index.html` for the client-side router.
- The backend is deployed to Azure App Service automatically by
  `.github/workflows/deploy-backend.yml` on every push to `main` (and manually
  through `workflow_dispatch`), building and testing `backend/` first.

Backend releases must be live before the frontend reaches users.

## Repository guides

- `docs/development.md` — branching, API and error contract, testing, tooling
- `docs/monorepo.md` — layout, imported history, tags and release conventions
- `docs/issue-migration.md` — backend issue number mapping
- `frontend/README.md` — frontend details
- `backend/README.md` — backend configuration and deployment details
