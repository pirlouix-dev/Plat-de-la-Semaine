# Azure backend deployment

The backend is deployed by `.github/workflows/deploy-backend.yml`.

- Trigger: every push to `main`, plus `workflow_dispatch`.
- Target: Azure App Service `PDLS` (resource group `PDLS`), slot `Production`.
- Build: `backend/plat-de-la-semaine-back.csproj` on .NET 10, after the full
  backend test suite passes.
- Authentication: GitHub OIDC through an Entra ID app registration. No client
  secret or publish profile is stored in GitHub.

## GitHub secrets

| Secret | Meaning |
|---|---|
| `AZURE_CLIENT_ID` | Application (client) ID of the app registration |
| `AZURE_TENANT_ID` | Entra ID tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Subscription containing the App Service |

These values are identifiers, not passwords.

## Entra ID app registration

The app registration is named `PDLS GitHub Actions` and has two federated
credentials:

| Name | Subject |
|---|---|
| `github-main` | `repo:pirlouix-dev/Plat-de-la-Semaine:ref:refs/heads/main` |
| `github-develop` | `repo:pirlouix-dev/Plat-de-la-Semaine:ref:refs/heads/develop` |

Issuer: `https://token.actions.githubusercontent.com`  
Audience: `api://AzureADTokenExchange`

The service principal has **Website Contributor** on the `PDLS` App Service.

## Testing and pre-deployment

`main` is deployed automatically. To deploy the backend before a release merge,
dispatch the workflow on `develop`:

```sh
gh workflow run deploy-backend.yml \
  --repo pirlouix-dev/Plat-de-la-Semaine \
  --ref develop
```

This deploys whatever is on `develop`, so only use it as the pre-deploy step of
a release, never as a casual smoke test. See `docs/monorepo.md` for the release
ordering.
