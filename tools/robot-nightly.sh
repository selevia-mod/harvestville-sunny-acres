#!/bin/bash
# The robot check, every night (tools/robot-nightly.plist runs this at 2:30 AM). The report goes to
# ~/Downloads/robot-check-<date>/report.png (and report.json); the run's own log next to it as run.log.
# Run by hand: tools/robot-nightly.sh   (ROBOT_NIGHTLY_ARGS adds flags, e.g. "--all-tests" or "--quick")
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$(dirname "$0")/.." || exit 2
# ROBOT_BRANCH (set in the plist): this folder is the robot's own (a worktree nobody works in). It goes to that branch's
# latest commit first, the robot's own build put back so the move is clean. Never a forced checkout.
if [ -n "${ROBOT_BRANCH:-}" ]; then
  git restore --source=HEAD --staged --worktree -- dist 2>/dev/null
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then echo "robot folder has changes: not moved" >&2; else git checkout --detach "$ROBOT_BRANCH" || exit 3; fi
fi
OUT="$HOME/Downloads/robot-check-$(date +%Y-%m-%d)"
mkdir -p "$OUT"
# (the full run: every check on the usual phone, the phone sizes, the big real farms, the slow phone, npm test)
node tools/robot-check.js --out "$OUT" ${ROBOT_NIGHTLY_ARGS:-} > "$OUT/run.log" 2>&1
code=$?
echo "exit $code at $(date)" >> "$OUT/run.log"
exit $code
