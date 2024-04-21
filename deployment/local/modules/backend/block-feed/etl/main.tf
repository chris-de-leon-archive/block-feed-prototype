terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

resource "docker_container" "redis_event_bus" {
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

resource "docker_image" "block_streamer" {
  name         = "block-streamer-${var.chain_id}:${var.tag}"
  keep_locally = true
  build {
    context    = "${path.cwd}/apps/workers"
    dockerfile = "./Dockerfile"
    build_args = {
      BUILD_PATH = "./src/apps/etl/${var.chain_name}/main.go"
    }
  }
}

resource "docker_container" "block_streamer" {
  name    = "block-poller-${var.chain_id}"
  image   = docker_image.block_streamer.name
  restart = "always"
  env = [
    "BLOCK_STREAMER_POSTGRES_URL=${var.timescaledb_url}",
    "BLOCK_STREAMER_REDIS_URL=${docker_container.redis_event_bus.name}:${docker_container.redis_event_bus.ports[0].internal}",
    "BLOCK_STREAMER_BLOCKCHAIN_URL=${var.chain_url}",
    "BLOCK_STREAMER_BLOCKCHAIN_ID=${var.chain_id}",
  ]
  networks_advanced {
    name = var.network_name
  }
}

