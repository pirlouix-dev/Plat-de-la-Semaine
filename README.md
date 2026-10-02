# PDLS-webapp-back

The backend for the React version of the "Plat de la Semaine" app. Built with
ASP.NET Core (.NET 10) and backed by Firebase/Firestore.

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- A Firebase project with Firestore enabled

## Getting started

1. Copy the example environment file and fill in your values:

   ```sh
   cp .env.example .env
   ```

2. Restore and run:

   ```sh
   dotnet restore
   dotnet run
   ```

The API listens on `http://localhost:5126` in development. In the Development
environment the OpenAPI document is served at `/openapi/v1.json`. Use
`./generate-openapi.sh` to write it to `openapi.yml`.

## Configuration

All runtime settings are read from environment variables. The active
environment is selected with `ASPNETCORE_ENVIRONMENT` (`Development` or
`Production`). On startup, variables are also loaded from a `.env` file, searched
in the project directory and its parents. Real environment variables are never
overwritten by `.env`, so host-provided values always win.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Yes | Firebase/Firestore project ID. |
| `FIREBASE_API_KEY` | Yes | Firebase Web API key for Auth REST calls. |
| `GOOGLE_CREDENTIALS_JSON` | No | Base64-encoded service account JSON. When unset, Application Default Credentials are used. |
| `DISCORD_WEBHOOK_URL` | No | Discord webhook for the feedback endpoint. Feedback returns an error when unset. |
| `CORS_ALLOWED_ORIGINS` | No | Comma-separated allowed browser origins. |
| `ASPNETCORE_ENVIRONMENT` | No | `Development` (default) or `Production`. |
| `ASPNETCORE_URLS` | No | Bind address, for example `http://localhost:5126`. |

### CORS

Allowed origins are read from the comma-separated `CORS_ALLOWED_ORIGINS`
environment variable. Origins must be absolute URLs with **no trailing slash**,
for example:

```
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.example.com
```

If no origin is configured, cross-origin browser requests are rejected and a
warning is logged at startup.

## Testing

```sh
dotnet test
```

## CI

GitHub Actions builds and tests the solution on every push to `main` and on pull
requests targeting `main`.
