#!/usr/bin/env sh
# Sao lưu Postgres mỗi ngày, giữ 14 bản gần nhất.
# Cron (chạy 3:15 sáng):  15 3 * * * /opt/vt-sys/deploy/backup.sh >> /var/log/bangden-backup.log 2>&1
# Máy chủ tại nhà (crontab của root, vì Docker cần sudo):
#   15 3 * * * COMPOSE_FILE_NAME=docker-compose.homelab.yml BACKUP_DIR=/home/vuongtq/backups/bangden /home/vuongtq/vt-sys/deploy/backup.sh >> /home/vuongtq/backups/bangden.log 2>&1
set -eu
cd "$(dirname "$0")/.."
DIR=${BACKUP_DIR:-/var/backups/bangden}
COMPOSE_FILE_NAME=${COMPOSE_FILE_NAME:-docker-compose.prod.yml}
mkdir -p "$DIR"
FILE="$DIR/bangden-$(date +%Y%m%d-%H%M).sql.gz"
docker compose -f "deploy/$COMPOSE_FILE_NAME" --env-file .env exec -T postgres \
  pg_dump -U bangden bangden | gzip > "$FILE"
ls -1t "$DIR"/bangden-*.sql.gz | tail -n +15 | xargs -r rm --
echo "$(date -Iseconds) đã sao lưu $FILE"
