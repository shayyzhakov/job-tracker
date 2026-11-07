variable "region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "job-tracker"
}

variable "owner_email" {
  type        = string
  description = "Cognito login user, and recipient of budget alerts"
}

variable "monthly_budget_usd" {
  type    = number
  default = 70
}

variable "mcp_enabled" {
  type        = bool
  default     = true
  description = "Expose /mcp (protected by Cognito OAuth with dynamic client registration)"
}

variable "db_deletion_protection" {
  type        = bool
  default     = true
  description = "Deletion protection on the DynamoDB table"
}

variable "scout_enabled" {
  type    = bool
  default = true
}
