variable "tag" {
  type = string
}

variable "mongo_version" {
  type    = string
  default = "7.0.5"
}

variable "mongo_db_name" {
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
