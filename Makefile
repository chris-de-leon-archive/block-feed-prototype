BLOCK_RELAY_COMPOSE_FILE_NAME="block-relay.compose.yml"
BLOCK_RELAY_K8S_FILE_NAME="block-relay.deployment.yaml"
BLOCK_RELAY_CLUSTER_NAME="block-relay"
TAG="1.0.0"

kompose-block-relay:
	-rm $(BLOCK_RELAY_K8S_FILE_NAME)
	@TAG=$(TAG) kompose convert -f $(BLOCK_RELAY_COMPOSE_FILE_NAME) --out $(BLOCK_RELAY_K8S_FILE_NAME)

create-block-relay-cluster:
	@-k3d cluster delete $(BLOCK_RELAY_CLUSTER_NAME)
	@k3d cluster create $(BLOCK_RELAY_CLUSTER_NAME)
	@TAG=$(TAG) docker compose -f $(BLOCK_RELAY_COMPOSE_FILE_NAME) build
	@docker pull docker.io/redis:7.2.1-alpine3.18
	@k3d image import \
		redis:7.2.1-alpine3.18 \
		mongo-dev:1.0.0 \
		mysql-dev:1.0.0 \
		block-poller-flow-testnet:$(TAG) \
		caching-consumer:$(TAG) \
		webhook-consumer:$(TAG) \
		block-flusher:$(TAG) \
		-c $(BLOCK_RELAY_CLUSTER_NAME)
	@kubectl apply -f $(BLOCK_RELAY_K8S_FILE_NAME)
	@kubectl get pods

delete-block-relay-cluster:
	@k3d cluster delete $(BLOCK_RELAY_CLUSTER_NAME)

