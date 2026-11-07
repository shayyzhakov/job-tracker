variable "name" {
  type = string
}

variable "app_domain" {
  type        = string
  description = "Public hostname of the app (CloudFront or custom domain), used for OAuth callbacks"
}

variable "user_email" {
  type        = string
  description = "The one user; Cognito emails an invitation with a temporary password"
}
