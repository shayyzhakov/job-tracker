output "app_url" {
  value = "https://${module.web.domain_name}"
}

output "web_bucket" {
  value = module.web.bucket_name
}

output "distribution_id" {
  value = module.web.distribution_id
}

output "api_function" {
  value = module.api.function_name
}

output "scout_function" {
  value = module.scout_function.function_name
}

output "dynamodb_table" {
  value = module.database.table_name
}

output "cognito" {
  value = {
    region       = module.auth.region
    user_pool_id = module.auth.user_pool_id
    client_id    = module.auth.client_id
    domain       = module.auth.hosted_domain
  }
}

output "anthropic_parameter" {
  value = aws_ssm_parameter.anthropic_api_key.name
}
