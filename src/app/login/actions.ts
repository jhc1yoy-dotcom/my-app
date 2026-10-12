"use server";

import { cookies } from "next/headers";
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

  const input = String(formData.get("password") ?? "");
  if (!checkPassword(input)) {
    // 연속 대입 시도를 늦추기 위한 짧은 지연
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { error: "비밀번호가 올바르지 않습니다." };
  }

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
