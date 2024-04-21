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

module "block_feed_storage" {
  source              = "./modules/storage"
  network_name        = docker_network.block_feed_net.name
  tag                 = var.tag
  timescaledb_version = var.timescaledb_version
  timescaledb_db_name = var.timescaledb_db_name
  mysql_version       = var.mysql_version
  mysql_db_name       = var.mysql_db_name
}

# module "block_feed_flow_testnet" {
#   source                         = "./modules/backend/block-feed"
#   network_name                   = docker_network.block_feed_net.name
#   tag                            = var.tag
#   redis_image                    = docker_image.redis.name
#   timescaledb_url                = module.block_feed_storage.timescaledb_url
#   mysql_url                      = module.block_feed_storage.mysql_backend_url
#   chain_url                      = "access.devnet.nodes.onflow.org:9000"
#   chain_id                       = "flow-testnet"
#   chain_name                     = "flow"
#   etl_port                       = 6382
#   processing_port                = 6383
#   shards                         = 1
#   processors_per_shard           = 1
#   consumers_per_processor        = 3
#   mysql_processor_conn_pool_size = 3
#   activators_per_shard           = 1
#   consumers_per_activator        = 3
#   mysql_activator_conn_pool_size = 3
#   depends_on                     = [module.block_feed_storage]
# }

module "block_feed_moonbeam_mainnet" {
  source                         = "./modules/backend/block-feed"
  network_name                   = docker_network.block_feed_net.name
  tag                            = var.tag
  redis_image                    = docker_image.redis.name
  timescaledb_url                = module.block_feed_storage.timescaledb_url
  mysql_url                      = module.block_feed_storage.mysql_backend_url
  chain_url                      = "wss://moonbeam-rpc.dwellir.com"
  chain_id                       = "moonbeam-mainnet"
  chain_name                     = "eth"
  etl_port                       = 6382
  processing_port                = 6383
  shards                         = 1
  processors_per_shard           = 1
  consumers_per_processor        = 3
  mysql_processor_conn_pool_size = 3
  activators_per_shard           = 1
  consumers_per_activator        = 3
  mysql_activator_conn_pool_size = 3
  depends_on                     = [module.block_feed_storage]
}

module "block_feed_lb" {
  source       = "./modules/backend/block-feed-lb"
  tag          = var.tag
  network_name = docker_network.block_feed_net.name
  redis_image  = docker_image.redis.name
  mysql_url    = module.block_feed_storage.mysql_backend_url
  port         = 6379
  replicas     = 1
  depends_on = [
    module.block_feed_storage,
    # module.block_feed_flow_testnet,
    module.block_feed_eth_mainnet,
  ]
}

