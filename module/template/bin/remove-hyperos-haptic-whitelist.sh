#!/system/bin/sh

set -eu

CONFIG=/data/adb/hyperos_music_haptic_whitelist.txt
DATA_ROOT=/data/adb/remove_hyperos_haptic_whitelist
BACKUP_DIR="$DATA_ROOT/backup"
STAGE_DIR="$DATA_ROOT/stage"

mkdir -p "$BACKUP_DIR" "$STAGE_DIR"
chmod 700 "$DATA_ROOT" "$BACKUP_DIR" "$STAGE_DIR" 2>/dev/null || true

_json_string() {
  awk 'BEGIN{printf "\""} {
    gsub(/\\/,"\\\\"); gsub(/"/,"\\\""); gsub(/\t/,"\\t");
    gsub(/\r/,"\\r"); printf "%s\\n", $0
  } END{printf "\""}'
}

die() {
  printf '{"ok":false,"error":%s}\n' "$(printf '%s' "$1" | _json_string)"
  exit 1
}

safe_name() {
  case "$1" in
    ''|*..*|*/*|*\\*|*\&*|*\|*|*\;*|*\`*|*\$*|*\(*|*\)*|*\<*|*\>*) return 1 ;;
    *) return 0 ;;
  esac
}

backup_count() {
  ls "$BACKUP_DIR" 2>/dev/null | wc -l | tr -d ' \n'
}

cmd_stat() {
  local exists=false size=0 mtime=0
  if [ -f "$CONFIG" ]; then
    exists=true
    size=$(stat -c '%s' "$CONFIG" 2>/dev/null || echo 0)
    mtime=$(stat -c '%Y' "$CONFIG" 2>/dev/null || echo 0)
  fi

  printf '{"ok":true,"configPath":"%s","exists":%s,"size":%s,"mtime":%s,"backupCount":%s}\n' \
    "$CONFIG" "$exists" "$size" "$mtime" "$(backup_count)"
}

cmd_pull() {
  [ -f "$CONFIG" ] || die "missing: $CONFIG"
  base64 -w0 "$CONFIG"
  echo
}

cmd_stage_clear() {
  safe_name "$1" || die "invalid stage name"
  rm -f "$STAGE_DIR/$1.b64"
  printf '{"ok":true}\n'
}

cmd_stage_append() {
  local name="$1" chunk="$2"
  safe_name "$name" || die "invalid stage name"
  [ -n "$chunk" ] || die "missing stage chunk"
  printf '%s' "$chunk" >> "$STAGE_DIR/$name.b64"
  printf '{"ok":true}\n'
}

cmd_save_from_stage() {
  local name="$1" staged tmp backup uid gid
  safe_name "$name" || die "invalid stage name"
  staged="$STAGE_DIR/$name.b64"
  [ -f "$staged" ] || die "missing stage: $name"

  tmp="$CONFIG.tmp.$$"
  base64 -d "$staged" > "$tmp" 2>/dev/null || {
    rm -f "$tmp" "$staged"
    die "base64 decode failed"
  }
  rm -f "$staged"

  backup=null
  if [ -f "$CONFIG" ]; then
    backup="$BACKUP_DIR/$(date +%s).txt"
    cp -f "$CONFIG" "$backup"
    chmod 600 "$backup" 2>/dev/null || true
  fi

  uid=0
  gid=0
  if [ -f "$CONFIG" ]; then
    uid=$(stat -c '%u' "$CONFIG" 2>/dev/null || echo 0)
    gid=$(stat -c '%g' "$CONFIG" 2>/dev/null || echo 0)
  fi
  chown "$uid:$gid" "$tmp" 2>/dev/null || true
  chmod 600 "$tmp" 2>/dev/null || true
  mv -f "$tmp" "$CONFIG"
  if command -v restorecon >/dev/null 2>&1; then
    restorecon "$CONFIG" 2>/dev/null || true
  fi

  if [ "$backup" = null ]; then
    printf '{"ok":true,"path":"%s","backup":null}\n' "$CONFIG"
  else
    printf '{"ok":true,"path":"%s","backup":"%s"}\n' "$CONFIG" "$backup"
  fi
}

cmd_backup_list() {
  ls -1t "$BACKUP_DIR" 2>/dev/null || true
}

cmd_restore_latest() {
  local latest from tmp uid gid
  latest=$(ls -1t "$BACKUP_DIR" 2>/dev/null | head -n1)
  [ -n "$latest" ] || die "no backups yet"
  safe_name "$latest" || die "invalid backup name"
  from="$BACKUP_DIR/$latest"
  [ -f "$from" ] || die "missing backup: $latest"

  tmp="$CONFIG.restore.$$"
  cp -f "$from" "$tmp"
  uid=0
  gid=0
  if [ -f "$CONFIG" ]; then
    uid=$(stat -c '%u' "$CONFIG" 2>/dev/null || echo 0)
    gid=$(stat -c '%g' "$CONFIG" 2>/dev/null || echo 0)
  fi
  chown "$uid:$gid" "$tmp" 2>/dev/null || true
  chmod 600 "$tmp" 2>/dev/null || true
  mv -f "$tmp" "$CONFIG"
  if command -v restorecon >/dev/null 2>&1; then
    restorecon "$CONFIG" 2>/dev/null || true
  fi
  printf '{"ok":true,"restoredFrom":"%s","path":"%s"}\n' "$from" "$CONFIG"
}

case "${1:-}" in
  stat) cmd_stat ;;
  pull) cmd_pull ;;
  stage-clear) shift; cmd_stage_clear "$@" ;;
  stage-append) shift; cmd_stage_append "$@" ;;
  save-from-stage) shift; cmd_save_from_stage "$@" ;;
  backup-list) cmd_backup_list ;;
  restore-latest) cmd_restore_latest ;;
  *) die "unknown command: ${1:-}" ;;
esac
