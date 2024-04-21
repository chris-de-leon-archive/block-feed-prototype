apply:
	@cd ../../ && terraform -chdir="./deployment/local" apply -auto-approve

destroy:
	@terraform destroy -auto-approve

block-heights:
	@docker exec -it timescaledb /bin/bash -c \
		"psql --username rootuser --dbname block_feed -c 'SELECT \"block_height\" FROM \"block_feed\".\"$(CHAIN)\" ORDER BY \"block_height\" DESC LIMIT 10'"

count-blocks:
	@docker exec -it timescaledb /bin/bash -c \
		"psql --username rootuser --dbname block_feed -c 'SELECT COUNT(*) FROM \"block_feed\".\"$(CHAIN)\"'"
	
