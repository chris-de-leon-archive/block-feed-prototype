# TODO:

provider "aws" {
  region = "us-west-2"
}

resource "aws_instance" "example" {
  ami           = "ami-0a63f963df4139a95" # Amazon Linux 2 AMI ID
  instance_type = "t2.micro"
}

provisioner "remote-exec" {
  inline = [
    "sudo yum update -y",
    "sudo yum install -y docker docker-compose",
    "sudo service docker start",
    "sudo usermod -a -G docker ec2-user",
  ]
}

provisioner "file" {
  source      = "./compose.yml"
  destination = "/home/ec2-user/compose.yml"
}

provisioner "remote-exec" {
  inline = [
    "docker compose -f /home/ec2-user/compose.yml up -d",
    "docker volume prune -f",
    "docker image prune -f",
  ]
  environment = {
    MY_ENV_VARIABLE = "my_dynamic_value", # Set your desired value here
  }
  depends_on = [aws_instance.example]
}
