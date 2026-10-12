// 모의 원고 생성기 (PLAN 12번, PRD must 2 규칙 1)
// 결과물은 반드시 이 원고만 보고 만든다. 원고는 근거 조각의 내용만으로 조립한다.
import type { Chunk, Manuscript } from "@/lib/types";
import { LIMITS } from "@/lib/rules/constants";
import { splitSentences, truncate } from "@/lib/draft/text";
import { relevantExcerpt } from "./excerpt";
import { toCitation, toPolite } from "./mock";

/** 질문을 결과물 제목으로 바꾼다 (물음표·말끝 정리, 30자 이내). */
export function questionToTitle(question: string): string {
  const cleaned = question
    .trim()
    .replace(/[?？!]+$/, "")
    .replace(/(할 수 있나요|수 있나요|있나요|인가요|되나요|하나요|할까요|될까요|나요)$/, "")
    .trim();
  return truncate(`${cleaned} 안내`);
}

/**
 * 조각에서 핵심 메시지를 뽑는다: 첫 문장 + 바로 뒤의 "다만/단,"으로 시작하는 문장.
 * (예외 조항을 빼면 "휴직 중에는 승진할 수 없다"처럼 뜻이 거꾸로 전달될 수 있다.)
 */
export function keyMessage(text: string): string {
  const [first, ...rest] = splitSentences(text);
  if (!first) return "";
  const exceptions: string[] = [];
  for (const s of rest) {
    if (/^(다만|단,|단서)/.test(s)) exceptions.push(s);
    else break;
  }
  return [first, ...exceptions].join(" ");
}

/** 핵심 메시지·근거 하나의 최대 글자 수 (실제 자료의 긴 쪽에서 질문과 관련된 부분만 쓰기 위함) */
const MESSAGE_MAX_CHARS = 200;
const EVIDENCE_MAX_CHARS = 400;

/**
 * 근거 조각(현행이 앞)으로 원고를 만든다.
 * - 핵심 메시지: 현행 조각마다 첫 문장(+다만 문장). 긴 조각은 질문과 가장 관련 있는 부분 (최대 3개)
 * - 근거: 조각 내용 ("~습니다"체, 긴 조각은 관련 부분 400자 이내). evidence[i]는 citations[i]의 내용이다.
 */
export function buildMockManuscript(question: string, chunks: Chunk[]): Manuscript {
  const current = chunks.filter((c) => !c.superseded);
  const messages = current
    .map((c) => {
      const text = toPolite(c.text);
      return text.length <= MESSAGE_MAX_CHARS ? keyMessage(text) : relevantExcerpt(text, question, MESSAGE_MAX_CHARS);
    })
    .filter(Boolean)
    .slice(0, LIMITS.messagesMax);
  const evidence = chunks.map((c) => relevantExcerpt(toPolite(c.text), question, EVIDENCE_MAX_CHARS));
  return {
    title: questionToTitle(question),
    messages,
    evidence,
    citations: chunks.map(toCitation),
  };
}
