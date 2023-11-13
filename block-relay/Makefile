# Flow HTTP vars
FLOW_HTTP_RELAYER_ENTRYPOINT="./src/apps/flow/http/main.go"
FLOW_HTTP_RELAYER_IMAGE_NAME="block-relayer-flow-http"

# Flow SMTP vars
FLOW_SMTP_RELAYER_ENTRYPOINT="./src/apps/flow/smtp/main.go"
FLOW_SMTP_RELAYER_IMAGE_NAME="block-relayer-flow-smtp"

# ETH HTTP vars
ETH_HTTP_RELAYER_ENTRYPOINT="./src/apps/eth/http/main.go"
ETH_HTTP_RELAYER_IMAGE_NAME="block-relayer-eth-http"

# ETH SMTP vars
ETH_SMTP_RELAYER_ENTRYPOINT="./src/apps/eth/smtp/main.go"
ETH_SMTP_RELAYER_IMAGE_NAME="block-relayer-eth-smtp"

# AWS env vars
AWS_SECRET_ACCESS_KEY="does-not-matter"
AWS_ACCESS_KEY_ID="does-not-matter"
AWS_URL="http://localhost:4566"
AWS_REGION="us-west-2"

# Redis env vars
REDIS_URL="host.docker.internal:6379"

# https://developers.flow.com/tools/clients/fcl-js/sdk-guidelines#connect
FLOW_TESTNET_URL="access.devnet.nodes.onflow.org:9000"
FLOW_POLL_MS=3000

# https://chainlist.org/chain/11155111
ETH_TESTNET_URL="https://ethereum-sepolia.blockpi.network/v1/rpc/public"
ETH_POLL_MS=10000

# Relayer SMTP env vars
RELAYER_SMTP_RECEIVER_EMAIL="test@gmail.com"
RELAYER_SMTP_SENDER_EMAIL="test@gmail.com"
RELAYER_SMTP_RETRY_DELAY_MS=5000
RELAYER_SMTP_MAX_RETRIES=3

# Relayer HTTP env vars
RELAYER_HTTP_URL="http://localhost:3000/webhook"
RELAYER_HTTP_RETRY_DELAY_MS=3000
RELAYER_HTTP_MAX_RETRIES=3

# Helpers

build-local:
	@docker build --build-arg BUILD_PATH=$(BUILD_PATH) -t $(TAG) .

build-and-push:
	@docker build --build-arg BUILD_PATH=$(BUILD_PATH) -t $(DOCKERHUB_USERNAME)/$(TAG) .
	@docker push $(DOCKERHUB_USERNAME)/$(TAG)

verify-email:
	@aws --endpoint-url=$(AWS_URL) ses verify-email-identity --email=$(RELAYER_SMTP_SENDER_EMAIL)
	@aws --endpoint-url=$(AWS_URL) ses list-identities

run-tests:
	@go test ./tests... -v

# ETH HTTP

# make build-and-push-eth-http-relayer TAG=<...>
build-and-push-eth-http-relayer:
	@make build-and-push \
		DOCKERHUB_UNAME=$(DOCKERHUB_USERNAME) \
		BUILD_PATH=$(ETH_HTTP_RELAYER_ENTRYPOINT) \
		TAG=$(ETH_HTTP_RELAYER_IMAGE_NAME):$(TAG)

# make build-eth-http-relayer TAG=<...>
build-eth-http-relayer:
	@make build-local \
		BUILD_PATH=$(ETH_HTTP_RELAYER_ENTRYPOINT) \
		TAG=$(ETH_HTTP_RELAYER_IMAGE_NAME):$(TAG)

# make run-eth-http
run-eth-http:
	@RELAYER_REDIS_CONNECTION_URL=$(REDIS_URL) \
	RELAYER_NETWORK_URL=$(ETH_TESTNET_URL) \
	RELAYER_HTTP_URL=$(RELAYER_HTTP_URL) \
	RELAYER_HTTP_RETRY_DELAY_MS=$(RELAYER_HTTP_RETRY_DELAY_MS) \
	RELAYER_HTTP_MAX_RETRIES=$(RELAYER_HTTP_MAX_RETRIES) \
	RELAYER_POLL_MS=$(ETH_POLL_MS) \
	go run $(ETH_HTTP_RELAYER_ENTRYPOINT)

# ETH SMTP

# make build-and-push-eth-smtp-relayer TAG=<...>
build-and-push-eth-smtp-relayer:
	@make build-and-push \
		DOCKERHUB_UNAME=$(DOCKERHUB_USERNAME) \
		BUILD_PATH=$(ETH_SMTP_RELAYER_ENTRYPOINT) \
		TAG=$(ETH_SMTP_RELAYER_IMAGE_NAME):$(TAG)

# make build-eth-smtp-relayer TAG=<...>
build-eth-smtp-relayer:
	@make build-local \
		BUILD_PATH=$(ETH_SMTP_RELAYER_ENTRYPOINT) \
		TAG=$(ETH_SMTP_RELAYER_IMAGE_NAME):$(TAG)

# make run-eth-smtp
run-eth-smtp:
	@make verify-email
	@RELAYER_REDIS_CONNECTION_URL=$(REDIS_URL) \
	RELAYER_NETWORK_URL=$(ETH_TESTNET_URL) \
	RELAYER_POLL_MS=$(ETH_POLL_MS) \
	RELAYER_SMTP_RECEIVER_EMAIL=$(RELAYER_SMTP_RECEIVER_EMAIL) \
	RELAYER_SMTP_SENDER_EMAIL=$(RELAYER_SMTP_SENDER_EMAIL) \
	RELAYER_SMTP_RETRY_DELAY_MS=$(RELAYER_SMTP_RETRY_DELAY_MS) \
	RELAYER_SMTP_MAX_RETRIES=$(RELAYER_SMTP_MAX_RETRIES) \
	AWS_SECRET_ACCESS_KEY=$(AWS_SECRET_ACCESS_KEY) \
	AWS_ACCESS_KEY_ID=$(AWS_ACCESS_KEY_ID) \
	AWS_REGION=$(AWS_REGION) \
	AWS_URL=$(AWS_URL) \
	go run $(ETH_SMTP_RELAYER_ENTRYPOINT)

# FLOW HTTP

# make build-and-push-flow-http-relayer TAG=<...>
build-and-push-flow-http-relayer:
	@make build-and-push \
		DOCKERHUB_UNAME=$(DOCKERHUB_USERNAME) \
		BUILD_PATH=$(FLOW_HTTP_RELAYER_ENTRYPOINT) \
		TAG=$(FLOW_HTTP_RELAYER_IMAGE_NAME):$(TAG)

# make build-flow-http-relayer TAG=<...>
build-flow-http-relayer:
	@make build-local \
		BUILD_PATH=$(FLOW_HTTP_RELAYER_ENTRYPOINT) \
		TAG=$(FLOW_HTTP_RELAYER_IMAGE_NAME):$(TAG)

# make run-flow-http
run-flow-http:
	@RELAYER_REDIS_CONNECTION_URL=$(REDIS_URL) \
	RELAYER_NETWORK_URL=$(FLOW_TESTNET_URL) \
	RELAYER_HTTP_URL=$(RELAYER_HTTP_URL) \
	RELAYER_HTTP_RETRY_DELAY_MS=$(RELAYER_HTTP_RETRY_DELAY_MS) \
	RELAYER_HTTP_MAX_RETRIES=$(RELAYER_HTTP_MAX_RETRIES) \
	RELAYER_POLL_MS=$(FLOW_POLL_MS) \
	go run $(FLOW_HTTP_RELAYER_ENTRYPOINT)

# FLOW SMTP

# make build-and-push-flow-smtp-relayer TAG=<...>
build-and-push-flow-smtp-relayer:
	@make build-and-push \
		DOCKERHUB_UNAME=$(DOCKERHUB_USERNAME) \
		BUILD_PATH=$(FLOW_SMTP_RELAYER_ENTRYPOINT) \
		TAG=$(FLOW_SMTP_RELAYER_IMAGE_NAME):$(TAG)

# make build-flow-smtp-relayer TAG=<...>
build-flow-smtp-relayer:
	@make build-local \
		BUILD_PATH=$(FLOW_SMTP_RELAYER_ENTRYPOINT) \
		TAG=$(FLOW_SMTP_RELAYER_IMAGE_NAME):$(TAG)

# make run-flow-smtp
run-flow-smtp:
	@make verify-email
	@RELAYER_REDIS_CONNECTION_URL=$(REDIS_URL) \
	RELAYER_NETWORK_URL=$(FLOW_TESTNET_URL) \
	RELAYER_POLL_MS=$(FLOW_POLL_MS) \
	RELAYER_SMTP_RECEIVER_EMAIL=$(RELAYER_SMTP_RECEIVER_EMAIL) \
	RELAYER_SMTP_SENDER_EMAIL=$(RELAYER_SMTP_SENDER_EMAIL) \
	RELAYER_SMTP_RETRY_DELAY_MS=$(RELAYER_SMTP_RETRY_DELAY_MS) \
	RELAYER_SMTP_MAX_RETRIES=$(RELAYER_SMTP_MAX_RETRIES) \
	AWS_SECRET_ACCESS_KEY=$(AWS_SECRET_ACCESS_KEY) \
	AWS_ACCESS_KEY_ID=$(AWS_ACCESS_KEY_ID) \
	AWS_REGION=$(AWS_REGION) \
	AWS_URL=$(AWS_URL) \
	go run $(FLOW_SMTP_RELAYER_ENTRYPOINT)
