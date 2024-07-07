#!/bin/bash

# Defines helper variables
MAX_RETRIES=10
CUR_RETRIES=0

# Pings mongo until it comes online
printf "\nWaiting for mongo server to come online...\n"
while [ $CUR_RETRIES -lt $MAX_RETRIES ]; do
	mongosh 'mongodb://localhost:27017' --eval "db.runCommand('ping').ok" --quiet --json relaxed
	if [ $? -eq 0 ]; then
		break
	else
		((CUR_RETRIES++))
		sleep 0.1
	fi
done

# Ensures the rest of this script exits on any error
set -e

# Exits if mongo never came online
if [ $CUR_RETRIES -ge $MAX_RETRIES ]; then
	exit 1
fi

# Allows passing the host port as an argument instead of an env variable
DB_HOST_PORT="$1"
if [ -z "$DB_HOST_PORT" ]; then
	DB_HOST_PORT=${MONGO_DB_HOST_PORT:='27017'}
fi

# Gets configurations from environment or uses default values
READWRITE_UNAME=${MONGO_READWRITE_UNAME:='readwrite'}
READWRITE_PWORD=${MONGO_READWRITE_PWORD:='password'}
READONLY_UNAME=${MONGO_READONLY_UNAME:='readonly'}
READONLY_PWORD=${MONGO_READONLY_PWORD:='password'}
ROOT_UNAME=${MONGO_ROOT_UNAME:='rootuser'}
ROOT_PWORD=${MONGO_ROOT_PWORD:='password'}
REPLICA_SET_NAME=${MONGO_REPLICA_SET_NAME:='rs0'}
DB=${MONGO_DB:='dev'}

# Initializes a single-node replica set
printf "\nInitializing a single-node replica set...\n"
mongosh 'mongodb://localhost:27017/admin' \
	--eval "rs.initiate({ _id: '$REPLICA_SET_NAME', members: [{ _id: 0, host: 'host.docker.internal:$DB_HOST_PORT' }] })" \
	--quiet \
	--json relaxed

# Creates a root user for management purposes
printf "\nCreating a root user...\n"
mongosh 'mongodb://localhost:27017/admin?directConnection=true' \
	--eval "db.createUser({ user: '$ROOT_UNAME', pwd: '$ROOT_PWORD', roles: [{ role:'root', db:'admin' }] })" \
	--quiet \
	--json relaxed

# Creates a readonly user
printf "\nCreating a readonly user...\n"
mongosh "mongodb://$ROOT_UNAME:$ROOT_PWORD@localhost:27017/admin?directConnection=true" \
	--eval "db.createUser({ user: '$READONLY_UNAME', pwd: '$READONLY_PWORD', roles: [{ role:'read', db:'$DB' }] })" \
	--quiet \
	--json relaxed

# Creates a readwrite user
printf "\nCreating a readwrite user...\n"
mongosh "mongodb://$ROOT_UNAME:$ROOT_PWORD@localhost:27017/admin?directConnection=true" \
	--eval "db.createUser({ user: '$READWRITE_UNAME', pwd: '$READWRITE_PWORD', roles: [{ role:'readWrite', db:'$DB' }] })" \
	--quiet \
	--json relaxed
