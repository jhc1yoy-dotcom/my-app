// 인사나침반 공통 데이터 형식 (DESIGN.md 6장)
// 날짜는 모두 "YYYY-MM-DD" 문자열로 다룬다.

/** 수집 목록 1건 (data/sources.json) */
export type SourceKind = "law" | "guideline" | "publication" | "press";

export interface Source {
  id: string;
  kind: SourceKind;
  /** 화면·출처에 보일 문서명 */
  name: string;
  /** 법령이면 법제처 API로 찾을 법령명 */
  lawName?: string;
  /** 지침·간행물이면 첨부파일(PDF·HWPX) 직접 주소. 게시판 페이지 주소는 받지 않는다. */
  fileUrl?: string;
  /** 이 판의 시행일(게시일). 같은 문서의 이전 판을 함께 두면 개정 전으로 표시된다. */
  version?: string;
  /** 공공누리 유형 (필수, 비어 있으면 수집 거부) */
  kogl: string;
  /** false면 최신화 때 건너뛴다 (주소를 아직 채우지 않은 예시 등) */
  enabled: boolean;
}

/** 자료 조각 (data/corpus.json, data/corpus.mock.json) */
export interface Chunk {
  id: string;
  docName: string;
  /** 조항 또는 쪽 (예: "제5조", "12쪽") */
  location: string;
  text: string;
  /** 시행일(게시일) */
  effectiveDate: string;
  /** 원문 주소. 모의 자료는 원문이 없으므로 null */
  url: string | null;
  /** 같은 문서·같은 조항의 더 최신 판이 있으면 true */
  superseded: boolean;
  /** 모의 자료면 true */
  mock: boolean;
}

/** 답변·결과물에 붙는 출처 */
export interface Citation {
  docName: string;
  location: string;
  effectiveDate: string;
  url: string | null;
  superseded: boolean;
}

/** 근거가 없을 때 안내하는 사이트 */
export interface GuideSite {
  name: string;
  url: string;
}

/** 질문에 대한 답변 */
export interface Answer {
  /** 답변 본문 (결론이 첫 문장, 500자 이내). 근거 없음이면 안내 문구 */
  text: string;
  /** 출처 0~3개 (근거 없음일 때만 0개) */
  citations: Citation[];
  noEvidence: boolean;
  /** 근거 없음일 때 찾아볼 사이트 */
  guideSites: GuideSite[];
  /** 개별 사안이면 true → "최종 판단은 소관 부서에 확인하세요" 표시 */
  needsDeptCheck: boolean;
  /** 모의 자료로 답했으면 true */
  mock: boolean;
}

/** 결과물의 바탕이 되는 원고 */
export interface Manuscript {
  title: string;
  /** 핵심 메시지 최대 3개 */
  messages: string[];
  /** 근거 문장 목록 */
  evidence: string[];
  citations: Citation[];
}

export type SlideKind = "cover" | "body" | "sources";

export interface Slide {
  /** 1부터 시작하는 장 번호 */
  no: number;
  title: string;
  /** 글머리 최대 5개, 각 30자 이내 */
  bullets: string[];
  kind: SlideKind;
  /** 발표자 메모 (줄이지 않은 전체 출처 등) */
  notes?: string;
}

export interface Speech {
  /** 말씀자료 본문 (안내문·출처 단락 제외) */
  body: string;
  /** 요청 분량(분) */
  minutes: number;
  citations: Citation[];
  /** 자료가 모자라 요청 분량보다 짧게 만들었으면 true */
  shortened: boolean;
}

/** 시험 질문 (data/test-questions.json) */
export type TestCategory = "normal" | "superseded" | "no-evidence" | "individual";

export interface TestQuestion {
  id: string;
  question: string;
  category: TestCategory;
  /** 답변 본문에 들어 있어야 하는 핵심 내용 */
  expectedKeyPoints: string[];
  /** 출처에 들어 있어야 하는 문서 (근거 없음이면 빈 배열) */
  expectedCitations: { docName: string; location: string; effectiveDate: string }[];
}
