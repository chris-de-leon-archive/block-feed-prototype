terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

locals {
  mysql_db_name = "block_feed"
}

resource "docker_image" "mysql_dev" {
  name         = "mysql-dev:${var.tag}"
  keep_locally = true
  build {
    context    = "${path.cwd}/vendor/mysql"
    dockerfile = "./Dockerfile"
    build_args = {
      MYSQL_VERSION = var.mysql_version
    }
  }
}

resource "docker_container" "mysql" {
  name  = "mysql"
  image = docker_image.mysql_dev.name
  env = [
    "MYSQL_ROOT_PASSWORD=password",
    "MYSQL_DATABASE=${local.mysql_db_name}",
    "MYSQL_PASSWORD=password",
    "MYSQL_USER=rootuser"
  ]
  ports {
    internal = 3306
    external = 3306
  }
  networks_advanced {
    name = var.network_name
  }
}
