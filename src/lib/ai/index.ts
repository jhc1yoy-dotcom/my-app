// AI 호출 계층 (PLAN 7번, DESIGN 3.1·4.3)
// 질문 → 검색 → 답변 만들기 → 규칙 점검을 한곳에서 처리한다.
// 실제 AI로 바꿀 때는 "답변 만들기" 부분만 교체하고, 검색·개별 사안 판정·규칙 점검은 그대로 쓴다.
import type { Answer } from "@/lib/types";
import { GUIDE_SITES, NO_EVIDENCE_MESSAGE } from "@/lib/rules/constants";
import { checkAnswer, isIndividualCase, type Violation } from "@/lib/rules/checks";
import { getCorpus } from "@/lib/search/corpus";
import { search } from "@/lib/search";
import { buildMockAnswer } from "./mock";

/** 실제 AI 연결 시 쓸 모델 (CLAUDE.md: gpt-4o-mini 고정, 이 상수 한 곳에만 적는다) */
export const OPENAI_MODEL = "gpt-4o-mini";

export type AiMode = "mock" | "real";

/** 모의/실제 전환 스위치. 기본값은 mock이며, AI_MODE=real일 때만 실제 AI를 부른다. */
export function getAiMode(): AiMode {
  return process.env.AI_MODE === "real" ? "real" : "mock";
}

/** 규칙 점검에 걸린 답변을 내보내지 않기 위한 오류 */
export class RuleViolationError extends Error {
  constructor(public violations: Violation[]) {
    super(`규칙 점검 실패: ${violations.map((v) => v.rule).join(", ")}`);
  }
}

export function answerQuestion(question: string): Answer {
  const corpus = getCorpus();
  const hits = search(question, corpus.chunks);
  const needsDeptCheck = isIndividualCase(question);

  if (hits.length === 0) {
    return {
      text: NO_EVIDENCE_MESSAGE,
      citations: [],
      noEvidence: true,
      guideSites: GUIDE_SITES,
      needsDeptCheck,
      mock: corpus.mock,
    };
  }

  if (getAiMode() === "real") {
    // 이번 사이클에는 실제 AI를 연결하지 않는다 (PLAN 23번, 사용자 지시 시 구현).
    throw new Error("실제 AI 모드는 아직 연결되지 않았습니다. AI_MODE를 mock으로 두세요.");
  }

  const chunks = hits.map((h) => h.chunk);
  const answer = { ...buildMockAnswer(chunks, needsDeptCheck), mock: corpus.mock };

  const violations = checkAnswer(answer, question, chunks.map((c) => c.text).join("\n"));
  if (violations.length) throw new RuleViolationError(violations);
  return answer;
}
