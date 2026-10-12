// PDF·HWPX 파일에서 글자 뽑기 (PLAN 19번). 옛 한글(HWP)·스캔본(OCR)은 다루지 않는다 (PRD 비범위).
import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";

/** PDF → 쪽마다의 글 */
export async function pdfToPages(data: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  return text;
}

/**
 * HWPX → 문단마다의 글.
 * HWPX는 압축 파일이며, 본문은 Contents/section0.xml, section1.xml …에 있다.
 * 문단은 <hp:p>, 글자는 그 안의 <hp:t>에 들어 있다.
 */
export async function hwpxToParagraphs(data: Uint8Array): Promise<string[]> {
  const zip = await JSZip.loadAsync(data);
  const sections = Object.keys(zip.files)
    .filter((name) => /^Contents\/section\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
  if (sections.length === 0) throw new Error("HWPX 본문(Contents/section*.xml)을 찾지 못했습니다.");

  const paragraphs: string[] = [];
  for (const name of sections) {
    const xml = await zip.files[name].async("string");
    for (const p of xml.match(/<hp:p[\s>][\s\S]*?<\/hp:p>/g) ?? []) {
      const text = [...p.matchAll(/<hp:t(?:\s[^>]*)?>([\s\S]*?)<\/hp:t>/g)]
        .map((m) => decodeXml(m[1].replace(/<[^>]+>/g, "")))
        .join("");
      if (text.trim()) paragraphs.push(text);
    }
  }
  return paragraphs;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}
