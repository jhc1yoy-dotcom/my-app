// 질문 API (PLAN 9번, DESIGN 7장): POST { question } → Answer
// 비밀번호 확인은 src/proxy.ts가 먼저 한다. 질문 내용은 서버 기록에 남기지 않는다.
import { z } from "zod";
import { answerQuestion, RuleViolationError } from "@/lib/ai";
import { errorResponse } from "@/lib/api/errors";
import { QuestionSchema } from "@/lib/api/schemas";

const AskSchema = z.object({ question: QuestionSchema });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT", "요청 형식이 올바르지 않습니다.");
  }

  const parsed = AskSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("INVALID_INPUT", parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다.");
  }

  try {
    return Response.json(answerQuestion(parsed.data.question));
  } catch (e) {
    if (e instanceof RuleViolationError) {
      return errorResponse("RULE_VIOLATION", "답변을 만드는 중 문제가 생겼습니다. 다시 시도해 주세요.");
    }
    return errorResponse("SERVER_ERROR", "잠시 후 다시 시도해 주세요.");
  }
}
