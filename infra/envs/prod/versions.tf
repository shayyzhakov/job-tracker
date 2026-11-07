terraform {
  required_version = ">= 1.10"

  required_providers {
    aws     = { source = "hashicorp/aws", version = "~> 6.0" }
    random  = { source = "hashicorp/random", version = "~> 3.6" }
    archive = { source = "hashicorp/archive", version = "~> 2.7" }
  }

  # Bucket and region come from `scripts/infra-init.sh` (-backend-config); backend blocks cannot use variables.
  backend "s3" {
    key          = "prod/terraform.tfstate"
    use_lockfile = true # S3-native locking, no DynamoDB table
    encrypt      = true
  }

  # OpenTofu client-side encryption: state and saved plans are encrypted with the KMS key made by bootstrap/.
  # Literal values only (the encryption block cannot use variables); change the region here if you change it elsewhere.
  encryption {
    key_provider "aws_kms" "state" {
      kms_key_id = "alias/job-tracker-tfstate"
      region     = "us-east-1"
      key_spec   = "AES_256"
    }
    method "aes_gcm" "state" {
      keys = key_provider.aws_kms.state
    }
    state {
      method   = method.aes_gcm.state
      enforced = true
    }
    plan {
      method   = method.aes_gcm.state
      enforced = true
    }
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = { Project = var.project, Environment = "prod", ManagedBy = "opentofu" }
  }
}
