// 자료 묶음 불러오기 (DESIGN 3.3, 4.3)
// 파일은 import로 불러와 빌드할 때 서버 묶음에 함께 들어가게 한다 (Vercel 배포 대비).
// 실제 자료(corpus.json)가 비어 있으면 모의 자료(corpus.mock.json)를 쓴다.
import type { Chunk } from "@/lib/types";
import realFile from "../../../data/corpus.json";
import mockFile from "../../../data/corpus.mock.json";

export interface Corpus {
  chunks: Chunk[];
  /** 모의 자료를 쓰고 있으면 true */
  mock: boolean;
}

export function getCorpus(): Corpus {
  const real = realFile.chunks as Chunk[];
  if (real.length > 0) return { chunks: real, mock: false };
  return { chunks: mockFile.chunks as Chunk[], mock: true };
}
