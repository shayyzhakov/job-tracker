#!/usr/bin/env bash
# Code-only deploy (no infra plan/apply): tests -> Lambda code -> web upload -> smoke test
#
#   AWS_PROFILE=<sso-profile> pnpm deploy:code [--skip-tests]
#
# Use `pnpm deploy:aws` instead when infra (infra/**) changed.
set -euo pipefail
cd "$(dirname "$0")/.."
TF_DIR="infra/envs/prod"

SKIP_TESTS=false
for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=true ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

for cmd in aws tofu docker pnpm curl zip python3; do
  command -v "$cmd" >/dev/null || { echo "Missing required command: $cmd" >&2; exit 1; }
done

export AWS_REGION="${AWS_REGION:-us-east-1}"
aws sts get-caller-identity >/dev/null 2>&1 || { echo "AWS credentials not available. Run: aws sso login --profile \$AWS_PROFILE" >&2; exit 1; }

tf() { tofu -chdir="$TF_DIR" "$@"; }

if ! $SKIP_TESTS; then
  echo "==> Quality gate"
  docker compose up -d --wait dynamodb
  pnpm check
  pnpm typecheck
  pnpm test
fi

echo "==> Reading infra outputs"
scripts/infra-init.sh >/dev/null
APP_URL="$(tf output -raw app_url)"
BUCKET="$(tf output -raw web_bucket)"
DISTRIBUTION="$(tf output -raw distribution_id)"
API_FN="$(tf output -raw api_function 2>/dev/null || echo job-tracker-api)"
SCOUT_FN="$(tf output -raw scout_function 2>/dev/null || echo job-tracker-scout)"
COGNITO="$(tf output -json cognito)"
cog() { echo "$COGNITO" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }

echo "==> Updating Lambda code"
scripts/build-lambda.sh
ZIPDIR="$(mktemp -d)"
trap 'rm -rf "$ZIPDIR"' EXIT
for pair in "api:$API_FN" "scout:$SCOUT_FN"; do
  dir="${pair%%:*}"; fn="${pair#*:}"
  (cd "dist-lambda/$dir" && zip -qr "$ZIPDIR/$dir.zip" .)
  aws lambda update-function-code --function-name "$fn" --zip-file "fileb://$ZIPDIR/$dir.zip" >/dev/null
  aws lambda wait function-updated --function-name "$fn"
  echo "updated $fn"
done

echo "==> Building and uploading the web app"
VITE_COGNITO_REGION="$(cog region)" \
VITE_COGNITO_USER_POOL_ID="$(cog user_pool_id)" \
VITE_COGNITO_CLIENT_ID="$(cog client_id)" \
VITE_COGNITO_DOMAIN="$(cog domain)" \
  pnpm --filter @job-tracker/web build
aws s3 sync apps/web/dist "s3://$BUCKET" --delete --exclude index.html \
  --cache-control "public,max-age=31536000,immutable" --only-show-errors
aws s3 cp apps/web/dist/index.html "s3://$BUCKET/index.html" --cache-control "no-cache" --content-type "text/html" --only-show-errors
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths "/*" >/dev/null

echo "==> Smoke test"
curl -fsS "$APP_URL/health" >/dev/null && echo "health: ok"
STATUS="$(curl -s -o /dev/null -w '%{http_code}' "$APP_URL/api/v1/overview")"
[ "$STATUS" = "401" ] && echo "api requires login: ok" || { echo "Expected 401 from /api/v1/overview, got $STATUS" >&2; exit 1; }

echo "Deployed code -> $APP_URL"
