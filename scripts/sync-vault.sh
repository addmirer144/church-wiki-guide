#!/bin/bash
# =============================================================
# 교회 볼트 → Quartz 동기화 스크립트
# 사용법: ./scripts/sync-vault.sh
#
# 설정 방법:
#   아래 VAULT, CONTENT, REPO, BRANCH 값을 본인 환경에 맞게 수정하세요.
# =============================================================

set -e

VAULT="$HOME/Documents/church-vault"          # Obsidian 볼트 경로
CONTENT="$(cd "$(dirname "$0")/.." && pwd)/content"  # Quartz content 폴더 (자동)
REPO="$(cd "$(dirname "$0")/.." && pwd)"       # 저장소 루트 (자동)
BRANCH="v4"                                    # GitHub 브랜치명
VERCEL="$HOME/.npm-global/bin/vercel"          # vercel CLI 경로

echo "▶ 볼트 동기화 시작..."
echo "  소스: $VAULT"
echo "  대상: $CONTENT"
echo ""

# 1. content/ 초기화
echo "▶ 기존 content 폴더 초기화 중..."
find "$CONTENT" -mindepth 1 -not -name '.gitkeep' -delete 2>/dev/null || true

# 2. 볼트 → content/ 복사 (민감 폴더 제외)
echo "▶ 볼트 파일 복사 중..."
rsync -av --delete \
  --exclude='.obsidian/' \
  --exclude='.DS_Store' \
  --exclude='_템플릿/' \
  --exclude='_시스템/' \
  --exclude='*.pdf' \
  --exclude='.claude/' \
  --exclude='CLAUDE.md' \
  "$VAULT/" "$CONTENT/"

echo ""
echo "▶ 동기화 완료. 변경 사항 확인 중..."

# 3. 변경 사항이 있으면 커밋 & 배포
cd "$REPO"
git status --short

if [[ -n $(git status --short) ]]; then
  DATE=$(date '+%Y-%m-%d %H:%M')
  echo ""
  echo "▶ 변경 사항 커밋 중..."
  git add -A
  git commit -m "볼트 동기화: $DATE"
  echo ""
  echo "▶ GitHub에 푸시 중..."
  git push origin "$BRANCH"
  echo ""
  echo "▶ Vercel에 배포 중..."
  node "$VERCEL" --prod --yes
  echo ""
  echo "✅ 완료!"
else
  echo ""
  echo "✅ 변경 사항 없음. 사이트는 이미 최신 상태입니다."
fi
