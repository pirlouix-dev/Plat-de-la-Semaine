# Monorepo conventions

## Imported history

The repository was formed from two independent repositories:
`PDLS-webapp-front` and `PDLS-webapp-back`.

- The frontend was moved into `frontend/` in a normal commit, so its commit
  SHAs, branches, tags and pull request references are unchanged. Checkouts of
  tags up to `v4.3.0` show the pre-monorepo layout with the frontend at the
  repository root.
- The backend was imported with `git subtree add` into `backend/`. Its commits
  keep their original SHAs and remain reachable from the import merge commit.
- Backend tags are namespaced as `backend/v4.0.0` … `backend/v4.3.0` because the
  original backend tags used the same names as the frontend tags.

Historical backend pull requests and releases remain in the archived
`PDLS-webapp-back` repository. They cannot be transferred.

## Tags and releases

- Frontend tags `v4.0.0` … `v4.3.0` are historical and point at the original
  frontend commits.
- Backend tags `backend/v4.0.0` … `backend/v4.3.0` point at the original backend
  commits.
- From the first monorepo release onward there is a single tag `vX.Y.Z` on the
  `main` release merge commit, covering both packages.
- Each monorepo release has one GitHub Release with combined notes.

## Local environment

- Keep environment files per package: `frontend/.env`, `backend/.env`.
- Do not create a root `.env`. The backend searches parent directories, so a
  root file would silently override `backend/.env`.
- A single `venv/` at the repository root is used by one-off Python scripts and
  by `backend/generate-openapi.sh`.

## Release ordering

The backend must be running before the frontend that depends on it reaches
users. Merging to `main` triggers both the Azure backend deployment and the
Vercel frontend deployment, so the backend is pre-deployed from `develop`
before the merge:

1. Wait for the release pull request CI to be green.
2. Dispatch `deploy-backend.yml` on `develop` and wait for it to succeed, then
   verify the running API's release contract.
3. Merge the release pull request. Vercel deploys the frontend and the backend
   workflow deploys the same `main` tree again.
4. Wait for `main` CI, the backend deployment and the Vercel production
   deployment to succeed.
5. Tag the `main` merge commit and publish one GitHub Release.
6. Update the version in Firestore.

The pre-merge backend dispatch is what preserves the backend-first ordering; do
not merge a release that changes the contract before it succeeds.
