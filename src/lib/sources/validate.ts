// 수집 목록 점검 (PLAN 20번, DESIGN 3.3 ⓪)
// 켜진 항목만 보고, 규칙에 맞지 않는 항목은 수집하지 않고 이유를 알려 준다.
import type { Source } from "@/lib/types";

export interface SourceProblem {
  id: string;
  reason: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** 첨부파일 직접 주소만 받는다 (게시판 페이지를 뒤지는 크롤링은 PRD 비범위). */
const FILE_URL = /^https:\/\/\S+\.(pdf|hwpx)(\?\S*)?$/i;

export function validateSources(sources: Source[]): { ok: Source[]; problems: SourceProblem[] } {
  const ok: Source[] = [];
  const problems: SourceProblem[] = [];
  const seen = new Set<string>();

  for (const s of sources) {
    if (!s.enabled) continue;
    const reasons: string[] = [];
    if (seen.has(s.id)) reasons.push("id가 다른 항목과 겹칩니다");
    if (!s.kogl?.trim()) reasons.push("공공누리 유형(kogl)이 비어 있습니다");
    if (s.kind === "law") {
      if (!s.lawName?.trim()) reasons.push("법령명(lawName)이 비어 있습니다");
    } else {
      if (!s.fileUrl || !FILE_URL.test(s.fileUrl))
        reasons.push("fileUrl은 https로 시작하고 .pdf 또는 .hwpx로 끝나는 첨부파일 직접 주소여야 합니다");
      if (!s.version || !DATE.test(s.version))
        reasons.push("version(시행일·게시일)을 YYYY-MM-DD 형식으로 적어야 합니다");
    }
    seen.add(s.id);
    if (reasons.length) problems.push({ id: s.id, reason: reasons.join(" / ") });
    else ok.push(s);
  }
  return { ok, problems };
}

/** 파일 주소의 확장자로 형식을 정한다. */
export function fileKind(url: string): "pdf" | "hwpx" | null {
  const m = url.toLowerCase().match(/\.(pdf|hwpx)(\?|$)/);
  return m ? (m[1] as "pdf" | "hwpx") : null;
}
