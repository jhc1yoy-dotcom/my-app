// 규칙 점검기 자동 시험 (npm test)
import { describe, expect, it } from "vitest";
import type { Answer, Citation, Slide, Speech } from "@/lib/types";
import {
  checkAnswer,
  checkSlides,
  checkSpeech,
  countChars,
  extractNumbers,
  findUnsupportedNumbers,
  isIndividualCase,
  speechCharRange,
  startsWithDisclaimer,
} from "./checks";
import { DISCLAIMER, GUIDE_SITES, NO_EVIDENCE_MESSAGE } from "./constants";

const cite: Citation = {
  docName: "(모의) 공무원 휴직 예시 규정",
  location: "제3조",
  effectiveDate: "2025-01-01",
  url: null,
  superseded: false,
};
const evidence = "공무원은 만 8세 이하 자녀를 양육하기 위하여 자녀 1명당 3년 이내의 육아휴직을 할 수 있다.";

const okAnswer: Answer = {
  text: "육아휴직은 자녀 1명당 3년 이내로 할 수 있습니다.",
  citations: [cite],
  noEvidence: false,
  guideSites: [],
  needsDeptCheck: false,
  mock: true,
};

const rules = (v: { rule: string }[]) => v.map((x) => x.rule);

describe("숫자 검사", () => {
  it("쉼표와 앞자리 0을 정리해 숫자를 뽑는다", () => {
    expect(extractNumbers("1,500자, 2025-07-01")).toEqual(["1500", "2025", "7", "1"]);
  });
  it("근거에 없는 숫자만 돌려준다", () => {
    expect(findUnsupportedNumbers("3년, 5년", evidence)).toEqual(["5"]);
  });
});

describe("개별 사안 판정", () => {
  it.each([
    ["제가 작년에 견책을 받았는데 올해 승진할 수 있나요?", true],
    ["우리 직원이 정직 처분을 받으면 보수는 어떻게 되나요?", true],
    ["김철수 주무관 징계 가능한가요?", true],
    ["육아휴직 중에도 승진할 수 있나요?", false],
    ["징계의 종류에는 어떤 것이 있나요?", false],
    ["제5조의 내용을 알려주세요", false],
  ])("%s → %s", (q, expected) => {
    expect(isIndividualCase(q)).toBe(expected);
  });
});

describe("답변 점검", () => {
  it("규칙을 지킨 답변은 통과한다", () => {
    expect(checkAnswer(okAnswer, "육아휴직은 몇 년까지 되나요?", evidence)).toEqual([]);
  });

  it("출처가 없거나 4개 이상이면 걸린다", () => {
    expect(rules(checkAnswer({ ...okAnswer, citations: [] }, "질문", evidence))).toContain("citation-count");
    const four = [cite, cite, cite, cite];
    expect(rules(checkAnswer({ ...okAnswer, citations: four }, "질문", evidence))).toContain("citation-count");
  });

  it("출처의 시행일 형식이 틀리면 걸린다", () => {
    const bad = { ...okAnswer, citations: [{ ...cite, effectiveDate: "2025.1.1" }] };
    expect(rules(checkAnswer(bad, "질문", evidence))).toContain("citation-date");
  });

  it("500자를 넘으면 걸린다", () => {
    const long = { ...okAnswer, text: "가".repeat(501) };
    expect(rules(checkAnswer(long, "질문", evidence))).toContain("answer-length");
  });

  it("근거에 없는 숫자가 있으면 걸린다", () => {
    const made = { ...okAnswer, text: "육아휴직은 5년까지 됩니다." };
    expect(rules(checkAnswer(made, "질문", evidence))).toContain("unsupported-number");
  });

  it("출처의 시행일 숫자는 본문에 써도 된다", () => {
    const withDate = { ...okAnswer, text: "2025.1.1. 시행 규정에 따라 3년 이내입니다." };
    expect(checkAnswer(withDate, "질문", evidence)).toEqual([]);
  });

  it("개별 사안인데 소관 부서 문구가 없으면 걸린다", () => {
    const q = "제가 육아휴직 중에 승진할 수 있나요?";
    expect(rules(checkAnswer(okAnswer, q, evidence))).toContain("dept-check");
    expect(checkAnswer({ ...okAnswer, needsDeptCheck: true }, q, evidence)).toEqual([]);
  });

  it("근거 없음 답변은 출처 0개 + 안내 문구 + 찾아볼 사이트면 통과한다", () => {
    const none: Answer = {
      text: NO_EVIDENCE_MESSAGE,
      citations: [],
      noEvidence: true,
      guideSites: GUIDE_SITES,
      needsDeptCheck: false,
      mock: true,
    };
    expect(checkAnswer(none, "공무원 연금은 언제 받나요?", "")).toEqual([]);
    expect(rules(checkAnswer({ ...none, guideSites: [] }, "질문", ""))).toContain("no-evidence-guide");
    expect(rules(checkAnswer({ ...none, citations: [cite] }, "질문", ""))).toContain("no-evidence-citations");
  });
});

/** 표지 + 본문 n장 + 출처로 이루어진 슬라이드 묶음 */
function makeSlides(total: number): Slide[] {
  const slides: Slide[] = [{ no: 1, title: "육아휴직 안내", bullets: [DISCLAIMER], kind: "cover" }];
  for (let i = 2; i < total; i++) {
    slides.push({ no: i, title: "핵심 내용", bullets: ["자녀 1명당 3년 이내"], kind: "body" });
  }
  slides.push({
    no: total,
    title: "출처",
    bullets: ["(모의) 공무원 휴직 예시 규정", "제3조 · 2025.1.1."],
    kind: "sources",
  });
  return slides;
}

describe("슬라이드 점검", () => {
  it("요청 장수(표지·출처 포함)와 같으면 통과한다", () => {
    expect(checkSlides(makeSlides(10), 10, evidence)).toEqual([]);
  });

  it("±1장까지는 통과, 2장 차이는 걸린다", () => {
    expect(checkSlides(makeSlides(11), 10, evidence)).toEqual([]);
    expect(rules(checkSlides(makeSlides(8), 10, evidence))).toContain("slides-count");
  });

  it("분량 부족 표시가 있으면 짧아도 통과한다", () => {
    expect(checkSlides(makeSlides(5), 10, evidence, true)).toEqual([]);
  });

  it("요청 장수가 5~20장 밖이면 걸린다", () => {
    expect(rules(checkSlides(makeSlides(21), 21, evidence))).toContain("slides-request");
  });

  it("표지 안내문·출처 장이 없으면 걸린다", () => {
    const slides = makeSlides(10);
    slides[0] = { ...slides[0], bullets: [] };
    slides[9] = { ...slides[9], kind: "body" };
    const r = rules(checkSlides(slides, 10, evidence));
    expect(r).toContain("disclaimer");
    expect(r).toContain("sources-slide");
  });

  it("글머리 6개, 30자 넘는 줄, 근거 없는 숫자는 걸린다", () => {
    const slides = makeSlides(10);
    slides[1] = { ...slides[1], bullets: ["가", "나", "다", "라", "마", "바"] };
    slides[2] = { ...slides[2], bullets: ["가".repeat(31)] };
    slides[3] = { ...slides[3], bullets: ["최대 7년까지 가능"] };
    const r = rules(checkSlides(slides, 10, evidence));
    expect(r).toContain("bullets-count");
    expect(r).toContain("line-length");
    expect(r).toContain("unsupported-number");
  });
});

describe("말씀자료 점검", () => {
  const sentence = "육아휴직은 자녀 1명당 3년 이내로 할 수 있습니다. ";
  const body = (chars: number) => sentence.repeat(Math.ceil(chars / sentence.length)).slice(0, chars).trim();

  it("분량 범위는 ±10%이고 최대 3,000자다", () => {
    expect(speechCharRange(5)).toEqual({ min: 1350, max: 1650 });
    expect(speechCharRange(10)).toEqual({ min: 2700, max: 3000 });
  });

  it("문장 단위로 맞춘 1분 분량 본문은 통과한다", () => {
    const text = sentence.repeat(10).trim(); // 약 300자
    const speech: Speech = { body: text, minutes: 1, citations: [cite], shortened: false };
    expect(countChars(text)).toBeGreaterThanOrEqual(270);
    expect(checkSpeech(speech, evidence)).toEqual([]);
  });

  it("너무 짧으면 걸리고, 분량 부족 표시가 있으면 통과한다", () => {
    const speech: Speech = { body: sentence.trim(), minutes: 5, citations: [cite], shortened: false };
    expect(rules(checkSpeech(speech, evidence))).toContain("speech-length");
    expect(checkSpeech({ ...speech, shortened: true }, evidence)).toEqual([]);
  });

  it("3,000자를 넘으면 걸린다", () => {
    const speech: Speech = { body: body(3100), minutes: 10, citations: [cite], shortened: false };
    expect(rules(checkSpeech(speech, evidence))).toContain("speech-length");
  });

  it("'~습니다'체가 아니거나 출처가 없으면 걸린다", () => {
    const speech: Speech = { body: "육아휴직은 3년 이내로 할 수 있다.", minutes: 1, citations: [], shortened: true };
    const r = rules(checkSpeech(speech, evidence));
    expect(r).toContain("speech-style");
    expect(r).toContain("citation-count");
  });
});

describe("안내문 첫 줄", () => {
  it("첫 줄이 안내문이어야 한다", () => {
    expect(startsWithDisclaimer(`${DISCLAIMER}\n\n본문`)).toBe(true);
    expect(startsWithDisclaimer(`본문\n${DISCLAIMER}`)).toBe(false);
  });
});
