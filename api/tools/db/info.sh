set -e

. ./tools/db/utils.sh

# Define an array of required options and their associated variable names
declare -A required_options=(
  ["--environment"]="environment"
)

# Parse command-line options
while [ $# -gt 0 ]; do
  env_var_name="${required_options[$1]}"
  if [ -z "$env_var_name" ]; then
    echo "unknown option: $1"
    exit 1
  fi

  eval "$env_var_name=\"$2\""
  shift 2
done

# Checks that required flags were provided
for flag in "${!required_options[@]}"; do
  env_var_name="${required_options[$flag]}"
  env_var_val="${!env_var_name}"
  if [ -z "$env_var_val" ]; then
    echo "error: $flag is required"
    exit 1
  fi
done

echo "DB endpoint: $(get_db_endpoint $environment)"
echo "EC2 login: $(get_ec2_login $environment)"
