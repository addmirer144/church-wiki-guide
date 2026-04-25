// 선린교회 위키 - Vercel Edge 비밀번호 게이트
// 필요 환경변수: SITE_PASSWORD (Vercel 프로젝트 Environment Variables)

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

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=")
    if (k === name) return v.join("=")
  }
  return null
}

function safeRedirect(raw: string): string {
  // 오픈 리다이렉트 방지: 내부 경로만 허용
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/"
  return raw
}

export default async function middleware(
  request: Request,
): Promise<Response | undefined> {
  const pw = process.env.SITE_PASSWORD
  if (!pw) {
    return new Response("SITE_PASSWORD 환경변수가 설정되지 않았습니다.", {
      status: 500,
    })
  }

  const url = new URL(request.url)
  const expected = await token(pw)
  const current = readCookie(request.headers.get("cookie"), COOKIE)

  // 로그인 제출
  if (url.pathname === "/__login" && request.method === "POST") {
    const form = await request.formData()
    const input = (form.get("password") ?? "").toString()
    const redirect = safeRedirect((form.get("redirect") ?? "/").toString())
    if (input === pw) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: redirect,
          "Set-Cookie": `${COOKIE}=${expected}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`,
        },
      })
    }
    return htmlResponse(loginPage(redirect, true), 401)
  }

  // 로그아웃
  if (url.pathname === "/__logout") {
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/",
        "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
      },
    })
  }

  // 인증됨 → 통과
  if (current === expected) return

  // 미인증 → 로그인 페이지
  return htmlResponse(loginPage(url.pathname + url.search, false))
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function loginPage(redirect: string, failed: boolean): string {
  const safe = escapeAttr(redirect)
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>선린교회 위키</title>
<style>
  :root { color-scheme: light dark; }
  html, body { margin: 0; padding: 0; height: 100%; font-family: "Noto Sans KR", -apple-system, system-ui, sans-serif; }
  body { background: #fdfcf8; color: #1e1a16; display: flex; align-items: center; justify-content: center; }
  .card {
    background: #fff; border: 1px solid #ece8df; border-radius: 12px;
    padding: 32px 28px; width: min(360px, 92vw);
    box-shadow: 0 2px 12px rgba(107, 76, 42, 0.06);
  }
  h1 { margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #3d3530; }
  p.sub { margin: 0 0 20px; font-size: 13px; color: #a89f90; }
  form { display: flex; flex-direction: column; gap: 10px; }
  input[type=password] {
    padding: 11px 14px; border: 1px solid #ece8df; border-radius: 8px;
    font-size: 15px; background: #fdfcf8; color: #1e1a16; outline: none;
  }
  input[type=password]:focus { border-color: #6b4c2a; }
  button {
    padding: 11px 14px; border: none; border-radius: 8px;
    background: #6b4c2a; color: #fdfcf8; font-size: 15px; font-weight: 600;
    cursor: pointer;
  }
  button:hover { background: #9b7b52; }
  .err { margin-top: 6px; font-size: 13px; color: #c04a2a; }
  @media (prefers-color-scheme: dark) {
    body { background: #1a1712; color: #f0ebe2; }
    .card { background: #221c16; border-color: #2e2a24; box-shadow: none; }
    h1 { color: #d4cec5; }
    p.sub { color: #6b6258; }
    input[type=password] { background: #1a1712; border-color: #2e2a24; color: #f0ebe2; }
    input[type=password]:focus { border-color: #c9a06a; }
    button { background: #c9a06a; color: #1a1712; }
    button:hover { background: #a07840; }
    .err { color: #e08a6a; }
  }
</style>
</head>
<body>
  <div class="card">
    <h1>선린교회 위키</h1>
    <p class="sub">열람하려면 비밀번호를 입력하세요.</p>
    <form method="POST" action="/__login">
      <input type="hidden" name="redirect" value="${safe}">
      <input type="password" name="password" autofocus required autocomplete="current-password">
      <button type="submit">접속</button>
      ${failed ? '<div class="err">비밀번호가 올바르지 않습니다.</div>' : ""}
    </form>
  </div>
</body>
</html>`
}
