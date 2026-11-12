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
$P -d t -1 -f "$ROOT/supabase/farm_online_13.sql" # (the Tailor Shop's looks: needs only parts 1-4)
$P -d t -1 -f "$ROOT/supabase/farm_online_14.sql" # (hunting together: needs parts 1-3)
$P -d t -1 -f "$ROOT/supabase/farm_online_15.sql" # (the Fishing Derby)
$P -d t -1 -f "$ROOT/supabase/farm_online_16.sql" # (barangays and the Bayanihan Cup: needs parts 1-3)
$P -d t -1 -f "$ROOT/supabase/farm_online_16.sql" # (twice: safe to run again)
$P -d t -1 -f "$ROOT/supabase/farm_online_17.sql" # (the Market board: needs part 7)
$P -d t -1 -f "$ROOT/supabase/farm_online_17.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online_18.sql" # (signed live messages: needs part 1)
$P -d t -1 -f "$ROOT/supabase/farm_online_18.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online_19.sql" # (Central Park: needs parts 1, 3 and 18)
$P -d t -1 -f "$ROOT/supabase/farm_online_19.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online_20.sql" # (Bayanihan Projects: needs parts 1 and 16)
$P -d t -1 -f "$ROOT/supabase/farm_online_20.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online_21.sql" # (the Town Raid: needs only part 1)
$P -d t -1 -f "$ROOT/supabase/farm_online_21.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online_22.sql" # (Town Rank and the Hall of Fame: needs parts 1, 14 and 15, not 20 or 21)
$P -d t -1 -f "$ROOT/supabase/farm_online_22.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online_23.sql" # (every hunting place: needs parts 14 and 22)
$P -d t -1 -f "$ROOT/supabase/farm_online_23.sql"
$P -d t -f "$ROOT/test/sql/checks.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
$P -d t -f "$ROOT/test/sql/looks-checks.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
$P -d t -f "$ROOT/test/sql/hunt-checks.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
$P -d t -f "$ROOT/test/sql/derby-checks.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
$P -d t -f "$ROOT/test/sql/social-checks.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
$P -d t -f "$ROOT/test/sql/line-keys-checks.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
$P -d t -f "$ROOT/test/sql/park-checks.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
$P -d t -f "$ROOT/test/sql/rank-checks.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
$P -d t -f "$ROOT/test/sql/bayanihan-checks.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
$P -d t -f "$ROOT/test/sql/raid-checks.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
$P -d t -f "$ROOT/test/sql/places-checks.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
# part 24 (refills in bulk) after the old checks, which test part 4's 20 a day (live: 1,000)
$P -d t -1 -f "$ROOT/supabase/farm_online_24.sql"
$P -d t -1 -f "$ROOT/supabase/farm_online_24.sql"
$P -d t -f "$ROOT/test/sql/bulk-checks.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
# The Lost Tower's weekly board and First in Selebox (needs parts 1 and 22)
$P -d t -1 -f "$ROOT/supabase/farm_tower_board.sql"
$P -d t -1 -f "$ROOT/supabase/farm_tower_board.sql"
$P -d t -f "$ROOT/test/sql/tower-board-checks.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //'
