#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PORT=5199
OPENAPI_URL="http://localhost:${PORT}/openapi/v1.json"
OUTPUT="openapi.yml"

echo "Building project..."
rm -rf obj bin
dotnet build plat-de-la-semaine-back.csproj

echo "Starting app on port ${PORT} in background..."
ASPNETCORE_URLS="http://localhost:${PORT}" dotnet run --no-build --no-launch-profile &
APP_PID=$!

cleanup() {
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "Waiting for app to start..."
for i in $(seq 1 30); do
    if curl -sf "$OPENAPI_URL" > /dev/null 2>&1; then
        break
    fi
    if ! kill -0 "$APP_PID" 2>/dev/null; then
        echo "Error: App process exited unexpectedly." >&2
        exit 1
    fi
    sleep 1
done

echo "Fetching OpenAPI spec..."
curl -sf "$OPENAPI_URL" | python3 -c "
import json, yaml, sys
spec = json.load(sys.stdin)
with open('$OUTPUT', 'w') as f:
    yaml.dump(spec, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
"

echo "Generated $OUTPUT"
