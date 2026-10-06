import { createHmac, timingSafeEqual } from "node:crypto";

// 접속 비밀번호 확인용 공통 로직 (서버 전용)
// 쿠키에는 비밀번호 자체가 아니라 비밀번호로 만든 서명값만 저장한다.

export const AUTH_COOKIE = "insa_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 7; // 7일

function getPassword(): string | null {
  const password = process.env.APP_PASSWORD;
  return password ? password : null;
}

export function isPasswordConfigured(): boolean {
  return getPassword() !== null;
}

function sign(value: string, key: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

// 비밀번호를 통과한 브라우저에 발급할 토큰. 비밀번호가 바뀌면 기존 토큰은 자동으로 무효가 된다.
export function createAuthToken(): string | null {
  const password = getPassword();
  if (!password) return null;
  return sign("insa-compass-auth", password).toString("hex");
}

export function verifyAuthToken(token: string | undefined): boolean {
  const expected = createAuthToken();
  if (!expected || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPassword(input: string): boolean {
  const password = getPassword();
  if (!password) return false;
  // 길이가 달라도 비교 시간이 같도록 해시끼리 비교한다.
  return timingSafeEqual(sign(input, "compare"), sign(password, "compare"));
}
