// 결과물을 만들 때 쓰는 글 다듬기 함수 (화면에서도 쓰므로 서버 전용 코드를 넣지 않는다)
import { LIMITS } from "@/lib/rules/constants";

/** 글을 문장 단위로 나눈다. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 한 줄이 max자를 넘으면 줄임표(…)로 줄인다. */
export function truncate(text: string, max: number = LIMITS.lineMaxChars): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/**
 * 글을 한 줄 max자 이내의 줄들로 나눈다 (슬라이드 글머리용).
 * 문장 → 띄어쓰기 단위로 끊고, 한 낱말이 max자보다 길면 글자 단위로 자른다.
 */
export function wrapLines(text: string, max: number = LIMITS.lineMaxChars): string[] {
  const lines: string[] = [];
  for (const sentence of splitSentences(text)) {
    let line = "";
    for (const word of sentence.split(/\s+/)) {
      const pieces = word.length > max ? word.match(new RegExp(`.{1,${max}}`, "g")) ?? [word] : [word];
      for (const piece of pieces) {
        const next = line ? `${line} ${piece}` : piece;
        if (next.length <= max) line = next;
        else {
          if (line) lines.push(line);
          line = piece;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}
