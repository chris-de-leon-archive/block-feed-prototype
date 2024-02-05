test:
	@sqlc generate
	@go test ./tests/e2e... -v

# make docker-push-all-images TAG=<...>
docker-push-all-images:
	@bash ./scripts/docker-push-all-images.sh $(TAG)

# make docker-delete-all-repos
docker-delete-all-repos:
	@bash ./scripts/docker-delete-all-repos.sh

