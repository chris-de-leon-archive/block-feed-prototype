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
  envvars = [
    "CHAIN_ID=${var.chain_id}",
    "CHAIN_URL=${var.chain_url}",
    "CHAIN_PG_STORE_URL=${local.timescaledb_url}",
    "CHAIN_REDIS_STORE_URL=${local.redis_store_url}",
    "CHAIN_REDIS_CLUSTER_URL=${local.redis_cluster_url}",
    "CHAIN_REDIS_STREAM_URL=${local.redis_stream_url}",
    "CHAIN_SHARD_COUNT=${var.shard_count}",
  ]
}

resource "null_resource" "insert_chain" {
  // Always re-run the local-exec command
  triggers = {
    always_run = timestamp()
  }

  provisioner "local-exec" {
    command = "docker exec mysql /bin/bash -c 'bash /db/utils/insert-chain.sh \"${var.chain_id}\" \"${var.shard_count}\" \"${var.chain_url}\" \"${local.timescaledb_url}\" \"${local.redis_store_url}\" \"${local.redis_cluster_url}\" \"${local.redis_stream_url}\"'"
  }
}

resource "null_resource" "restart_redis_cluster" {
  // Always re-run the local-exec command
  triggers = {
    always_run = timestamp()
  }

  provisioner "local-exec" {
    command = "docker restart \"${docker_container.redis_cluster.name}\""
  }

  depends_on = [docker_container.redis_cluster]
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

resource "docker_image" "block_forwarder" {
  name         = "block-forwarder:${var.tag}"
  keep_locally = true
  build {
    context    = path.cwd
    dockerfile = "./go.Dockerfile"
    build_args = {
      BUILD_DIR = "apps/block-feed/block-forwarders/${var.chain_name}-forwarder"
    }
  }
}

resource "docker_container" "block_forwarder" {
  name    = "block-forwarder-${var.chain_id}"
  restart = "always"
  image   = docker_image.block_forwarder.name
  env     = local.envvars
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_image" "block_router" {
  name         = "block-router:${var.tag}"
  keep_locally = true
  build {
    context    = path.cwd
    dockerfile = "./go.Dockerfile"
    build_args = {
      BUILD_DIR = "apps/block-feed/block-router"
    }
  }
}

resource "docker_container" "block_router" {
  name    = "block-router-${var.chain_id}"
  restart = "always"
  image   = docker_image.block_router.name
  env = concat(local.envvars, [
    "BLOCK_CONSUMER_BATCH_SIZE=100",
  ])
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_image" "block_flusher" {
  name         = "block-flusher:${var.tag}"
  keep_locally = true
  build {
    context    = path.cwd
    dockerfile = "./go.Dockerfile"
    build_args = {
      BUILD_DIR = "apps/block-feed/block-flusher"
    }
  }
}

resource "docker_container" "block_flusher" {
  name    = "block-flusher-${var.chain_id}"
  restart = "always"
  image   = docker_image.block_flusher.name
  env = concat(local.envvars, [
    "BLOCK_FLUSHER_INTERVAL_MS=1000",
    "BLOCK_FLUSHER_THRESHOLD=25"
  ])
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_image" "webhook_processor" {
  name         = "webhook-processor:${var.tag}"
  keep_locally = true
  build {
    context    = path.cwd
    dockerfile = "./go.Dockerfile"
    build_args = {
      BUILD_DIR = "apps/block-feed/block-processors/webhook-processor"
    }
  }
}

resource "docker_container" "webhook_processor" {
  count   = var.shard_count * var.replicas_per_shard
  name    = "webhook-processor-${var.chain_id}-${count.index}"
  restart = "always"
  image   = docker_image.webhook_processor.name
  env = concat(local.envvars, [
    "WEBHOOK_PROCESSOR_NAME=webhook-consumer-replica-${var.chain_id}-${count.index}",
    "WEBHOOK_PROCESSOR_POOL_SIZE=${var.workers_per_replica}",
    "WEBHOOK_PROCESSOR_SHARD_ID=${floor(count.index / var.replicas_per_shard) + 1}",
    "WEBHOOK_PROCESSOR_MYSQL_URL=${var.mysql_workers_url}",
    "WEBHOOK_PROCESSOR_MYSQL_CONN_POOL_SIZE=5"
  ])
  networks_advanced {
    name = var.network_name
  }
}

