set -e

# Default values for options
concurrency="4"
image_tag=""
username=""

# Flags to check if -t and -u flags are provided
is_flag_t_present=0
is_flag_u_present=0

# Parse command-line options
while getopts ":t:c:u:" opt; do
  case $opt in
  t)
    is_flag_t_present=1
    image_tag="$OPTARG"
    ;;
  c)
    concurrency="$OPTARG"
    ;;
  u)
    is_flag_u_present=1
    username="$OPTARG"
    ;;
  \?)
    echo "Invalid option: -$OPTARG" >&2
    exit 1
    ;;
  :)
    echo "Option -$OPTARG requires an argument." >&2
    exit 1
    ;;
  esac
done

# Check if -t flag was provided
if [ $is_flag_t_present -eq 0 ]; then
  echo "error: -t (image tag) flag is required"
  exit 1
fi

# Check if -u flag was provided
if [ $is_flag_u_present -eq 0 ]; then
  echo "error: -u (username) flag is required"
  exit 1
fi

# Shift the options so that $1 now refers to the first non-option argument (if any)
shift "$((OPTIND - 1))"

# Define an array of Docker build args
docker_build_args=(
  "-t $username/block-feed-block-gateway-fetcher-flow:$image_tag --build-arg PROJECT_NAME=block-gateway/fetcher/flow"
  "-t $username/block-feed-block-gateway-consumer:$image_tag --build-arg PROJECT_NAME=block-gateway/consumer"
  "-t $username/block-feed-block-gateway-divider:$image_tag --build-arg PROJECT_NAME=block-gateway/divider"
  "-t $username/block-feed-block-gateway-logger:$image_tag --build-arg PROJECT_NAME=block-gateway/logger"
)

# Use xargs to run docker build in parallel
printf "%s\n" "${docker_build_args[@]}" | xargs -P $concurrency -I {} sh -c 'docker build -f block-gateway-service.Dockerfile $1 .' _ {}

# Define an array of Docker image names
image_names=(
  "$username/block-feed-block-gateway-fetcher-flow:$image_tag"
  "$username/block-feed-block-gateway-consumer:$image_tag"
  "$username/block-feed-block-gateway-divider:$image_tag"
  "$username/block-feed-block-gateway-logger:$image_tag"
)

# Use xargs to run docker push in parallel
printf "%s\n" "${image_names[@]}" | xargs -P $concurrency -I {} docker push {}
