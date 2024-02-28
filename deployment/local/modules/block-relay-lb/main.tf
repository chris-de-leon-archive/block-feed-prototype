terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

resource "docker_container" "webhook_lb_redis" {
  name    = "webhook-lb-redis"
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

resource "docker_image" "webhook_lb_consumer" {
  name = "webhook-lb-consumer:${var.tag}"
  build {
    context    = "${path.cwd}/block-relay"
    dockerfile = "./Dockerfile"
    build_args = {
      BUILD_PATH = "./src/apps/webhook-load-balancer-consumer/main.go"
    }
  }
}

resource "docker_container" "webhook_lb_consumer" {
  count   = var.replicas
  name    = "webhook-lb-consumer-replica-${count.index}"
  image   = docker_image.webhook_lb_consumer.name
  restart = "always"
  env = [
    "WEBHOOK_LB_CONSUMER_MYSQL_URL=${var.mysql_url}",
    "WEBHOOK_LB_CONSUMER_REDIS_URL=${docker_container.webhook_lb_redis.name}:${docker_container.webhook_lb_redis.ports[0].internal}",
    "WEBHOOK_LB_CONSUMER_MYSQL_CONN_POOL_SIZE=10",
    "WEBHOOK_LB_CONSUMER_POOL_SIZE=3",
    "WEBHOOK_LB_CONSUMER_BLOCK_TIMEOUT_MS=60000",
    "WEBHOOK_LB_CONSUMER_NAME=webhook-lb-consumer-replica-${count.index}",
    "WEBHOOK_LB_CONSUMER_LOCK_RETRY_ATTEMPTS=3",
    "WEBHOOK_LB_CONSUMER_LOCK_EXP_BACKOFF_INIT_MS=1000",
    "WEBHOOK_LB_CONSUMER_LOCK_EXP_BACKOFF_MAX_RAND_MS=1000"
  ]
  networks_advanced {
    name = var.network_name
  }
}

