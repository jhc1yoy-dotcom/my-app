// 말씀자료 미리보기 (DESIGN 2.2 ⑥): 내려받을 .txt 내용 그대로 + 글자 수·예상 시간
import { countChars } from "@/lib/rules/checks";
import { LIMITS } from "@/lib/rules/constants";

export default function SpeechPreview({ text, bodyChars }: { text: string; bodyChars: number }) {
  const minutes = (bodyChars / LIMITS.speechCharsPerMinute).toFixed(1);
  return (
    <div>
      <p className="mb-2 text-xs text-zinc-600 dark:text-zinc-400">
        본문 {bodyChars.toLocaleString()}자 · 약 {minutes}분 (전체 {countChars(text).toLocaleString()}자)
      </p>
      <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-black/10 p-3 font-sans text-sm leading-6 dark:border-white/15">
        {text}
      </pre>
    </div>
  );
}
