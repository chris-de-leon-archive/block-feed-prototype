test-all:
	@sqlc generate
	@go test ./tests/e2e... -v

test:
	@sqlc generate
	@go test ./tests/e2e/$(NAME)_test.go -v

# make docker-push-all-images TAG=<...>
docker-push-all-images:
	@bash ./scripts/docker-push-all-images.sh $(TAG)


# make docker-build-all-images TAG=<...>
docker-build-all-images:
	@bash ./scripts/docker-build-all-images.sh $(TAG)

# make docker-delete-all-repos
docker-delete-all-repos:
	@bash ./scripts/docker-delete-all-repos.sh

