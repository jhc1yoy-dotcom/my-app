// 규칙 점검기 (PLAN 2번, DESIGN 3장·10장)
// 답변·슬라이드·말씀자료가 PRD 규칙을 지키는지 검사하고, 어긴 항목을 목록으로 돌려준다.
// 빈 목록이면 통과다.
import type { Answer, Citation, Slide, Speech } from "@/lib/types";
import {
  DISCLAIMER,
  GUIDE_SITES,
  INDIVIDUAL_JUDGMENT_WORDS,
  INDIVIDUAL_SUBJECT_PATTERNS,
  LIMITS,
  NO_EVIDENCE_MESSAGE,
} from "./constants";

export interface Violation {
  rule: string;
  message: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 글자 수: 줄바꿈만 빼고 띄어쓰기는 포함해 센다. */
export function countChars(text: string): number {
  return text.replace(/\r?\n/g, "").length;
}

/** 개별 사안 질문인지 판정한다 (사람을 가리키는 말 + 판단을 묻는 말). */
export function isIndividualCase(question: string): boolean {
  const hasSubject = INDIVIDUAL_SUBJECT_PATTERNS.some((p) => p.test(question));
  const hasJudgment = INDIVIDUAL_JUDGMENT_WORDS.some((w) => question.includes(w));
  return hasSubject && hasJudgment;
}

/**
 * 글 속 숫자를 뽑는다. 쉼표는 지우고 앞자리 0은 뗀다 (예: "1,500자" → "1500", "07" → "7").
 * 점은 숫자를 나누는 것으로 본다 ("2025.1.1." → 2025, 1, 1 / "1.5배" → 1, 5).
 * 근거 글도 같은 방식으로 나누므로 날짜·소수 모두 같은 기준으로 비교된다.
 */
export function extractNumbers(text: string): string[] {
  const matches = text.match(/\d[\d,]*/g) ?? [];
  return matches.map((m) => m.replace(/,/g, "").replace(/^0+(?=\d)/, ""));
}

/** 결과물에 나온 숫자 중 근거 글에 없는 숫자를 돌려준다 (PRD must 2 규칙 5). */
export function findUnsupportedNumbers(output: string, allowedText: string): string[] {
  const allowed = new Set(extractNumbers(allowedText));
  return [...new Set(extractNumbers(output))].filter((n) => !allowed.has(n));
}

/** 출처를 숫자 검사에 쓸 글로 바꾼다 (시행일 숫자도 허용 목록에 넣기 위함). */
export function citationsToText(citations: Citation[]): string {
  return citations
    .map((c) => `${c.docName} ${c.location} ${c.effectiveDate} ${c.effectiveDate.replace(/-/g, ".")}`)
    .join("\n");
}

function checkCitation(c: Citation, index: number): Violation[] {
  const v: Violation[] = [];
  const label = `출처 ${index + 1}`;
  if (!c.docName.trim()) v.push({ rule: "citation-docname", message: `${label}에 문서명이 없습니다.` });
  if (!c.location.trim()) v.push({ rule: "citation-location", message: `${label}에 조항(쪽)이 없습니다.` });
  if (!DATE_PATTERN.test(c.effectiveDate))
    v.push({ rule: "citation-date", message: `${label}의 시행일(게시일) 형식이 올바르지 않습니다.` });
  return v;
}

function checkCitationCount(citations: Citation[], what: string): Violation[] {
  const { citationsMin, citationsMax } = LIMITS;
  if (citations.length < citationsMin || citations.length > citationsMax) {
    return [
      {
        rule: "citation-count",
        message: `${what}의 출처는 ${citationsMin}~${citationsMax}개여야 합니다 (현재 ${citations.length}개).`,
      },
    ];
  }
  return [];
}

/**
 * 답변 점검 (PRD must 1)
 * @param question 사용자 질문 (개별 사안 판정용)
 * @param evidenceText 답변에 쓴 근거 조각 본문 (숫자 검사용)
 */
export function checkAnswer(answer: Answer, question: string, evidenceText: string): Violation[] {
  const v: Violation[] = [];

  if (answer.noEvidence) {
    if (answer.citations.length !== 0)
      v.push({ rule: "no-evidence-citations", message: "근거 없음 답변에는 출처가 없어야 합니다." });
    if (!answer.text.startsWith(NO_EVIDENCE_MESSAGE))
      v.push({ rule: "no-evidence-message", message: `근거 없음 답변은 "${NO_EVIDENCE_MESSAGE}"로 시작해야 합니다.` });
    const urls = answer.guideSites.map((s) => s.url);
    if (!GUIDE_SITES.every((s) => urls.includes(s.url)))
      v.push({ rule: "no-evidence-guide", message: "근거 없음 답변에 찾아볼 사이트가 빠졌습니다." });
  } else {
    v.push(...checkCitationCount(answer.citations, "답변"));
    answer.citations.forEach((c, i) => v.push(...checkCitation(c, i)));
    const unsupported = findUnsupportedNumbers(
      answer.text,
      `${evidenceText}\n${citationsToText(answer.citations)}`,
    );
    if (unsupported.length)
      v.push({ rule: "unsupported-number", message: `근거에 없는 숫자가 있습니다: ${unsupported.join(", ")}` });
  }

  if (countChars(answer.text) > LIMITS.answerMaxChars)
    v.push({ rule: "answer-length", message: `답변은 ${LIMITS.answerMaxChars}자 이내여야 합니다.` });

  if (isIndividualCase(question) && !answer.needsDeptCheck)
    v.push({ rule: "dept-check", message: "개별 사안 질문인데 소관 부서 확인 문구가 빠졌습니다." });

  return v;
}

/**
 * 슬라이드 점검 (PRD must 2 규칙 2·3·5·6)
 * @param requested 요청 장수 (5~20, 표지·출처 장 포함)
 * @param allowedText 원고·근거 글 (숫자 검사용)
 * @param shortened 자료가 모자라 요청보다 짧게 만들었는지
 */
export function checkSlides(
  slides: Slide[],
  requested: number,
  allowedText: string,
  shortened = false,
): Violation[] {
  const v: Violation[] = [];
  const { min, max, tolerance } = LIMITS.slides;

  if (requested < min || requested > max)
    v.push({ rule: "slides-request", message: `요청 장수는 ${min}~${max}장이어야 합니다.` });

  const n = slides.length;
  if (shortened) {
    // 표지·본문·출처 최소 3장은 있어야 하고, 요청보다 많을 수는 없다.
    if (n < 3 || n > requested)
      v.push({ rule: "slides-count", message: `분량 부족 결과물은 3~${requested}장이어야 합니다 (현재 ${n}장).` });
  } else if (Math.abs(n - requested) > tolerance) {
    v.push({ rule: "slides-count", message: `요청 ${requested}장의 ±${tolerance}장 이내여야 합니다 (현재 ${n}장).` });
  }

  if (slides[0]?.kind !== "cover" || !slides[0].bullets.includes(DISCLAIMER))
    v.push({ rule: "disclaimer", message: "첫 장(표지)에 AI 초안 안내문이 없습니다." });

  const last = slides[n - 1];
  if (last?.kind !== "sources" || last.bullets.length === 0)
    v.push({ rule: "sources-slide", message: "마지막 장은 출처 목록이어야 합니다." });

  slides.forEach((s, i) => {
    if (s.no !== i + 1) v.push({ rule: "slide-no", message: `${i + 1}번째 장의 번호가 ${s.no}입니다.` });
    if (s.bullets.length > LIMITS.bulletsPerSlideMax)
      v.push({ rule: "bullets-count", message: `${s.no}장 글머리가 ${LIMITS.bulletsPerSlideMax}개를 넘습니다.` });
    [s.title, ...s.bullets].forEach((line) => {
      if (countChars(line) > LIMITS.lineMaxChars)
        v.push({ rule: "line-length", message: `${s.no}장에 ${LIMITS.lineMaxChars}자를 넘는 줄이 있습니다: "${line}"` });
    });
  });

  // 표지(안내문)와 출처 장(시행일)은 숫자 검사에서 뺀다.
  const bodyText = slides
    .filter((s) => s.kind === "body")
    .flatMap((s) => [s.title, ...s.bullets])
    .join("\n");
  const unsupported = findUnsupportedNumbers(bodyText, allowedText);
  if (unsupported.length)
    v.push({ rule: "unsupported-number", message: `근거에 없는 숫자가 있습니다: ${unsupported.join(", ")}` });

  return v;
}

/** 말씀자료 목표 글자 수 범위 (본문 기준). 최대 3,000자를 넘지 않는다. */
export function speechCharRange(minutes: number): { min: number; max: number } {
  const target = minutes * LIMITS.speechCharsPerMinute;
  return {
    min: Math.round(target * (1 - LIMITS.speechTolerance)),
    max: Math.min(Math.round(target * (1 + LIMITS.speechTolerance)), LIMITS.speechMaxChars),
  };
}

/**
 * 말씀자료 점검 (PRD must 2 규칙 4·5, 7장 ①)
 * @param allowedText 원고·근거 글 (숫자 검사용)
 */
export function checkSpeech(speech: Speech, allowedText: string): Violation[] {
  const v: Violation[] = [];
  const { min, max } = LIMITS.speechMinutes;

  if (speech.minutes < min || speech.minutes > max)
    v.push({ rule: "speech-minutes", message: `말씀자료 분량은 ${min}~${max}분이어야 합니다.` });

  const chars = countChars(speech.body);
  const range = speechCharRange(speech.minutes);
  if (chars > range.max)
    v.push({ rule: "speech-length", message: `본문이 ${range.max}자를 넘습니다 (현재 ${chars}자).` });
  if (!speech.shortened && chars < range.min)
    v.push({ rule: "speech-length", message: `본문이 ${range.min}자보다 짧습니다 (현재 ${chars}자).` });

  // "~습니다"체: 모든 문장이 "니다." 또는 "니까."/"니까?"로 끝나야 한다 (예: "안녕하십니까.").
  const sentences = speech.body
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const bad = sentences.filter((s) => !/(니다\.|니까[.?])$/.test(s));
  if (bad.length)
    v.push({ rule: "speech-style", message: `"~습니다"체가 아닌 문장이 있습니다: "${bad[0]}"` });

  v.push(...checkCitationCount(speech.citations, "말씀자료"));
  speech.citations.forEach((c, i) => v.push(...checkCitation(c, i)));

  const unsupported = findUnsupportedNumbers(speech.body, allowedText);
  if (unsupported.length)
    v.push({ rule: "unsupported-number", message: `근거에 없는 숫자가 있습니다: ${unsupported.join(", ")}` });

  return v;
}

/** 내려받는 결과물(.txt 등)의 첫 줄이 AI 초안 안내문인지 확인한다. */
export function startsWithDisclaimer(text: string): boolean {
  return text.split(/\r?\n/)[0]?.trim() === DISCLAIMER;
}
