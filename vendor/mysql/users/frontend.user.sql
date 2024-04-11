-- creates the user
SET @query = CONCAT("CREATE USER IF NOT EXISTS ", @uname, " IDENTIFIED BY '", @pword, "'");
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- customer
SET @query = CONCAT("REVOKE IF EXISTS ALL PRIVILEGES ON customer FROM ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @query = CONCAT("GRANT SELECT, INSERT, UPDATE ON TABLE customer TO ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- checkout_session 
SET @query = CONCAT("REVOKE IF EXISTS ALL PRIVILEGES ON checkout_session FROM ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @query = CONCAT("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE checkout_session TO ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- blockchain
SET @query = CONCAT("REVOKE IF EXISTS ALL PRIVILEGES ON blockchain FROM ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @query = CONCAT("GRANT SELECT ON TABLE blockchain TO ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- webhook
SET @query = CONCAT("REVOKE IF EXISTS ALL PRIVILEGES ON webhook FROM ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @query = CONCAT("GRANT SELECT, INSERT, DELETE, UPDATE(`url`, `max_blocks`, `max_retries`, `timeout_ms`, `is_queued`) ON TABLE webhook TO ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- webhook_location
SET @query = CONCAT("REVOKE IF EXISTS ALL PRIVILEGES ON webhook_location FROM ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @query = CONCAT("GRANT SELECT ON TABLE webhook_location TO ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- webhook_claim
SET @query = CONCAT("REVOKE IF EXISTS ALL PRIVILEGES ON webhook_claim FROM ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @query = CONCAT("GRANT SELECT ON TABLE webhook_claim TO ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Flush privileges
SET @query = "FLUSH PRIVILEGES";
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

