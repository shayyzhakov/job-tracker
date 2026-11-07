#!/usr/bin/env bash
# Initialises the prod OpenTofu root against the remote state bucket created by infra/bootstrap.
set -euo pipefail
cd "$(dirname "$0")/../infra/envs/prod"

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
tofu init -input=false -reconfigure \
  -backend-config="bucket=job-tracker-tfstate-${ACCOUNT_ID}-${REGION}" \
  -backend-config="region=${REGION}"
