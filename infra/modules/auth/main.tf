# Cognito user pool for a single person: admin-created user, no self sign-up, hosted login UI, optional TOTP MFA.
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  domain_prefix = "${var.name}-${data.aws_caller_identity.current.account_id}"
}

resource "aws_cognito_user_pool" "this" {
  name                     = var.name
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]
  mfa_configuration        = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

resource "aws_cognito_user_pool_domain" "this" {
  domain       = local.domain_prefix
  user_pool_id = aws_cognito_user_pool.this.id
}

# Custom scope that gates the /mcp endpoint. MCP clients register their own app clients at runtime (the API's
# /oauth/register, apps/api/src/oauth) with this scope; the web client above deliberately does not get it.
resource "aws_cognito_resource_server" "mcp" {
  user_pool_id = aws_cognito_user_pool.this.id
  identifier   = "jobtracker"
  name         = "${var.name}-mcp"

  scope {
    scope_name        = "mcp"
    scope_description = "Use the Job Tracker MCP server"
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name            = "${var.name}-web"
  user_pool_id    = aws_cognito_user_pool.this.id
  generate_secret = false # public SPA client; PKCE protects the code flow

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email"]
  supported_identity_providers         = ["COGNITO"]
  callback_urls                        = ["https://${var.app_domain}/"]
  logout_urls                          = ["https://${var.app_domain}/"]
  explicit_auth_flows                  = ["ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors        = "ENABLED"

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

resource "aws_cognito_user" "owner" {
  user_pool_id             = aws_cognito_user_pool.this.id
  username                 = var.user_email
  desired_delivery_mediums = ["EMAIL"]
  attributes = {
    email          = var.user_email
    email_verified = "true"
  }
}
