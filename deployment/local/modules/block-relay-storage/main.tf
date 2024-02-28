terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

resource "docker_image" "mongo_dev" {
  name = "mongo-dev:${var.tag}"
  build {
    context    = "${path.cwd}/vendor/mongodb"
    dockerfile = "./Dockerfile"
    build_args = {
      MONGO_VERSION = var.mongo_version
    }
  }
}

resource "docker_container" "mongodb" {
  name  = "mongodb"
  image = docker_image.mongo_dev.name
  env = [
    "MONGO_AUTO_INIT=true",
    "MONGO_DB=${var.mongo_db_name}"
  ]
  ports {
    internal = 27017
    external = 27017
  }
  networks_advanced {
    name = var.network_name
  }
}

resource "docker_image" "mysql_dev" {
  name = "mysql-dev:${var.tag}"
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
    "MYSQL_DATABASE=${var.mysql_db_name}",
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
