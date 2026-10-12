// 수집 목록 1건 → 자료 조각 (PLAN 18~20번, DESIGN 3.3)
// 관리자 컴퓨터에서 최신화 명령(npm run update-sources)으로만 실행한다. 배포된 사이트에서는 쓰지 않는다.
import type { Chunk, Source } from "@/lib/types";
import { hwpxToParagraphs, pdfToPages } from "./convert";
import { personnelListWarning } from "./privacy";
import { piecesFromPages, piecesFromParagraphs, type Piece } from "./split";
import { fileKind } from "./validate";

export interface CollectResult {
  chunks: Chunk[];
  warnings: string[];
}

/** 조각 id: 수집 목록 id + 판(시행일) + 순번 */
function chunkId(source: Source, effectiveDate: string, i: number): string {
  return `${source.id}-${effectiveDate}-${String(i + 1).padStart(3, "0")}`;
}

export function piecesToChunks(source: Source, pieces: Piece[], effectiveDate: string, url: string): Chunk[] {
  return pieces.map((p, i) => ({
    id: chunkId(source, effectiveDate, i),
    docName: source.name,
    location: p.location,
    text: p.text,
    effectiveDate,
    url,
    superseded: false, // 전체를 모은 뒤 markSuperseded로 다시 정한다
    mock: false,
  }));
}

/** 지침·간행물: 첨부파일을 내려받아 글자로 바꾼다. */
export async function collectFile(source: Source, fetcher: typeof fetch = fetch): Promise<CollectResult> {
  const url = source.fileUrl!;
  const kind = fileKind(url);
  if (!kind) throw new Error("PDF·HWPX 파일만 다룹니다.");

  const res = await fetcher(url);
  if (!res.ok) throw new Error(`내려받기 실패 (HTTP ${res.status})`);
  const data = new Uint8Array(await res.arrayBuffer());

  const pieces = kind === "pdf" ? piecesFromPages(await pdfToPages(data)) : piecesFromParagraphs(await hwpxToParagraphs(data));
  const warnings: string[] = [];
  if (pieces.length === 0) warnings.push("글자를 뽑지 못했습니다 (스캔본일 수 있음. 스캔본·OCR은 다루지 않습니다)");
  const privacy = personnelListWarning(pieces.map((p) => p.text).join(" "));
  if (privacy) warnings.push(privacy);

  return { chunks: piecesToChunks(source, pieces, source.version!, url), warnings };
}

/** 법령: 법제처 오픈 API로 가져온다 (PLAN 18번 — 인증키 승인 후 구현). */
export async function collectLaw(source: Source, oc: string | undefined): Promise<CollectResult> {
  if (!oc) {
    return { chunks: [], warnings: [".env에 LAW_API_KEY(법제처 OC 값)가 없어 건너뛰었습니다"] };
  }
  return { chunks: [], warnings: ["법제처 API 수집은 아직 만들지 않았습니다 (PLAN 18번, 인증키 승인 후 구현)"] };
}
