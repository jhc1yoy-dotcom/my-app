// 화면과 서버가 함께 쓰는 표시용 함수

/** "2025-07-01" → "2025.7.1." */
export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}.${m}.${d}.`;
}
