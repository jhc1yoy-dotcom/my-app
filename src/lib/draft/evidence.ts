// 화면에서 받은 출처를 자료 묶음의 실제 조각으로 되찾는다 (서버 전용).
// 결과물은 화면이 보낸 글이 아니라 자료 묶음에 실제로 있는 조각만으로 만든다 (PRD: 지어내지 않기).
import type { Chunk, Citation } from "@/lib/types";
import { getCorpus } from "@/lib/search/corpus";
import { markSuperseded } from "@/lib/search";

export interface Evidence {
  chunks: Chunk[];
  mock: boolean;
}

/** 출처와 같은 문서명·조항·시행일의 조각을 찾는다. 하나라도 없으면 null. */
export function resolveEvidence(citations: Citation[]): Evidence | null {
  const corpus = getCorpus();
  const all = markSuperseded(corpus.chunks);
  const chunks: Chunk[] = [];
  for (const c of citations) {
    const found = all.find(
      (x) => x.docName === c.docName && x.location === c.location && x.effectiveDate === c.effectiveDate,
    );
    if (!found) return null;
    chunks.push(found);
  }
  return { chunks, mock: corpus.mock };
}
