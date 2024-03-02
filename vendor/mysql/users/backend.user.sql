-- creates the user
SET @query = CONCAT("CREATE USER IF NOT EXISTS ", @uname, " IDENTIFIED BY '", @pword, "'");
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- webhook
SET @query = CONCAT("REVOKE IF EXISTS ALL PRIVILEGES ON webhook FROM ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @query = CONCAT("GRANT SELECT, UPDATE(`is_active`) ON TABLE webhook TO ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- blockchain
SET @query = CONCAT("REVOKE IF EXISTS ALL PRIVILEGES ON blockchain FROM ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @query = CONCAT("GRANT SELECT, INSERT, UPDATE ON TABLE blockchain TO ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- webhook_claim
SET @query = CONCAT("REVOKE IF EXISTS ALL PRIVILEGES ON webhook_claim FROM ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @query = CONCAT("GRANT SELECT, INSERT ON TABLE webhook_claim TO ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- webhook_location
SET @query = CONCAT("REVOKE IF EXISTS ALL PRIVILEGES ON webhook_location FROM ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @query = CONCAT("GRANT SELECT, INSERT ON TABLE webhook_location TO ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- webhook_node
SET @query = CONCAT("REVOKE IF EXISTS ALL PRIVILEGES ON webhook_node FROM ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @query = CONCAT("GRANT SELECT ON TABLE webhook_node TO ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Grant lock tables
SET @query = CONCAT("GRANT LOCK TABLES ON `", @db, "`.* TO ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Flush privileges
SET @query = "FLUSH PRIVILEGES";
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
