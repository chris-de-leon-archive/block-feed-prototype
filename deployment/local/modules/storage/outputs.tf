output "mongo_readwrite_url" {
  value = "mongodb://readwrite:password@${docker_container.mongodb.name}:${docker_container.mongodb.ports[0].internal}/?compressors=zlib&replicaSet=rs0"
}

output "mongo_readonly_url" {
  value = "mongodb://readonly:password@${docker_container.mongodb.name}:${docker_container.mongodb.ports[0].internal}/?compressors=zlib&replicaSet=rs0"
}

output "mysql_backend_url" {
  value = "backend_user:password@tcp(${docker_container.mysql.name}:${docker_container.mysql.ports[0].internal})/${var.mysql_db_name}?parseTime=true"
}
