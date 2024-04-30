#!/bin/bash

cleanup() {
	cd /redis-cluster
	bash create-cluster stop
	bash create-cluster clean
	exit 0
}

trap cleanup SIGINT SIGTERM SIGKILL

# Define a custom port if one is passed in
if [[ "${START_PORT}" =~ ^[0-9]+$ && "${END_PORT}" =~ ^[0-9]+$ && "${END_PORT}" -ge "${START_PORT}" ]]; then
	NODES=$((END_PORT - START_PORT + 1))
	echo "export NODES=$NODES" >>/redis-cluster/config.sh
	echo "export PORT=$((START_PORT - 1))" >>/redis-cluster/config.sh
fi

# Define a custom cluster host if one is passed in
if [ -n "$CLUSTER_HOST" ]; then
	echo "export CLUSTER_HOST=$CLUSTER_HOST" >>/redis-cluster/config.sh
fi

# Setup the cluster
cd /redis-cluster &&
	bash create-cluster start &&
	bash create-cluster create -f

# We need to use exec here to make sure signals
# from the --init flag are passed down correctly:
#
#   https://hynek.me/articles/docker-signals/
#   https://stackoverflow.com/a/76477566
#
exec bash create-cluster tailall
