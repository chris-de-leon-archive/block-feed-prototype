variable "tag" {
  type = string
}

variable "network_name" {
  type = string
}

variable "redis_image" {
  type = string
}

variable "dashboard_port" {
  type = number
}

variable "web_port" {
  type = number
}

variable "mysql_api_url" {
  type = string
}

variable "stripe_webhook_event_consumer_replicas" {
  type    = number
  default = 1
}
