variable "tag" {
  type = string
}

variable "network_name" {
  type = string
}

variable "timescaledb_image" {
  type = string
}

variable "redis_image" {
  type = string
}

variable "mysql_workers_url" {
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

variable "redis_cluster_start_port" {
  type = number
}

variable "redis_cluster_end_port" {
  type = number
}

variable "redis_block_stream_port" {
  type = number
}

variable "redis_block_store_port" {
  type = number
}

variable "timescaledb_port" {
  type = number
}

variable "shard_count" {
  type = number
}

variable "replicas_per_shard" {
  type = number
}

variable "workers_per_replica" {
  type = number
}

