// 원고 → 말씀자료 (PLAN 17번, DESIGN 3.2 "말씀자료 분량 규칙")
// 1분 300자(±10%, 본문만 셈), 최대 3,000자, "~습니다"체, 끝에 출처 단락.
// 자료가 모자라면 근거 원문을 다시 풀어 읽는 문단으로 채우고, 그래도 모자라면 짧게 만들고 표시한다.
import type { Manuscript, Speech } from "@/lib/types";
import { DISCLAIMER, LIMITS, SUPERSEDED_LABEL, shortenedNotice } from "@/lib/rules/constants";
import { countChars, speechCharRange } from "@/lib/rules/checks";
import { formatDate } from "@/lib/format";
import { splitSentences } from "./text";

const ORDINALS = ["첫째", "둘째", "셋째"];
/** 근거 원문을 다시 읽는 문단을 최대 몇 번까지 덧붙일지 */
const MAX_RETELLS = 2;

/** 모든 문장이 "~니다." 로 끝나게 한다. 바꾸지 못한 "~다."는 "~다고 정하고 있습니다."로 감싼다. */
export function ensurePolite(sentence: string): string {
  const s = sentence.trim();
  if (/(니다\.|니까[.?])$/.test(s)) return s;
  if (/다\.$/.test(s)) return s.replace(/다\.$/, "다고 정하고 있습니다.");
  return `${s.replace(/[.?!]*$/, "")}입니다.`;
}

function polite(text: string): string {
  return splitSentences(text).map(ensurePolite).join(" ");
}

/**
 * @param minutes 요청 분량 (1~10분)
 * @param audience 대상 (인사말에 사용)
 */
export function buildSpeech(m: Manuscript, minutes: number, audience: string): Speech {
  const range = speechCharRange(minutes);
  const opening = polite(`${audience} 여러분, 안녕하십니까. 오늘은 ${m.title}에 대해 말씀드리겠습니다.`);
  const closing = "이상으로 말씀을 마치겠습니다. 감사합니다.";

  const evidence = m.evidence.map((text, i) => {
    const c = m.citations[i];
    const label = `${c.docName} ${c.location}${c.superseded ? ` ${SUPERSEDED_LABEL}` : ""}`;
    return polite(`${label}에 따르면, ${text}`);
  });
  const retells = m.evidence.map((text, i) =>
    polite(`${m.citations[i].location}의 내용을 다시 한번 말씀드리면, ${text}`),
  );

  const paragraphs = [opening];
  const total = (ps: string[]) => countChars([...ps, closing].join("\n\n"));
  const fits = (p: string) => total([...paragraphs, p]) <= range.max;

  // ① 핵심 메시지: 들어가는 것만 "첫째/둘째/셋째" 순서로 넣는다.
  let order = 0;
  for (const msg of m.messages) {
    const p = polite(`${ORDINALS[order]}, ${msg}`);
    if (fits(p)) {
      paragraphs.push(p);
      order++;
    }
  }
  // ② 근거: 들어가는 것만 넣는다.
  for (const p of evidence) if (fits(p)) paragraphs.push(p);
  // ③ 아직 모자라면 근거를 다시 풀어 읽는 문단을 덧붙인다 (최대 MAX_RETELLS바퀴).
  for (let round = 0; round < MAX_RETELLS && total(paragraphs) < range.min; round++) {
    for (const p of retells) {
      if (total(paragraphs) >= range.min) break;
      if (fits(p)) paragraphs.push(p);
    }
  }
  // ④ 그래도 모자라면 남은 문장을 한 문장씩 채워 본다.
  if (total(paragraphs) < range.min) {
    for (const s of [...evidence, ...retells].flatMap(splitSentences)) {
      if (total(paragraphs) >= range.min) break;
      if (fits(s)) paragraphs.push(s);
    }
  }

  const body = [...paragraphs, closing].join("\n\n");
  return { body, minutes, citations: m.citations, shortened: countChars(body) < range.min };
}

/** 말씀자료 분량 부족 안내: 실제 본문 분량을 분 단위로 알려 준다 (1분이 안 되면 따로 표현). */
export function speechShortenedNotice(speech: Speech): string {
  const actual = countChars(speech.body) / LIMITS.speechCharsPerMinute;
  if (actual < 1) return "자료가 부족해 1분이 안 되는 분량만 작성했습니다.";
  return shortenedNotice(Math.floor(actual), "분");
}

/** 내려받을 .txt 내용: 첫 줄 안내문 → 제목 → (분량 부족 안내) → 본문 → 출처 단락 */
export function formatSpeechText(speech: Speech, title: string): string {
  const parts = [DISCLAIMER, "", title];
  if (speech.shortened) parts.push(speechShortenedNotice(speech));
  parts.push("", speech.body, "", "출처");
  for (const c of speech.citations) {
    parts.push(`- ${c.docName} ${c.location} (${formatDate(c.effectiveDate)} 시행)${c.superseded ? ` ${SUPERSEDED_LABEL}` : ""}`);
  }
  return parts.join("\n");
}
