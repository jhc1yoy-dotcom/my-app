// 결과물 API (PLAN 13번, DESIGN 7장)
// POST { question, citations, kind, audience, slides?, minutes? } → { manuscript, slides? | speech?, shortened, mock }
import { RuleViolationError } from "@/lib/ai";
import { EvidenceNotFoundError, makeDraft } from "@/lib/ai/draft";
import { errorResponse } from "@/lib/api/errors";
import { DraftSchema } from "@/lib/api/schemas";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT", "요청 형식이 올바르지 않습니다.");
  }

  const parsed = DraftSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("INVALID_INPUT", parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.");
  }

  try {
    return Response.json(makeDraft(parsed.data));
  } catch (e) {
    if (e instanceof EvidenceNotFoundError) {
      return errorResponse("INVALID_INPUT", "출처 자료를 찾지 못했습니다. 다시 질문한 뒤 시도해 주세요.");
    }
    if (e instanceof RuleViolationError) {
      return errorResponse("RULE_VIOLATION", "초안을 만드는 중 문제가 생겼습니다. 다시 시도해 주세요.");
    }
    return errorResponse("SERVER_ERROR", "잠시 후 다시 시도해 주세요.");
  }
}
