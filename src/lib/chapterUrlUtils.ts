import { suggestMangaAndChapter } from './mangaUtils';

export interface ChapterUrlAnalysis {
  isRecognized: boolean;
  seriesName: string;
  currentChapterNumber: number;
  nextChapterNumber: number;
  currentChapterTitle: string;
  nextChapterTitle: string;
  nextUrl: string | null;
  patternDescription?: string;
}

/**
 * Analyzes a comic chapter URL, detects chapter number, series name,
 * and computes the next chapter URL while preserving structure, parameters, and padding.
 */
export function analyzeChapterUrl(rawUrl: string): ChapterUrlAnalysis {
  const fallbackResult: ChapterUrlAnalysis = {
    isRecognized: false,
    seriesName: 'Bộ truyện mới',
    currentChapterNumber: 1,
    nextChapterNumber: 2,
    currentChapterTitle: 'Chương 1',
    nextChapterTitle: 'Chương 2',
    nextUrl: null,
    patternDescription: 'Không phát hiện quy luật số chương tự động',
  };

  if (!rawUrl || !rawUrl.trim()) return fallbackResult;

  const urlStr = rawUrl.trim();

  // Try parsing URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlStr);
  } catch {
    return fallbackResult;
  }

  // 1. Get Series name suggestion
  const { mangaName } = suggestMangaAndChapter(urlStr);
  const seriesName = mangaName && mangaName !== 'Bộ truyện mới' ? mangaName : 'Bộ truyện mới';

  // 2. Check Query Parameter first (e.g. ?chapter=1, ?chap=10, ?c=5)
  for (const param of ['chapter', 'chap', 'ch', 'c', 'chuong', 'episode', 'ep']) {
    const val = parsedUrl.searchParams.get(param);
    if (val && /^\d+(\.\d+)?$/.test(val)) {
      const num = parseFloat(val);
      const isInt = Number.isInteger(num);
      const nextNum = isInt ? num + 1 : Math.floor(num) + 1;
      const padLen = val.length;
      const nextVal = isInt && padLen > 1 && String(nextNum).length < padLen
        ? String(nextNum).padStart(padLen, '0')
        : String(nextNum);

      const nextParsed = new URL(parsedUrl.toString());
      nextParsed.searchParams.set(param, nextVal);

      return {
        isRecognized: true,
        seriesName,
        currentChapterNumber: num,
        nextChapterNumber: nextNum,
        currentChapterTitle: `Chương ${num}`,
        nextChapterTitle: `Chương ${nextNum}`,
        nextUrl: nextParsed.toString(),
        patternDescription: `Tham số URL: ?${param}=${val} → ?${param}=${nextVal}`,
      };
    }
  }

  const pathname = parsedUrl.pathname;

  // 3. Match Chapter Prefix in Path
  // Examples: /chapter-0/, /chap-1/, /ch-02/, /chuong-10/, /c-5/, /c5/, /episode-1/, /ep-3/, /tap-1/
  const chapterPrefixRegex = /((?:^|\/)[a-zA-Z0-9_\-]*(?:chapter|chap|chuong|ch|episode|ep|tap|c)[_\-]?)(0*\d+(?:\.\d+)?)([\/?#\.]|$)/i;
  const prefixMatch = pathname.match(chapterPrefixRegex);

  if (prefixMatch) {
    const fullMatched = prefixMatch[0];
    const prefix = prefixMatch[1];
    const numStr = prefixMatch[2];
    const suffix = prefixMatch[3];
    const num = parseFloat(numStr);

    const isInt = Number.isInteger(num);
    const nextNum = isInt ? num + 1 : Math.floor(num) + 1;
    const hasLeadingZeros = numStr.length > 1 && numStr.startsWith('0') && !numStr.startsWith('0.');
    const padLen = numStr.length;

    let nextNumStr = String(nextNum);
    if (hasLeadingZeros && isInt && nextNumStr.length < padLen) {
      nextNumStr = nextNumStr.padStart(padLen, '0');
    }

    const replacedPath = pathname.replace(
      chapterPrefixRegex,
      `${prefix}${nextNumStr}${suffix}`
    );

    const nextParsed = new URL(parsedUrl.toString());
    nextParsed.pathname = replacedPath;

    return {
      isRecognized: true,
      seriesName,
      currentChapterNumber: num,
      nextChapterNumber: nextNum,
      currentChapterTitle: `Chương ${num}`,
      nextChapterTitle: `Chương ${nextNum}`,
      nextUrl: nextParsed.toString(),
      patternDescription: `${prefix}${numStr} → ${prefix}${nextNumStr}`,
    };
  }

  // 4. Match Trailing Number Segment: e.g. /manga/selena/0/ or /manga/selena/0.html or /manga/selena/0
  const trailingNumRegex = /((?:^|\/))(0*\d+(?:\.\d+)?)([\/?#\.]|$)/;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0) {
    const lastSeg = segments[segments.length - 1];
    const numMatch = lastSeg.match(/^(0*\d+(?:\.\d+)?)(.*)$/);
    if (numMatch) {
      const numStr = numMatch[1];
      const trailingExt = numMatch[2] || '';
      const num = parseFloat(numStr);
      const isInt = Number.isInteger(num);
      const nextNum = isInt ? num + 1 : Math.floor(num) + 1;
      const hasLeadingZeros = numStr.length > 1 && numStr.startsWith('0') && !numStr.startsWith('0.');
      const padLen = numStr.length;

      let nextNumStr = String(nextNum);
      if (hasLeadingZeros && isInt && nextNumStr.length < padLen) {
        nextNumStr = nextNumStr.padStart(padLen, '0');
      }

      const newSegments = [...segments];
      newSegments[newSegments.length - 1] = `${nextNumStr}${trailingExt}`;
      const newPath = '/' + newSegments.join('/') + (pathname.endsWith('/') ? '/' : '');

      const nextParsed = new URL(parsedUrl.toString());
      nextParsed.pathname = newPath;

      return {
        isRecognized: true,
        seriesName,
        currentChapterNumber: num,
        nextChapterNumber: nextNum,
        currentChapterTitle: `Chương ${num}`,
        nextChapterTitle: `Chương ${nextNum}`,
        nextUrl: nextParsed.toString(),
        patternDescription: `Số thứ tự: /${numStr}/ → /${nextNumStr}/`,
      };
    }
  }

  return {
    ...fallbackResult,
    seriesName,
  };
}

/**
 * Generate next chapter URL given current URL and current chapter number.
 */
export function getNextChapterUrl(currentUrl: string): string | null {
  const analysis = analyzeChapterUrl(currentUrl);
  return analysis.isRecognized ? analysis.nextUrl : null;
}
