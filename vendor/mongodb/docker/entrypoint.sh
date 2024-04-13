#!/bin/bash

# Makes sure a replica set name is specified
if [ -z "$MONGO_REPLICA_SET_NAME" ]; then
	export MONGO_REPLICA_SET_NAME='rs0'
fi

# Defines helper variables
MONGO_KEY_FILE_PATH=/mongodb.key
MONGO_PORT="27017"

# @source:
#
#   https://docs.docker.com/config/containers/multi-service_container/#use-bash-job-controls
#
if [ "$MONGO_AUTO_INIT" == "true" ]; then
	# Turns on bash's job control
	set -m

	# Starts the primary process and put it in the background
	mongod \
		--replSet $MONGO_REPLICA_SET_NAME \
		--keyFile $MONGO_KEY_FILE_PATH \
		--port $MONGO_PORT \
		--bind_ip_all \
		--auth \
		"$@" &

	# Sets up mongodb automatically
	bash /docker/setup.sh

	# Brings the primary process back into the foreground and leaves it there
	fg %1
else
	mongod \
		--replSet $MONGO_REPLICA_SET_NAME \
		--keyFile $MONGO_KEY_FILE_PATH \
		--port $MONGO_PORT \
		--bind_ip_all \
		--auth \
		"$@"
fi
