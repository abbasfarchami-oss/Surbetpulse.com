#!/bin/bash
# ArbRadar -> Google Drive sync. live-cache: consistent DB snapshot overwritten each run; big-odds-history: daily JSONL files copied (append-only by day).
set -euo pipefail
D=/root/arbradar-data; R=${ARBRADAR_REMOTE:-arbradar-gdrive}
mkdir -p $D/snap
[ -f $D/arbradar.db ] && sqlite3 $D/arbradar.db ".backup $D/snap/arbradar.db" && gzip -f $D/snap/arbradar.db
date -u +%FT%TZ > $D/snap/last-sync-utc.txt
rclone copy $D/snap "$R:live-cache" --drive-use-trash=true
rclone copy $D/big-odds "$R:big-odds-history" --include 'big-odds-*.jsonl'
