import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// 접속 비밀번호 확인용 공통 로직 (서버 전용)
// 쿠키 토큰 = "발급시각.서명". 서명 열쇠는 비밀번호가 아니라 별도의 긴 무작위 값(AUTH_SECRET)이다.
// - 서버가 발급 시각을 확인해 7일이 지나면 거부한다 (브라우저 기한만 믿지 않음).
// - 서명에 비밀번호 지문을 함께 넣어, 비밀번호를 바꾸면 기존 토큰이 모두 무효가 된다.
// - 모두를 강제로 내보내야 할 때는 AUTH_SECRET을 바꾼다.

export const AUTH_COOKIE = "insa_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 7; // 7일 (초)

/** AUTH_SECRET의 최소 길이 (짧으면 추측당하기 쉬움) */
const MIN_SECRET_LENGTH = 32;

function getPassword(): string | null {
  const password = process.env.APP_PASSWORD;
  return password ? password : null;
}

function getSecret(): string | null {
  const secret = process.env.AUTH_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

/** 비밀번호와 서명 열쇠가 모두 설정돼 있어야 들어올 수 있다 (하나라도 없으면 아무도 못 들어옴). */
export function isPasswordConfigured(): boolean {
  return getPassword() !== null && getSecret() !== null;
}

function sign(value: string, key: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

/** 비밀번호 지문: 비밀번호가 바뀌면 달라진다 (비밀번호 자체는 토큰에 들어가지 않음). */
function passwordFingerprint(password: string): string {
  return createHash("sha256").update(`insa-compass:${password}`).digest("hex");
}

function signature(issuedAt: number, password: string, secret: string): string {
  return sign(`insa-compass-auth:${issuedAt}:${passwordFingerprint(password)}`, secret).toString("hex");
}

/** 비밀번호를 통과한 브라우저에 발급할 토큰. 설정이 없으면 null. */
export function createAuthToken(now: number = Date.now()): string | null {
  const password = getPassword();
  const secret = getSecret();
  if (!password || !secret) return null;
  const issuedAt = Math.floor(now / 1000);
  return `${issuedAt}.${signature(issuedAt, password, secret)}`;
}

export function verifyAuthToken(token: string | undefined, now: number = Date.now()): boolean {
  const password = getPassword();
  const secret = getSecret();
  if (!password || !secret || !token) return false;

  const match = /^(\d{1,12})\.([0-9a-f]{64})$/.exec(token);
  if (!match) return false;
  const issuedAt = Number(match[1]);
  const age = Math.floor(now / 1000) - issuedAt;
  if (age < 0 || age > AUTH_MAX_AGE) return false; // 미래 시각이거나 7일이 지난 토큰은 거부

  const a = Buffer.from(match[2]);
  const b = Buffer.from(signature(issuedAt, password, secret));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPassword(input: string): boolean {
  const password = getPassword();
  if (!password) return false;
  // 길이가 달라도 비교 시간이 같도록 해시끼리 비교한다.
  return timingSafeEqual(sign(input, "compare"), sign(password, "compare"));
}
