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
  docName: z.string().min(1),
  location: z.string().min(1),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  url: z.string().nullable(),
  superseded: z.boolean(),
});

export const CitationsSchema = z
  .array(CitationSchema)
  .min(LIMITS.citationsMin, "출처가 있는 답변만 결과물로 만들 수 있습니다.")
  .max(LIMITS.citationsMax);

export const DraftSchema = z.object({
  question: QuestionSchema,
  citations: CitationsSchema,
  kind: z.enum(["ppt", "speech"]),
  audience: z
    .string()
    .trim()
    .min(1, "대상을 입력해 주세요.")
    .max(AUDIENCE_MAX_CHARS, `대상은 ${AUDIENCE_MAX_CHARS}자 이내로 입력해 주세요.`),
  slides: z.coerce
    .number()
    .int()
    .min(LIMITS.slides.min, `PPT는 ${LIMITS.slides.min}~${LIMITS.slides.max}장으로 요청해 주세요.`)
    .max(LIMITS.slides.max, `PPT는 ${LIMITS.slides.min}~${LIMITS.slides.max}장으로 요청해 주세요.`)
    .default(LIMITS.slides.default),
  minutes: z.coerce
    .number()
    .int()
    .min(LIMITS.speechMinutes.min, `말씀자료는 ${LIMITS.speechMinutes.min}~${LIMITS.speechMinutes.max}분으로 요청해 주세요.`)
    .max(LIMITS.speechMinutes.max, `말씀자료는 ${LIMITS.speechMinutes.min}~${LIMITS.speechMinutes.max}분으로 요청해 주세요.`)
    .default(LIMITS.speechMinutes.default),
});

export const SlideSchema = z.object({
  no: z.number().int().min(1),
  title: z.string(),
  bullets: z.array(z.string()),
  kind: z.enum(["cover", "body", "sources"]),
  notes: z.string().optional(),
});

export const ExportPptxSchema = z.object({
  question: QuestionSchema,
  citations: CitationsSchema,
  audience: DraftSchema.shape.audience,
  slides: z.array(SlideSchema).min(3).max(LIMITS.slides.max + LIMITS.slides.tolerance),
});
