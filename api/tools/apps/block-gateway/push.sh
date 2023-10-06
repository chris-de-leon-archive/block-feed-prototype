set -e

# Set default concurrency for xargs
concurrency="4"

# Define an array of required options and their associated environment variable names
declare -A required_options=(
  ["--dockerhub-uname"]="dockerhub_uname"
  ["--dockerhub-pword"]="dockerhub_pword"
  ["--image-tag"]="image_tag"
)

# Parse command-line options
while [ $# -gt 0 ]; do
  var_name="${required_options[$1]}"
  if [ -z "$var_name" ]; then
    echo "unknown option: $1"
    exit 1
  fi

  eval "$var_name=\"$2\""
  shift 2
done

# Check for required options
for flag in "${!required_options[@]}"; do
  var_name="${required_options[$flag]}"
  var_val="${!var_name}"
  if [ -z "$var_val" ]; then
    echo "error: $flag is required"
    exit 1
  fi
done

# Defines an array of base images
# NOTE: since we're running multiple docker build commands in parallel, the same
# base images will be pulled multiple times. Adding this line prevents this from
# happening. If the dockerfile base image versions change, this should also be
# updated.
base_images=(
  "node:20.7.0-alpine3.17"
  "alpine:3.17"
)

# Use xargs to run docker pull in parallel
printf "%s\n" "${base_images[@]}" | xargs -P $concurrency -I {} docker pull {}

# Log into Dockerhub
echo "$dockerhub_pword" | docker login --username "$dockerhub_uname" --password-stdin

# Define an array of Docker build args
docker_build_args=(
  "-t $dockerhub_uname/block-feed-block-gateway-fetcher-flow:$image_tag --build-arg PROJECT_NAME=block-gateway/fetcher/flow"
  "-t $dockerhub_uname/block-feed-block-gateway-consumer:$image_tag --build-arg PROJECT_NAME=block-gateway/consumer"
  "-t $dockerhub_uname/block-feed-block-gateway-divider:$image_tag --build-arg PROJECT_NAME=block-gateway/divider"
  "-t $dockerhub_uname/block-feed-block-gateway-webhook:$image_tag --build-arg PROJECT_NAME=block-gateway/webhook"
  "-t $dockerhub_uname/block-feed-block-gateway-mailer:$image_tag --build-arg PROJECT_NAME=block-gateway/mailer"
  "-t $dockerhub_uname/block-feed-block-gateway-logger:$image_tag --build-arg PROJECT_NAME=block-gateway/logger"
)

# Use xargs to run docker build in parallel
printf "%s\n" "${docker_build_args[@]}" | xargs -P $concurrency -I {} sh -c 'docker build -f block-gateway-service.Dockerfile $1 .' _ {}

# Define an array of Docker image names
image_names=(
  "$dockerhub_uname/block-feed-block-gateway-fetcher-flow:$image_tag"
  "$dockerhub_uname/block-feed-block-gateway-consumer:$image_tag"
  "$dockerhub_uname/block-feed-block-gateway-divider:$image_tag"
  "$dockerhub_uname/block-feed-block-gateway-webhook:$image_tag"
  "$dockerhub_uname/block-feed-block-gateway-mailer:$image_tag"
  "$dockerhub_uname/block-feed-block-gateway-logger:$image_tag"
)

# Use xargs to run docker push in parallel
printf "%s\n" "${image_names[@]}" | xargs -P $concurrency -I {} docker push {}
