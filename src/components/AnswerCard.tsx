// 답변 카드 (DESIGN 2.2 ③, 2.4 점검표)
import type { Answer } from "@/lib/types";
import { DEPT_CHECK_MESSAGE, SUPERSEDED_LABEL } from "@/lib/rules/constants";
import { formatDate } from "@/lib/format";

export default function AnswerCard({ answer }: { answer: Answer }) {
  return (
    <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/15 dark:bg-zinc-900">
      {answer.mock && (
        <span className="mb-2 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          모의 자료
        </span>
      )}

      <p className="whitespace-pre-line leading-7">{answer.text}</p>

      {answer.needsDeptCheck && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          ⚠ {DEPT_CHECK_MESSAGE}
        </p>
      )}

      {answer.noEvidence ? (
        <div className="mt-3 text-sm">
          <p className="font-medium">아래 사이트에서 직접 찾아보세요.</p>
          <ul className="mt-1 list-disc pl-5">
            {answer.guideSites.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline dark:text-blue-400">
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <div className="mt-4 border-t border-black/10 pt-3 dark:border-white/15">
            <p className="text-sm font-medium">출처</p>
            <ul className="mt-1 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              {answer.citations.map((c) => {
                const label = `${c.docName} · ${c.location} · ${formatDate(c.effectiveDate)} 시행`;
                return (
                  <li key={`${c.docName}-${c.location}-${c.effectiveDate}`}>
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline dark:text-blue-400">
                        {label}
                      </a>
                    ) : (
                      <span>
                        {label} <span className="text-xs text-zinc-500">(모의 자료 · 원문 없음)</span>
                      </span>
                    )}
                    {c.superseded && <span className="ml-1 font-medium text-red-700 dark:text-red-400">{SUPERSEDED_LABEL}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
          <button
            type="button"
            disabled
            title="다음 단계에서 열립니다"
            className="mt-4 rounded-lg border border-black/15 px-3 py-1.5 text-sm opacity-50 dark:border-white/20"
          >
            결과물 만들기 (준비 중)
          </button>
        </>
      )}
    </article>
  );
}
