set -e

. ./tools/utils/tools.sh

awslocal logs filter-log-events --log-group-name /aws/lambda/block-feed-development-$1
