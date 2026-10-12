// PPT 미리보기 (DESIGN 2.2 ⑥): 장 번호·제목·글머리
import type { Slide } from "@/lib/types";

const KIND_LABEL: Record<Slide["kind"], string> = { cover: "표지", body: "", sources: "출처" };

export default function SlidePreview({ slides }: { slides: Slide[] }) {
  return (
    <ol className="space-y-2">
      {slides.map((s) => (
        <li key={s.no} className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/15">
          <p className="font-medium">
            <span className="mr-2 text-zinc-500">{s.no}.</span>
            {s.title}
            {KIND_LABEL[s.kind] && (
              <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {KIND_LABEL[s.kind]}
              </span>
            )}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-zinc-700 dark:text-zinc-300">
            {s.bullets.map((b, i) => (
              <li key={i} className={s.kind === "cover" && i === 0 ? "font-medium text-red-700 dark:text-red-400" : ""}>
                {b}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
