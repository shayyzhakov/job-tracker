output "user_pool_id" {
  value = aws_cognito_user_pool.this.id
}

output "client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "hosted_domain" {
  value = "${aws_cognito_user_pool_domain.this.domain}.auth.${data.aws_region.current.region}.amazoncognito.com"
}

output "region" {
  value = data.aws_region.current.region
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.this.arn
}
