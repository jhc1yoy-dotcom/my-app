// 개인 이름이 많아 보이는 자료 경고 (PLAN 20번, DESIGN 3.3 "개인 이름 경고 기준")
// 자동으로 빼지 않는다. 경고만 하고, 목록에서 뺄지는 관리자가 정한다.

const LIST_WORDS = ["인사발령", "전보 명단", "승진 명단", "승진자 명단", "임용 명단", "발령 명단", "발령사항"];

export function personnelListWarning(text: string): string | null {
  if (/성\s?명/.test(text) && /(직\s?급|소\s?속|직\s?위)/.test(text)) {
    return "'성명'과 '직급/소속' 표 머리글이 함께 있습니다 (인사 명단일 수 있음)";
  }
  const found = LIST_WORDS.find((w) => text.includes(w));
  return found ? `'${found}' 낱말이 있습니다 (인사 명단일 수 있음)` : null;
}
