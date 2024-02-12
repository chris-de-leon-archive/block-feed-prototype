test:
	@sqlc generate
	@go test ./tests/e2e... -v

test-perf:
	@sqlc generate
	@go test ./tests/e2e/block_relay_performance_test.go -v

test-simple:
	@sqlc generate
	@go test ./tests/e2e/block_relay_simple_test.go -v

# make docker-push-all-images TAG=<...>
docker-push-all-images:
	@bash ./scripts/docker-push-all-images.sh $(TAG)

# make docker-delete-all-repos
docker-delete-all-repos:
	@bash ./scripts/docker-delete-all-repos.sh

