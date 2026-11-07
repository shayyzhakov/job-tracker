# Daily AI scout: EventBridge Scheduler invokes the scout Lambda (one scout pass, then it returns).
data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  name               = "${var.name}-scout-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json
}

resource "aws_iam_role_policy" "scheduler" {
  name = "invoke-scout"
  role = aws_iam_role.scheduler.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["lambda:InvokeFunction"]
      Resource = [var.function_arn]
    }]
  })
}

resource "aws_scheduler_schedule" "daily" {
  name                         = "${var.name}-scout-daily"
  state                        = var.enabled ? "ENABLED" : "DISABLED"
  schedule_expression          = var.schedule_expression
  schedule_expression_timezone = var.timezone

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = var.function_arn
    role_arn = aws_iam_role.scheduler.arn

    retry_policy {
      maximum_retry_attempts = 1
    }
  }
}
