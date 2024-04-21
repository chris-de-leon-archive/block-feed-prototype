output "redis_url" {
  value = "${docker_container.redis_event_bus.name}:${docker_container.redis_event_bus.ports[0].internal}"
}
