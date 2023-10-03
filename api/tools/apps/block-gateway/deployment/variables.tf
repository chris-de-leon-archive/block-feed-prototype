variable "AWS_ACCESS_KEY" {
  type      = string
  sensitive = true
}

variable "AWS_REGION" {
  type      = string
  sensitive = true
}

variable "AWS_SECRET_KEY" {
  type      = string
  sensitive = true
}

variable "DOCKERHUB_PASSWORD" {
  type      = string
  sensitive = true
}

variable "DOCKERHUB_USERNAME" {
  type      = string
  sensitive = true
}

variable "RDS_DB_NAME" {
  type      = string
  sensitive = true
}

variable "RDS_GTWY_PWORD" {
  type      = string
  sensitive = true
}

variable "RDS_GTWY_UNAME" {
  type      = string
  sensitive = true
}

variable "RDS_ROOT_PWORD" {
  type      = string
  sensitive = true
}

variable "RDS_ROOT_UNAME" {
  type      = string
  sensitive = true
}

variable "SSH_PRV_KEY" {
  type      = string
  sensitive = true
}

variable "SSH_PUB_KEY" {
  type      = string
  sensitive = true
}

variable "IMAGE_TAG" {
  type = string
}

variable "ENVIRONMENT" {
  type = string
  validation {
    condition     = contains(["stag", "prod"], var.ENVIRONMENT)
    error_message = "Valid values for ENVIRONMENT are 'stag' or 'prod'"
  }
}

variable "PROJECT_NAME" {
  default = "block-feed"
  type    = string
  validation {
    condition     = var.PROJECT_NAME == "block-feed"
    error_message = "PROJECT_NAME must equal 'block-feed'"
  }
}
