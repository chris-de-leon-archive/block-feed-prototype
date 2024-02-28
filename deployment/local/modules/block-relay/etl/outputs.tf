output "redis_url" {
  value = "${docker_container.block_poller_redis.name}:${docker_container.block_poller_redis.ports[0].internal}"
}
