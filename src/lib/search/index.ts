// 자료 검색 (PLAN 6번, DESIGN 3.1)
// 외부 서비스 없이 글자 두 개씩 묶은 조각(바이그램)이 얼마나 겹치는지로 관련 조각을 찾는다.
// 흔한 낱말은 가중치를 낮추고(IDF), 기준값 미만이면 "근거 없음"으로 본다.
import type { Chunk } from "@/lib/types";
import { LIMITS } from "@/lib/rules/constants";

/**
 * 근거로 인정하는 최소 점수 (0~1, 질문 조각 포함 비율).
 * 모의 자료 시험 질문 20개와 실제 자료(2024 공무원 인사실무) 시험 질문으로 맞춘 값이다.
 * (실제 자료의 관련 조각은 0.68~1.0, 관련 없는 조각은 0.42 안팎이었다.)
 */
export const MIN_SCORE = 0.5;
/** 1순위 점수에 비해 이 비율보다 낮은 조각은 함께 내보내지 않는다. */
const RELATIVE_CUTOFF = 0.6;

/** 질문에서 뜻이 없는 말(묻는 말투, 모든 자료에 나오는 말, 때를 가리키는 말 등)은 지운다. */
const QUESTION_STOPWORDS = [
  "알려주세요", "궁금합니다", "어떻게", "어떤", "얼마나", "얼마", "무엇", "언제", "며칠", "몇",
  "있는", "하는", "되는", "받을", "쓸", "쓰면", "할", "수", "중", "때",
  "공무원", "공무", "우리", "직원", "작년", "올해", "내년", "지금", "현재", "하루",
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

/** 자료 묶음의 검색용 색인. 자료 묶음이 같으면 다시 만들지 않는다. */
interface Index {
  chunks: Chunk[];
  /** 조각마다 바이그램 집합 (문서명 포함, 근거 여부 판정용) */
  sets: Set<string>[];
  /** 조각마다 본문 바이그램 빈도 (순위 계산용) */
  tf: Map<string, number>[];
  lengths: number[];
  avgLength: number;
  df: Map<string, number>;
  /** 조각마다 띄어쓰기를 뺀 본문 (낱말 쌍 찾기용) */
  compact: string[];
}
const indexCache = new WeakMap<Chunk[], Index>();

function buildIndex(chunks: Chunk[]): Index {
  const cached = indexCache.get(chunks);
  if (cached) return cached;
  const marked = markSuperseded(chunks);
  const df = new Map<string, number>();
  const sets: Set<string>[] = [];
  const tf: Map<string, number>[] = [];
  const lengths: number[] = [];
  const compact: string[] = [];
  for (const c of marked) {
    const text = normalize(c.text).replace(/\s/g, "");
    compact.push(text);
    const body = bigrams(text);
    const counts = new Map<string, number>();
    for (const b of body) counts.set(b, (counts.get(b) ?? 0) + 1);
    const set = new Set([...counts.keys(), ...bigrams(normalize(c.docName).replace(/\s/g, ""))]);
    for (const b of set) df.set(b, (df.get(b) ?? 0) + 1);
    sets.push(set);
    tf.push(counts);
    lengths.push(body.length);
  }
  const avgLength = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  const index = { chunks: marked, sets, tf, lengths, avgLength, df, compact };
  indexCache.set(chunks, index);
  return index;
}

/** BM25 순위 점수의 조정값 (널리 쓰는 기본값) */
const BM25_K1 = 1.2;
const BM25_B = 0.75;
/** 질문의 이웃한 두 낱말이 본문에 붙어서 나오면 더하는 점수 (예: "육아휴직 중" → "육아휴직 중인") */
const PHRASE_BONUS = 2;

/** 질문에서 이웃한 낱말 쌍을 띄어쓰기 없이 붙여 만든다 (낱말 순서를 반영하기 위함). */
export function questionPhrases(question: string): string[] {
  const words = normalize(question)
    .split(" ")
    .filter((w) => !/\d/.test(w))
    .map(stripWord)
    .filter((w) => w.length >= 1 && !["수", "할", "몇", "어떻게", "어떤", "얼마"].includes(w));
  const phrases: string[] = [];
  for (let i = 0; i + 1 < words.length; i++) {
    const p = words[i] + words[i + 1];
    if (p.length >= 3) phrases.push(p);
  }
  return [...new Set(phrases)];
}

export interface SearchHit {
  chunk: Chunk;
  /** 0~1. 질문 조각 중 이 자료에 들어 있는 비율(흔한 조각은 가중치 낮음) — 근거 여부 판정에 쓴다 */
  score: number;
}

/**
 * 질문과 관련된 조각을 최대 3개 찾는다.
 * - 근거 여부: 질문 조각이 얼마나 들어 있는지(포함 비율)가 기준값 이상인 조각만 후보로 둔다.
 * - 순위: 후보 중에서 BM25 점수(드문 낱말이 짧은 조각에 여러 번 나올수록 높음)로 정한다.
 *   (실제 자료처럼 조각이 많으면 짧은 질문의 낱말이 여러 조각에 모두 들어 있어, 포함 비율만으로는 순위를 가릴 수 없다.)
 * - 같은 문서에 더 최신 판이 있으면 옛 판은 개정 전이며, 질문이 개정·변경을 묻지 않으면 내보내지 않는다.
 * - 기준값 이상인 조각이 없으면 빈 배열(근거 없음)을 돌려준다.
 */
export function search(question: string, chunks: Chunk[]): SearchHit[] {
  const terms = questionTerms(question);
  if (terms.length === 0) return [];

  const index = buildIndex(chunks);
  const n = index.chunks.length;
  const coverIdf = (t: string) => Math.log((n + 1) / ((index.df.get(t) ?? 0) + 1)) + 1;
  const rankIdf = (t: string) => {
    const df = index.df.get(t) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  };
  const weights = terms.map((t) => ({ t, cover: coverIdf(t), rank: rankIdf(t) }));
  const total = weights.reduce((a, w) => a + w.cover, 0);
  const phrases = questionPhrases(question);

  const scored = index.chunks
    .map((chunk, i) => {
      let cover = 0;
      let rank = 0;
      const norm = BM25_K1 * (1 - BM25_B + (BM25_B * index.lengths[i]) / index.avgLength);
      for (const w of weights) {
        if (index.sets[i].has(w.t)) cover += w.cover;
        const f = index.tf[i].get(w.t) ?? 0;
        if (f) rank += (w.rank * f * (BM25_K1 + 1)) / (f + norm);
      }
      const base = rank;
      for (const p of phrases) if (index.compact[i].includes(p)) rank += PHRASE_BONUS;
      return { chunk, score: cover / total, rank, base };
    })
    .filter((h) => h.score >= MIN_SCORE)
    .sort(
      (a, b) =>
        b.rank - a.rank || b.score - a.score || b.chunk.effectiveDate.localeCompare(a.chunk.effectiveDate),
    );

  if (scored.length === 0) return [];

  const wantsHistory = CHANGE_WORDS.some((w) => question.includes(w));
  // 함께 보여 줄지는 낱말 쌍 가산점을 뺀 기본 점수로 정한다 (가산점은 1순위를 가리는 데만 쓴다).
  const top = Math.max(...scored.map((h) => h.base));
  const picked: SearchHit[] = [];
  const seen = new Set<string>();

  for (const h of scored) {
    if (h.base < top * RELATIVE_CUTOFF) continue; // 순위(가산점 포함)순으로 돌므로 break가 아니라 건너뛴다
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
