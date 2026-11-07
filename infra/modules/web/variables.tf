variable "name" {
  type = string
}

variable "api_domain" {
  type        = string
  description = "Hostname of the API Lambda Function URL"
}

variable "origin_verify_secret" {
  type        = string
  sensitive   = true
  description = "Value of the x-origin-verify header CloudFront adds to API requests"
}

variable "price_class" {
  type    = string
  default = "PriceClass_100" # North America + Europe edge locations
}
