variable "name" {
  type = string
}

variable "function_arn" {
  type = string
}

variable "schedule_expression" {
  type    = string
  default = "cron(0 7 * * ? *)"
}

variable "timezone" {
  type    = string
  default = "Asia/Jerusalem"
}

variable "enabled" {
  type    = bool
  default = true
}
