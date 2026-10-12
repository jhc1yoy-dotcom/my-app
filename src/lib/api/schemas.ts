// API 입력 검사 규칙 (zod). 숫자 한도는 모두 rules/constants의 LIMITS에서 가져온다.
import { z } from "zod";
import { LIMITS } from "@/lib/rules/constants";

export const AUDIENCE_MAX_CHARS = LIMITS.audienceMaxChars;

export const QuestionSchema = z
  .string()
  .trim()
  .min(1, "질문을 입력해 주세요.")
  .max(LIMITS.questionMaxChars, `질문은 ${LIMITS.questionMaxChars}자 이내로 입력해 주세요.`);

export const CitationSchema = z.object({
  docName: z.string().min(1).max(200),
  location: z.string().min(1).max(50),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  url: z.string().max(500).nullable(),
  superseded: z.boolean(),
});

export const CitationsSchema = z
  .array(CitationSchema)
  .min(LIMITS.citationsMin, "출처가 있는 답변만 결과물로 만들 수 있습니다.")
  .max(LIMITS.citationsMax);

const AudienceSchema = z
  .string()
  .trim()
  .min(1, "대상을 입력해 주세요.")
  .max(AUDIENCE_MAX_CHARS, `대상은 ${AUDIENCE_MAX_CHARS}자 이내로 입력해 주세요.`);

const SLIDES_MESSAGE = `PPT는 ${LIMITS.slides.min}~${LIMITS.slides.max}장으로 요청해 주세요.`;
const MINUTES_MESSAGE = `말씀자료는 ${LIMITS.speechMinutes.min}~${LIMITS.speechMinutes.max}분으로 요청해 주세요.`;

/**
 * 결과물 요청. 고른 종류의 분량만 검사한다 (PPT면 장수, 말씀자료면 분).
 * 다른 종류의 분량은 무시하고 기본값으로 채운다.
 */
export const DraftSchema = z
  .object({
    question: QuestionSchema,
    citations: CitationsSchema,
    kind: z.enum(["ppt", "speech"]),
    audience: AudienceSchema,
    slides: z.unknown().optional(),
    minutes: z.unknown().optional(),
  })
  .transform((d, ctx) => {
    const amount = (value: unknown, fallback: number, min: number, max: number, message: string) => {
      if (value === undefined || value === null || value === "") return fallback;
      const n = Number(value);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return n;
    };
    const slides = LIMITS.slides;
    const minutes = LIMITS.speechMinutes;
    return {
      ...d,
      slides: d.kind === "ppt" ? amount(d.slides, slides.default, slides.min, slides.max, SLIDES_MESSAGE) : slides.default,
      minutes:
        d.kind === "speech" ? amount(d.minutes, minutes.default, minutes.min, minutes.max, MINUTES_MESSAGE) : minutes.default,
    };
  });

/** 발표자 메모 최대 글자 수 (전체 출처 + 근거 400자 정도가 들어간다) */
const NOTES_MAX_CHARS = 1000;

// 화면이 보낸 슬라이드는 길이·개수를 먼저 제한한다 (아주 큰 요청으로 서버를 느리게 만드는 것 방지).
// 30자·5개 규칙 자체는 이후 규칙 점검기가 한 번 더 확인한다.
export const SlideSchema = z.object({
  no: z.number().int().min(1).max(LIMITS.slides.max + LIMITS.slides.tolerance),
  title: z.string().max(LIMITS.lineMaxChars),
  bullets: z.array(z.string().max(LIMITS.lineMaxChars)).max(LIMITS.bulletsPerSlideMax),
  kind: z.enum(["cover", "body", "sources"]),
  notes: z.string().max(NOTES_MAX_CHARS).optional(),
});

export const ExportPptxSchema = z.object({
  question: QuestionSchema,
  citations: CitationsSchema,
  audience: AudienceSchema,
  slides: z.array(SlideSchema).min(3).max(LIMITS.slides.max + LIMITS.slides.tolerance),
});
