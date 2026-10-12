"use client";

// 결과물 만들기 패널 (PLAN 16번, DESIGN 2.2 ⑤⑥)
// 종류 선택 → 대상·분량 입력 → 초안 만들기 → 미리보기 → 내려받기
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Answer } from "@/lib/types";
import type { ApiError } from "@/lib/api/errors";
import type { DraftResult } from "@/lib/ai/draft";
import { LIMITS, shortenedNotice } from "@/lib/rules/constants";
import { countChars } from "@/lib/rules/checks";
import { formatSpeechText, speechShortenedNotice } from "@/lib/draft/speech";
import SlidePreview from "./SlidePreview";
import SpeechPreview from "./SpeechPreview";

interface Props {
  question: string;
  answer: Answer;
  onClose: () => void;
}

/** 파일 이름에 쓸 수 없는 글자를 바꾼다. */
const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|]/g, "_");

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DraftPanel({ question, answer, onClose }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<"ppt" | "speech">("ppt");
  const [audience, setAudience] = useState("");
  const [slides, setSlides] = useState<number>(LIMITS.slides.default);
  const [minutes, setMinutes] = useState<number>(LIMITS.speechMinutes.default);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(DraftResult & { audience: string }) | null>(null);

  async function post(url: string, body: unknown): Promise<Response | null> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      router.push("/login");
      return null;
    }
    return res;
  }

  async function makeDraft() {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      // 고른 종류의 분량만 보낸다 (PPT면 장수, 말씀자료면 분).
      const amount = kind === "ppt" ? { slides } : { minutes };
      const res = await post("/api/draft", { question, citations: answer.citations, kind, audience, ...amount });
      if (!res) return;
      const data: DraftResult | ApiError = await res.json();
      if (!res.ok || "error" in data) setError("error" in data ? data.error.message : "잠시 후 다시 시도해 주세요.");
      else setResult({ ...data, audience: audience.trim() });
    } catch {
      setError("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  async function downloadPptx() {
    if (!result?.slides) return;
    setPending(true);
    setError(null);
    try {
      const res = await post("/api/export/pptx", {
        question,
        citations: answer.citations,
        audience: result.audience,
        slides: result.slides,
      });
      if (!res) return;
      if (!res.ok) {
        const data: ApiError = await res.json();
        setError(data.error.message);
        return;
      }
      download(await res.blob(), `${safeFileName(result.manuscript.title)}.pptx`);
    } catch {
      setError("서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  }

  const speechText = result?.speech ? formatSpeechText(result.speech, result.manuscript.title) : "";
  // 분량 부족 안내: PPT는 실제 장수, 말씀자료는 실제 분량(분)
  const shortened = result?.slides
    ? shortenedNotice(result.slides.length, "장")
    : result?.speech
      ? speechShortenedNotice(result.speech)
      : "";
  const audienceOk = audience.trim().length > 0 && audience.trim().length <= LIMITS.audienceMaxChars;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/15">
        <h2 className="font-bold">결과물 만들기</h2>
        <button type="button" onClick={onClose} className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
          닫기
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-xs text-zinc-600 dark:text-zinc-400">질문: {question}</p>

        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">종류</legend>
          <div className="flex gap-4 text-sm">
            {(["ppt", "speech"] as const).map((k) => (
              <label key={k} className="flex items-center gap-1.5">
                <input type="radio" name="kind" checked={kind === k} onChange={() => { setKind(k); setResult(null); }} />
                {k === "ppt" ? "발표자료(PPT)" : "말씀자료"}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="font-medium">대상</span>
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            maxLength={LIMITS.audienceMaxChars}
            placeholder="예: 신규 공무원"
            className="mt-1 h-10 w-full rounded-lg border border-black/15 bg-transparent px-3 outline-none focus:border-blue-600 dark:border-white/20"
          />
        </label>

        {kind === "ppt" ? (
          <label className="block text-sm">
            <span className="font-medium">분량 (장, 표지·출처 포함)</span>
            <input
              type="number"
              min={LIMITS.slides.min}
              max={LIMITS.slides.max}
              value={slides}
              onChange={(e) => setSlides(Number(e.target.value))}
              className="mt-1 h-10 w-28 rounded-lg border border-black/15 bg-transparent px-3 dark:border-white/20"
            />
            <span className="ml-2 text-xs text-zinc-500">
              {LIMITS.slides.min}~{LIMITS.slides.max}장
            </span>
          </label>
        ) : (
          <label className="block text-sm">
            <span className="font-medium">분량 (분)</span>
            <input
              type="number"
              min={LIMITS.speechMinutes.min}
              max={LIMITS.speechMinutes.max}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className="mt-1 h-10 w-28 rounded-lg border border-black/15 bg-transparent px-3 dark:border-white/20"
            />
            <span className="ml-2 text-xs text-zinc-500">
              {LIMITS.speechMinutes.min}~{LIMITS.speechMinutes.max}분 (1분 약 {LIMITS.speechCharsPerMinute}자)
            </span>
          </label>
        )}

        <button
          type="button"
          onClick={makeDraft}
          disabled={pending || !audienceOk}
          className="h-10 w-full rounded-lg bg-blue-700 font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
        >
          {pending && !result ? "만드는 중…" : "초안 만들기"}
        </button>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}

        {result && (
          <section className="space-y-3 border-t border-black/10 pt-4 dark:border-white/15">
            <h3 className="font-medium">미리보기</h3>
            {result.mock && <p className="text-xs text-zinc-500">모의 자료로 만든 초안입니다.</p>}
            {result.shortened && (
              <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                {shortened}
              </p>
            )}
            {result.slides && <SlidePreview slides={result.slides} />}
            {result.speech && <SpeechPreview text={speechText} bodyChars={countChars(result.speech.body)} />}

            {result.slides ? (
              <button
                type="button"
                onClick={downloadPptx}
                disabled={pending}
                className="h-10 w-full rounded-lg border border-blue-700 font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-950"
              >
                {pending ? "파일 만드는 중…" : ".pptx 내려받기"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  download(new Blob([speechText], { type: "text/plain;charset=utf-8" }), `${safeFileName(result.manuscript.title)}.txt`)
                }
                className="h-10 w-full rounded-lg border border-blue-700 font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950"
              >
                .txt 내려받기
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
