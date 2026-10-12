// 변환한 글을 조항 또는 쪽 단위 조각으로 나눈다 (PLAN 19번, DESIGN 3.3 ③)

export interface Piece {
  /** 조항 또는 쪽 (예: "제5조", "12쪽", "문단 3") */
  location: string;
  text: string;
}

/** 조각 하나의 최대 글자 수. 너무 긴 조항은 나눠서 검색이 한 주제에 집중되게 한다. */
const MAX_PIECE_CHARS = 800;
/** 이보다 짧은 조각(머리말·쪽 번호 등)은 버린다. */
const MIN_PIECE_CHARS = 15;

/** 줄바꿈·여러 칸 띄어쓰기를 한 칸으로 정리한다. */
export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** "제5조(육아휴직)" 같은 조항 머리가 있으면 조항 단위로 나눈다. 없으면 빈 배열. */
export function splitByArticle(text: string): Piece[] {
  const re = /제\s?(\d+)\s?조(?:의\s?(\d+))?\s?\(/g;
  const starts: { index: number; location: string }[] = [];
  for (const m of text.matchAll(re)) {
    const location = `제${m[1]}조${m[2] ? `의${m[2]}` : ""}`;
    // 본문 속 "제5조(…)에 따라" 같은 인용을 머리로 잘못 잡지 않도록, 같은 조항 번호는 처음 나온 것만 쓴다.
    if (!starts.some((s) => s.location === location)) starts.push({ index: m.index ?? 0, location });
  }
  if (starts.length < 2) return [];
  return starts
    .map((s, i) => ({
      location: s.location,
      text: cleanText(text.slice(s.index, starts[i + 1]?.index ?? text.length)),
    }))
    .filter((p) => p.text.length >= MIN_PIECE_CHARS);
}

/** 긴 조각을 문장 경계에서 MAX_PIECE_CHARS 이내로 나눈다. 같은 조항(쪽) 이름을 유지한다. */
export function limitLength(pieces: Piece[]): Piece[] {
  return pieces.flatMap((p) => {
    if (p.text.length <= MAX_PIECE_CHARS) return [p];
    const sentences = p.text.split(/(?<=[.。])\s+/);
    const out: Piece[] = [];
    let buf = "";
    for (const s of sentences) {
      if (buf && (buf + " " + s).length > MAX_PIECE_CHARS) {
        out.push({ location: p.location, text: buf });
        buf = s;
      } else buf = buf ? `${buf} ${s}` : s;
    }
    if (buf) out.push({ location: p.location, text: buf.slice(0, MAX_PIECE_CHARS * 2) });
    return out;
  });
}

/**
 * PDF: 조항 머리가 있으면 조항 단위, 없으면 쪽 단위로 나눈다.
 * @param pages 쪽마다 뽑은 글
 */
export function piecesFromPages(pages: string[]): Piece[] {
  const byArticle = splitByArticle(pages.join("\n"));
  if (byArticle.length) return limitLength(byArticle);
  return limitLength(
    pages
      .map((t, i) => ({ location: `${i + 1}쪽`, text: cleanText(t) }))
      .filter((p) => p.text.length >= MIN_PIECE_CHARS),
  );
}

/**
 * HWPX: 쪽 정보가 없으므로 조항 머리가 있으면 조항 단위, 없으면 문단을 묶어 "문단 n"으로 나눈다.
 * @param paragraphs 문단마다 뽑은 글
 */
export function piecesFromParagraphs(paragraphs: string[]): Piece[] {
  const byArticle = splitByArticle(paragraphs.join("\n"));
  if (byArticle.length) return limitLength(byArticle);
  const pieces: Piece[] = [];
  let buf = "";
  let start = 1;
  paragraphs.map(cleanText).forEach((p, i) => {
    if (!p) return;
    if (buf && (buf + " " + p).length > MAX_PIECE_CHARS) {
      pieces.push({ location: `문단 ${start}`, text: buf });
      buf = p;
      start = i + 1;
    } else buf = buf ? `${buf} ${p}` : p;
  });
  if (buf) pieces.push({ location: `문단 ${start}`, text: buf });
  return limitLength(pieces.filter((p) => p.text.length >= MIN_PIECE_CHARS));
}
