. ./tools/utils/tools.sh
. ./tools/utils/utils.sh

# $1 = a valid JSON string that's only one layer deep
# $2 = a key in the JSON string
parse_value() {
  set -e
  echo $(sed -r 's/.*\"'$2'\"\:\"([^,;]+)\".*/\1/' <<<$1)
}

# $1 = 'stag' or 'prod'
get_db_endpoint() {
  set -e
  local prj="$(get_project_name)"
  local env="$1"
  local res=$(
    aws rds describe-db-instances \
      --query "DBInstances[?TagList[?Key=='project' && Value=='$prj'] && TagList[?Key=='environment' && Value=='$env']].[Endpoint.Address, Endpoint.Port]" \
      --output text |
      node -e 'process.stdin.on("data", data => {
        console.log(
          data
            .toString()
            .split(" ")
            .filter((t) => t.length !== 0)
            .join(":")
        );
      });'
  )
  echo "$(clean_str $res)"
}

# $1 = 'stag' or 'prod'
get_ec2_login() {
  set -e
  local prj="$(get_project_name)"
  local env="$1"
  local res=$(
    aws ec2 describe-instances \
      --filters "Name=tag:project,Values=$prj" "Name=tag:environment,Values=$env" \
      --query "Reservations[].Instances[].PublicIpAddress" \
      --output text
  )
  echo "ec2-user@$(clean_str $res)"
}

# https://stackoverflow.com/questions/2241063/bash-script-to-set-up-a-temporary-ssh-tunnel
# $1 = 'stag' or 'prod'
# $2 = localhost tunnel port (e.g. 5430)
create_temp_db_tunnel() {
  set -e
  local rdshost="$(get_db_endpoint $1)"
  local gateway="$(get_ec2_login $1)"
  local lclhost="localhost:$2"

  trap "ssh -S ctrl-socket -O exit $gateway" EXIT
  ssh -fNTM -S ctrl-socket -L "$lclhost:$rdshost" "$gateway" -o ExitOnForwardFailure=True
  ssh -S ctrl-socket -O check "$gateway"
}

# $1 = 'stag' or 'prod'
# $2 = localhost tunnel port (e.g. 5430)
create_tunnel() {
  set -e
  local rdshost="$(get_db_endpoint $1)"
  local gateway="$(get_ec2_login $1)"
  local lclhost="localhost:$2"

  ssh -v \
    -N "$gateway" \
    -L "$lclhost:$rdshost" \
    -o ExitOnForwardFailure=True
}
