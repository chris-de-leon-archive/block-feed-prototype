terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

provider "docker" {
}

resource "docker_image" "redis" {
  name         = "docker.io/redis:7.2.1-alpine3.18"
  keep_locally = true
}

resource "docker_network" "block_feed_net" {
  name = "block_feed_net"
}

module "block_relay_storage" {
  source        = "./modules/block-relay-storage"
  network_name  = docker_network.block_feed_net.name
  tag           = var.tag
  mongo_version = var.mongo_version
  mongo_db_name = var.mongo_db_name
  mysql_version = var.mysql_version
  mysql_db_name = var.mysql_db_name
}

// module "flow_mainnet_block_relay" {
//   source                         = "./modules/block-relay"
//   network_name                   = docker_network.block_feed_net.name
//   tag                            = var.tag
//   redis_image                    = docker_image.redis.name
//   mongo_readwrite_url            = module.block_relay_storage.mongo_readwrite_url
//   mongo_readonly_url             = module.block_relay_storage.mongo_readonly_url
//   mongo_db_name                  = var.mongo_db_name
//   mysql_url                      = module.block_relay_storage.mysql_url
//   chain_url                      = "access.mainnet.nodes.onflow.org:9000"
//   chain_id                       = "flow-mainnet"
//   chain_name                     = "flow"
//   etl_port                       = 6380
//   poll_ms                        = 1000
//   max_blocks_per_poll            = 10
//   max_in_flight_requests         = 10
//   processing_port                = 6381
//   shards                         = 1
//   processors_per_shard           = 1
//   consumers_per_processor        = 3
//   mysql_processor_conn_pool_size = 3
//   activators_per_shard           = 1
//   consumers_per_activator        = 3
//   mysql_activator_conn_pool_size = 3
//   depends_on                     = [module.block_relay_storage]
// }

module "eth_mainnet_block_relay" {
  source                         = "./modules/block-relay"
  network_name                   = docker_network.block_feed_net.name
  tag                            = var.tag
  redis_image                    = docker_image.redis.name
  mongo_readwrite_url            = module.block_relay_storage.mongo_readwrite_url
  mongo_readonly_url             = module.block_relay_storage.mongo_readonly_url
  mongo_db_name                  = var.mongo_db_name
  mysql_url                      = module.block_relay_storage.mysql_url
  chain_url                      = "https://eth-mainnet.public.blastapi.io"
  chain_id                       = "eth-mainnet"
  chain_name                     = "eth"
  etl_port                       = 6382
  poll_ms                        = 1000
  max_blocks_per_poll            = 10
  max_in_flight_requests         = 10
  processing_port                = 6383
  shards                         = 1
  processors_per_shard           = 1
  consumers_per_processor        = 3
  mysql_processor_conn_pool_size = 3
  activators_per_shard           = 1
  consumers_per_activator        = 3
  mysql_activator_conn_pool_size = 3
  depends_on                     = [module.block_relay_storage]
}

module "block_relay_lb" {
  source       = "./modules/block-relay-lb"
  tag          = var.tag
  network_name = docker_network.block_feed_net.name
  redis_image  = docker_image.redis.name
  mysql_url    = module.block_relay_storage.mysql_url
  port         = 6379
  replicas     = 1
  depends_on = [
    module.block_relay_storage,
    module.eth_mainnet_block_relay,
  ]
}

