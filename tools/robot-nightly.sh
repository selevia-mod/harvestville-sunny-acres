#!/bin/bash
# The robot check, every night (tools/robot-nightly.plist runs this at 2:30 AM). The report goes to
# ~/Downloads/robot-check-<date>/report.png (and report.json); the run's own log next to it as run.log.
# Run by hand: tools/robot-nightly.sh   (ROBOT_NIGHTLY_ARGS adds flags, e.g. "--all-tests" or "--quick")
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")/.." || exit 2
OUT="$HOME/Downloads/robot-check-$(date +%Y-%m-%d)"
mkdir -p "$OUT"
# (the full run: every check on the usual phone, the phone sizes, the big real farms, the slow phone, npm test)
node tools/robot-check.js --out "$OUT" ${ROBOT_NIGHTLY_ARGS:-} > "$OUT/run.log" 2>&1
code=$?
echo "exit $code at $(date)" >> "$OUT/run.log"
exit $code
