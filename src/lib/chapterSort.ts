/**
 * Smart chapter number extraction & natural sorting utility
 */

export function extractChapterNumber(title: string): number {
  if (!title) return 0;
  // Match chapter numbers: "Chap 10", "Chương 10.5", "Chapter 100", "c20", "v1c2", or "10"
  const match = title.match(/(?:chap(?:ter)?|chương|c|vol|tập)?\s*(\d+(?:\.\d+)?)/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return 0;
}

export function compareChapterTitles(a: string, b: string): number {
  const numA = extractChapterNumber(a);
  const numB = extractChapterNumber(b);

  if (numA !== numB) {
    return numA - numB;
  }

  // Fallback to natural string collation if chapter numbers are identical or unparseable
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortChapters<T extends { title: string; timestamp?: string }>(
  items: T[],
  order: 'asc' | 'desc' = 'asc'
): T[] {
  return [...items].sort((a, b) => {
    const cmp = compareChapterTitles(a.title, b.title);
    if (cmp !== 0) {
      return order === 'asc' ? cmp : -cmp;
    }
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return order === 'asc' ? timeA - timeB : timeB - timeA;
  });
}
