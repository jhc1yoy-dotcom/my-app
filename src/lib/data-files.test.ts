// data 폴더의 JSON 파일이 정한 형식과 규칙을 지키는지 확인하는 시험 (PLAN 3~5번)
import { describe, expect, it } from "vitest";
import type { Chunk, Source, TestQuestion } from "@/lib/types";
import { isIndividualCase } from "@/lib/rules/checks";
import sourcesFile from "../../data/sources.json";
import corpusFile from "../../data/corpus.json";
import mockFile from "../../data/corpus.mock.json";
import testFile from "../../data/test-questions.json";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const sources = sourcesFile.sources as Source[];
const mockChunks = mockFile.chunks as Chunk[];
const realChunks = corpusFile.chunks as Chunk[];
const questions = testFile.questions as TestQuestion[];

describe("수집 목록 (sources.json)", () => {
  it("id가 겹치지 않는다", () => {
    const ids = sources.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("켜진 항목은 공공누리 유형이 있고, 법령은 법령명·지침은 첨부파일 주소가 있다", () => {
    for (const s of sources.filter((x) => x.enabled)) {
      expect(s.kogl.trim(), s.id).not.toBe("");
      if (s.kind === "law") expect(s.lawName?.trim(), s.id).toBeTruthy();
      else expect(s.fileUrl, s.id).toMatch(/^https:\/\/.+\.(pdf|hwpx)$/i);
    }
  });
});

describe("모의 자료 (corpus.mock.json)", () => {
  it("모든 조각이 형식을 지키고 모의 자료로 표시돼 있다", () => {
    for (const c of mockChunks) {
      expect(c.docName.startsWith("(모의)"), c.id).toBe(true);
      expect(c.location.trim(), c.id).not.toBe("");
      expect(c.text.trim(), c.id).not.toBe("");
      expect(c.effectiveDate, c.id).toMatch(DATE);
      expect(c.mock, c.id).toBe(true);
      expect(c.url, c.id).toBeNull();
    }
  });

  it("id가 겹치지 않는다", () => {
    const ids = mockChunks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("개정 전·후 1쌍이 있고, 시행일이 늦은 쪽만 현행이다", () => {
    const groups = new Map<string, Chunk[]>();
    for (const c of mockChunks) {
      const key = `${c.docName}|${c.location}`;
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    const pairs = [...groups.values()].filter((g) => g.length > 1);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    for (const g of pairs) {
      const sorted = [...g].sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate));
      expect(sorted[0].superseded).toBe(false);
      sorted.slice(1).forEach((c) => expect(c.superseded, c.id).toBe(true));
    }
  });
});

describe("실제 자료 (corpus.json)", () => {
  it("최신화 전에는 비어 있다", () => {
    expect(realChunks).toEqual([]);
  });
});

describe("시험 질문 (test-questions.json)", () => {
  it("20개이고, 근거 없음 3개·개별 사안 2개·개정 전후 2개가 들어 있다", () => {
    expect(questions).toHaveLength(20);
    const count = (cat: string) => questions.filter((q) => q.category === cat).length;
    expect(count("no-evidence")).toBe(3);
    expect(count("individual")).toBe(2);
    expect(count("superseded")).toBe(2);
  });

  it("질문은 500자 이내이고 id가 겹치지 않는다", () => {
    expect(new Set(questions.map((q) => q.id)).size).toBe(20);
    questions.forEach((q) => expect(q.question.length, q.id).toBeLessThanOrEqual(500));
  });

  it("정답 출처는 모의 자료에 실제로 있는 현행 조각이다", () => {
    for (const q of questions) {
      for (const e of q.expectedCitations) {
        const found = mockChunks.find(
          (c) => c.docName === e.docName && c.location === e.location && c.effectiveDate === e.effectiveDate,
        );
        expect(found, `${q.id} → ${e.docName} ${e.location}`).toBeDefined();
        expect(found?.superseded, q.id).toBe(false);
      }
    }
  });

  it("정답 핵심 내용은 기대 출처 조각의 본문에 들어 있다", () => {
    for (const q of questions) {
      const texts = q.expectedCitations
        .map((e) => mockChunks.find((c) => c.docName === e.docName && c.location === e.location && c.effectiveDate === e.effectiveDate)?.text ?? "")
        .join(" ");
      q.expectedKeyPoints.forEach((k) => expect(texts, `${q.id} → ${k}`).toContain(k));
    }
  });

  it("근거 없음 질문은 정답 출처가 없고, 그 밖의 질문은 1~3개다", () => {
    for (const q of questions) {
      if (q.category === "no-evidence") expect(q.expectedCitations, q.id).toHaveLength(0);
      else expect(q.expectedCitations.length, q.id).toBeGreaterThanOrEqual(1);
    }
  });

  it("개별 사안 질문만 개별 사안으로 판정된다", () => {
    for (const q of questions) {
      expect(isIndividualCase(q.question), q.id).toBe(q.category === "individual");
    }
  });
});
