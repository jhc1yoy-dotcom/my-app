// PRD에 정한 고정 문구와 숫자 규칙. 다른 파일에 같은 값을 직접 쓰지 않는다.
import type { GuideSite } from "@/lib/types";

/** 모든 결과물 표지/첫 줄 안내문 (PRD must 2 규칙 6) */
export const DISCLAIMER = "AI가 만든 초안입니다. 사용 전 검토가 필요합니다.";
/** 근거가 없을 때 답변 (PRD must 1 규칙 1) */
export const NO_EVIDENCE_MESSAGE = "확인된 자료에서 찾을 수 없습니다.";
/** 개별 사안 안내 (PRD must 1 규칙 5) */
export const DEPT_CHECK_MESSAGE = "최종 판단은 소관 부서에 확인하세요.";
/** 개정 전 자료 표시 (PRD must 1 규칙 3) */
export const SUPERSEDED_LABEL = "(개정 전)";
/** 결과물을 요청 분량보다 짧게 만들었을 때 안내 (n과 단위는 호출하는 쪽에서 채움) */
export const shortenedNotice = (amount: number, unit: "분" | "장") =>
  `자료가 부족해 ${amount}${unit} 분량만 작성했습니다.`;

/** 근거가 없을 때 찾아볼 사이트 (고정, DESIGN 3.1) */
export const GUIDE_SITES: GuideSite[] = [
  { name: "인사혁신처 누리집", url: "https://www.mpm.go.kr" },
  { name: "국가법령정보센터", url: "https://www.law.go.kr" },
];

export const LIMITS = {
  questionMaxChars: 500,
  answerMaxChars: 500,
  citationsMin: 1,
  citationsMax: 3,
  slides: { min: 5, max: 20, default: 10, tolerance: 1 },
  bulletsPerSlideMax: 5,
  lineMaxChars: 30,
  speechMinutes: { min: 1, max: 10, default: 5 },
  speechCharsPerMinute: 300,
  speechTolerance: 0.1,
  speechMaxChars: 3000,
  messagesMax: 3,
} as const;

/** 개별 사안 판정용 낱말 (DESIGN 3.4). ㉠과 ㉡이 함께 있으면 개별 사안. */
// ㉠ 사람을 가리키는 말. "○○씨", "○○ 주무관"처럼 이름 뒤에 붙는 말은 앞 글자와 함께 찾는다.
export const INDIVIDUAL_SUBJECT_PATTERNS: readonly RegExp[] = [
  /제가/,
  /저는/,
  /저의/,
  /(^|\s)제\s/,
  /우리\s?직원/,
  /우리\s?과/,
  /직원이/,
  /부하/,
  /동료/,
  /[가-힣]씨(\s|$|가|는|의|를|에게|도)/,
  /[가-힣]\s?주무관/,
];

export const INDIVIDUAL_JUDGMENT_WORDS = [
  "징계",
  "감봉",
  "견책",
  "정직",
  "해임",
  "파면",
  "승진",
  "전보",
  "전출",
  "휴직 승인",
  "가능한가요",
  "될까요",
  "받을 수 있나요",
] as const;
