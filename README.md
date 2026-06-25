# 교회 내부 위키 구축 가이드

Obsidian으로 작성한 교회 문서를 **비밀번호로 보호된 내부 웹사이트**로 자동 배포하는 시스템입니다.  
[Quartz v4](https://quartz.jzhao.xyz/) + [Vercel](https://vercel.com) 기반으로 구성하며, 모든 과정은 Claude(AI)의 도움을 받아 구현했습니다.

> 선린교회에서 실제로 운영 중인 시스템을 템플릿으로 정리했습니다.  
> 경로·비밀번호 등 `YOUR_USERNAME` 표시 부분을 본인 환경에 맞게 수정해 사용하세요.

> **두 키트는 한 쌍입니다.**
> - 지식/볼트 → **[church-wiki-starter](https://github.com/addmirer144/church-wiki-starter)** (먼저 이걸로 회의록·자료를 쌓는다)
> - 웹 배포 → **이 저장소(church-wiki-guide)** (준비되면 비밀번호 웹사이트로 공유)
>
> 순서: 스타터 키트로 볼트를 만들어 한동안 기록을 쌓은 뒤, 공유가 필요해지면 이 가이드로 배포한다.

---

## 어떤 시스템인가

```
Obsidian 볼트 (로컬 편집)
       ↓  파일 저장 감지 (fswatch)
  5분 이내 자동 실행
       ↓
  sync-vault.sh
  ├── rsync: 볼트 → content/
  ├── git commit & push
  └── vercel --prod 배포
       ↓
https://sunrin-wiki.vercel.app
(비밀번호 게이트로 보호)
```

- 교역자/담당자가 Obsidian에서 문서를 저장하면 최대 5분 안에 웹사이트에 반영됩니다.
- 외부인은 접속할 수 없고, 비밀번호를 아는 교인만 열람 가능합니다.
- 비용: **무료** (Vercel Hobby 플랜, GitHub 무료 플랜)

---

## 사전 준비

| 항목 | 설명 |
|------|------|
| macOS | Apple Silicon(M1~) 기준 |
| [Obsidian](https://obsidian.md) | 문서 작성 도구 |
| [Node.js](https://nodejs.org) 18 이상 | Quartz 빌드에 필요 |
| [Git](https://git-scm.com) | 버전 관리 |
| [GitHub 계정](https://github.com) | 저장소 호스팅 |
| [Vercel 계정](https://vercel.com) | 웹 배포 (GitHub으로 가입 가능) |
| [Homebrew](https://brew.sh) | macOS 패키지 관리자 |
| fswatch | `brew install fswatch` |
| Vercel CLI | `npm install -g vercel` |

---

## 1단계 — Quartz 저장소 준비

### 1-1. Quartz 포크 및 클론

```bash
# GitHub에서 jackyzha0/quartz 를 본인 계정으로 Fork 후
git clone https://github.com/<내-계정>/quartz.git sunrin-wiki
cd sunrin-wiki
npm install
```

### 1-2. 기본 설정 (`quartz.config.ts`)

```ts
const config: QuartzConfig = {
  configuration: {
    pageTitle: "선린교회 위키",
    enableSPA: true,        // 페이지 전환 애니메이션 (비밀번호 게이트 방식에서 정상 작동)
    enablePopovers: true,   // 링크 미리보기
    locale: "ko-KR",
    // ...
  },
  // ...
}
```

### 1-3. 로컬 미리보기

```bash
npx quartz build --serve
# http://localhost:8080 에서 확인
```

---

## 2단계 — GitHub에 올리기

```bash
# 이미 Fork한 저장소라면 브랜치만 변경
git checkout -b v4
git push origin v4
```

브랜치 이름은 자유롭게 지정해도 됩니다. 이후 Vercel과 연동할 때 같은 브랜치를 지정합니다.

---

## 3단계 — Vercel 배포 설정

### 3-1. Vercel에 프로젝트 연결

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository**
2. GitHub 저장소 선택
3. 빌드 설정을 아래처럼 지정하거나, `vercel.json`으로 관리 (권장)

**`vercel.json`**
```json
{
  "buildCommand": "npx quartz build",
  "outputDirectory": "public",
  "installCommand": "npm ci",
  "cleanUrls": true,
  "trailingSlash": false
}
```

- `cleanUrls: true` — `/about.html` 대신 `/about`으로 깔끔한 URL 사용
- Vercel이 push를 감지해 자동 빌드합니다.

### 3-2. 환경 변수 설정 (비밀번호)

Vercel 대시보드 → 프로젝트 → **Settings → Environment Variables**

| 이름 | 값 | 환경 |
|------|-----|------|
| `SITE_PASSWORD` | 원하는 비밀번호 | Production |
| `SITE_NAME` | 로그인 화면에 표시할 이름 (예: `○○교회 위키`). 생략 시 "교회 위키" | Production |

> 비밀번호를 바꾸면 기존 로그인 쿠키가 자동으로 무효화됩니다(SHA-256 기반 토큰이므로).
> `SITE_NAME`만 바꾸면 코드 수정 없이 로그인 화면의 교회 이름이 바뀝니다.

---

## 4단계 — 비밀번호 게이트 (Edge Middleware)

> **왜 Edge Middleware인가?**  
> 초기에는 staticrypt 방식을 시도했으나, Quartz의 SPA 네비게이션과 구조적으로 충돌했습니다.  
> 모든 HTML이 암호화 래퍼로 감싸이면 페이지 전환 시 DOM morph 실패, 페이지마다 전체 리로드·재복호화가 발생해 매우 느렸습니다.  
> Vercel Edge Middleware로 전환하면 서버 단에서 인증을 처리하므로 SPA·Popover가 정상 작동합니다.

루트에 `middleware.ts` 파일을 생성합니다:

```ts
export const config = {
  matcher: "/((?!_vercel/).*)",
}

const COOKIE = "sunrin_auth"
const MAX_AGE = 60 * 60 * 24 * 30 // 30일

async function token(pw: string): Promise<string> {
  const data = new TextEncoder().encode(`${pw}::sunrin-wiki::v1`)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
```

**동작 방식:**
- 미인증 요청 → 로그인 페이지(`/__login`) 표시
- 비밀번호 일치 → SHA-256 토큰을 HttpOnly 쿠키로 저장 (30일)
- 인증된 쿠키 보유 시 → 모든 페이지 통과
- `/__logout` 접속 → 쿠키 삭제

전체 코드는 이 저장소의 [`middleware.ts`](./middleware.ts)를 참고하세요.

---

## 5단계 — 볼트 동기화 스크립트

Obsidian 볼트 → `content/` 폴더 복사 → git push → Vercel 배포를 한 번에 처리하는 스크립트입니다.

**`sync-vault.sh`** (저장소 루트에 위치)

```bash
#!/bin/bash
set -e

VAULT="/Users/내-계정/Desktop/문서/선린교회"   # Obsidian 볼트 경로
CONTENT="$(pwd)/content"
VERCEL="$HOME/.npm-global/bin/vercel"

# 1. content/ 초기화
find "$CONTENT" -mindepth 1 -not -name '.gitkeep' -delete

# 2. 볼트 → content/ 복사 (민감 폴더 제외)
rsync -av --delete \
  --exclude='.obsidian/' \
  --exclude='.DS_Store' \
  --exclude='_템플릿/' \
  --exclude='_시스템/' \
  --exclude='*.pdf' \
  "$VAULT/" "$CONTENT/"

# 3. 변경 있으면 커밋 & 배포
if [[ -n $(git status --short) ]]; then
  git add -A
  git commit -m "볼트 동기화: $(date '+%Y-%m-%d %H:%M')"
  git push origin v4
  node $VERCEL --prod --yes
fi
```

실행:
```bash
chmod +x sync-vault.sh
./sync-vault.sh
```

> **주의:** `content/` 폴더는 직접 편집하지 마세요. sync 시 `rsync --delete`로 전부 덮어씌워집니다.  
> 항상 Obsidian 볼트에서 편집하세요.

---

## 6단계 — 자동 동기화 설정 (macOS LaunchAgent)

파일을 저장할 때마다 수동으로 `sync-vault.sh`를 실행하는 대신, 변경을 감지해 자동으로 실행하도록 설정합니다.

### 6-1. 데몬 스크립트 (`~/bin/sunrin-auto-sync.sh`)

```bash
#!/bin/bash
VAULT="/Users/내-계정/Desktop/문서/선린교회"
REPO="/Users/내-계정/Desktop/sunrin-wiki"
DIRTY_FLAG="/tmp/sunrin_vault_dirty"
FSWATCH="/opt/homebrew/bin/fswatch"

# 변경 감지 → dirty 플래그 세팅
"$FSWATCH" --recursive --latency=2 \
  --exclude='\.obsidian' --exclude='\.DS_Store' --exclude='\.git' \
  "$VAULT" | while read -r _; do
    touch "$DIRTY_FLAG"
done &

WATCHER_PID=$!
trap "kill $WATCHER_PID 2>/dev/null; exit 0" TERM INT

# 5분마다 dirty 확인 → sync 실행
while true; do
  sleep 300
  if [ -f "$DIRTY_FLAG" ]; then
    rm -f "$DIRTY_FLAG"
    cd "$REPO" && bash sync-vault.sh
  fi
done
```

### 6-2. LaunchAgent 등록

`~/Library/LaunchAgents/com.addmirer.sunrin-sync.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.addmirer.sunrin-sync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>/Users/내-계정/bin/sunrin-auto-sync.sh</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key>
    <string>/Users/내-계정/Library/Logs/sunrin-sync.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/내-계정/Library/Logs/sunrin-sync.log</string>
</dict>
</plist>
```

```bash
launchctl load -w ~/Library/LaunchAgents/com.addmirer.sunrin-sync.plist
```

> **macOS 권한 설정 필요:**  
> 시스템 설정 → 개인정보 보호 및 보안 → 전체 디스크 접근 권한에 `/bin/bash`를 추가해야 Desktop 폴더에 접근 가능합니다.

### 6-3. 수동 제어

```bash
# 중지
launchctl unload -w ~/Library/LaunchAgents/com.addmirer.sunrin-sync.plist

# 재시작
launchctl load -w ~/Library/LaunchAgents/com.addmirer.sunrin-sync.plist

# 로그 확인
tail -f ~/Library/Logs/sunrin-sync.log

# 즉시 수동 배포
cd ~/Desktop/sunrin-wiki && ./sync-vault.sh
```

---

## Windows에서는

위 6단계 중 **1~4단계(Quartz·GitHub·Vercel·비밀번호 게이트)는 Windows에서도 동일**합니다. 차이는 5~6단계(bash 스크립트·자동화)뿐입니다.

| 단계 | macOS | Windows |
|------|-------|---------|
| Quartz·GitHub·Vercel·middleware | 동일 | **동일** |
| `sync-vault.sh`(5단계) | bash로 바로 실행 | **Git Bash 또는 WSL**에서 실행 (둘 다 무료) |
| 자동 동기화(6단계) | fswatch + LaunchAgent | 맥 전용 → Windows는 **수동 동기화**로 대체 (아래) |

**Windows 권장 운영:** 자동화(6단계)는 건너뛰고, 문서를 고친 뒤 Git Bash에서 `bash scripts/sync-vault.sh` 한 줄을 직접 실행한다. 또는 작업 스케줄러로 주기 실행을 걸 수 있다.

> 참고: 맥과 윈도우를 git으로 함께 쓰면 한글 파일명(NFD/NFC) 차이로 링크가 깨져 보일 수 있다. 한 교회는 한 OS로 통일하는 것을 권장한다.

---

## 운영 요약

| 상황 | 방법 |
|------|------|
| 문서 작성/수정 | Obsidian에서 저장하면 5분 내 자동 배포 (macOS) / Windows는 수동 동기화 |
| 즉시 배포 필요 | `cd <위키폴더> && ./scripts/sync-vault.sh` (Windows는 Git Bash) |
| 비밀번호 변경 | Vercel 환경변수 `SITE_PASSWORD` 수정 후 재배포 |
| 교회 이름 변경 | Vercel 환경변수 `SITE_NAME` 수정 후 재배포 |
| 로그 확인(macOS) | `tail -f ~/Library/Logs/<위키>-sync.log` |
| 자동 sync 일시 중지(macOS) | `launchctl unload -w ~/Library/LaunchAgents/<your>.plist` |

---

## 이 시스템을 만든 과정

이 시스템 전체는 Claude(Anthropic의 AI)와 대화하며 단계별로 구현했습니다.

1. **Quartz 기본 설정** — `quartz.config.ts` 한국어/교회 맞춤 설정
2. **staticrypt 시도 → Edge Middleware 전환** — SPA 충돌 문제 진단 및 해결
3. **sync-vault.sh 작성** — rsync + git + Vercel CLI 파이프라인 구성
4. **LaunchAgent 자동화** — fswatch 기반 변경 감지 데몬 구현
5. **리더 모드 추가** — 사이드바 숨김 + 본문 중앙 정렬 커스텀 UI
6. **macOS 권한 문제 해결** — 전체 디스크 접근 권한 설정

각 단계에서 발생한 오류(DOM morph 실패, NFC/NFD 인코딩 문제, esbuild 직렬화 제약 등)를 AI와 함께 진단하고 수정했습니다.

---

## 라이선스

Quartz 원본: MIT License (jackyzha0/quartz)  
교회 커스터마이징 코드(middleware.ts, sync-vault.sh 등): 자유롭게 사용 가능
