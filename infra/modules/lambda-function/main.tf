# One Lambda function (arm64, Node.js) with its role and log group, built from a directory the deploy script bundled
# (scripts/build-lambda.sh). Optionally exposes a public Function URL, which CloudFront uses as an origin.
data "archive_file" "code" {
  type        = "zip"
  source_dir  = var.source_dir
  output_path = "${path.module}/.build/${var.name}.zip" # zip contents are deterministic, so the hash only changes with the code
}

resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.name}"
  retention_in_days = var.log_retention_days
}

data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name               = var.name
  assume_role_policy = data.aws_iam_policy_document.assume.json
}

data "aws_iam_policy_document" "permissions" {
  source_policy_documents = [var.policy_json]

  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.this.arn}:*"]
  }

  # Secrets and settings live in SSM Parameter Store under one path (decrypted with the AWS-managed key).
  statement {
    actions   = ["ssm:GetParameters", "ssm:GetParameter"]
    resources = ["arn:aws:ssm:*:*:parameter${var.ssm_path_prefix}/*"]
  }
}

resource "aws_iam_role_policy" "this" {
  name   = "permissions"
  role   = aws_iam_role.this.id
  policy = data.aws_iam_policy_document.permissions.json
}

resource "aws_lambda_function" "this" {
  function_name    = var.name
  role             = aws_iam_role.this.arn
  runtime          = "nodejs24.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  filename         = data.archive_file.code.output_path
  source_code_hash = data.archive_file.code.output_base64sha256
  memory_size      = var.memory_mb
  timeout          = var.timeout_seconds

  environment {
    variables = merge({ NODE_ENV = "production" }, var.environment)
  }

  depends_on = [aws_cloudwatch_log_group.this, aws_iam_role_policy.this]
}

# Public Function URL (no IAM auth): CloudFront adds a secret header that the app checks, because OAC would require
# browsers and MCP clients to sign POST bodies themselves.
resource "aws_lambda_function_url" "this" {
  count              = var.create_url ? 1 : 0
  function_name      = aws_lambda_function.this.function_name
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "url" {
  count                  = var.create_url ? 1 : 0
  statement_id           = "FunctionURLAllowPublicAccess"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.this.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}
