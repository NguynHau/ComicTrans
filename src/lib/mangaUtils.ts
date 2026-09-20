export function suggestMangaAndChapter(sourceUrl?: string) {
  if (!sourceUrl || sourceUrl.startsWith('upload://')) {
    return {
      mangaName: 'Truyện tải lên',
      chapterName: 'Chương 1'
    };
  }

  try {
    const urlObj = new URL(sourceUrl);
    const segments = urlObj.pathname.split('/').filter(Boolean);
    
    // Example: /truyen-tranh/dai-vuong-tha-ming/chap-15
    // or /manga/one-piece/chapter-100
    let mangaSlug = '';
    let chapterSlug = '';

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i].toLowerCase();
      if ((seg.includes('chap') || seg.includes('chuong') || seg.includes('chapter')) && i > 0) {
        chapterSlug = segments[i];
        mangaSlug = segments[i - 1];
        break;
      }
    }

    if (!mangaSlug && segments.length >= 2) {
      mangaSlug = segments[segments.length - 2];
      chapterSlug = segments[segments.length - 1];
    } else if (!mangaSlug && segments.length === 1) {
      chapterSlug = segments[0];
    }

    const formatName = (slug: string) => {
      if (!slug) return 'Bộ truyện mới';
      return slug
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    };

    const formatChapter = (slug: string) => {
      if (!slug) return 'Chương 1';
      const clean = slug.replace(/[-_]/g, ' ');
      // If it contains numbers, try to format nicely
      const match = clean.match(/(\d+(\.\d+)?)/);
      if (match) {
        return `Chap ${match[1]}`;
      }
      return clean.replace(/\b\w/g, c => c.toUpperCase());
    };

    return {
      mangaName: formatName(mangaSlug),
      chapterName: formatChapter(chapterSlug)
    };
  } catch (err) {
    return {
      mangaName: 'Bộ truyện mới',
      chapterName: 'Chương 1'
    };
  }
}
