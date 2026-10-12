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

/**
 * 줄바꿈·여러 칸 띄어쓰기를 한 칸으로 정리한다.
 * PDF의 아이콘 글리프(사용자 정의 문자)와 반쪽짜리 문자(짝 없는 서로게이트)는 지운다.
 * (깨진 글자로 보이거나, 자료 파일을 읽는 도구가 오류를 낼 수 있음)
 */
export function cleanText(text: string): string {
  return text
    .replace(/\p{Co}/gu, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

/**
 * 긴 조각을 문장 경계에서 MAX_PIECE_CHARS 이내로 나눈다.
 * 나눈 조각에는 "제5조 (1/3)"처럼 서로 다른 이름을 붙인다.
 * (출처는 문서명·조항·시행일로 조각을 되찾으므로, 이름이 겹치면 결과물이 다른 조각으로 만들어질 수 있다.)
 */
export function limitLength(pieces: Piece[]): Piece[] {
  return pieces.flatMap((p) => {
    if (p.text.length <= MAX_PIECE_CHARS) return [p];
    const sentences = p.text.split(/(?<=[.。])\s+/);
    const texts: string[] = [];
    let buf = "";
    for (const s of sentences) {
      if (buf && (buf + " " + s).length > MAX_PIECE_CHARS) {
        texts.push(buf);
        buf = s;
      } else buf = buf ? `${buf} ${s}` : s;
    }
    if (buf) texts.push(buf);
    // 마침표 없이 아주 긴 문장은 글자 수로 자른다 (u 플래그: 두 칸짜리 문자를 반으로 자르지 않도록).
    const parts = texts.flatMap((t) => t.match(new RegExp(`[\\s\\S]{1,${MAX_PIECE_CHARS}}`, "gu")) ?? [t]);
    if (parts.length === 1) return [{ location: p.location, text: parts[0] }];
    return parts.map((text, i) => ({ location: `${p.location} (${i + 1}/${parts.length})`, text }));
  });
}

/** 간행물 조각의 목표 크기: 한 쪽을 글머리(○ ∙ ※ 등) 단위로 묶어 이 글자 수 안팎으로 나눈다. */
const PUB_PIECE_CHARS = 400;

/**
 * 쪽 맨 앞의 머리글(장 제목·쪽 번호)을 지운다.
 * 예: "신 분 및 권 익 보 장 제9장 431 ∙ 부부가…" → "∙ 부부가…", "82 (2) 승진…" → "(2) 승진…"
 */
export function stripRunningHeader(text: string): string {
  return text
    .replace(/^(?:[가-힣･·]+\s){1,}[가-힣･·]+\s*제\s?\d+\s?장\s*\d*\s*/, "")
    .replace(/^\d{1,4}\s+/, "")
    .trim();
}

/** 글머리 기호(○ ∙ • ◦ □ ■ ※, (1), (가)) 앞에서 나눈다. 기호는 뒤 글과 함께 둔다. */
export function splitByBullets(text: string): string[] {
  return text
    .split(/\s(?=[○∙•◦□■▪※]|\(\d{1,2}\)\s|\([가-하]\)\s)/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 간행물(해설서) 한 쪽을 글머리 단위로 묶어 PUB_PIECE_CHARS 안팎의 조각으로 나눈다.
 * 한 쪽이 여러 조각이 되면 "431쪽 (2/3)"처럼 이름을 붙인다.
 * (쪽 전체를 한 조각으로 두면 짧은 질문의 낱말이 거의 모든 쪽에 들어 있어 검색이 정확하지 않다.)
 */
function piecesFromPublicationPage(text: string, pageNo: number): Piece[] {
  const groups: string[] = [];
  let buf = "";
  for (const seg of splitByBullets(stripRunningHeader(text))) {
    if (buf && (buf + " " + seg).length > PUB_PIECE_CHARS) {
      groups.push(buf);
      buf = seg;
    } else buf = buf ? `${buf} ${seg}` : seg;
  }
  if (buf) groups.push(buf);
  // 글머리 하나가 아주 길면 limitLength가 다시 나눈다 (이름이 겹치지 않도록 쪽 이름에 순번을 먼저 붙인다).
  const named = groups
    .filter((g) => g.length >= MIN_PIECE_CHARS)
    .map((g, i, all) => ({ location: all.length === 1 ? `${pageNo}쪽` : `${pageNo}쪽 (${i + 1}/${all.length})`, text: g }));
  return limitLength(named);
}

/**
 * PDF: 조항 머리가 있으면 조항 단위, 없으면 쪽 단위로 나눈다.
 * 쪽 번호는 PDF 파일의 쪽 순서다 (책에 인쇄된 쪽 번호와 다를 수 있음).
 * @param pages 쪽마다 뽑은 글
 * @param byArticle false면 간행물(해설서)로 보고, 쪽을 글머리 단위로 묶어 나눈다
 */
export function piecesFromPages(pages: string[], byArticle = true): Piece[] {
  if (!byArticle) return pages.flatMap((t, i) => piecesFromPublicationPage(cleanText(t), i + 1));
  const articles = splitByArticle(pages.join("\n"));
  if (articles.length) return limitLength(articles);
  return limitLength(
    pages
      .map((t, i) => ({ location: `${i + 1}쪽`, text: cleanText(t) }))
      .filter((p) => p.text.length >= MIN_PIECE_CHARS),
  );
}

/**
 * HWPX: 쪽 정보가 없으므로 조항 머리가 있으면 조항 단위, 없으면 문단을 묶어 "문단 n"으로 나눈다.
 * @param paragraphs 문단마다 뽑은 글
 * @param byArticle false면 조항 머리가 있어도 문단 단위로 나눈다 (간행물·해설서용)
 */
export function piecesFromParagraphs(paragraphs: string[], byArticle = true): Piece[] {
  const articles = byArticle ? splitByArticle(paragraphs.join("\n")) : [];
  if (articles.length) return limitLength(articles);
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
