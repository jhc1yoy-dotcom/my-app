// API 공통 오류 형식 (DESIGN 7·8장): { "error": { "code": "...", "message": "한국어 안내문" } }

export type ErrorCode = "UNAUTHORIZED" | "INVALID_INPUT" | "RULE_VIOLATION" | "SERVER_ERROR";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  INVALID_INPUT: 400,
  RULE_VIOLATION: 500,
  SERVER_ERROR: 500,
};

export interface ApiError {
  error: { code: ErrorCode; message: string };
}

export function errorResponse(code: ErrorCode, message: string): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status: STATUS[code] });
}
