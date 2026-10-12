// 비밀번호 시도 횟수 제한 (보안 점검 1번, 서버 전용)
// - 같은 접속지(IP)에서 1분에 5번 넘게 틀리면 그 접속지를 5분 동안 막는다.
// - 여러 곳에서 나눠 시도하는 것에 대비해, 전체 실패가 1분에 30번을 넘으면 5분 동안 모두 막는다.
// - 맞히면 그 접속지의 실패 기록을 지운다.
// 주의: 서버 메모리에 기록하므로 서버가 여러 대로 나뉘면 각자 따로 센다 (데이터베이스를 쓰지 않는 PRD 원칙).
//      배포할 때는 Vercel 방화벽(WAF)의 요청 제한 규칙을 함께 켜서 보완한다.

export const RATE_LIMIT = {
  windowMs: 60_000, // 실패를 세는 구간: 1분
  perIp: 5, // 접속지 하나가 구간 안에 틀릴 수 있는 횟수
  global: 30, // 전체가 구간 안에 틀릴 수 있는 횟수
  blockMs: 5 * 60_000, // 넘으면 막는 시간: 5분
  maxTracked: 10_000, // 기억하는 접속지 수 상한 (메모리 보호)
} as const;

interface Record {
  failures: number[]; // 실패 시각들
  blockedUntil: number;
}

const byIp = new Map<string, Record>();
let globalFailures: number[] = [];
let globalBlockedUntil = 0;

const recent = (times: number[], now: number) => times.filter((t) => now - t < RATE_LIMIT.windowMs);

/** 지금 이 접속지의 시도를 막아야 하면 남은 초를, 아니면 0을 돌려준다. */
export function blockedSeconds(ip: string, now: number = Date.now()): number {
  const until = Math.max(globalBlockedUntil, byIp.get(ip)?.blockedUntil ?? 0);
  return until > now ? Math.ceil((until - now) / 1000) : 0;
}

/** 틀린 시도를 기록한다. */
export function recordFailure(ip: string, now: number = Date.now()): void {
  const rec = byIp.get(ip) ?? { failures: [], blockedUntil: 0 };
  rec.failures = [...recent(rec.failures, now), now];
  if (rec.failures.length > RATE_LIMIT.perIp) rec.blockedUntil = now + RATE_LIMIT.blockMs;
  byIp.delete(ip); // 최근에 쓴 것을 뒤로 보낸다 (오래된 것부터 지우기 위함)
  byIp.set(ip, rec);
  if (byIp.size > RATE_LIMIT.maxTracked) byIp.delete(byIp.keys().next().value!);

  globalFailures = [...recent(globalFailures, now), now];
  if (globalFailures.length > RATE_LIMIT.global) globalBlockedUntil = now + RATE_LIMIT.blockMs;
}

/** 맞힌 접속지의 실패 기록을 지운다. */
export function recordSuccess(ip: string): void {
  byIp.delete(ip);
}

/** 시험용: 기록을 모두 지운다. */
export function resetRateLimit(): void {
  byIp.clear();
  globalFailures = [];
  globalBlockedUntil = 0;
}

/** 요청 머리글에서 접속지(IP)를 꺼낸다. Vercel은 x-forwarded-for의 첫 값이 실제 접속지다. */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}
