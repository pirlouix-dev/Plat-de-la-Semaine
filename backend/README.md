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
| `ALLOWED_HOSTS` | No | Semicolon-separated hostnames the app accepts in the `Host` header. Defaults to `*`. |
| `HTTPS_REDIRECTION_ENABLED` | No | `true`/`false`. Redirect plain HTTP to HTTPS outside Development. Defaults to `true`. |
| `HSTS_ENABLED` | No | `true`/`false`. Send `Strict-Transport-Security` outside Development. Defaults to `true`. |
| `ASPNETCORE_ENVIRONMENT` | No | `Development` (default) or `Production`. |
| `ASPNETCORE_URLS` | No | Bind address, for example `http://localhost:5126`. |

### HTTPS

The application assumes a reverse proxy terminates TLS and forwards plain HTTP
requests to it, which is how Azure App Service works: HTTPS traffic reaches the
app as unencrypted HTTP on the load balancer's behalf. Outside Development the
pipeline therefore:

1. trusts `X-Forwarded-For` / `X-Forwarded-Proto` via the forwarded headers
   middleware,
2. sends `Strict-Transport-Security` (HSTS), and
3. redirects plain HTTP requests to HTTPS.

Steps 1 and 3 only work together. Without trusted forwarded headers the app
believes every request is unencrypted and step 3 redirects forever, so the known
proxy lists are cleared to trust the platform's load balancer.

Inside Development nothing is enabled, because the `http` launch profile binds
no HTTPS port. Set `HTTPS_REDIRECTION_ENABLED=false` or `HSTS_ENABLED=false`
in the host configuration to back either behaviour out without a redeploy.

When the app runs on Azure App Service, also turn on **TLS/SSL settings →
HTTPS Only** in the portal so cleartext requests are refused before they reach
the app. Do **not** set `ASPNETCORE_FORWARDEDHEADERS_ENABLED`: the pipeline
already registers the forwarded headers middleware, and enabling both applies
the headers twice.

### Allowed hosts

`AllowedHosts` defaults to `*`, which accepts any `Host` header. In production
set `ALLOWED_HOSTS` to the hostname(s) clients actually use:

```
ALLOWED_HOSTS=your-app.azurewebsites.net;api.your-domain.example
```

Keep the platform's default hostname (for example
`your-app.azurewebsites.net`) even when a custom domain is used: App Service
warm-up probes hit it, and filtering it out makes them fail. Hosts are
semicolon-separated and must not include ports. Wildcards such as
`*.your-domain.example` are supported. When the value is still `*` in
Production, a warning is logged at startup.

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
