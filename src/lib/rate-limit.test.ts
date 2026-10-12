// 비밀번호 시도 횟수 제한 시험 (보안 점검 1번)
import { beforeEach, describe, expect, it } from "vitest";
import { blockedSeconds, clientIp, RATE_LIMIT, recordFailure, recordSuccess, resetRateLimit } from "./rate-limit";

const T = 1_000_000_000_000; // 기준 시각

beforeEach(() => resetRateLimit());

describe("비밀번호 시도 횟수 제한", () => {
  it("1분에 5번까지는 막지 않고, 6번째에 5분 동안 막는다", () => {
    for (let i = 0; i < RATE_LIMIT.perIp; i++) recordFailure("1.1.1.1", T + i);
    expect(blockedSeconds("1.1.1.1", T + 10)).toBe(0);
    recordFailure("1.1.1.1", T + 20);
    expect(blockedSeconds("1.1.1.1", T + 30)).toBe(300);
    expect(blockedSeconds("1.1.1.1", T + 20 + RATE_LIMIT.blockMs + 1)).toBe(0);
  });

  it("다른 접속지는 막히지 않는다", () => {
    for (let i = 0; i <= RATE_LIMIT.perIp; i++) recordFailure("1.1.1.1", T + i);
    expect(blockedSeconds("2.2.2.2", T + 10)).toBe(0);
  });

  it("1분이 지난 실패는 세지 않는다", () => {
    for (let i = 0; i < RATE_LIMIT.perIp; i++) recordFailure("1.1.1.1", T + i);
    recordFailure("1.1.1.1", T + RATE_LIMIT.windowMs + 100);
    expect(blockedSeconds("1.1.1.1", T + RATE_LIMIT.windowMs + 200)).toBe(0);
  });

  it("맞히면 그 접속지의 실패 기록이 지워진다", () => {
    for (let i = 0; i < RATE_LIMIT.perIp; i++) recordFailure("1.1.1.1", T + i);
    recordSuccess("1.1.1.1");
    recordFailure("1.1.1.1", T + 10);
    expect(blockedSeconds("1.1.1.1", T + 20)).toBe(0);
  });

  it("여러 접속지에서 나눠 시도해도 전체 실패가 1분에 30번을 넘으면 모두 막는다", () => {
    for (let i = 0; i <= RATE_LIMIT.global; i++) recordFailure(`10.0.0.${i}`, T + i);
    expect(blockedSeconds("9.9.9.9", T + 100)).toBeGreaterThan(0);
  });

  it("접속지는 x-forwarded-for의 첫 값을 쓴다", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "3.3.3.3, 10.0.0.1" }))).toBe("3.3.3.3");
    expect(clientIp(new Headers({ "x-real-ip": "4.4.4.4" }))).toBe("4.4.4.4");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
