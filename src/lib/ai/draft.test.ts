// 결과물 만들기 시험 (PLAN 12~17번): 시험 질문의 답변으로 PPT·말씀자료를 여러 분량으로 만들어 규칙을 확인한다.
import { describe, expect, it } from "vitest";
import type { TestQuestion } from "@/lib/types";
import { checkSlides, checkSpeech, countChars, speechCharRange, startsWithDisclaimer } from "@/lib/rules/checks";
import { DISCLAIMER } from "@/lib/rules/constants";
import { formatSpeechText, speechShortenedNotice } from "@/lib/draft/speech";
import { wrapLines } from "@/lib/draft/text";
import { buildPptx } from "@/lib/export/pptx";
import testFile from "../../../data/test-questions.json";
import { answerQuestion } from "./index";
import { getMockCorpus } from "@/lib/search/corpus";
import { allowedTextFor, EvidenceNotFoundError, makeDraft } from "./draft";

const questions = (testFile.questions as TestQuestion[]).filter((q) => q.category !== "no-evidence");
const AUDIENCE = "신규 공무원";
// 정답이 정해진 모의 자료로 시험한다 (실제 자료가 들어와도 시험 결과가 바뀌지 않게).
const MOCK = getMockCorpus();

function draftFor(question: string, kind: "ppt" | "speech", slides = 10, minutes = 5) {
  const answer = answerQuestion(question, MOCK);
  return makeDraft({ question, citations: answer.citations, kind, audience: AUDIENCE, slides, minutes }, MOCK);
}

describe("줄 나누기", () => {
  it("모든 줄이 30자 이내가 된다", () => {
    const lines = wrapLines("휴직 중인 공무원은 승진임용될 수 없다. 다만, 육아휴직 중인 공무원은 승진 심사 대상에 포함될 수 있으며, 승진이 결정되면 복직한 날에 승진임용한다.");
    expect(lines.length).toBeGreaterThan(1);
    lines.forEach((l) => expect(l.length).toBeLessThanOrEqual(30));
  });
});

describe("원고", () => {
  it("핵심 메시지 3개 이내, 근거와 출처가 짝을 이룬다", () => {
    const { manuscript } = draftFor("육아휴직 중 승진할 수 있나요?", "ppt");
    expect(manuscript.messages.length).toBeGreaterThanOrEqual(1);
    expect(manuscript.messages.length).toBeLessThanOrEqual(3);
    expect(manuscript.evidence).toHaveLength(manuscript.citations.length);
    expect(manuscript.title.length).toBeLessThanOrEqual(30);
  });
});

describe("PPT", () => {
  for (const requested of [5, 10, 20]) {
    it.each(questions.map((q) => [q.id, q] as const))(`%s — ${requested}장 요청`, (_id, q) => {
      const r = draftFor(q.question, "ppt", requested);
      const slides = r.slides!;
      expect(checkSlides(slides, requested, allowedTextFor(r.manuscript, [AUDIENCE]), r.shortened)).toEqual([]);
      expect(slides[0].bullets[0]).toBe(DISCLAIMER);
      expect(slides.at(-1)?.kind).toBe("sources");
      if (!r.shortened) expect(Math.abs(slides.length - requested)).toBeLessThanOrEqual(1);
    });
  }

  it("내용이 넉넉한 질문은 10장 요청에 9~11장으로 맞춘다", () => {
    const r = draftFor("육아휴직 중 승진할 수 있나요?", "ppt", 10);
    expect(r.shortened).toBe(false);
    expect(r.slides!.length).toBeGreaterThanOrEqual(9);
    expect(r.slides!.length).toBeLessThanOrEqual(11);
  });

  it(".pptx 파일(압축 형식, PK로 시작)을 만든다", async () => {
    const r = draftFor("육아휴직 중 승진할 수 있나요?", "ppt", 10);
    const file = await buildPptx(r.manuscript.title, r.slides!);
    expect(file.length).toBeGreaterThan(1000);
    expect(file.subarray(0, 2).toString()).toBe("PK");
    // 압축 파일 목록(이름은 압축되지 않음)에 슬라이드 파일이 장수만큼 들어 있다.
    const names = file.toString("latin1");
    const n = r.slides!.length;
    expect(names).toContain(`ppt/slides/slide${n}.xml`);
    expect(names).not.toContain(`ppt/slides/slide${n + 1}.xml`);
  });
});

describe("말씀자료", () => {
  for (const minutes of [1, 5, 10]) {
    it.each(questions.map((q) => [q.id, q] as const))(`%s — ${minutes}분 요청`, (_id, q) => {
      const r = draftFor(q.question, "speech", 10, minutes);
      const speech = r.speech!;
      expect(checkSpeech(speech, allowedTextFor(r.manuscript, [AUDIENCE]))).toEqual([]);
      const chars = countChars(speech.body);
      const range = speechCharRange(minutes);
      expect(chars).toBeLessThanOrEqual(Math.min(range.max, 3000));
      if (!speech.shortened) expect(chars).toBeGreaterThanOrEqual(range.min);

      const txt = formatSpeechText(speech, r.manuscript.title);
      expect(startsWithDisclaimer(txt)).toBe(true);
      expect(txt).toContain("\n출처\n");
      if (speech.shortened) expect(txt).toContain("자료가 부족해");
    });
  }

  it("분량 부족 안내는 실제 분량을 알려 주고, 1분이 안 되면 따로 표현한다", () => {
    const base = { minutes: 5, citations: [], shortened: true };
    expect(speechShortenedNotice({ ...base, body: "가".repeat(100) })).toBe("자료가 부족해 1분이 안 되는 분량만 작성했습니다.");
    expect(speechShortenedNotice({ ...base, body: "가".repeat(700) })).toBe("자료가 부족해 2분 분량만 작성했습니다.");
  });

  it("1분 요청은 근거가 넉넉하면 분량 부족 없이 270~330자로 맞춘다", () => {
    const r = draftFor("육아휴직 중 승진할 수 있나요?", "speech", 10, 1);
    expect(r.speech!.shortened).toBe(false);
  });
});

describe("잘못된 출처", () => {
  it("자료 묶음에 없는 출처로는 결과물을 만들지 않는다", () => {
    expect(() =>
      makeDraft({
        question: "가짜 질문",
        citations: [{ docName: "없는 문서", location: "제1조", effectiveDate: "2025-01-01", url: null, superseded: false }],
        kind: "ppt",
        audience: AUDIENCE,
        slides: 10,
        minutes: 5,
      }),
    ).toThrow(EvidenceNotFoundError);
  });
});
