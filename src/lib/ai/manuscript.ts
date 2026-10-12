// 모의 원고 생성기 (PLAN 12번, PRD must 2 규칙 1)
// 결과물은 반드시 이 원고만 보고 만든다. 원고는 근거 조각의 내용만으로 조립한다.
import type { Chunk, Manuscript } from "@/lib/types";
import { LIMITS } from "@/lib/rules/constants";
import { splitSentences, truncate } from "@/lib/draft/text";
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

/**
 * 근거 조각(현행이 앞)으로 원고를 만든다.
 * - 핵심 메시지: 현행 조각마다 첫 문장 (최대 3개)
 * - 근거: 조각 전체 내용 ("~습니다"체). evidence[i]는 citations[i]의 내용이다 (개정 전 여부는 출처에 표시).
 */
export function buildMockManuscript(question: string, chunks: Chunk[]): Manuscript {
  const current = chunks.filter((c) => !c.superseded);
  const messages = current
    .map((c) => keyMessage(toPolite(c.text)))
    .filter(Boolean)
    .slice(0, LIMITS.messagesMax);
  const evidence = chunks.map((c) => toPolite(c.text));
  return {
    title: questionToTitle(question),
    messages,
    evidence,
    citations: chunks.map(toCitation),
  };
}
