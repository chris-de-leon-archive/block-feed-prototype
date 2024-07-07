terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

locals {
  redis_stripe_url    = "${docker_container.redis_stripe.name}:${docker_container.redis_stripe.ports[0].internal}"
  redis_api_cache_url = "${docker_container.redis_api_cache.name}:${docker_container.redis_api_cache.ports[0].internal}"
}

resource "docker_container" "redis_api_cache" {
  name    = "redis-api-cache"
  image   = var.redis_image
  command = ["--port", "6379", "--loglevel", "debug", "--maxmemory", "0", "--maxmemory-policy", "noeviction", "--appendonly", "yes"]
  ports {
    internal = 6379
    external = 6379
  }
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_container" "redis_stripe" {
  name    = "redis-stripe"
  image   = var.redis_image
  command = ["--port", "6379", "--loglevel", "debug", "--maxmemory", "0", "--maxmemory-policy", "noeviction", "--appendonly", "yes"]
  ports {
    internal = 6379
    external = 6380
  }
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_image" "stripe_webhook_event_consumer" {
  name         = "stripe-webhook-event-consumer:${var.tag}"
  keep_locally = true
  build {
    context    = path.cwd
    target     = "stripe-webhook-event-consumer"
    dockerfile = "./node.Dockerfile"
  }
}

resource "docker_container" "stripe_webhook_event_consumer" {
  count   = var.stripe_webhook_event_consumer_replicas
  name    = "stripe-webhook-event-consumer-${count.index}"
  restart = "always"
  image   = docker_image.stripe_webhook_event_consumer.name
  env = [
    "STRIPE_WEBHOOK_EVENT_CONSUMER_NAME=replica-${count.index}",
    "REDIS_STREAM_URL=${local.redis_stripe_url}",
    "REDIS_CACHE_URL=${local.redis_api_cache_url}",
  ]
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_image" "dashboard" {
  name         = "dashboard:${var.tag}"
  keep_locally = true
  build {
    context    = path.cwd
    target     = "dashboard"
    dockerfile = "./node.Dockerfile"
    build_args = {
      NEXT_PUBLIC_API_URL = "http://host.docker.internal:${var.dashboard_port}/api/graphql"
    }
  }
}

resource "docker_container" "dashboard" {
  name    = "dashboard"
  restart = "always"
  image   = docker_image.dashboard.name
  ports {
    internal = 3000
    external = var.dashboard_port
  }
  env = [
    "STRIPE_CHECKOUT_SUCCESS_URL=http://localhost:${var.dashboard_port}",
    "STRIPE_CHECKOUT_CANCEL_URL=http://localhost:${var.web_port}",
    "STRIPE_BILLING_PORTAL_RETURN_URL=http://localhost:${var.dashboard_port}",
    "REDIS_STREAM_URL=${local.redis_stripe_url}",
    "REDIS_CACHE_URL=${local.redis_api_cache_url}",
    "DB_URL=${var.mysql_api_url}",
  ]
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_image" "web" {
  name         = "web:${var.tag}"
  keep_locally = true
  build {
    context    = path.cwd
    target     = "web"
    dockerfile = "./node.Dockerfile"
  }
}

resource "docker_container" "web" {
  name    = "web"
  restart = "always"
  image   = docker_image.web.name
  ports {
    internal = 3000
    external = var.web_port
  }
  networks_advanced {
    name = var.network_name
  }
}
