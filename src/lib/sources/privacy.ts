// 개인 이름이 많아 보이는 자료 경고 (PLAN 20번, DESIGN 3.3 "개인 이름 경고 기준")
// 자동으로 빼지 않는다. 경고만 하고, 목록에서 뺄지는 관리자가 정한다.

const LIST_WORDS = ["인사발령", "전보 명단", "승진 명단", "승진자 명단", "임용 명단", "발령 명단", "발령사항"];

/**
 * @param text 변환한 본문
 * @param title 문서 제목 (수집 목록의 name)
 */
export function personnelListWarning(text: string, title = ""): string | null {
  const found = LIST_WORDS.find((w) => title.includes(w) || text.includes(w));
  if (found) return `'${found}' 낱말이 있습니다 (인사 명단일 수 있음)`;
  if (/성\s?명/.test(text)) return "'성명' 표 머리글이 있습니다 (인사 명단일 수 있음)";
  return null;
}
