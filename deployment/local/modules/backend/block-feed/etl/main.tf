terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

resource "docker_container" "block_poller_redis" {
  name    = "block-poller-redis-${var.chain_id}"
  image   = var.redis_image
  command = ["--port", "6379", "--loglevel", "debug"]
  ports {
    internal = 6379
    external = var.port
  }
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_image" "block_poller" {
  name         = "block-poller-${var.chain_id}:${var.tag}"
  keep_locally = true
  build {
    context    = "${path.cwd}/apps/backend"
    dockerfile = "./Dockerfile"
    build_args = {
      BUILD_PATH = "./src/apps/etl/block-pollers/${var.chain_name}/main.go"
    }
  }
}

resource "docker_container" "block_poller" {
  name    = "block-poller-${var.chain_id}"
  image   = docker_image.block_poller.name
  restart = "always"
  env = [
    "BLOCK_POLLER_MYSQL_URL=${var.mysql_url}",
    "BLOCK_POLLER_REDIS_URL=${docker_container.block_poller_redis.name}:${docker_container.block_poller_redis.ports[0].internal}",
    "BLOCK_POLLER_BLOCKCHAIN_URL=${var.chain_url}",
    "BLOCK_POLLER_BLOCKCHAIN_ID=${var.chain_id}",
    "BLOCK_POLLER_MAX_IN_FLIGHT_REQUESTS=${var.max_in_flight_requests}",
    "BLOCK_POLLER_BLOCK_TIMEOUT_MS=${var.block_timeout_ms}",
    "BLOCK_POLLER_BATCH_SIZE=${var.max_blocks_per_poll}",
    "BLOCK_POLLER_POLL_MS=${var.poll_ms}"
  ]
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_image" "block_consumer" {
  name         = "block-consumer:${var.tag}"
  keep_locally = true
  build {
    context    = "${path.cwd}/apps/backend"
    dockerfile = "./Dockerfile"
    build_args = {
      BUILD_PATH = "./src/apps/etl/block-consumer/main.go"
    }
  }
}

resource "docker_container" "block_consumer" {
  name    = "block-consumer-${var.chain_id}"
  image   = docker_image.block_consumer.name
  restart = "always"
  env = [
    "BLOCK_CONSUMER_POSTGRES_URL=${var.timescaledb_url}",
    "BLOCK_CONSUMER_REDIS_URL=${docker_container.block_poller_redis.name}:${docker_container.block_poller_redis.ports[0].internal}",
    "BLOCK_CONSUMER_BLOCKCHAIN_ID=${var.chain_id}",
    "BLOCK_CONSUMER_BLOCK_TIMEOUT_MS=${var.block_timeout_ms}",
    "BLOCK_CONSUMER_NAME=${var.chain_id}-block-consumer"
  ]
  networks_advanced {
    name = var.network_name
  }
}

