CREATE FUNCTION pg_temp.update_blockstore_role(
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
    format('GRANT USAGE, CREATE ON SCHEMA %I TO %I;', schma, uname),

    -- grant SELECT and INSERT on all existing tables and all future tables: https://stackoverflow.com/a/22684537 
    format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT ON TABLES TO %I;', schma, uname)
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

SELECT pg_temp.update_blockstore_role(:'schema', :'uname', :'pword');
