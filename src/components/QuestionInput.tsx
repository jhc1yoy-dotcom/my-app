"use client";

// 질문 입력창 (DESIGN 2.2 ④): Enter로 보내기, Shift+Enter로 줄바꿈, 500자 제한
import { LIMITS } from "@/lib/rules/constants";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

export default function QuestionInput({ value, onChange, onSubmit, disabled }: Props) {
  const length = value.length;
  const tooLong = length > LIMITS.questionMaxChars;
  const canSend = !disabled && value.trim().length > 0 && !tooLong;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSubmit();
      }}
      className="flex flex-col gap-2"
    >
      <p className="text-xs text-zinc-600 dark:text-zinc-400">
        이름·주민등록번호 등 개인정보나 내부 자료를 입력하지 마세요.
      </p>
      <div className="flex items-end gap-2">
        <div className="relative flex-1">
          <label htmlFor="question" className="sr-only">
            질문
          </label>
          <textarea
            id="question"
            rows={2}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (canSend) onSubmit();
              }
            }}
            placeholder={`질문을 입력하세요 (${LIMITS.questionMaxChars}자 이내)`}
            className="w-full resize-none rounded-lg border border-black/15 bg-transparent px-3 py-2 pr-20 outline-none focus:border-blue-600 dark:border-white/20"
          />
          <span
            className={`absolute bottom-2 right-3 text-xs ${tooLong ? "font-medium text-red-600" : "text-zinc-500"}`}
          >
            {length}/{LIMITS.questionMaxChars}
          </span>
        </div>
        <button
          type="submit"
          disabled={!canSend}
          className="h-11 rounded-lg bg-blue-700 px-5 font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
        >
          질문
        </button>
      </div>
    </form>
  );
}
