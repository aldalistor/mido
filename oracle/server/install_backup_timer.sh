#!/usr/bin/env bash
set -Eeuo pipefail

BASE_DIR="${BASE_DIR:-/opt/onyx-server}"
install -m 0755 backup.sh "${BASE_DIR}/backup.sh"

cat >/etc/systemd/system/onyx-oracle-backup.service <<EOF
[Unit]
Description=Onyx Oracle Data Pump backup
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=${BASE_DIR}
ExecStart=${BASE_DIR}/backup.sh
EOF

cat >/etc/systemd/system/onyx-oracle-backup.timer <<'EOF'
[Unit]
Description=Daily Onyx Oracle backup

[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now onyx-oracle-backup.timer
systemctl list-timers onyx-oracle-backup.timer
