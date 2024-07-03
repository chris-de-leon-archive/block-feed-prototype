output "mysql_workers_url" {
  value = "workers_user:password@tcp(${docker_container.mysql.name}:${docker_container.mysql.ports[0].internal})/${local.mysql_db_name}?parseTime=true"
}

output "mysql_api_url" {
  value = "mysql://api_user:password@${docker_container.mysql.name}:${docker_container.mysql.ports[0].internal}/${local.mysql_db_name}"
}
