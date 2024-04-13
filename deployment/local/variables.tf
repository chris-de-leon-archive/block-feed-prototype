variable "tag" {
  type = string
}

variable "timescaledb_version" {
  type    = string
  default = "latest-pg16"
}

variable "timescaledb_db_name" {
  type    = string
  default = "block_feed"
}

variable "mysql_version" {
  type    = string
  default = "8.3.0"
}

variable "mysql_db_name" {
  type    = string
  default = "block_feed"
}
