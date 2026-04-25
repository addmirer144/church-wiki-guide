#!/bin/bash
# =============================================================
# 교회 볼트 자동 동기화 데몬
# fswatch로 볼트 변경 감지 → dirty 플래그 → 5분마다 sync 실행
#
# 설정 방법:
#   VAULT, REPO 값을 본인 환경에 맞게 수정하세요.
#   실행 전 fswatch 설치 필요: brew install fswatch
# =============================================================

set -u

VAULT="$HOME/Documents/church-vault"           # Obsidian 볼트 경로
REPO="$HOME/Desktop/church-wiki"               # Quartz 저장소 경로
SYNC="$REPO/scripts/sync-vault.sh"
DIRTY_FLAG="/tmp/church_vault_dirty"
CHECK_INTERVAL=300   # 5분(300초)마다 dirty 플래그 확인
FSWATCH="/opt/homebrew/bin/fswatch"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 자동 sync 데몬 시작"

# 변경 감지 → dirty 플래그 세팅 (백그라운드)
"$FSWATCH" --recursive --latency=2 \
  --exclude='\.obsidian' \
  --exclude='\.DS_Store' \
  --exclude='\.git' \
  "$VAULT" | while read -r _; do
    touch "$DIRTY_FLAG"
done &

WATCHER_PID=$!
trap "kill $WATCHER_PID 2>/dev/null; exit 0" TERM INT

# 폴링 루프: 5분마다 dirty 플래그 확인, 있으면 sync 실행
while true; do
  sleep "$CHECK_INTERVAL"
  if [ -f "$DIRTY_FLAG" ]; then
    rm -f "$DIRTY_FLAG"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 변경 감지됨. sync 실행..."
    cd "$REPO" && bash "$SYNC"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] sync 완료"
  fi
done
