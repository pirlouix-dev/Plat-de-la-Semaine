# Plat de la Semaine

Try it at **[platdelasemaine.vercel.app](https://platdelasemaine.vercel.app)**.

Deciding what to cook every week is a chore. Plat de la Semaine ("Dish of the
Week") turns it into a small, pleasant ritual: you build your own repertoire of
dishes, then review them one card at a time — accepting the ones that appeal to
you right now and refusing the rest — until a menu for the current season takes
shape.

The app is in French, works offline, and installs to the home screen on phones
and desktops.

## What it does

- **Keep your own dish book** — Add each dish with its name, a description
  (ingredients, preparation tips), its course (starter, main or dessert) and the
  seasons it suits. Edit or delete them whenever you like.
- **Choose the week's menu** — "Choisir les plats" deals a card for a dish that
  is in season. Accept or refuse it, undo a choice, and watch the starter, main
  and dessert counters fill up. Validate when you are happy with the list.
- **Review and rework** — The recap groups your selection by course. Go back to
  adjust it, or reset everything and deal a fresh deck.
- **Never lose your work** — Your dish book and the menu you are working on are
  saved on the device. With an account they also sync to the cloud, so you can
  start on your phone and finish on your computer. If the menu was changed on
  another device, the app asks which version to keep.
- **Works offline** — Dishes and selections stay available without a connection
  and sync back as soon as you are online again.
- **Pick up where you left off** — An unfinished menu, and even a half-filled
  add-dish form, survive a reload or a closed tab.
- **Guest mode or account** — Try the app without signing up; create an account
  to sync across devices. From Settings you can import/export your dishes as a
  file, restore a cloud backup, and send feedback or a bug report.

## Development

The app is a monorepo: a React frontend and an ASP.NET Core backend.

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
- `docs/azure-deploy.md` — Azure App Service deployment and OIDC setup
- `frontend/README.md` — frontend details
- `backend/README.md` — backend configuration and deployment details
