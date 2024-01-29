#################
### Variables ###
#################

# Block Producer vars
BLOCK_PRODUCER_FLOW_ENTRYPOINT="./src/apps/producer/flow/main.go"
BLOCK_PRODUCER_ETH_ENTRYPOINT="./src/apps/producer/eth/main.go"
BLOCK_PRODUCER_FLOW_IMAGE_NAME="block-producer-flow"
BLOCK_PRODUCER_ETH_IMAGE_NAME="block-producer-eth"

# Block Splitter vars
BLOCK_SPLITTER_ENTRYPOINT="./src/apps/splitter/main.go"
BLOCK_SPLITTER_IMAGE_NAME="block-splitter-flow"

# Block Consumer vars
BLOCK_CONSUMER_ENTRYPOINT="./src/apps/consumer/main.go"
BLOCK_CONSUMER_IMAGE_NAME="block-consumer"

###############
### Helpers ###
###############

build-local:
	@docker build --build-arg BUILD_PATH=$(BUILD_PATH) -t $(TAG) .

build-and-push:
	@docker build --build-arg BUILD_PATH=$(BUILD_PATH) -t $(DOCKERHUB_USERNAME)/$(TAG) .
	@docker push $(DOCKERHUB_USERNAME)/$(TAG)

test:
	@sqlc generate
	@go test ./tests... -v

migrate: DB_URL := "postgres://rootuser:password@host.docker.internal:5432/dev?sslmode=disable"
migrate:
	@-docker stop pg-atlas
	@docker run --rm -d --name pg-atlas -p 5432:5432 -e POSTGRES_USER=rootuser -e POSTGRES_PASSWORD=password -e POSTGRES_DB=dev postgres:16.1-alpine3.18
	@sleep 3
	@atlas schema clean --url $(DB_URL) --auto-approve
	@docker exec -i pg-atlas psql $(DB_URL) --single-transaction -v ON_ERROR_STOP=1 -c "CREATE SCHEMA IF NOT EXISTS \"block_feed\";"
	@atlas migrate diff --dir "file://./sql/migrations" --to "file://./sql/schema.sql" --dev-url "$(DB_URL)&search_path=block_feed"
	@docker stop pg-atlas

###########################
### Flow Block Producer ###
###########################

# make build-and-push-block-producer-flow TAG=<...>
build-and-push-block-producer-flow:
	@make build-and-push \
		DOCKERHUB_UNAME=$(DOCKERHUB_USERNAME) \
		BUILD_PATH=$(BLOCK_PRODUCER_FLOW_ENTRYPOINT) \
		TAG=$(BLOCK_PRODUCER_FLOW_IMAGE_NAME):$(TAG)

# make build-block-producer-flow TAG=<...>
build-block-producer-flow:
	@make build-local \
		BUILD_PATH=$(BLOCK_PRODUCER_FLOW_ENTRYPOINT) \
		TAG=$(BLOCK_PRODUCER_FLOW_IMAGE_NAME):$(TAG)

###############################
### Ethereum Block Producer ###
###############################

# make build-and-push-block-producer-eth TAG=<...>
build-and-push-block-producer-eth:
	@make build-and-push \
		DOCKERHUB_UNAME=$(DOCKERHUB_USERNAME) \
		BUILD_PATH=$(BLOCK_PRODUCER_ETH_ENTRYPOINT) \
		TAG=$(BLOCK_PRODUCER_ETH_IMAGE_NAME):$(TAG)

# make build-block-producer-eth TAG=<...>
build-block-producer-eth:
	@make build-local \
		BUILD_PATH=$(BLOCK_PRODUCER_ETH_ENTRYPOINT) \
		TAG=$(BLOCK_PRODUCER_ETH_IMAGE_NAME):$(TAG)

######################
### Block Splitter ###
######################

# make build-and-push-block-splitter TAG=<...>
build-and-push-block-splitter:
	@make build-and-push \
		DOCKERHUB_UNAME=$(DOCKERHUB_USERNAME) \
		BUILD_PATH=$(BLOCK_SPLITTER_ENTRYPOINT) \
		TAG=$(BLOCK_SPLITTER_IMAGE_NAME):$(TAG)

# make build-block-splitter TAG=<...>
build-block-splitter:
	@make build-local \
		BUILD_PATH=$(BLOCK_SPLITTER_ENTRYPOINT) \
		TAG=$(BLOCK_SPLITTER_ENTRYPOINT):$(TAG)

######################
### Block Consumer ###
######################

# make build-and-push-block-consumer TAG=<...>
build-and-push-block-consumer:
	@make build-and-push \
		DOCKERHUB_UNAME=$(DOCKERHUB_USERNAME) \
		BUILD_PATH=$(BLOCK_CONSUMER_ENTRYPOINT) \
		TAG=$(BLOCK_CONSUMER_IMAGE_NAME):$(TAG)

# make build-block-consumer TAG=<...>
build-block-consumer:
	@make build-local \
		BUILD_PATH=$(BLOCK_CONSUMER_ENTRYPOINT) \
		TAG=$(BLOCK_CONSUMER_IMAGE_NAME):$(TAG)

