terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

module "etl" {
  source                 = "./etl"
  network_name           = var.network_name
  tag                    = var.tag
  redis_image            = var.redis_image
  timescaledb_url        = var.timescaledb_url
  mysql_url              = var.mysql_url
  chain_name             = var.chain_name
  chain_id               = var.chain_id
  chain_url              = var.chain_url
  port                   = var.etl_port
  poll_ms                = var.poll_ms
  max_blocks_per_poll    = var.max_blocks_per_poll
  max_in_flight_requests = var.max_in_flight_requests
}

module "processing" {
  source                         = "./processing"
  network_name                   = var.network_name
  tag                            = var.tag
  redis_image                    = var.redis_image
  timescaledb_url                = var.timescaledb_url
  mysql_url                      = var.mysql_url
  etl_redis_url                  = module.etl.redis_url
  chain_id                       = var.chain_id
  port                           = var.processing_port
  shards                         = var.shards
  processors_per_shard           = var.processors_per_shard
  consumers_per_processor        = var.consumers_per_processor
  mysql_processor_conn_pool_size = var.mysql_processor_conn_pool_size
  activators_per_shard           = var.activators_per_shard
  consumers_per_activator        = var.consumers_per_activator
  mysql_activator_conn_pool_size = var.mysql_activator_conn_pool_size
}
