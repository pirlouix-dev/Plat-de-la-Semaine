# Azure backend deployment

The backend is deployed by `.github/workflows/deploy-backend.yml`.

- Trigger: every push to `main`, plus `workflow_dispatch`.
- Target: Azure App Service `PDLS` (resource group `PDLS`), slot `Production`.
- Build: `backend/plat-de-la-semaine-back.csproj` on .NET 10, after the full
  backend test suite passes.
- Serialization: `concurrency: group: deploy-production` with
  `cancel-in-progress: false`, so two deploys queue instead of interleaving.
- Authentication: GitHub OIDC through an Entra ID app registration, using the
  `Production` environment subject. No client secret or publish profile is
  stored in GitHub.

## GitHub secrets

| Secret | Meaning |
|---|---|
| `AZURE_CLIENT_ID` | Application (client) ID of the app registration |
| `AZURE_TENANT_ID` | Entra ID tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Subscription containing the App Service |
| `PROD_SERVER_URL` | Public backend origin, used by the post-deploy check |

The first three are identifiers, not passwords. `PROD_SERVER_URL` is the same
origin as `PROD_SERVER_URL` in `frontend/.env` (for example
`https://pdls-f2cxfkcva4anazh5.swedencentral-01.azurewebsites.net`).

## Entra ID app registration

The app registration is named `PDLS GitHub Actions` and trusts the `Production`
environment of this repository:

| Name | Subject |
|---|---|
| `github-environment-production` | `repo:pirlouix-dev@196543487/Plat-de-la-Semaine@1245715224:environment:Production` |

Issuer: `https://token.actions.githubusercontent.com`  
Audience: `api://AzureADTokenExchange`

The service principal has **Website Contributor** on the `PDLS` App Service.

Because the deploy job declares `environment: Production`, the subject is the
environment, not the ref: one credential authorizes a dispatch on `main`,
`develop`, or any tag. Federated credential subjects do not support wildcards,
which is why the environment claim is used instead of a per-ref list.

The older ref-based credentials (`github-main-immutable`,
`github-develop-immutable`) are no longer used by this workflow. They can be
removed once no other workflow authenticates through them.

## Build stamp and verification

The build job resolves the checked-out commit with `git rev-parse HEAD` and
stamps it into the assembly with `-p:SourceRevisionId`. The running app exposes
it on `GET /api/ping`:

```json
{"commit":"ca009f126cbe848b3c0052cc659493adabdf7e09"}
```

After `azure/webapps-deploy`, the workflow polls `/api/ping` every 5 seconds for
up to 5 minutes until `commit` equals the deployed commit. A green deploy
therefore means that exact commit is live; a timeout fails the workflow instead
of leaving an unverified rollout. Clients only used the status code of
`/api/ping`, so the added body is backward compatible.

## Deploying a specific ref

`workflow_dispatch` accepts a `ref` input. The workflow itself runs from the ref
selected in the dispatch, while the `ref` input controls what is checked out,
built, and deployed:

```sh
# Pre-deploy the release from develop (see docs/monorepo.md)
gh workflow run deploy-backend.yml \
  --repo pirlouix-dev/Plat-de-la-Semaine \
  --ref develop

# Roll back to a tag, including one tagged before this workflow existed
gh workflow run deploy-backend.yml \
  --repo pirlouix-dev/Plat-de-la-Semaine \
  --ref main \
  -f ref=v4.3.0
```

Use the pre-deploy dispatch only as the backend-first step of a release, never
as a casual smoke test: it deploys whatever is on `develop`.

Dispatching on `main` with `-f ref=vX.Y.Z` is the rollback form because tags
created before this workflow do not carry the `Production` environment claim.
A tag created after this change can also be dispatched directly with
`--ref vX.Y.Z`.
