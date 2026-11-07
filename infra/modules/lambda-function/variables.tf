variable "name" {
  type = string
}

variable "source_dir" {
  type        = string
  description = "Directory with the bundled handler (index.mjs and any data files)"
}

variable "environment" {
  type    = map(string)
  default = {}
}

variable "policy_json" {
  type        = string
  description = "Extra IAM policy document for the function role (data access)"
}

variable "ssm_path_prefix" {
  type        = string
  description = "SSM parameter path the function may read, e.g. /job-tracker"
}

variable "memory_mb" {
  type    = number
  default = 512
}

variable "timeout_seconds" {
  type    = number
  default = 30
}

variable "create_url" {
  type    = bool
  default = false
}

variable "log_retention_days" {
  type    = number
  default = 14
}
