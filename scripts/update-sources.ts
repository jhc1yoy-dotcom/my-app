// 관리자 자료 최신화 명령 (PLAN 20번, DESIGN 3.3): npm run update-sources
// data/sources.json의 목록을 가져와 data/corpus.json(자료 묶음)으로 저장한다.
// 관리자 컴퓨터에서만 실행한다. 모은 조각이 하나도 없으면 기존 자료 묶음을 덮어쓰지 않는다.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvConfig } from "@next/env";
import type { Chunk, Source } from "../src/lib/types";
import { markSuperseded } from "../src/lib/search";
import { collectFile, collectLaw } from "../src/lib/sources/collect";
import { validateSources } from "../src/lib/sources/validate";

const root = resolve(__dirname, "..");
loadEnvConfig(root); // .env 읽기 (Next.js와 같은 방식). 값은 화면에 출력하지 않는다.

async function main() {
  const sourcesFile = JSON.parse(readFileSync(resolve(root, "data/sources.json"), "utf8")) as { sources: Source[] };
  const { ok, problems } = validateSources(sourcesFile.sources);

  console.log(`수집 목록: 켜진 항목 ${ok.length + problems.length}개 중 ${ok.length}개 수집 진행`);
  for (const p of problems) console.log(`  ✗ 건너뜀 [${p.id}] ${p.reason}`);

  const chunks: Chunk[] = [];
  let failed = 0;
  for (const source of ok) {
    try {
      const r = source.kind === "law" ? await collectLaw(source, process.env.LAW_API_KEY) : await collectFile(source);
      chunks.push(...r.chunks);
      console.log(`  ${r.chunks.length ? "✓" : "·"} [${source.id}] ${source.name}: 조각 ${r.chunks.length}개`);
      for (const w of r.warnings) console.log(`      ⚠ ${w}`);
    } catch (e) {
      failed++;
      console.log(`  ✗ 실패 [${source.id}] ${source.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (chunks.length === 0) {
    console.log("\n모은 조각이 없어 data/corpus.json을 바꾸지 않았습니다. (화면은 계속 모의 자료를 씁니다)");
    process.exitCode = failed ? 1 : 0;
    return;
  }

  const marked = markSuperseded(chunks);
  const superseded = marked.filter((c) => c.superseded).length;
  const out = {
    description:
      "실제 자료 묶음. npm run update-sources가 만든다. 비어 있으면 corpus.mock.json(모의 자료)을 쓴다. 직접 고치지 않는다.",
    generatedAt: new Date().toISOString(),
    chunks: marked,
  };
  writeFileSync(resolve(root, "data/corpus.json"), `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`\n저장 완료: data/corpus.json — 조각 ${marked.length}개 (개정 전 ${superseded}개), 실패 ${failed}건`);
  console.log("다음 단계: 시험 질문으로 답변을 확인한 뒤 커밋하세요.");
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error("최신화 중 오류:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
