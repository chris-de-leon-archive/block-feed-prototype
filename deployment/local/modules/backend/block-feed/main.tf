terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

locals {
  timescaledb_url   = "postgres://blockstore:password@${docker_container.timescaledb.name}:${docker_container.timescaledb.ports[0].internal}/block_feed?sslmode=disable&search_path=block_feed"
  redis_cluster_url = "${docker_container.redis_cluster.name}:${docker_container.redis_cluster.ports[0].internal}"
  redis_stream_url  = "${docker_container.redis_block_stream.name}:${docker_container.redis_block_stream.ports[0].internal}"
  redis_store_url   = "${docker_container.redis_block_store.name}:${docker_container.redis_block_store.ports[0].internal}"
}

resource "docker_image" "redis_cluster_dev" {
  name         = "redis-cluster-dev:${var.tag}"
  keep_locally = true
  build {
    context    = "${path.cwd}/vendor/redis-cluster"
    dockerfile = "./Dockerfile"
  }
}

resource "docker_container" "redis_cluster" {
  name  = "redis-cluster-${var.chain_id}"
  image = docker_image.redis_cluster_dev.name
  env = [
    "CLUSTER_HOST=redis-cluster-${var.chain_id}",
    "START_PORT=${var.redis_cluster_start_port}",
    "END_PORT=${var.redis_cluster_end_port}",
  ]
  dynamic "ports" {
    for_each = range(var.redis_cluster_start_port, var.redis_cluster_end_port + 1)
    content {
      internal = ports.value
      external = ports.value
    }
  }
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_container" "redis_block_stream" {
  name    = "redis-block-stream-${var.chain_id}"
  image   = var.redis_image
  command = ["--port", "6379", "--loglevel", "debug"]
  ports {
    internal = 6379
    external = var.redis_block_stream_port
  }
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_container" "redis_block_store" {
  name    = "redis-block-store-${var.chain_id}"
  image   = var.redis_image
  command = ["--port", "6379", "--loglevel", "debug", "--maxmemory", "0", "--maxmemory-policy", "noeviction", "--appendonly", "yes"]
  ports {
    internal = 6379
    external = var.redis_block_store_port
  }
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_container" "timescaledb" {
  name  = "timescaledb-${var.chain_id}"
  image = var.timescaledb_image
  env = [
    "POSTGRES_PASSWORD=password",
    "POSTGRES_USER=rootuser",
    "POSTGRES_DB=block_feed",
  ]
  ports {
    internal = 5432
    external = var.timescaledb_port
  }
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_image" "block_streamer" {
  name         = "block-streamer:${var.tag}"
  keep_locally = true
  build {
    context    = "${path.cwd}/apps/workers"
    dockerfile = "./Dockerfile"
    build_args = {
      BUILD_PATH = "./src/apps/block-streamers/${var.chain_name}/main.go"
    }
  }
}

resource "docker_container" "block_streamer" {
  name    = "block-streamer-${var.chain_id}"
  image   = docker_image.block_streamer.name
  restart = "always"
  env = [
    "BLOCK_STREAMER_POSTGRES_URL=${local.timescaledb_url}",
    "BLOCK_STREAMER_REDIS_STREAM_URL=${local.redis_stream_url}",
    "BLOCK_STREAMER_REDIS_STORE_URL=${local.redis_store_url}",
    "BLOCK_STREAMER_CHAIN_URL=${var.chain_url}",
    "BLOCK_STREAMER_CHAIN_ID=${var.chain_id}",
  ]
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_image" "block_consumer" {
  name         = "block-consumer:${var.tag}"
  keep_locally = true
  build {
    context    = "${path.cwd}/apps/workers"
    dockerfile = "./Dockerfile"
    build_args = {
      BUILD_PATH = "./src/apps/block-consumer/main.go"
    }
  }
}

resource "docker_container" "block_consumer" {
  name    = "block-consumer-${var.chain_id}"
  image   = docker_image.block_consumer.name
  restart = "always"
  env = [
    "BLOCK_CONSUMER_POSTGRES_URL=${local.timescaledb_url}",
    "BLOCK_CONSUMER_REDIS_CLUSTER_URL=${local.redis_cluster_url}",
    "BLOCK_CONSUMER_REDIS_STREAM_URL=${local.redis_stream_url}",
    "BLOCK_CONSUMER_REDIS_STORE_URL=${local.redis_store_url}",
    "BLOCK_CONSUMER_CHAIN_ID=${var.chain_id}",
    "BLOCK_CONSUMER_BATCH_SIZE=100",
    "BLOCK_CONSUMER_SHARD_COUNT=${var.shard_count}"
  ]
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_image" "block_flusher" {
  name         = "block-flusher:${var.tag}"
  keep_locally = true
  build {
    context    = "${path.cwd}/apps/workers"
    dockerfile = "./Dockerfile"
    build_args = {
      BUILD_PATH = "./src/apps/block-flusher/main.go"
    }
  }
}

resource "docker_container" "block_flusher" {
  name    = "block-flusher-${var.chain_id}"
  image   = docker_image.block_flusher.name
  restart = "always"
  env = [
    "BLOCK_FLUSHER_POSTGRES_URL=${local.timescaledb_url}",
    "BLOCK_FLUSHER_REDIS_STORE_URL=${local.redis_store_url}",
    "BLOCK_FLUSHER_CHAIN_ID=${var.chain_id}",
    "BLOCK_FLUSHER_INTERVAL_MS=1000",
    "BLOCK_FLUSHER_MAX_BLOCKS=25"
  ]
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_image" "webhook_consumer" {
  name         = "webhook-consumer:${var.tag}"
  keep_locally = true
  build {
    context    = "${path.cwd}/apps/workers"
    dockerfile = "./Dockerfile"
    build_args = {
      BUILD_PATH = "./src/apps/webhook-consumer/main.go"
    }
  }
}

resource "docker_container" "webhook_consumer" {
  count   = var.shard_count * var.replicas_per_shard
  name    = "webhook-consumer-${var.chain_id}-${count.index}"
  image   = docker_image.webhook_consumer.name
  restart = "always"
  env = [
    "WEBHOOK_CONSUMER_POSTGRES_URL=${local.timescaledb_url}",
    "WEBHOOK_CONSUMER_REDIS_CLUSTER_URL=${local.redis_cluster_url}",
    "WEBHOOK_CONSUMER_REDIS_STORE_URL=${local.redis_store_url}",
    "WEBHOOK_CONSUMER_CHAIN_ID=${var.chain_id}",
    "WEBHOOK_CONSUMER_NAME=webhook-consumer-replica-${var.chain_id}-${count.index}",
    "WEBHOOK_CONSUMER_POOL_SIZE=${var.workers_per_replica}",
    "WEBHOOK_CONSUMER_SHARD_NUM=${floor(count.index / var.replicas_per_shard) + 1}"
  ]
  networks_advanced {
    name = var.network_name
  }
}

