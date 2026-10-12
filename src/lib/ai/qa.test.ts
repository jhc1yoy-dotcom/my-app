// 시험 질문 20개를 실제 검색 → 답변 만들기 경로로 돌려 채점한다 (PLAN 11번, DESIGN 10장)
// 미리 써 둔 답이 아니라, 매번 검색·조립한 답변을 정답과 비교한다.
import { describe, expect, it } from "vitest";
import type { TestQuestion } from "@/lib/types";
import { checkAnswer } from "@/lib/rules/checks";
import { GUIDE_SITES, NO_EVIDENCE_MESSAGE } from "@/lib/rules/constants";
import testFile from "../../../data/test-questions.json";
import { answerQuestion, getAiMode, OPENAI_MODEL } from "./index";
import { toPolite } from "./mock";

const questions = testFile.questions as TestQuestion[];

describe("AI 계층 설정", () => {
  it("기본값은 모의 모드이고 모델은 gpt-4o-mini로 고정돼 있다", () => {
    expect(getAiMode()).toBe("mock");
    expect(OPENAI_MODEL).toBe("gpt-4o-mini");
  });
});

describe("말투 바꾸기", () => {
  it("규정 문장을 '~습니다'체로 바꾼다", () => {
    expect(toPolite("병가를 받을 수 있다.")).toBe("병가를 받을 수 있습니다.");
    expect(toPolite("이수하여야 한다.")).toBe("이수하여야 합니다.");
    expect(toPolite("승진임용될 수 없다.")).toBe("승진임용될 수 없습니다.");
  });
});

describe("시험 질문 20개", () => {
  it.each(questions.map((q) => [q.id, q] as const))("%s", (_id, q) => {
    const answer = answerQuestion(q.question);

    // 모든 답변은 규칙 점검을 통과해야 한다 (answerQuestion 안에서도 검사하지만 한 번 더 확인).
    expect(checkAnswer(answer, q.question, answer.citations.length ? answer.text : "")).toEqual([]);
    expect(answer.mock).toBe(true);

    if (q.category === "no-evidence") {
      expect(answer.noEvidence).toBe(true);
      expect(answer.citations).toHaveLength(0);
      expect(answer.text).toBe(NO_EVIDENCE_MESSAGE);
      expect(answer.guideSites).toEqual(GUIDE_SITES);
      return;
    }

    expect(answer.noEvidence).toBe(false);
    // 정답 출처가 1순위(첫 출처)로 나온다.
    const first = answer.citations[0];
    const expected = q.expectedCitations[0];
    expect(`${first.docName} ${first.location} ${first.effectiveDate}`).toBe(
      `${expected.docName} ${expected.location} ${expected.effectiveDate}`,
    );
    expect(first.superseded).toBe(false);
    // 핵심 내용이 답변 첫 문장(결론)에 들어 있다.
    const conclusion = answer.text.split("\n")[0];
    q.expectedKeyPoints.forEach((k) => expect(conclusion).toContain(k));

    expect(answer.needsDeptCheck).toBe(q.category === "individual");
  });

  it("개정·변경을 묻는 질문에는 개정 전 자료를 '(개정 전)'으로 표시해 함께 보여 준다", () => {
    const answer = answerQuestion("육아휴직 경력 인정 기준이 예전과 달라졌나요?");
    const old = answer.citations.find((c) => c.superseded);
    expect(old?.effectiveDate).toBe("2024-01-01");
    expect(answer.text).toContain("(개정 전)");
    expect(answer.citations[0].superseded).toBe(false);
  });

  it("개정·변경을 묻지 않으면 개정 전 자료는 빠진다", () => {
    const answer = answerQuestion("육아휴직 기간은 승진 소요 경력에 얼마나 인정되나요?");
    expect(answer.citations.every((c) => !c.superseded)).toBe(true);
  });

  it("PRD 예시 질문 '육아휴직 중 승진할 수 있나요?'에 휴직 중 승진 규정으로 답한다", () => {
    const answer = answerQuestion("육아휴직 중 승진할 수 있나요?");
    expect(answer.citations[0].location).toBe("제7조");
    expect(answer.text.split("\n")[0]).toContain("승진 심사 대상");
  });
});
