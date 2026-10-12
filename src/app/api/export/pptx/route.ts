// PPT 내려받기 API (PLAN 15번, DESIGN 7장): POST { question, citations, audience, slides } → .pptx 파일
// 화면이 보낸 슬라이드를 그대로 믿지 않고, 실제 자료로 규칙을 다시 확인한 뒤 파일을 만든다.
import { RuleViolationError } from "@/lib/ai";
import { allowedTextFor } from "@/lib/ai/draft";
import { buildMockManuscript } from "@/lib/ai/manuscript";
import { errorResponse } from "@/lib/api/errors";
import { ExportPptxSchema } from "@/lib/api/schemas";
import { resolveEvidence } from "@/lib/draft/evidence";
import { buildPptx } from "@/lib/export/pptx";
import { checkSlides } from "@/lib/rules/checks";
import { LIMITS } from "@/lib/rules/constants";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT", "요청 형식이 올바르지 않습니다.");
  }

  const parsed = ExportPptxSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("INVALID_INPUT", parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.");
  }
  const { question, citations, audience, slides } = parsed.data;

  const evidence = resolveEvidence(citations);
  if (!evidence) {
    return errorResponse("INVALID_INPUT", "출처 자료를 찾지 못했습니다. 다시 질문한 뒤 시도해 주세요.");
  }

  try {
    const manuscript = buildMockManuscript(question, evidence.chunks);
    // 장수 자체는 이미 /api/draft에서 확인했으므로, 여기서는 글머리·30자·안내문·출처 장·숫자를 다시 본다.
    const { min, max } = LIMITS.slides;
    const requested = Math.min(Math.max(slides.length, min), max);
    const v = checkSlides(slides, requested, allowedTextFor(manuscript, [audience]), slides.length < min);
    if (v.length) throw new RuleViolationError(v);

    const file = await buildPptx(manuscript.title, slides);
    const filename = encodeURIComponent(`${manuscript.title}.pptx`);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="draft.pptx"; filename*=UTF-8''${filename}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof RuleViolationError) {
      return errorResponse("RULE_VIOLATION", "PPT 파일을 만드는 중 문제가 생겼습니다. 다시 시도해 주세요.");
    }
    return errorResponse("SERVER_ERROR", "잠시 후 다시 시도해 주세요.");
  }
}
