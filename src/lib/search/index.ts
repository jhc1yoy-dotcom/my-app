// 자료 검색 (PLAN 6번, DESIGN 3.1)
// 외부 서비스 없이 글자 두 개씩 묶은 조각(바이그램)이 얼마나 겹치는지로 관련 조각을 찾는다.
// 흔한 낱말은 가중치를 낮추고(IDF), 기준값 미만이면 "근거 없음"으로 본다.
import type { Chunk } from "@/lib/types";
import { LIMITS } from "@/lib/rules/constants";

/** 근거로 인정하는 최소 점수 (0~1). 시험 질문 20개로 맞춘 값이다. */
export const MIN_SCORE = 0.3;
/** 1순위 점수에 비해 이 비율보다 낮은 조각은 함께 내보내지 않는다. */
const RELATIVE_CUTOFF = 0.6;

/** 질문에서 뜻이 없는 말(묻는 말투, 모든 자료에 나오는 말, 때를 가리키는 말 등)은 지운다. */
const QUESTION_STOPWORDS = [
  "알려주세요", "궁금합니다", "어떻게", "어떤", "얼마나", "얼마", "무엇", "언제", "며칠", "몇",
  "있는", "하는", "되는", "받을", "쓸", "쓰면", "할", "수", "중", "때",
  "공무원", "공무", "우리", "작년", "올해", "내년", "지금", "현재", "하루",
];

/** 개정 전 자료를 함께 보여 줄 질문 낱말 (검색어에서는 뺀다) */
const CHANGE_WORDS = ["예전", "이전", "개정", "바뀌", "달라", "변경"];

/** 말끝(묻는 말투·연결 어미)을 떼어 낸다 (예: "지급되나요" → "지급", "근무해야" → "근무"). */
const ENDING =
  /(인가요|입니까|습니까|되나요|하나요|있나요|없나요|할까요|될까요|졌나요|했나요|았나요|었나요|나요|까요|았는데|었는데|는데|해야|아야|어야|으면|하면|되나|인가|(?<=[가-힣]{2})할)$/;
/**
 * 낱말 끝의 조사를 한 번만 떼어 낸다 (예: "육아휴직은" → "육아휴직", "중에도" → "중").
 * 겹친 조사는 목록에 따로 두고, 두 번 떼지 않는다 ("연가는"이 "연"이 되지 않도록).
 */
const PARTICLE =
  /(에서도|에서는|으로는|에게는|에도|에는|에서|으로|까지|부터|에게|은|는|이|가|을|를|의|에|도|로|과|와)$/;

function normalize(text: string): string {
  return text.replace(/[^가-힣a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function stripWord(word: string): string {
  return word.replace(ENDING, "").replace(PARTICLE, "");
}

function bigrams(word: string): string[] {
  if (word.length < 2) return [];
  const out: string[] = [];
  for (let i = 0; i < word.length - 1; i++) out.push(word.slice(i, i + 2));
  return out;
}

/** 질문을 검색용 조각 집합으로 바꾼다. */
export function questionTerms(question: string): string[] {
  const words = normalize(question)
    .split(" ")
    // 숫자가 든 말("1년에", "1주간")은 빈도 표현이라 검색어에서 뺀다.
    .filter((w) => !/\d/.test(w))
    .map(stripWord)
    .filter(
      (w) =>
        w.length >= 2 &&
        !QUESTION_STOPWORDS.includes(w) &&
        !CHANGE_WORDS.some((c) => w.startsWith(c)),
    );
  return [...new Set(words.flatMap(bigrams))];
}

function chunkTerms(chunk: Chunk): Set<string> {
  const text = normalize(`${chunk.docName} ${chunk.text}`).replace(/\s/g, "");
  return new Set(bigrams(text));
}

/** 동점일 때 쓰는 보조 점수: 본문에 질문 조각이 몇 번 나오는지 센다. */
function occurrences(chunk: Chunk, terms: string[]): number {
  const text = normalize(chunk.text).replace(/\s/g, "");
  return terms.reduce((sum, t) => sum + (text.split(t).length - 1), 0);
}

export interface SearchHit {
  chunk: Chunk;
  /** 0~1. 질문 조각 중 이 자료에 들어 있는 비율(흔한 조각은 가중치 낮음) */
  score: number;
}

/**
 * 질문과 관련된 조각을 최대 3개 찾는다.
 * - 같은 문서·같은 조항이면 시행일이 가장 늦은 것만 현행으로 보고 나머지는 개정 전으로 표시한다.
 * - 질문이 개정·변경을 묻지 않으면 개정 전 조각은 내보내지 않는다.
 * - 기준값 이상인 조각이 없으면 빈 배열(근거 없음)을 돌려준다.
 */
export function search(question: string, chunks: Chunk[]): SearchHit[] {
  const terms = questionTerms(question);
  if (terms.length === 0) return [];

  const marked = markSuperseded(chunks);
  const termSets = marked.map(chunkTerms);
  const n = marked.length;
  const idf = (t: string) => {
    const df = termSets.filter((s) => s.has(t)).length;
    return Math.log((n + 1) / (df + 1)) + 1;
  };
  const weights = new Map(terms.map((t) => [t, idf(t)]));
  const total = [...weights.values()].reduce((a, b) => a + b, 0);

  const scored = marked
    .map((chunk, i) => {
      let hit = 0;
      for (const [t, w] of weights) if (termSets[i].has(t)) hit += w;
      return { chunk, score: hit / total, occ: occurrences(chunk, terms) };
    })
    .filter((h) => h.score >= MIN_SCORE)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.occ - a.occ ||
        b.chunk.effectiveDate.localeCompare(a.chunk.effectiveDate),
    )
    .map(({ chunk, score }) => ({ chunk, score }));

  if (scored.length === 0) return [];

  const wantsHistory = CHANGE_WORDS.some((w) => question.includes(w));
  const top = scored[0].score;
  const picked: SearchHit[] = [];
  const seen = new Set<string>();

  for (const h of scored) {
    if (h.score < top * RELATIVE_CUTOFF) break;
    if (h.chunk.superseded && !wantsHistory) continue;
    const key = `${h.chunk.docName}|${h.chunk.location}|${h.chunk.effectiveDate}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(h);
    if (picked.length === LIMITS.citationsMax) break;
  }

  // 현행 조각을 개정 전 조각보다 앞에 둔다.
  return picked.sort((a, b) => Number(a.chunk.superseded) - Number(b.chunk.superseded));
}

/**
 * 개정 전 표시 (DESIGN 3.3): 같은 문서명에 더 최신 판(시행일)이 있으면, 옛 판의 조각은 모두 개정 전이다.
 * 조항 단위가 아니라 문서 단위로 보므로, 새 판에서 없어진 조항도 개정 전으로 표시된다.
 * 이미 개정 전으로 저장된 표시는 지우지 않는다.
 */
export function markSuperseded(chunks: Chunk[]): Chunk[] {
  const latest = new Map<string, string>();
  for (const c of chunks) {
    const prev = latest.get(c.docName);
    if (!prev || c.effectiveDate > prev) latest.set(c.docName, c.effectiveDate);
  }
  return chunks.map((c) => ({
    ...c,
    superseded: c.superseded || c.effectiveDate < (latest.get(c.docName) ?? c.effectiveDate),
  }));
}
