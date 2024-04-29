apply:
	@cd ../../ && terraform -chdir="./deployment/local" apply -auto-approve

destroy:
	@terraform destroy -auto-approve

redis-latest-block:
	@redis-cli -p $(PORT) EVAL "return redis.call('ZRANGE', KEYS[1], -1, -1, 'WITHSCORES')[2]" 1 $(CHAIN)

redis-block-count:
	@redis-cli -p $(PORT) ZCARD $(CHAIN)

db-latest-block:
	@docker exec -it timescaledb-$(CHAIN) /bin/bash -c \
		"psql --username rootuser --dbname block_feed -c 'SELECT \"block_height\" FROM \"block_feed\".\"$(CHAIN)\" ORDER BY \"block_height\" DESC LIMIT 10'"

db-block-count:
	@docker exec -it timescaledb-$(CHAIN) /bin/bash -c \
		"psql --username rootuser --dbname block_feed -c 'SELECT COUNT(*) FROM \"block_feed\".\"$(CHAIN)\"'"
	
