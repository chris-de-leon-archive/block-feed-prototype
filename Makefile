BLOCK_RELAY_COMPOSE_FILE_NAME="block-relay.compose.yml"
BLOCK_RELAY_K8S_FILE_NAME="block-relay.deployment.yaml"
BLOCK_RELAY_CLUSTER_NAME="block-relay"

kompose-block-relay:
	-rm $(BLOCK_RELAY_K8S_FILE_NAME)
	@kompose convert -f $(BLOCK_RELAY_COMPOSE_FILE_NAME) --out $(BLOCK_RELAY_K8S_FILE_NAME)

create-block-relay-cluster:
	@-k3d cluster delete $(BLOCK_RELAY_CLUSTER_NAME)
	@k3d cluster create $(BLOCK_RELAY_CLUSTER_NAME)
	@docker compose -f $(BLOCK_RELAY_COMPOSE_FILE_NAME) build
	@docker pull docker.io/redis:7.2.1-alpine3.18
	@docker pull docker.io/rabbitmq:3.12.12-alpine 
	@k3d image import \
		redis:7.2.1-alpine3.18 \
		rabbitmq:3.12.12-alpine \
		block-producer-flow-testnet:1 \
		block-splitter:1 \
		block-consumer:1 \
		-c $(BLOCK_RELAY_CLUSTER_NAME)
	@kubectl apply -f $(BLOCK_RELAY_K8S_FILE_NAME)
	@kubectl get pods

delete-block-relay-cluster:
	@k3d cluster delete $(BLOCK_RELAY_CLUSTER_NAME)
