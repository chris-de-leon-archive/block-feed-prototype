variable "tag" {
  type = string
}

variable "network_name" {
  type = string
}

variable "mongo_readwrite_url" {
  type = string
}

variable "mongo_db_name" {
  type = string
}

variable "mysql_url" {
  type = string
}

variable "redis_image" {
  type = string
}

variable "chain_id" {
  type = string
}

variable "chain_name" {
  type = string
}

variable "chain_url" {
  type = string
}

variable "port" {
  type = number
}

variable "max_blocks_per_poll" {
  type = number
}

variable "max_in_flight_requests" {
  type = number
}

variable "poll_ms" {
  type = number
}

variable "block_timeout_ms" {
  type    = number
  default = 60000
}
