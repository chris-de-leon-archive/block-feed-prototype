# NOTE: host environment variables may not be
# copied into the container. Here's a trick you
# can use to copy host env variables with a
# certain prefix into the container:
#
# https://stackoverflow.com/a/40230624/22520608
#

terraform() {
  # https://hub.docker.com/r/hashicorp/terraform/tags
  docker run \
    --rm \
    -ti \
    --env-file <(env | grep TF_) \
    -v ~/.terraform.d:/root/.terraform.d \
    -v ~/.ssh:/root/.ssh \
    -v $(pwd):/workspace \
    -v /var/run/docker.sock:/var/run/docker.sock \
    --workdir /workspace \
    hashicorp/terraform:1.5 "$@"
}

openapi() {
  # https://hub.docker.com/r/openapitools/openapi-generator-cli/tags
  docker run \
    --rm \
    -ti \
    -v $(pwd):/workspace \
    openapitools/openapi-generator-cli:v6.6.0 generate "$@"
}

aws() {
  # https://hub.docker.com/r/amazon/aws-cli/tags
  docker run \
    --rm \
    -ti \
    -v ~/.aws:/root/.aws \
    -v $(pwd):/aws \
    --net=host \
    amazon/aws-cli:2.13.7 "$@"
}

awslocal() {
  # https://docs.localstack.cloud/user-guide/integrations/aws-cli/
  aws --endpoint-url="http://localhost:4566" "$@"
}
