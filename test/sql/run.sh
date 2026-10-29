#!/bin/sh
# Applies supabase/farm_online*.sql (parts 1-9) to a throwaway local Postgres (Homebrew postgresql@16) and runs test/sql/checks.sql.
set -e
export LC_ALL=en_US.UTF-8
PG=${PG:-/opt/homebrew/opt/postgresql@16/bin}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
DIR=$(mktemp -d /tmp/farm-sql.XXXX)
PORT=${PORT:-54331}
"$PG/initdb" -D "$DIR" -U postgres -A trust >/dev/null
"$PG/pg_ctl" -D "$DIR" -o "-p $PORT -k '' -c listen_addresses=127.0.0.1" -l "$DIR/log" start >/dev/null
trap '"$PG/pg_ctl" -D "$DIR" stop >/dev/null; rm -rf "$DIR"' EXIT
sleep 1
P="$PG/psql -h 127.0.0.1 -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "create database t"
$P -d t -f "$ROOT/test/sql/stubs.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online_2.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online_3.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online_4.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online_5.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online_6.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online_7.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online_8.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online_9.sql"
$P -d t -f "$ROOT/test/sql/checks.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
