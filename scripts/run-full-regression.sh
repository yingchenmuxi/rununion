#!/usr/bin/env bash
set +e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR="$ROOT/test-runs/full-2026-11-27"
MASTER="$LOGDIR/master.log"
mkdir -p "$LOGDIR"
: > "$MASTER"
reset_api() {
  curl.exe -s -X POST http://127.0.0.1:8090/api/reset >/dev/null
}
run_test() {
  local name="$1"
  local dir="$2"
  shift 2
  echo "=== $name ===" | tee -a "$MASTER"
  ( cd "$ROOT/$dir" && timeout 300 node "$@" ) > "$LOGDIR/$name.log" 2>&1
  local code=$?
  echo "EXIT $code $name" | tee -a "$MASTER"
  grep -E "SUMMARY|FAILED|通过|passed|^FAIL " "$LOGDIR/$name.log" | tail -8 | tee -a "$MASTER"
  if [ "${RESET_AFTER:-1}" = "1" ]; then reset_api; fi
}
reset_api
run_test mobile-messages mobile verify-messages.mjs
run_test mobile-announcements mobile verify-announcements.mjs
run_test mobile-knowledge mobile verify-knowledge.mjs
run_test mobile-run-sync mobile verify-run-sync.mjs
run_test mobile-three-channels mobile verify-three-channels.mjs
run_test admin-activities admin verify-activities-admin.mjs
run_test admin-checkin admin verify-checkin-admin.mjs
run_test admin-edit-activity admin verify-edit-activity.mjs
run_test admin-announcements admin verify-announcements.mjs
run_test root-membership . verify-membership.mjs
run_test root-invites . verify-invites.mjs
RESET_AFTER=0 run_test admin-runs-challenges admin verify-runs-challenges.mjs
run_test mobile-runs-challenges mobile verify-runs-challenges.mjs
run_test admin-platform admin verify-platform.mjs
run_test admin-platform-actions admin verify-platform-actions.mjs
run_test admin-platform-paging2 admin verify-platform-paging2.mjs
run_test admin-platform-responsive admin verify-platform-responsive.mjs
reset_api
echo "=== FINAL HEALTH ===" | tee -a "$MASTER"
curl.exe -s http://127.0.0.1:8090/api/health | tee -a "$MASTER"
echo "" | tee -a "$MASTER"
echo "DONE" | tee -a "$MASTER"
