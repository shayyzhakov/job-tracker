output "function_name" {
  value = aws_lambda_function.this.function_name
}

output "function_arn" {
  value = aws_lambda_function.this.arn
}

output "url_domain" {
  description = "Hostname of the Function URL (no scheme, no trailing slash)"
  value       = var.create_url ? trimsuffix(trimprefix(aws_lambda_function_url.this[0].function_url, "https://"), "/") : null
}

output "role_name" {
  value = aws_iam_role.this.name
}
