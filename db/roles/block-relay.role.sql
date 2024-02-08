CREATE FUNCTION pg_temp.update_block_relay_role(
  schma TEXT,
  uname TEXT,
  pword TEXT
) RETURNS VOID AS
$func$
DECLARE
  query   TEXT;
  queries TEXT[] := ARRAY[
    -- create role if not exists
    format('CREATE ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION PASSWORD ''%s''', uname, pword),
    
    -- custom schema
    format('REVOKE USAGE ON SCHEMA %I FROM %I;', schma, uname),
    format('GRANT USAGE ON SCHEMA %I TO %I;', schma, uname),

    -- customer
    format('REVOKE ALL PRIVILEGES ON %I."customer" FROM %I;', schma, uname),
    format('GRANT SELECT ON TABLE %I."customer" TO %I;', schma, uname),

    -- blockchain
    format('REVOKE ALL PRIVILEGES ON %I."blockchain" FROM %I;', schma, uname),
    format('GRANT SELECT, INSERT, UPDATE ON TABLE %I."blockchain" TO %I;', schma, uname),

    -- webhook
    format('REVOKE ALL PRIVILEGES ON %I."webhook" FROM %I;', schma, uname),
    format('GRANT SELECT ON TABLE %I."webhook" TO %I;', schma, uname),

    -- webhook_job
    format('REVOKE ALL PRIVILEGES ON %I."webhook_job" FROM %I;', schma, uname),
    format('REVOKE USAGE ON %I."webhook_job_id_seq" FROM %I;', schma, uname),
    format('GRANT SELECT, INSERT, DELETE ON TABLE %I."webhook_job" TO %I;', schma, uname),
    format('GRANT USAGE ON SEQUENCE %I."webhook_job_id_seq" TO %I;', schma, uname),

    -- block_cache
    format('REVOKE ALL PRIVILEGES ON %I."block_cache" FROM %I;', schma, uname),
    format('GRANT SELECT, INSERT, DELETE ON TABLE %I."block_cache" TO %I;', schma, uname)
  ];
BEGIN
  FOREACH query IN ARRAY queries
  LOOP
    BEGIN
      RAISE NOTICE '%', query;
      EXECUTE query;
    EXCEPTION WHEN DUPLICATE_OBJECT THEN
      RAISE NOTICE '% - skipping', SQLERRM USING ERRCODE = SQLSTATE;
      CONTINUE;
    END;
  END LOOP;
END
$func$ LANGUAGE plpgsql;

SELECT pg_temp.update_block_relay_role(:'schema', :'uname', :'pword');
