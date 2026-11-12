locals {
  name = var.project
  # Everything the Lambdas read at runtime (secrets and settings) lives under this SSM path.
  ssm_prefix = "/${var.project}"
}

module "database" {
  source              = "../../modules/dynamodb"
  name                = local.name
  deletion_protection = var.db_deletion_protection
}

# ---- Secrets and settings: SSM Parameter Store (Standard tier is free; SecureString uses the AWS-managed key) ----

resource "random_password" "origin_verify" {
  length  = 48
  special = false
}

# CloudFront adds this as the x-origin-verify header; the API rejects requests without it (so the public Lambda URL is not usable directly).
resource "aws_ssm_parameter" "origin_verify" {
  name        = "${local.ssm_prefix}/origin-verify-secret"
  description = "Shared secret between CloudFront and the API Lambda"
  type        = "SecureString"
  value       = random_password.origin_verify.result
}

resource "aws_ssm_parameter" "anthropic_api_key" {
  name        = "${local.ssm_prefix}/anthropic-api-key"
  description = "Set once: aws ssm put-parameter --name ${local.ssm_prefix}/anthropic-api-key --type SecureString --overwrite --value <key>"
  type        = "SecureString"
  value       = "not-set-yet"

  lifecycle {
    ignore_changes = [value]
  }
}

# Cognito ids are passed through SSM (not env vars) because the API function must exist before CloudFront, which
# the Cognito app client's callback URL depends on; the function only needs the parameter *names*.
resource "aws_ssm_parameter" "cognito_user_pool_id" {
  name  = "${local.ssm_prefix}/cognito-user-pool-id"
  type  = "String"
  value = module.auth.user_pool_id
}

resource "aws_ssm_parameter" "cognito_client_id" {
  name  = "${local.ssm_prefix}/cognito-client-id"
  type  = "String"
  value = module.auth.client_id
}

# Also by name only (see above): the app's public origin and the Cognito hosted UI domain feed the MCP OAuth
# discovery documents.
resource "aws_ssm_parameter" "app_url" {
  name  = "${local.ssm_prefix}/mcp-public-url"
  type  = "String"
  value = "https://${module.web.domain_name}"
}

resource "aws_ssm_parameter" "cognito_domain" {
  name  = "${local.ssm_prefix}/cognito-domain"
  type  = "String"
  value = module.auth.hosted_domain
}

# ---- Compute ----

module "api" {
  source          = "../../modules/lambda-function"
  name            = "${local.name}-api"
  source_dir      = "${path.root}/../../../dist-lambda/api"
  policy_json     = module.database.access_policy_json
  ssm_path_prefix = local.ssm_prefix
  create_url      = true
  memory_mb       = 512
  timeout_seconds = 29 # CloudFront gives up after 30 s

  environment = {
    DYNAMODB_TABLE = module.database.table_name
    LOG_LEVEL      = "info"
    TRUST_PROXY    = "true"
    MCP_ENABLED    = tostring(var.mcp_enabled)
    # The public hostname is only known after CloudFront exists; Cognito OAuth is what protects /mcp here.
    MCP_ALLOWED_HOSTS = "*"
    # Resolved from SSM once per cold start (see apps/api/src/ssm.ts): SSM_<NAME> = parameter name -> <NAME>.
    SSM_MCP_PUBLIC_URL       = "${local.ssm_prefix}/mcp-public-url"
    SSM_COGNITO_DOMAIN       = "${local.ssm_prefix}/cognito-domain"
    SSM_ORIGIN_VERIFY_SECRET = aws_ssm_parameter.origin_verify.name
    SSM_COGNITO_USER_POOL_ID = "${local.ssm_prefix}/cognito-user-pool-id"
    SSM_COGNITO_CLIENT_ID    = "${local.ssm_prefix}/cognito-client-id"
  }
}

# Dynamic client registration for MCP clients creates and prunes Cognito app clients at runtime.
data "aws_iam_policy_document" "mcp_client_registration" {
  statement {
    actions   = ["cognito-idp:CreateUserPoolClient", "cognito-idp:DeleteUserPoolClient", "cognito-idp:ListUserPoolClients"]
    resources = [module.auth.user_pool_arn]
  }
}

resource "aws_iam_role_policy" "api_mcp_client_registration" {
  name   = "mcp-client-registration"
  role   = module.api.role_name
  policy = data.aws_iam_policy_document.mcp_client_registration.json
}

module "scout_function" {
  source          = "../../modules/lambda-function"
  name            = "${local.name}-scout"
  source_dir      = "${path.root}/../../../dist-lambda/scout"
  policy_json     = module.database.access_policy_json
  ssm_path_prefix = local.ssm_prefix
  memory_mb       = 512
  timeout_seconds = 900 # Lambda maximum; the web search source stops itself after SCOUT_SEARCH_DEADLINE_SECONDS

  environment = {
    DYNAMODB_TABLE        = module.database.table_name
    SCOUT_SCORER          = "claude"
    SCOUT_SOURCES         = "websearch"
    SCOUT_TIMEZONE        = "Asia/Jerusalem"
    SCOUT_FIXTURE_PATH    = "/var/task/listings.json"
    SSM_ANTHROPIC_API_KEY = aws_ssm_parameter.anthropic_api_key.name
  }
}

module "scout" {
  source       = "../../modules/scout"
  name         = local.name
  function_arn = module.scout_function.function_arn
  enabled      = var.scout_enabled
}

module "web" {
  source               = "../../modules/web"
  name                 = local.name
  api_domain           = module.api.url_domain
  origin_verify_secret = random_password.origin_verify.result
}

module "auth" {
  source     = "../../modules/auth"
  name       = local.name
  app_domain = module.web.domain_name
  user_email = var.owner_email
}

module "budget" {
  source            = "../../modules/budget"
  name              = local.name
  email             = var.owner_email
  monthly_limit_usd = var.monthly_budget_usd
}
