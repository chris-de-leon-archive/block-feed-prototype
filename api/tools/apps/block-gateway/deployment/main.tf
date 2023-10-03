resource "aws_security_group" "block_gateway_server_sg" {
  name = "${var.PROJECT_NAME}-block-gateway-server-sg-${var.ENVIRONMENT}"
  ingress {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
    cidr_blocks = [
      "0.0.0.0/0",
    ]
  }
  egress {
    protocol  = "-1"
    from_port = 0
    to_port   = 0
    cidr_blocks = [
      "0.0.0.0/0",
    ]
  }
  tags = {
    "environment" = "${var.ENVIRONMENT}"
    "project"     = "${var.PROJECT_NAME}"
  }
}

resource "aws_key_pair" "block_gateway_key_pair" {
  key_name   = "${var.PROJECT_NAME}-block-gateway-key-pair-${var.ENVIRONMENT}"
  public_key = <<-EOT
    ${var.SSH_PUB_KEY}
  EOT
  tags = {
    "environment" = "${var.ENVIRONMENT}"
    "project"     = "${var.PROJECT_NAME}"
  }
}

resource "aws_instance" "block_gateway_server" {
  ami           = "ami-038937b3d6616035f"
  instance_type = "t2.micro"
  key_name      = aws_key_pair.block_gateway_key_pair.key_name

  vpc_security_group_ids = [
    aws_security_group.block_gateway_server_sg.id
  ]

  root_block_device {
    volume_type           = "gp2"
    volume_size           = 10
    delete_on_termination = true
    encrypted             = false
  }

  tags = {
    "environment" = "${var.ENVIRONMENT}"
    "project"     = "${var.PROJECT_NAME}"
  }

  provisioner "remote-exec" {
    connection {
      type        = "ssh"
      user        = "ec2-user"
      host        = aws_instance.block_gateway_server.public_ip
      private_key = <<-EOT
        ${var.SSH_PRV_KEY}
      EOT
    }

    inline = [
      join(" && ", [
        # Updates yum
        "sudo yum update -y",

        # Installs third party tools
        format("sudo amazon-linux-extras install -y %s", join(" ", [
          "postgresql14",
          "docker",
          "redis6"
        ])),

        # Sets up docker: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-docker.html
        "sudo service docker start",
        "sudo usermod -a -G docker ec2-user",

        # Sets up docker compose: https://docs.docker.com/compose/install/linux/#install-the-plugin-manually
        "if [ -z $DOCKER_CONFIG ]; then DOCKER_CONFIG=$HOME/.docker; fi",
        "sudo mkdir -p $DOCKER_CONFIG/cli-plugins",
        "sudo curl -SL https://github.com/docker/compose/releases/download/v2.20.3/docker-compose-linux-x86_64 -o $DOCKER_CONFIG/cli-plugins/docker-compose",
        "sudo chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose",
      ])
    ]
  }
}

resource "aws_security_group" "block_feed_db_sg" {
  name = "${var.PROJECT_NAME}-db-sg-${var.ENVIRONMENT}"
  ingress {
    protocol  = "tcp"
    from_port = 5432
    to_port   = 5432
    security_groups = [
      aws_security_group.block_gateway_server_sg.id
    ]
  }
  tags = {
    "environment" = "${var.ENVIRONMENT}"
    "project"     = "${var.PROJECT_NAME}"
  }
}

resource "aws_db_instance" "block_feed_db" {
  identifier                   = "${var.PROJECT_NAME}-db-${var.ENVIRONMENT}"
  ca_cert_identifier           = "rds-ca-rsa2048-g1"
  engine                       = "postgres"
  engine_version               = "15.4"
  instance_class               = "db.t4g.micro"
  parameter_group_name         = "default.postgres15"
  storage_type                 = "gp2"
  db_name                      = var.RDS_DB_NAME
  username                     = var.RDS_ROOT_UNAME
  password                     = var.RDS_ROOT_PWORD
  port                         = 5432
  max_allocated_storage        = 20
  allocated_storage            = 5
  backup_retention_period      = 0
  monitoring_interval          = 0
  allow_major_version_upgrade  = false
  copy_tags_to_snapshot        = false
  deletion_protection          = false
  performance_insights_enabled = false
  multi_az                     = false
  publicly_accessible          = false
  storage_encrypted            = false
  apply_immediately            = true
  auto_minor_version_upgrade   = true
  delete_automated_backups     = true
  skip_final_snapshot          = true
  vpc_security_group_ids = [
    aws_security_group.block_feed_db_sg.id
  ]
  tags = {
    "environment" = "${var.ENVIRONMENT}"
    "project"     = "${var.PROJECT_NAME}"
  }
}

resource "aws_security_group" "block_gateway_queue_sg" {
  name = "${var.PROJECT_NAME}-block-gateway-queue-sg-${var.ENVIRONMENT}"
  ingress {
    protocol  = "tcp"
    from_port = 6379
    to_port   = 6379
    security_groups = [
      aws_security_group.block_gateway_server_sg.id
    ]
  }
  tags = {
    "environment" = "${var.ENVIRONMENT}"
    "project"     = "${var.PROJECT_NAME}"
  }
}


resource "aws_elasticache_parameter_group" "block_gateway_queue_pg" {
  name   = "${var.PROJECT_NAME}-bullmq-redis7-${var.ENVIRONMENT}"
  family = "redis7"
  parameter {
    name  = "maxmemory-policy"
    value = "noeviction"
  }
  tags = {
    "environment" = "${var.ENVIRONMENT}"
    "project"     = "${var.PROJECT_NAME}"
  }
}

resource "aws_elasticache_replication_group" "block_gateway_queue" {
  replication_group_id       = "${var.PROJECT_NAME}-block-gateway-queue-${var.ENVIRONMENT}"
  parameter_group_name       = aws_elasticache_parameter_group.block_gateway_queue_pg.name
  description                = "Managed by terraform"
  maintenance_window         = "fri:10:00-fri:11:00"
  auto_minor_version_upgrade = "true"
  engine                     = "redis"
  engine_version             = "7.0"
  node_type                  = "cache.t3.micro"
  port                       = 6379
  replicas_per_node_group    = 0
  snapshot_retention_limit   = 0
  automatic_failover_enabled = false
  multi_az_enabled           = false
  transit_encryption_enabled = false
  at_rest_encryption_enabled = false
  apply_immediately          = true
  security_group_ids = [
    aws_security_group.block_gateway_queue_sg.id
  ]
  tags = {
    "environment" = "${var.ENVIRONMENT}"
    "project"     = "${var.PROJECT_NAME}"
  }
}

resource "null_resource" "create_services" {
  triggers = {
    "always_run" = timestamp()
  }

  connection {
    type        = "ssh"
    user        = "ec2-user"
    host        = aws_instance.block_gateway_server.public_ip
    private_key = <<-EOT
      ${var.SSH_PRV_KEY}
    EOT
  }

  provisioner "file" {
    source      = "./compose.yml"
    destination = "/home/ec2-user/compose.yml"
  }

  provisioner "remote-exec" {
    inline = [
      "echo \"${var.DOCKERHUB_PASSWORD}\" | docker login --username \"${var.DOCKERHUB_USERNAME}\" --password-stdin",
      join(" && ", [
        join(" ", [
          "DB_URL=\"postgres://${var.RDS_GTWY_UNAME}:${var.RDS_GTWY_PWORD}@${aws_db_instance.block_feed_db.endpoint}/${var.RDS_DB_NAME}\"",
          "REDIS_URL=\"redis://${aws_elasticache_replication_group.block_gateway_queue.primary_endpoint_address}:${aws_elasticache_replication_group.block_gateway_queue.port}\"",
          "AWS_SECRET_ACCESS_KEY=\"${var.AWS_SECRET_KEY}\"",
          "AWS_ACCESS_KEY_ID=\"${var.AWS_ACCESS_KEY}\"",
          "AWS_REGION=\"${var.AWS_REGION}\"",
          "IMAGE_TAG=\"${var.IMAGE_TAG}\"",
          "docker compose up -d"
        ]),
        "docker system prune -f -a --volumes"
      ]),
    ]
  }
}
