set -e

# Specify terraform root directory
tfdir="./tools/apps/block-gateway/deployment"

# Define an array of required options and their associated variable names
declare -A required_options=(
  ["--environment"]="ENVIRONMENT"
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

# Define variables for terraform
tfvars="$tfdir/.auto.tfvars"
[ -f "$tfvars" ] && rm "$tfvars"
for flag in "${!required_options[@]}"; do
  env_var_name="${required_options[$flag]}"
  env_var_val="${!env_var_name}"
  if [ -z "$env_var_val" ]; then
    echo "error: $flag is required"
    exit 1
  fi
  echo "$env_var_name=\"$env_var_val\"" >>"$tfvars"
done

# Handle unnecessary input variables
echo "IMAGE_TAG=\"NOT NEEDED FOR DESTROY\"" >>"$tfvars"

# Run terraform
terraform -chdir="$tfdir" fmt
terraform -chdir="$tfdir" init -migrate-state
terraform -chdir="$tfdir" destroy -auto-approve
