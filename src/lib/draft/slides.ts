// 원고 → 슬라이드 구성 (PLAN 14번, DESIGN 3.2 "PPT 장수 규칙")
// 장수는 표지·출처 장을 포함해 센다. 본문이 모자라면 지어내지 않고 원문을 더 잘게 나눠 채우고,
// 그래도 모자라면 짧게 만들고 분량 부족으로 표시한다.
import type { Citation, Manuscript, Slide } from "@/lib/types";
import { DISCLAIMER, LIMITS, SUPERSEDED_LABEL } from "@/lib/rules/constants";
import { formatDate } from "@/lib/format";
import { splitSentences, truncate, wrapLines } from "./text";

interface Section {
  title: string;
  /** 문장 단위 묶음. 한 묶음(문장)은 슬라이드 사이에서 쪼개지 않는다. 묶음마다 최대 5줄. */
  units: string[][];
  notes?: string;
}

export interface SlideResult {
  slides: Slide[];
  /** 자료가 모자라 요청 장수보다 짧게 만들었으면 true */
  shortened: boolean;
}

function citationFull(c: Citation): string {
  return `${c.docName} ${c.location} (${formatDate(c.effectiveDate)} 시행)${c.superseded ? ` ${SUPERSEDED_LABEL}` : ""}`;
}

/** 문장 하나를 30자 줄들로 나누고, 5줄이 넘으면 5줄씩 끊어 여러 묶음으로 만든다. */
function sentenceUnits(text: string): string[][] {
  return splitSentences(text).flatMap((s) => {
    const lines = wrapLines(s);
    const units: string[][] = [];
    for (let i = 0; i < lines.length; i += LIMITS.bulletsPerSlideMax) {
      units.push(lines.slice(i, i + LIMITS.bulletsPerSlideMax));
    }
    return units;
  });
}

/** 원고를 슬라이드 본문 단위(섹션)로 나눈다. 모든 줄은 30자 이내다. */
function toSections(m: Manuscript): Section[] {
  const sections: Section[] = [{ title: "핵심 요약", units: m.messages.flatMap(sentenceUnits) }];
  m.evidence.forEach((text, i) => {
    const c = m.citations[i];
    const [first = [], ...rest] = sentenceUnits(text);
    const docLine = truncate(c.docName);
    // 문서명 줄은 첫 문장과 같은 슬라이드에 둔다 (문서명만 있는 슬라이드가 생기지 않도록).
    const units =
      first.length < LIMITS.bulletsPerSlideMax ? [[docLine, ...first], ...rest] : [[docLine], first, ...rest];
    sections.push({
      title: truncate(`${c.superseded ? "이전 기준" : "근거"}: ${c.location}`),
      units,
      notes: `${citationFull(c)}\n${text}`,
    });
  });
  return sections.filter((s) => s.units.length > 0);
}

/** 섹션을 슬라이드로 나눈다. 장당 문장 묶음은 최대 maxUnits개, 글머리는 최대 5줄이다. */
function paginate(sections: Section[], maxUnits: number): Omit<Slide, "no">[] {
  return sections.flatMap((s) => {
    const pages: Omit<Slide, "no">[] = [];
    let bullets: string[] = [];
    let count = 0;
    const flush = () => {
      if (!bullets.length) return;
      pages.push({
        title: pages.length === 0 ? s.title : truncate(`${s.title} (계속)`),
        bullets,
        kind: "body",
        notes: s.notes,
      });
      bullets = [];
      count = 0;
    };
    for (const unit of s.units) {
      if (count >= maxUnits || bullets.length + unit.length > LIMITS.bulletsPerSlideMax) flush();
      bullets = [...bullets, ...unit];
      count++;
    }
    flush();
    return pages;
  });
}

/** 출처 장: 출처가 2개 이하면 "문서명 / 조항·시행일" 두 줄씩, 3개면 한 줄씩(줄임표). 전체는 발표자 메모에. */
function sourcesSlide(citations: Citation[]): Omit<Slide, "no"> {
  const twoLines = citations.length * 2 <= LIMITS.bulletsPerSlideMax;
  const bullets = twoLines
    ? citations.flatMap((c) => [
        truncate(c.docName),
        truncate(`${c.location} · ${formatDate(c.effectiveDate)} 시행${c.superseded ? ` ${SUPERSEDED_LABEL}` : ""}`),
      ])
    : citations.map((c) => truncate(`${c.location} ${formatDate(c.effectiveDate)} ${c.docName}`));
  return { title: "출처", bullets, kind: "sources", notes: citations.map(citationFull).join("\n") };
}

/**
 * @param requested 요청 장수 (5~20, 표지·출처 장 포함)
 * @param audience 대상 (표지에 표시)
 */
export function buildSlides(m: Manuscript, requested: number, audience: string): SlideResult {
  const target = requested - 2; // 표지·출처 장을 뺀 본문 장수
  const { tolerance } = LIMITS.slides;
  const sections = toSections(m);

  // 장당 문장 수를 줄여 가며(5 → 1), 본문 장수가 목표(−1장 허용)에 닿는 가장 큰 값을 고른다.
  // 문장 중간에서는 슬라이드를 나누지 않으므로, 1문장씩 나눠도 모자라면 분량 부족이 된다.
  let body = paginate(sections, LIMITS.bulletsPerSlideMax);
  for (let per = LIMITS.bulletsPerSlideMax; per >= 1; per--) {
    body = paginate(sections, per);
    if (body.length >= target - tolerance) break;
  }
  // 목표보다 많으면 뒤쪽 본문을 덜어 낸다 (전체 출처는 출처 장에 그대로 남는다).
  if (body.length > target + tolerance) body = body.slice(0, target);

  const cover: Omit<Slide, "no"> = {
    title: m.title,
    bullets: [DISCLAIMER, truncate(`대상: ${audience}`)],
    kind: "cover",
  };
  const slides = [cover, ...body, sourcesSlide(m.citations)].map((s, i) => ({ ...s, no: i + 1 }));
  return { slides, shortened: Math.abs(slides.length - requested) > tolerance };
}
