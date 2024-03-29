output "timescaledb_url" {
  value = "postgres://blockstore:password@${docker_container.timescaledb.name}:${docker_container.timescaledb.ports[0].internal}/${var.timescaledb_db_name}?sslmode=disable&search_path=block_feed"
}

output "mysql_backend_url" {
  value = "backend_user:password@tcp(${docker_container.mysql.name}:${docker_container.mysql.ports[0].internal})/${var.mysql_db_name}?parseTime=true"
}
