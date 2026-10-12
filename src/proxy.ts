import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, verifyAuthToken } from "@/lib/auth";
import { errorResponse } from "@/lib/api/errors";

// 모든 화면과 API 앞에서 접속 비밀번호 통과 여부를 확인한다.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = verifyAuthToken(request.cookies.get(AUTH_COOKIE)?.value);

  if (pathname === "/login") {
    // 이미 통과했다면 비밀번호 창 대신 대시보드로 보낸다.
    return authed
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api")) {
    return errorResponse("UNAUTHORIZED", "비밀번호 확인이 필요합니다.");
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // 정적 파일(빌드 결과물, 이미지 최적화, 파비콘, public 폴더의 svg)은 검사하지 않는다.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.svg$).*)"],
};
