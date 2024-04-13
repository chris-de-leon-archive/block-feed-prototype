terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

resource "docker_image" "timescaledb_dev" {
  name = "timescaledb-dev:${var.tag}"
  build {
    context    = "${path.cwd}/vendor/timescaledb"
    dockerfile = "./Dockerfile"
    build_args = {
      PG_VERSION = var.timescaledb_version
    }
  }
}

resource "docker_container" "timescaledb" {
  name  = "timescaledb"
  image = docker_image.timescaledb_dev.name
  env = [
    "POSTGRES_PASSWORD=password",
    "POSTGRES_USER=rootuser",
    "POSTGRES_DB=${var.timescaledb_db_name}",
  ]
  ports {
    internal = 5432
    external = 5432
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
