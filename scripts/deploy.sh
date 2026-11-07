#!/usr/bin/env bash
# One-command deploy to AWS from this machine:
#   tests -> Lambda bundles -> infra apply -> web upload -> smoke test
#
#   AWS_PROFILE=<sso-profile> pnpm deploy:aws [--skip-tests] [--yes]
#
# Prerequisites: aws CLI v2 (logged in: `aws sso login`), OpenTofu, Docker, pnpm. See infra/README.md.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
TF_DIR="infra/envs/prod"

SKIP_TESTS=false
ASSUME_YES=false
for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=true ;;
    --yes) ASSUME_YES=true ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

for cmd in aws tofu docker pnpm curl; do
  command -v "$cmd" >/dev/null || { echo "Missing required command: $cmd" >&2; exit 1; }
done
[ -f "$TF_DIR/terraform.tfvars" ] || { echo "Create $TF_DIR/terraform.tfvars (see terraform.tfvars.example)" >&2; exit 1; }

export AWS_REGION="${AWS_REGION:-us-east-1}"
aws sts get-caller-identity >/dev/null 2>&1 || { echo "AWS credentials not available. Run: aws sso login --profile \$AWS_PROFILE" >&2; exit 1; }

TAG="$(date -u +%Y%m%d-%H%M%S)"
if git rev-parse --short HEAD >/dev/null 2>&1; then
  TAG="$TAG-$(git rev-parse --short HEAD)"
  [ -z "$(git status --porcelain)" ] || TAG="$TAG-dirty"
fi
echo "==> Deploying $TAG to region $AWS_REGION"

confirm() {
  $ASSUME_YES && return 0
  read -r -p "$1 [y/N] " answer
  [ "$answer" = "y" ] || { echo "Aborted."; exit 1; }
}
tf() { tofu -chdir="$TF_DIR" "$@"; }
tf_out() { tf output -raw "$1"; }

if ! $SKIP_TESTS; then
  echo "==> Quality gate"
  docker compose up -d --wait dynamodb # route tests run against DynamoDB Local
  pnpm check && pnpm typecheck && pnpm test
fi

echo "==> Initialising OpenTofu"
scripts/infra-init.sh >/dev/null

echo "==> Bundling the Lambda functions"
scripts/build-lambda.sh

echo "==> Planning infrastructure"
tf plan -input=false -out=tfplan
confirm "Apply this plan?"
tf apply -input=false tfplan
rm -f "$TF_DIR/tfplan"

echo "==> Building and uploading the web app"
APP_URL="$(tf_out app_url)"
COGNITO="$(tf output -json cognito)"
cog() { echo "$COGNITO" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
VITE_COGNITO_REGION="$(cog region)" \
VITE_COGNITO_USER_POOL_ID="$(cog user_pool_id)" \
VITE_COGNITO_CLIENT_ID="$(cog client_id)" \
VITE_COGNITO_DOMAIN="$(cog domain)" \
  pnpm --filter @job-tracker/web build
BUCKET="$(tf_out web_bucket)"
aws s3 sync apps/web/dist "s3://$BUCKET" --delete --exclude index.html \
  --cache-control "public,max-age=31536000,immutable"
aws s3 cp apps/web/dist/index.html "s3://$BUCKET/index.html" --cache-control "no-cache" --content-type "text/html"
aws cloudfront create-invalidation --distribution-id "$(tf_out distribution_id)" --paths "/*" >/dev/null

echo "==> Smoke test"
curl -fsS "$APP_URL/health" >/dev/null && echo "health: ok"
STATUS="$(curl -s -o /dev/null -w '%{http_code}' "$APP_URL/api/v1/overview")"
[ "$STATUS" = "401" ] && echo "api requires login: ok" || { echo "Expected 401 from /api/v1/overview, got $STATUS" >&2; exit 1; }

cd "$ROOT"
echo "Deployed $TAG -> $APP_URL"
