#!/bin/bash
# Run after the user approves Google sign-in in the box browser. Never prints the token.
set -e; cd /workspace/arbradar
TOK=$(python3 -c "import re;s=open('.rclone_auth.out').read();m=re.search(r'Paste the following into your remote machine --->\s*(\{.*?\})\s*<---',s,re.S);print(m.group(1) if m else '')")
[ -z "$TOK" ] && { echo "no token yet"; exit 1; }
export SSHPASS="$(cat .hetzner_pass)"
printf '%s' "$TOK" | sshpass -e ssh root@65.109.199.19 'T=$(cat); rclone config create arbradar-gdrive drive scope=drive root_folder_id=1WA88O361MJrX-NZ9qHyRVXcf5YkmuGQm token="$T" >/dev/null && chmod 600 /root/.config/rclone/rclone.conf && rclone lsd arbradar-gdrive: && /root/arbradar-data/bin/arbradar-sync.sh && echo SYNC_OK'
echo "Then (after approval) enable: systemctl enable --now arbradar-sync.timer"
