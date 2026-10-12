// 슬라이드 → .pptx 파일 (PLAN 15번, DESIGN 4.3: 서버 메모리에서 만들어 바로 내려보내고 저장하지 않는다)
import PptxGenJS from "pptxgenjs";
import type { Slide } from "@/lib/types";

const FONT = "맑은 고딕";

export async function buildPptx(title: string, slides: Slide[]): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 16:9
  pptx.title = title;

  for (const s of slides) {
    const slide = pptx.addSlide();
    if (s.kind === "cover") {
      slide.addText(s.title, { x: 0.8, y: 2.2, w: 11.7, h: 1.2, fontFace: FONT, fontSize: 36, bold: true });
      slide.addText(
        s.bullets.map((b, i) => ({
          text: b,
          // 첫 줄(AI 초안 안내문)은 눈에 띄게 빨간색으로
          options: { breakLine: true, color: i === 0 ? "C00000" : "404040", bold: i === 0 },
        })),
        { x: 0.8, y: 3.6, w: 11.7, h: 1.4, fontFace: FONT, fontSize: 18 },
      );
    } else {
      slide.addText(s.title, { x: 0.6, y: 0.4, w: 12.1, h: 0.9, fontFace: FONT, fontSize: 28, bold: true });
      slide.addText(
        s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
        { x: 0.8, y: 1.5, w: 11.7, h: 5.2, fontFace: FONT, fontSize: 22, valign: "top", paraSpaceAfter: 8 },
      );
    }
    slide.addText(String(s.no), { x: 12.3, y: 7.0, w: 0.8, h: 0.4, fontFace: FONT, fontSize: 10, color: "808080", align: "right" });
    if (s.notes) slide.addNotes(s.notes);
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  return out as Buffer;
}
