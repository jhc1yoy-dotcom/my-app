// 긴 조각에서 질문과 가장 관련 있는 부분만 고른다.
// 실제 자료(간행물 한 쪽 ≈ 800자)를 그대로 넣으면 답변 500자 규칙을 넘기 때문이다.
// 짧은 조각(모의 자료 등)은 그대로 돌려준다.
import { questionTerms } from "@/lib/search";
import { splitSentences } from "@/lib/draft/text";

/**
 * 질문 낱말이 가장 많이 들어 있는 문장을 중심으로, 앞뒤 문장을 maxChars 안에서 붙여 돌려준다.
 * 원문 순서를 지키고, 한 문장이 maxChars보다 길면 띄어쓰기 경계에서 자르고 "…"를 붙인다.
 */
export function relevantExcerpt(text: string, question: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const sentences = splitSentences(text);
  if (sentences.length === 0) return cut(text, maxChars);

  const terms = questionTerms(question);
  const score = (s: string) => {
    const compact = s.replace(/\s/g, "");
    return terms.filter((t) => compact.includes(t)).length;
  };
  let best = 0;
  sentences.forEach((s, i) => {
    if (score(s) > score(sentences[best])) best = i;
  });

  if (sentences[best].length > maxChars) return cut(sentences[best], maxChars);

  // 가장 관련 있는 문장에서 시작해 뒤 → 앞 순서로 이웃 문장을 붙인다.
  let start = best;
  let end = best;
  const length = () => sentences.slice(start, end + 1).join(" ").length;
  for (let grew = true; grew; ) {
    grew = false;
    if (end + 1 < sentences.length) {
      end++;
      if (length() > maxChars) end--;
      else grew = true;
    }
    if (start > 0) {
      start--;
      if (length() > maxChars) start++;
      else grew = true;
    }
  }
  return sentences.slice(start, end + 1).join(" ");
}

/** 띄어쓰기 경계에서 maxChars 이내로 자르고 "…"를 붙인다 (숫자 중간에서 자르지 않도록). */
function cut(text: string, maxChars: number): string {
  const slice = Array.from(text).slice(0, maxChars - 1).join(""); // 두 칸짜리 문자를 반으로 자르지 않도록
  const space = slice.lastIndexOf(" ");
  return `${space > maxChars / 2 ? slice.slice(0, space) : slice}…`;
}
