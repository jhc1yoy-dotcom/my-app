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

/** 받은 내용이 실제 파일인지 첫 바이트로 확인한다 (PDF는 "%PDF", HWPX는 압축 파일 "PK"). */
function looksLike(kind: "pdf" | "hwpx", data: Uint8Array): boolean {
  const head = String.fromCharCode(...data.subarray(0, 4));
  return kind === "pdf" ? head.startsWith("%PDF") : head.startsWith("PK");
}

/** 지침·간행물: 첨부파일을 내려받아 글자로 바꾼다. */
export async function collectFile(source: Source, fetcher: typeof fetch = fetch): Promise<CollectResult> {
  const url = source.fileUrl!;
  const kind = fileKind(source);
  if (!kind) throw new Error("PDF·HWPX 파일만 다룹니다.");

  // 게시글 주소를 Referer로 보내야 파일을 내주는 사이트가 있다 (예: 인사혁신처 누리집). 다른 곳으로 넘어가지 않게 한다.
  const res = await fetcher(url, {
    headers: { "User-Agent": "Mozilla/5.0 (insa-compass update-sources)", ...(source.pageUrl ? { Referer: source.pageUrl } : {}) },
    redirect: "manual",
  });
  if (res.status >= 300 && res.status < 400) {
    throw new Error("파일 대신 다른 페이지로 넘어갔습니다 (pageUrl에 첨부파일이 올라간 게시글 주소를 적어 보세요)");
  }
  if (!res.ok) throw new Error(`내려받기 실패 (HTTP ${res.status})`);
  const data = new Uint8Array(await res.arrayBuffer());
  if (!looksLike(kind, data)) throw new Error(`받은 내용이 ${kind.toUpperCase()} 파일이 아닙니다 (웹페이지가 왔을 수 있음)`);

  // 간행물(해설서)은 여러 법령의 "제n조(…)"를 인용하므로 쪽 단위로, 지침은 조항 머리가 있으면 조항 단위로 나눈다.
  const byArticle = source.kind !== "publication";
  const pieces =
    kind === "pdf" ? piecesFromPages(await pdfToPages(data), byArticle) : piecesFromParagraphs(await hwpxToParagraphs(data), byArticle);
  const warnings: string[] = [];
  if (pieces.length === 0) warnings.push("글자를 뽑지 못했습니다 (스캔본일 수 있음. 스캔본·OCR은 다루지 않습니다)");
  const privacy = personnelListWarning(pieces.map((p) => p.text).join(" "), source.name);
  if (privacy) warnings.push(privacy);

  // 출처 링크는 사람이 열 수 있는 게시글 주소를 우선 쓴다 (첨부파일 주소는 Referer 없이는 열리지 않을 수 있음).
  return { chunks: piecesToChunks(source, pieces, source.version!, source.pageUrl ?? url), warnings };
}

/** 법령: 법제처 오픈 API로 가져온다 (PLAN 18번 — 인증키 승인 후 구현). */
export async function collectLaw(source: Source, oc: string | undefined): Promise<CollectResult> {
  if (!oc) {
    return { chunks: [], warnings: [".env에 LAW_API_KEY(법제처 OC 값)가 없어 건너뛰었습니다"] };
  }
  return { chunks: [], warnings: ["법제처 API 수집은 아직 만들지 않았습니다 (PLAN 18번, 인증키 승인 후 구현)"] };
}
