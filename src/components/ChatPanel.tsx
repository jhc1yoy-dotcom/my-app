"use client";

// 대화 영역 + 입력창 (DESIGN 2.2 ②④, 3.1)
// 대화 기록은 이 화면의 상태에만 있다. 새로고침하거나 닫으면 사라진다 (PRD: 대화 서버 저장 안 함).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Answer } from "@/lib/types";
import type { ApiError } from "@/lib/api/errors";
import AnswerCard from "./AnswerCard";
import QuestionInput from "./QuestionInput";

const EXAMPLE_QUESTION = "육아휴직 중 승진할 수 있나요?";

type Turn =
  | { id: number; kind: "question"; text: string }
  | { id: number; kind: "answer"; answer: Answer }
  | { id: number; kind: "error"; message: string; question: string };

export default function ChatPanel() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const nextId = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, pending]);

  async function ask(question: string, retry = false) {
    const q = question.trim();
    if (!q || pending) return;
    setPending(true);
    setTurns((prev) => [
      // 다시 시도할 때는 직전 오류 카드를 지우고 질문은 다시 쌓지 않는다.
      ...(retry ? prev.filter((t, i) => !(i === prev.length - 1 && t.kind === "error")) : prev),
      ...(retry ? [] : [{ id: nextId.current++, kind: "question" as const, text: q }]),
    ]);
    setInput("");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (res.status === 401) {
        // 비밀번호 확인이 풀렸으면 비밀번호 화면으로 보낸다.
        router.push("/login");
        return;
      }
      const data: Answer | ApiError = await res.json();
      if (!res.ok || "error" in data) {
        const message = "error" in data ? data.error.message : "잠시 후 다시 시도해 주세요.";
        setTurns((prev) => [...prev, { id: nextId.current++, kind: "error", message, question: q }]);
      } else {
        setTurns((prev) => [...prev, { id: nextId.current++, kind: "answer", answer: data }]);
      }
    } catch {
      setTurns((prev) => [
        ...prev,
        { id: nextId.current++, kind: "error", message: "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.", question: q },
      ]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {turns.length === 0 && (
            <section className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-black/15 p-8 text-center dark:border-white/20">
              <p className="text-lg font-medium">인사·복무 규정에 대해 질문해 보세요</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                모아 둔 자료에서 근거를 찾아 출처와 함께 답합니다.
              </p>
              <button
                type="button"
                onClick={() => ask(EXAMPLE_QUESTION)}
                className="rounded-full border border-black/15 px-4 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                예: {EXAMPLE_QUESTION}
              </button>
            </section>
          )}

          {turns.map((t) => {
            if (t.kind === "question")
              return (
                <div key={t.id} className="self-end max-w-[85%] whitespace-pre-line rounded-2xl bg-blue-700 px-4 py-2 text-white">
                  {t.text}
                </div>
              );
            if (t.kind === "answer") return <AnswerCard key={t.id} answer={t.answer} />;
            return (
              <div key={t.id} role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                <p>{t.message}</p>
                <button
                  type="button"
                  onClick={() => ask(t.question, true)}
                  className="mt-2 rounded-lg border border-red-300 px-3 py-1 hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900"
                >
                  다시 시도
                </button>
              </div>
            );
          })}

          {pending && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
              자료를 찾고 있습니다…
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-black/10 bg-background px-4 py-3 sm:px-6 dark:border-white/15">
        <div className="mx-auto max-w-3xl">
          <QuestionInput value={input} onChange={setInput} onSubmit={() => ask(input)} disabled={pending} />
        </div>
      </div>
    </div>
  );
}
