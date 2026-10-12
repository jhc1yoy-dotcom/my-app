// 결과물 만들기 (PLAN 12~14·17번, DESIGN 3.2)
// 출처 → 실제 조각 되찾기 → 원고 → 슬라이드/말씀자료 → 규칙 점검. 규칙에 걸리면 내보내지 않는다.
import type { Citation, Manuscript, Slide, Speech } from "@/lib/types";
import { checkSlides, checkSpeech, citationsToText } from "@/lib/rules/checks";
import { resolveEvidence } from "@/lib/draft/evidence";
import { buildSlides } from "@/lib/draft/slides";
import { buildSpeech } from "@/lib/draft/speech";
import { RuleViolationError } from "./index";
import { buildMockManuscript } from "./manuscript";

export type DraftKind = "ppt" | "speech";

export interface DraftRequest {
  question: string;
  citations: Citation[];
  kind: DraftKind;
  audience: string;
  slides: number;
  minutes: number;
}

export interface DraftResult {
  manuscript: Manuscript;
  slides?: Slide[];
  speech?: Speech;
  shortened: boolean;
  mock: boolean;
}

/** 출처가 자료 묶음에 없으면 던지는 오류 */
export class EvidenceNotFoundError extends Error {}

/** 숫자 검사에 쓸 허용 글: 근거 조각 본문 + 출처 + 사용자가 넣은 제목·대상 */
export function allowedTextFor(m: Manuscript, extra: string[]): string {
  return [...m.evidence, citationsToText(m.citations), m.title, ...extra].join("\n");
}

export function makeDraft(req: DraftRequest): DraftResult {
  const evidence = resolveEvidence(req.citations);
  if (!evidence) throw new EvidenceNotFoundError("출처에 해당하는 자료를 찾지 못했습니다.");

  const manuscript = buildMockManuscript(req.question, evidence.chunks);
  const allowed = allowedTextFor(manuscript, [req.audience]);

  if (req.kind === "ppt") {
    const { slides, shortened } = buildSlides(manuscript, req.slides, req.audience);
    const v = checkSlides(slides, req.slides, allowed, shortened);
    if (v.length) throw new RuleViolationError(v);
    return { manuscript, slides, shortened, mock: evidence.mock };
  }

  const speech = buildSpeech(manuscript, req.minutes, req.audience);
  const v = checkSpeech(speech, allowed);
  if (v.length) throw new RuleViolationError(v);
  return { manuscript, speech, shortened: speech.shortened, mock: evidence.mock };
}
