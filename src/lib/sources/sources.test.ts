// 자료 최신화 시험 (PLAN 19~20번): 목록 점검, 조각 나누기, 개인 이름 경고, PDF·HWPX 변환
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import type { Source } from "@/lib/types";
import { markSuperseded } from "@/lib/search";
import { collectFile, collectLaw } from "./collect";
import { hwpxToParagraphs, pdfToPages } from "./convert";
import { personnelListWarning } from "./privacy";
import { piecesFromPages, piecesFromParagraphs, splitByArticle } from "./split";
import { validateSources } from "./validate";

const guideline = (over: Partial<Source> = {}): Source => ({
  id: "g1",
  kind: "guideline",
  name: "복무 지침",
  fileUrl: "https://www.mpm.go.kr/files/guide.pdf",
  version: "2025-03-01",
  kogl: "제1유형",
  enabled: true,
  ...over,
});

describe("수집 목록 점검", () => {
  it("규칙에 맞는 항목만 통과시키고, 꺼진 항목은 보지 않는다", () => {
    const { ok, problems } = validateSources([
      guideline(),
      guideline({ id: "off", enabled: false, kogl: "" }),
      { id: "law1", kind: "law", name: "국가공무원법", lawName: "국가공무원법", kogl: "법령", enabled: true },
    ]);
    expect(ok.map((s) => s.id)).toEqual(["g1", "law1"]);
    expect(problems).toEqual([]);
  });

  it("공공누리 유형이 비면 수집을 거부한다", () => {
    const { problems } = validateSources([guideline({ kogl: " " })]);
    expect(problems[0].reason).toContain("공공누리");
  });

  it("게시판 페이지 주소·HWP·시행일 없음은 거부한다", () => {
    const { problems } = validateSources([
      guideline({ id: "page", fileUrl: "https://www.mpm.go.kr/board/view.do?id=1" }),
      guideline({ id: "hwp", fileUrl: "https://www.mpm.go.kr/files/guide.hwp" }),
      guideline({ id: "nodate", version: "" }),
    ]);
    expect(problems.map((p) => p.id)).toEqual(["page", "hwp", "nodate"]);
  });
});

describe("조각 나누기", () => {
  const law = "총칙입니다. 제1조(목적) 이 규정은 복무에 관하여 정한다. 제2조(정의) 이 규정에서 쓰는 말의 뜻은 다음과 같다. 제2조(정의)에 따른 용어를 쓴다. 제3조의2(특례) 특례를 둔다.";

  it("조항 머리로 나누고, 본문 속 같은 조항 인용은 머리로 보지 않는다", () => {
    const pieces = splitByArticle(law);
    expect(pieces.map((p) => p.location)).toEqual(["제1조", "제2조", "제3조의2"]);
    expect(pieces[1].text).toContain("제2조(정의)에 따른");
  });

  it("조항 머리가 없으면 PDF는 쪽 단위로 나누고 짧은 쪽은 버린다", () => {
    const pieces = piecesFromPages(["첫 쪽에는 출장 여비의 지급 기준이 적혀 있습니다.", "3", "셋째 쪽에는 숙박비 기준이 적혀 있습니다."]);
    expect(pieces.map((p) => p.location)).toEqual(["1쪽", "3쪽"]);
  });

  it("HWPX 문단은 묶어서 '문단 n'으로 나눈다", () => {
    const pieces = piecesFromParagraphs(["유연근무제는 기관장 승인을 받아 신청합니다.", "신청서는 전자결재로 제출합니다."]);
    expect(pieces).toEqual([{ location: "문단 1", text: "유연근무제는 기관장 승인을 받아 신청합니다. 신청서는 전자결재로 제출합니다." }]);
  });

  it("아주 긴 조항은 800자 이내로 나누고, 나눈 조각마다 서로 다른 이름을 붙인다", () => {
    const long = `제1조(목적) ${"이 규정은 복무에 관한 사항을 정한다. ".repeat(60)} 제2조(정의) 짧은 조항입니다.`;
    const pieces = piecesFromPages([long]);
    const first = pieces.filter((p) => p.location.startsWith("제1조"));
    expect(first.length).toBeGreaterThan(1);
    expect(first[0].location).toBe(`제1조 (1/${first.length})`);
    expect(new Set(pieces.map((p) => p.location)).size).toBe(pieces.length);
    expect(pieces.at(-1)?.location).toBe("제2조");
    pieces.forEach((p) => expect(p.text.length).toBeLessThanOrEqual(800));
  });

  it("마침표 없이 아주 긴 문장도 800자 이내로 자른다", () => {
    const pieces = piecesFromPages([`첫 쪽 ${"가".repeat(2000)}`]);
    expect(pieces.length).toBe(3);
    pieces.forEach((p) => expect(p.text.length).toBeLessThanOrEqual(800));
  });
});

describe("개인 이름 경고", () => {
  it("인사 명단으로 보이면 경고하고, 일반 지침은 경고하지 않는다", () => {
    expect(personnelListWarning("2025년 7월 인사발령 사항")).toContain("인사발령");
    expect(personnelListWarning("성명 홍길동 김영희")).toContain("성명");
    expect(personnelListWarning("본문에는 이름이 없습니다", "7월 승진자 명단")).toContain("승진자 명단");
    expect(personnelListWarning("유연근무제 운영 지침입니다.", "유연근무 지침")).toBeNull();
  });
});

/** 테스트용 HWPX(압축 파일) 만들기 */
async function makeHwpx(paragraphs: string[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const body = paragraphs
    .map((p) => `<hp:p id="1"><hp:run charPrIDRef="0"><hp:t>${p}</hp:t></hp:run></hp:p>`)
    .join("");
  zip.file("mimetype", "application/hwp+zip");
  zip.file("Contents/section0.xml", `<?xml version="1.0"?><hs:sec xmlns:hs="x" xmlns:hp="y">${body}</hs:sec>`);
  return zip.generateAsync({ type: "uint8array" });
}

/** 테스트용 PDF(한 쪽에 영어 한 줄) 만들기. 줄 위치(xref)를 계산해 올바른 파일을 만든다. */
function makePdf(text: string): Uint8Array {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${`BT /F1 12 Tf 20 100 Td (${text}) Tj ET`.length} >>\nstream\nBT /F1 12 Tf 20 100 Td (${text}) Tj ET\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => (pdf += `${String(o).padStart(10, "0")} 00000 n \n`));
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

describe("파일 변환", () => {
  it("HWPX에서 문단 글자를 뽑는다 (특수문자 복원 포함)", async () => {
    const paragraphs = await hwpxToParagraphs(await makeHwpx(["제1조(목적) 복무 &amp; 근무", "둘째 문단"]));
    expect(paragraphs).toEqual(["제1조(목적) 복무 & 근무", "둘째 문단"]);
  });

  it("PDF에서 쪽마다 글자를 뽑는다", async () => {
    const pages = await pdfToPages(makePdf("Leave policy page one"));
    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain("Leave policy page one");
  });

  it("첨부파일을 내려받아 조각으로 만들고, 같은 문서의 이전 판은 (새 판에서 없어진 조항까지) 개정 전으로 표시된다", async () => {
    const files: Record<string, Uint8Array> = {
      "https://www.mpm.go.kr/files/v1.hwpx": await makeHwpx(["제1조(기간) 휴직은 1년으로 한다.", "제2조(신청) 신청서를 낸다.", "제3조(특례) 옛 특례를 둔다."]),
      "https://www.mpm.go.kr/files/v2.hwpx": await makeHwpx(["제1조(기간) 휴직은 3년으로 한다.", "제2조(신청) 신청서를 낸다."]),
    };
    const fakeFetch = (async (url: string) => new Response(files[url] as BlobPart)) as unknown as typeof fetch;

    const v1 = await collectFile(guideline({ id: "leave-2024", name: "휴직 지침", fileUrl: "https://www.mpm.go.kr/files/v1.hwpx", version: "2024-01-01" }), fakeFetch);
    const v2 = await collectFile(guideline({ id: "leave-2025", name: "휴직 지침", fileUrl: "https://www.mpm.go.kr/files/v2.hwpx", version: "2025-01-01" }), fakeFetch);
    expect(v1.warnings).toEqual([]);
    expect(v2.chunks.map((c) => c.location)).toEqual(["제1조", "제2조"]);
    expect(v2.chunks[0]).toMatchObject({ docName: "휴직 지침", effectiveDate: "2025-01-01", mock: false, url: "https://www.mpm.go.kr/files/v2.hwpx" });

    const marked = markSuperseded([...v1.chunks, ...v2.chunks]);
    expect(marked.filter((c) => c.superseded).map((c) => `${c.effectiveDate} ${c.location}`)).toEqual([
      "2024-01-01 제1조",
      "2024-01-01 제2조",
      "2024-01-01 제3조", // 새 판에 없는 조항도 옛 판이므로 개정 전
    ]);
    expect(marked.filter((c) => !c.superseded).every((c) => c.effectiveDate === "2025-01-01")).toBe(true);
  });

  it("이미 개정 전으로 저장된 표시는 다시 계산해도 지워지지 않는다", () => {
    const stored = { id: "a", docName: "단독 문서", location: "제1조", text: "옛 내용", effectiveDate: "2020-01-01", url: null, superseded: true, mock: false };
    expect(markSuperseded([stored])[0].superseded).toBe(true);
  });

  it("내려받기에 실패하면 이유를 알려 준다", async () => {
    const notFound = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
    await expect(collectFile(guideline(), notFound)).rejects.toThrow("HTTP 404");
  });
});

describe("법령 수집 (인증키 승인 전)", () => {
  it("LAW_API_KEY가 없으면 건너뛰고 안내한다", async () => {
    const r = await collectLaw({ id: "law1", kind: "law", name: "국가공무원법", lawName: "국가공무원법", kogl: "법령", enabled: true }, undefined);
    expect(r.chunks).toEqual([]);
    expect(r.warnings[0]).toContain("LAW_API_KEY");
  });
});
