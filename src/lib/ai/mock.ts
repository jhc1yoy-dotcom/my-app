// 모의 답변기 (PLAN 8번, DESIGN 3.4)
// AI를 부르지 않고, 검색된 조각을 템플릿으로 조립해 답변을 만든다 (비용 0원).
// 시험 질문에 미리 써 둔 답을 내보내지 않는다.
import type { Answer, Chunk, Citation } from "@/lib/types";
import { LIMITS, SUPERSEDED_LABEL } from "@/lib/rules/constants";
import { countChars } from "@/lib/rules/checks";
import { formatDate } from "@/lib/format";
import { relevantExcerpt } from "./excerpt";

/** 규정 문장의 말끝을 "~습니다"체로 바꾼다 (예: "할 수 있다." → "할 수 있습니다."). */
export function toPolite(sentence: string): string {
  return sentence
    .replace(/할 수 있다\./g, "할 수 있습니다.")
    .replace(/될 수 없다\./g, "될 수 없습니다.")
    .replace(/수 없다\./g, "수 없습니다.")
    .replace(/하여야 한다\./g, "하여야 합니다.")
    .replace(/해야 한다\./g, "해야 합니다.")
    .replace(/한다\./g, "합니다.")
    .replace(/된다\./g, "됩니다.")
    .replace(/이다\./g, "입니다.")
    .replace(/있다\./g, "있습니다.")
    .replace(/없다\./g, "없습니다.");
}

export function toCitation(c: Chunk): Citation {
  return {
    docName: c.docName,
    location: c.location,
    effectiveDate: c.effectiveDate,
    url: c.url,
    superseded: c.superseded,
  };
}

function sourceLabel(c: Chunk): string {
  return `${c.docName} ${c.location}(${formatDate(c.effectiveDate)} 기준)${c.superseded ? ` ${SUPERSEDED_LABEL}` : ""}`;
}

/** 답변에 넣는 조각 내용의 최대 글자 수: 1순위(결론)와 나머지(관련 규정) */
const FIRST_EXCERPT_CHARS = 250;
const REST_EXCERPT_CHARS = 110;

/**
 * 검색된 조각(현행이 앞, 최대 3개)으로 답변 본문과 출처를 만든다.
 * - 첫 문장: 1순위 조각에서 질문과 가장 관련 있는 부분 (결론)
 * - 이어서: 근거 문서, 나머지 조각은 "관련 규정"으로 덧붙인다 (500자를 넘으면 뺀다)
 */
export function buildMockAnswer(chunks: Chunk[], needsDeptCheck: boolean, question = ""): Answer {
  const [first, ...rest] = chunks;
  let text = `${toPolite(relevantExcerpt(first.text, question, FIRST_EXCERPT_CHARS))}\n(근거: ${sourceLabel(first)})`;
  const used: Chunk[] = [first];

  for (const c of rest) {
    const prefix = c.superseded ? "이전 기준" : "관련 규정";
    const addition = `\n\n${prefix}: ${toPolite(relevantExcerpt(c.text, question, REST_EXCERPT_CHARS))}\n(근거: ${sourceLabel(c)})`;
    if (countChars(text + addition) > LIMITS.answerMaxChars) break;
    text += addition;
    used.push(c);
  }

  return {
    text,
    citations: used.map(toCitation),
    noEvidence: false,
    guideSites: [],
    needsDeptCheck,
    mock: true,
  };
}
