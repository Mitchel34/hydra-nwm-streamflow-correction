#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="${1:-logs}"

if [[ ! -d "$LOG_DIR" ]]; then
  echo "Log directory not found: $LOG_DIR"
  exit 1
fi

echo "Monitoring jobs in $LOG_DIR"
echo

for pidfile in "$LOG_DIR"/*.pid; do
  [[ -e "$pidfile" ]] || { echo "No PID files found in $LOG_DIR"; exit 0; }
  pid="$(cat "$pidfile")"
  name="$(basename "$pidfile" .pid)"
  logfile="$LOG_DIR/${name}.log"
  if kill -0 "$pid" 2>/dev/null; then
    status="RUNNING"
  else
    status="DONE"
  fi
  echo "[$status] $name (pid=$pid)"
  if [[ -f "$logfile" ]]; then
    last_line="$(tail -n 1 "$logfile" || true)"
    if [[ -n "$last_line" ]]; then
      echo "  last log: $last_line"
    else
      echo "  last log: (empty)"
    fi
  else
    echo "  last log: (missing)"
  fi
  echo
done
