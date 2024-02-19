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

-- blockchain
SET @query = CONCAT("REVOKE IF EXISTS ALL PRIVILEGES ON blockchain FROM ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @query = CONCAT("GRANT SELECT ON TABLE blockchain TO ", @uname);
PREPARE stmt FROM @query;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

