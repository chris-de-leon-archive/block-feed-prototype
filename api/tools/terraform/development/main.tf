terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
  }
}

provider "docker" {}

resource "docker_network" "block_feed_net" {
  name = "block_feed_net"
}

resource "docker_image" "postgres" {
  name = "postgres:15.4-alpine3.18"  
  keep_locally = false
}

resource "docker_container" "postgres" {
  image = docker_image.postgres.image_id
  name  = "postgres"
  command = ["postgres", "-c", "log_statement=all"]
  networks_advanced {
    name = docker_network.block_feed_net.name
  }
  ports {
    internal = 5432
    external = 5432
  }
  env = [
    "POSTGRES_PASSWORD=password",
    "POSTGRES_USER=rootuser",
    "POSTGRES_DB=dev",
  ]
}

resource "docker_image" "pgadmin" {
  name = "dpage/pgadmin4:7.5"
  keep_locally = false
}

resource "docker_container" "pgadmin" {
  image = docker_image.pgadmin.image_id
  name  = "pgadmin"
  networks_advanced {
    name = docker_network.block_feed_net.name
  }
  ports {
    internal = 5050
    external = 5050
  }
  env = [
    "PGADMIN_DEFAULT_EMAIL=rootuser@mail.com",
    "PGADMIN_DEFAULT_PASSWORD=password",
    "PGADMIN_LISTEN_PORT=5050"
  ]
}

resource "docker_image" "flow_emulator" {
  name = "flow-emulator"  
  keep_locally = false
  build {
    context = "./docker/blockchains/flow"
  }
}

resource "docker_container" "flow_emulator" {
  image = docker_image.flow_emulator.image_id
  name  = "flow-emulator"
  networks_advanced {
    name = docker_network.block_feed_net.name
  }
  ports {
    internal = 8888
    external = 8888
  }
}

resource "docker_image" "rabbitmq" {
  name = "rabbitmq:3.12.4-alpine"  
  keep_locally = false
}

resource "docker_container" "rabbitmq" {
  image = docker_image.rabbitmq.image_id
  name  = "rabbitmq"
  networks_advanced {
    name = docker_network.block_feed_net.name
  }
  ports {
    internal = 5672
    external = 5672
  }
}
