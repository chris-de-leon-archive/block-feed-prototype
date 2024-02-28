DELIMITER //
CREATE TRIGGER `match_webhook_and_webhook_node_blockchain_ids`
BEFORE INSERT ON `webhook_location`
FOR EACH ROW
BEGIN
  -- Defines helper variables
  DECLARE webhook_node_blockchain_id  VARCHAR(255);
  DECLARE webhook_blockchain_id  VARCHAR(255);

  -- Gets the value of `blockchain_id` in table `webhook_node`
  SELECT `blockchain_id` INTO webhook_node_blockchain_id FROM `webhook_node` WHERE id = NEW.`webhook_node_id`;

  -- Gets the value of `blockchain_id` in table `webhook`
  SELECT `blockchain_id` INTO webhook_blockchain_id FROM `webhook` WHERE id = NEW.`webhook_id`;

  -- Checks if the values match; if not, raise an error
  IF webhook_blockchain_id != webhook_node_blockchain_id THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'webhook blockchain ID does not match webhook node blockchain ID';
  END IF;
END //
DELIMITER ;
