# AWS infrastructure (OpenTofu)

One environment (`prod`) in your own AWS account. Everything is code; the only manual steps are the one-time setup below.

```
Phone/laptop --HTTPS--> CloudFront ─ /                  -> private S3 bucket (React build, SPA fallback via CloudFront Function)
                                   └ /api /mcp /health  -> Lambda Function URL (API, Fastify via @fastify/aws-lambda, arm64)
                                                              │
                                  DynamoDB (one on-demand table, always-free tier)
EventBridge Scheduler (07:00 Asia/Jerusalem) -> Lambda (AI scout) -> DynamoDB + Anthropic API
Cognito (one admin-created user, optional TOTP MFA) | SSM Parameter Store (secrets) | CloudWatch Logs | AWS Budgets
```

Why this shape: the UI and API share one HTTPS origin (no CORS), CloudFront's default certificate means no domain is required,
and there is no VPC, NAT, load balancer or server, so everything sits in always-free allowances (Lambda 1M requests/month, DynamoDB 25 GB, CloudFront 1 TB, Cognito 10k users, SSM standard parameters).
The Lambda Function URL is public but only answers requests that carry the `x-origin-verify` secret CloudFront adds (CloudFront OAC is not used because it makes clients sign POST bodies). Cognito/the MCP token still protect the routes themselves.

Estimated cost: about $0-1/month (the KMS key that encrypts the OpenTofu state is ~$1). A budget alert (default $10) is created for you.

## Layout

| Path                      | What                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `bootstrap/`              | One-time: encrypted, versioned S3 state bucket + KMS key; optional GitHub OIDC deploy role. |
| `modules/dynamodb`        | Single DynamoDB table (+2 indexes, PITR) and the Lambda access policy.                      |
| `modules/lambda-function` | A Lambda (role, log group, zip from `dist-lambda/`), optionally with a public Function URL. |
| `modules/web`             | S3 + CloudFront (API origin = the Function URL, with the secret header).                    |
| `modules/auth`            | Cognito user pool, client (code + PKCE), hosted login, your user.                           |
| `modules/scout`           | Daily EventBridge schedule that invokes the scout Lambda.                                   |
| `modules/budget`          | Monthly cost alert.                                                                         |
| `envs/prod/`              | Root module wiring it all together, plus the SSM parameters (secrets).                      |

Code is bundled by `scripts/build-lambda.sh` (esbuild, one file per function in `dist-lambda/`); OpenTofu zips and uploads it, so a code change is an ordinary `tofu apply`. No Serverless Framework/SAM/CDK: OpenTofu stays the single source of truth.

State lives in S3 (S3-native locking, no DynamoDB) and is additionally encrypted client-side by OpenTofu with the KMS key from `bootstrap/`; saved plans are encrypted too.

## One-time setup

1. **AWS account access.** Use IAM Identity Center (SSO), not long-lived access keys:
   `aws configure sso` then `export AWS_PROFILE=<profile>` and `aws sso login`.
2. **Install** the AWS CLI v2 and OpenTofu (`tofu`). Docker is used for DynamoDB Local (tests).
3. **Region.** Defaults to `us-east-1`. To change it, edit `region` defaults in `bootstrap/main.tf` and `envs/prod/variables.tf`, and the literals in `envs/prod/versions.tf` (`encryption` block; backend blocks cannot use variables), plus `AWS_REGION` when deploying.
4. **Bootstrap** (creates the state bucket and KMS key, local state):

   ```bash
   cd infra/bootstrap && tofu init && tofu apply
   ```
5. **Your settings:** `cp infra/envs/prod/terraform.tfvars.example infra/envs/prod/terraform.tfvars` and set `owner_email` (Cognito login and budget alerts).

## Deploy

```bash
AWS_PROFILE=<profile> pnpm deploy:aws
```

It runs tests, bundles the Lambdas, shows the OpenTofu plan and asks before applying, uploads the web build, invalidates CloudFront and smoke-tests the result. `--skip-tests` and `--yes` are available.

After the first deploy:
- Cognito emails you a temporary password; open the `app_url` output, sign in, set a permanent password, and add an authenticator app (MFA is optional but recommended).
- Give the scout its key (never put it in git):
  `aws ssm put-parameter --name /job-tracker/anthropic-api-key --type SecureString --overwrite --value '<key>'`
- Trigger a scout run: `aws lambda invoke --function-name job-tracker-scout /dev/stdout`

## Day 2

- **Logs:** `aws logs tail /aws/lambda/job-tracker-api --follow` (also `job-tracker-scout`).
- **Rollback:** redeploy a previous commit (`pnpm deploy:aws`); Lambda versions are not kept.
- **MCP from Claude:** the endpoint is `<app_url>/mcp` and uses OAuth with Cognito as the authorization server. Add the URL as a custom connector (or `claude mcp add --transport http job-tracker <app_url>/mcp`); the client discovers the endpoints, registers itself via `POST /oauth/register` and sends you to the Cognito sign-in page. There is no token to copy and nothing to register by hand. Set `mcp_enabled = false` in tfvars to switch it off.
- **Database access:** with your admin SSO profile, e.g. `aws dynamodb query --table-name job-tracker --key-condition-expression "PK = :p" --expression-attribute-values '{":p":{"S":"SCOUT"}}'`; no network path is needed.
- **Restore:** the table has point-in-time recovery (35 days): `aws dynamodb restore-table-to-point-in-time --source-table-name job-tracker --target-table-name job-tracker-restored --use-latest-restore-time`.
- **Tear down:** set `db_deletion_protection = false` in tfvars, apply, then `tofu destroy` in `envs/prod`.

## Security notes

- Everything under `/api` requires a Cognito access token; `/mcp` requires a Cognito OAuth token with the `jobtracker/mcp` scope (plus the open discovery/registration routes under `/.well-known/*` and `/oauth/*`); only `/health` is open.
- The API Lambda rejects any request without CloudFront's `x-origin-verify` secret; its role can only use the table and its indexes and read `/job-tracker/*` SSM parameters.
- No WAF (it adds about $5+/month); rate limiting is not implemented. Revisit if the app ever stops being single-user.
- `tfplan`, `*.tfstate` and `terraform.tfvars` are gitignored.

## Static checks

```bash
docker run --rm -v "$PWD/infra:/infra" ghcr.io/opentofu/opentofu:1.10 -chdir=/infra fmt -check -recursive
docker run --rm -v "$PWD/infra:/infra" ghcr.io/aquasecurity/trivy:latest config /infra
```
(or the same with a locally installed `tofu`). Accepted low-severity findings are listed in `.trivyignore`; accepted HIGH findings (no WAF, SSE-S3 on the public SPA bucket) are ignored inline with `#trivy:ignore:` on the resource, with the reason beside it.

## CI/CD (GitHub Actions)

`ci.yml` (lint, types, tests, `tofu fmt`, Trivy) runs on every pull request. `deploy.yml` runs on pushes to `main`: it calls `ci.yml`, then, after a manual approval, runs `scripts/deploy.sh` (Lambda bundles, `tofu apply`, web upload, smoke test).

**No AWS keys are stored anywhere.** The deploy job swaps a short-lived GitHub OIDC token for temporary AWS credentials. The IAM role trusts only `repo:<owner>/<repo>:environment:production`, so pull requests, forks and unapproved runs get nothing. The repository is public, but there is no secret in it to leak.

### One-time setup

1. Create the OIDC provider and role (needs your AWS admin login):

   ```bash
   cd infra/bootstrap && tofu apply -var github_repo=shayyzhakov/job-tracker
   tofu output ci_role_arn
   ```
2. GitHub, Settings > Secrets and variables > Actions > **Variables**: `AWS_DEPLOY_ROLE_ARN` (the output above) and `OWNER_EMAIL`. These are not secrets.
3. Settings > Environments > **production**: enable _Required reviewers_ (you), and under _Deployment branches_ choose _Selected branches_ = `main`.
4. Settings > Rules > Rulesets > new branch ruleset for `main` (enforcement: active): require a pull request with 1 approval and _Require review from Code Owners_, require status checks `quality` and `infra`, block force pushes and deletions. Only you can approve, so nobody else can land or deploy changes.
5. Settings > Actions > General: _Fork pull request workflows_: require approval for all outside collaborators; _Workflow permissions_: read-only.

With a single maintainer you cannot approve your own pull request; either leave "required approvals" at 0 while keeping the other rules (the environment approval then remains the deploy gate), or let the ruleset's bypass list include yourself.

- The CI deploy role uses AdministratorAccess, which is acceptable for a one-owner account; narrow it before sharing the account.
