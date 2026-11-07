# Dormant until var.github_repo is set. Lets GitHub Actions deploy without stored AWS keys.
locals {
  ci_enabled = var.github_repo != ""
}

resource "aws_iam_openid_connect_provider" "github" {
  count          = local.ci_enabled ? 1 : 0
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

resource "aws_iam_role" "ci_deploy" {
  count = local.ci_enabled ? 1 : 0
  name  = "${var.project}-ci-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github[0].arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          # Only jobs of this repository that run in its `production` environment can assume the role.
          # That environment requires manual approval and is restricted to the main branch (see infra/README.md),
          # so a pull request, a fork or an unapproved run can never obtain AWS credentials.
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:environment:production"
        }
      }
    }]
  })
}

# Pragmatic for a single-owner personal account: the deploy role manages every service in this stack.
# Narrow it before sharing the account with others.
resource "aws_iam_role_policy_attachment" "ci_deploy" {
  count      = local.ci_enabled ? 1 : 0
  role       = aws_iam_role.ci_deploy[0].name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

output "ci_role_arn" {
  value = local.ci_enabled ? aws_iam_role.ci_deploy[0].arn : null
}
