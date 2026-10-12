// 접속 비밀번호 토큰 시험 (보안 점검 4번): 발급 시각 포함, 7일 만료, 서명 열쇠 분리
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTH_MAX_AGE, checkPassword, createAuthToken, isPasswordConfigured, verifyAuthToken } from "./auth";

const SECRET = "test-secret-0123456789-abcdefghij-XYZ"; // 32자 이상
const saved = { ...process.env };

beforeEach(() => {
  process.env.APP_PASSWORD = "test-only-1234";
  process.env.AUTH_SECRET = SECRET;
});
afterEach(() => {
  process.env.APP_PASSWORD = saved.APP_PASSWORD;
  process.env.AUTH_SECRET = saved.AUTH_SECRET;
});

describe("접속 토큰", () => {
  it("방금 발급한 토큰은 통과한다", () => {
    const token = createAuthToken()!;
    expect(token).toMatch(/^\d+\.[0-9a-f]{64}$/);
    expect(verifyAuthToken(token)).toBe(true);
  });

  it("7일이 지나면 서버가 거부한다 (브라우저 기한만 믿지 않음)", () => {
    const now = Date.now();
    const token = createAuthToken(now)!;
    expect(verifyAuthToken(token, now + (AUTH_MAX_AGE - 60) * 1000)).toBe(true);
    expect(verifyAuthToken(token, now + (AUTH_MAX_AGE + 60) * 1000)).toBe(false);
  });

  it("발급 시각이나 서명을 고치면 거부한다", () => {
    const token = createAuthToken()!;
    const [issued, sig] = token.split(".");
    expect(verifyAuthToken(`${Number(issued) + 100}.${sig}`)).toBe(false);
    expect(verifyAuthToken(`${issued}.${"0".repeat(64)}`)).toBe(false);
    expect(verifyAuthToken("abc")).toBe(false);
    expect(verifyAuthToken(undefined)).toBe(false);
  });

  it("비밀번호를 바꾸거나 AUTH_SECRET을 바꾸면 기존 토큰이 모두 무효가 된다", () => {
    const token = createAuthToken()!;
    process.env.APP_PASSWORD = "new-password-5678";
    expect(verifyAuthToken(token)).toBe(false);
    process.env.APP_PASSWORD = "test-only-1234";
    process.env.AUTH_SECRET = `${SECRET}-rotated`;
    expect(verifyAuthToken(token)).toBe(false);
  });

  it("AUTH_SECRET이 없거나 32자보다 짧으면 아무도 들어올 수 없다", () => {
    process.env.AUTH_SECRET = "short";
    expect(isPasswordConfigured()).toBe(false);
    expect(createAuthToken()).toBeNull();
    delete process.env.AUTH_SECRET;
    expect(isPasswordConfigured()).toBe(false);
  });

  it("비밀번호 비교는 맞을 때만 통과한다", () => {
    expect(checkPassword("test-only-1234")).toBe(true);
    expect(checkPassword("test-only-123")).toBe(false);
    expect(checkPassword("")).toBe(false);
  });
});
