// API 입력 검사 시험: 결과물 요청은 고른 종류의 분량만 검사한다 (ANALYSIS M-3)
import { describe, expect, it } from "vitest";
import { DraftSchema } from "./schemas";

const base = {
  question: "육아휴직 중 승진할 수 있나요?",
  citations: [{ docName: "(모의) 공무원 휴직 예시 규정", location: "제7조", effectiveDate: "2025-01-01", url: null, superseded: false }],
  audience: "신규 공무원",
};

describe("결과물 요청 검사", () => {
  it("PPT 요청이면 말씀자료 분량(15분)이 범위 밖이어도 통과하고, 기본값으로 채운다", () => {
    const r = DraftSchema.safeParse({ ...base, kind: "ppt", slides: 12, minutes: 15 });
    expect(r.success).toBe(true);
    if (r.success) expect([r.data.slides, r.data.minutes]).toEqual([12, 5]);
  });

  it("말씀자료 요청이면 분량(분)만 검사한다", () => {
    const bad = DraftSchema.safeParse({ ...base, kind: "speech", minutes: 15, slides: 99 });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0].message).toContain("말씀자료는 1~10분");
    const ok = DraftSchema.safeParse({ ...base, kind: "speech", minutes: "3", slides: 99 });
    expect(ok.success && [ok.data.minutes, ok.data.slides]).toEqual([3, 10]);
  });

  it("PPT 장수가 범위 밖이거나 정수가 아니면 거부하고, 빠지면 기본 10장이다", () => {
    expect(DraftSchema.safeParse({ ...base, kind: "ppt", slides: 25 }).success).toBe(false);
    expect(DraftSchema.safeParse({ ...base, kind: "ppt", slides: 7.5 }).success).toBe(false);
    const r = DraftSchema.safeParse({ ...base, kind: "ppt" });
    expect(r.success && r.data.slides).toBe(10);
  });
});
