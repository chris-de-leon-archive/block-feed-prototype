set -e

. ./tools/utils/tools.sh
cd ./tools/terraform/development
terraform init
terraform apply
