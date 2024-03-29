# make test-all
test-all:
	@sqlc generate
	@go test ./tests/... -v

# Example(s):
# 	make test-e2e FPATH=basic
test-e2e:
	@sqlc generate
	@go test ./tests/e2e/$(FPATH)_test.go -v

# Example(s):
# 	make test-int FPATH=blockstore/redis
# 	make test-int FPATH=blockstore/mongo
# 	make test-int FPATH=blockstore/timescale
test-int:
	@sqlc generate
	@go test ./tests/integration/$(FPATH)_test.go -v

# make docker-push-all-images TAG=<...>
docker-push-all-images:
	@bash ./scripts/docker-push-all-images.sh $(TAG)

# make docker-build-all-images TAG=<...>
docker-build-all-images:
	@bash ./scripts/docker-build-all-images.sh $(TAG)

# make docker-delete-all-repos
docker-delete-all-repos:
	@bash ./scripts/docker-delete-all-repos.sh

