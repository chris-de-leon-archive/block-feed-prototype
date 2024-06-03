variable "tag" {
  type = string
}

variable "timescaledb_version" {
  type    = string
  default = "latest-pg16"
}

variable "mysql_version" {
  type    = string
  default = "8.3.0"
}

variable "redis_version" {
  type    = string
  default = "7.2.1-alpine3.18"
}

