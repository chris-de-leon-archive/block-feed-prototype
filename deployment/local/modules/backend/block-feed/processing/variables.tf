variable "tag" {
  type = string
}

variable "network_name" {
  type = string
}

variable "timescaledb_url" {
  type = string
}

variable "mysql_url" {
  type = string
}

variable "redis_image" {
  type = string
}

variable "etl_redis_url" {
  type = string
}

variable "chain_id" {
  type = string
}

variable "port" {
  type = number
}

variable "shards" {
  type = number
}

variable "processors_per_shard" {
  type = number
}

variable "consumers_per_processor" {
  type = number
}

variable "mysql_processor_conn_pool_size" {
  type = string
}

variable "activators_per_shard" {
  type = number
}

variable "consumers_per_activator" {
  type = number
}

variable "mysql_activator_conn_pool_size" {
  type = number
}

variable "block_timeout_ms" {
  type    = number
  default = 60000
}
