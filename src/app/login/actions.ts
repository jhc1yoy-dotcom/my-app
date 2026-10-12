"use server";

import { cookies, headers } from "next/headers";
import { blockedSeconds, clientIp, recordFailure, recordSuccess } from "@/lib/rate-limit";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE,
  AUTH_MAX_AGE,
  checkPassword,
  createAuthToken,
  isPasswordConfigured,
} from "@/lib/auth";

export type LoginState = { error: string | null };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isPasswordConfigured()) {
    return { error: ".env에 APP_PASSWORD와 AUTH_SECRET을 설정한 뒤 개발 서버를 다시 시작하세요." };
  }

  // 같은 접속지에서 너무 많이 틀렸으면 비밀번호를 확인하지도 않고 거절한다 (무한 대입 방지).
  const ip = clientIp(await headers());
  const wait = blockedSeconds(ip);
  if (wait > 0) {
    return { error: `시도가 너무 많습니다. ${Math.ceil(wait / 60)}분 뒤에 다시 시도해 주세요.` };
  }

  const input = String(formData.get("password") ?? "");
  if (!checkPassword(input)) {
    recordFailure(ip);
    // 연속 대입 시도를 늦추기 위한 짧은 지연
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { error: "비밀번호가 올바르지 않습니다." };
  }
  recordSuccess(ip);

  const cookieStore = await cookies();
  cookieStore.set({
    name: AUTH_COOKIE,
    value: createAuthToken()!,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  redirect("/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE);
  redirect("/login");
}
