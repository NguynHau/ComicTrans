// Client-Side Manga Translation Pipeline
// This module contains the complete logic for OCR, Translation, Inpainting, and Typesetting running entirely in the browser.

import { MangaPage, OCRBoxItem, TranslationItem, SampleChapter } from '../types';

// Helper to wrap text based on character width limits
export function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = (text || '').trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

// Calculate the optimal font size and layout for fitting text inside a bubble
export function layoutDialogueText(
  text: string,
  bubbleWidth: number,
  bubbleHeight: number
): { fontSize: number; lines: string[]; lineHeight: number; totalH: number } {
  const usableWidth = Math.max(20, bubbleWidth * 0.75);
  const usableHeight = Math.max(16, bubbleHeight * 0.75);

  const maxFont = Math.min(
    Math.round(bubbleHeight * 0.32),
    Math.round(bubbleWidth * 0.22),
    40
  );
  const minFont = Math.max(10, Math.min(13, Math.round(usableHeight * 0.15)));

  for (let fontSize = Math.max(12, maxFont); fontSize >= minFont; fontSize -= 1) {
    const charWidth = fontSize * 0.58;
    const maxChars = Math.max(3, Math.floor(usableWidth / charWidth));
    const lines = wrapText(text, maxChars);
    const lineHeight = fontSize * 1.25;
    const totalH = lines.length * lineHeight;

    if (totalH <= usableHeight) {
      return { fontSize, lines, lineHeight, totalH };
    }
  }

  const fontSize = minFont;
  const charWidth = fontSize * 0.58;
  const maxChars = Math.max(3, Math.floor(usableWidth / charWidth));
  const lines = wrapText(text, maxChars);
  const lineHeight = fontSize * 1.25;
  const totalH = lines.length * lineHeight;
  return { fontSize, lines, lineHeight, totalH };
}

// Crisp Built-in SVG Manga Samples so that users can click and try the app instantly
export function generateComicSvgDataUri(theme: 'manga' | 'manhwa' | 'manhua', pageNum: number): string {
  let svgContent = '';

  if (theme === 'manga') {
    svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1100" width="800" height="1100" style="background:#0f1117; font-family:'Segoe UI', sans-serif;">
      <rect x="20" y="20" width="760" height="1060" fill="#f8fafc" stroke="#1e293b" stroke-width="4" rx="8" />
      <rect x="40" y="40" width="720" height="420" fill="#0f172a" stroke="#000" stroke-width="3" />
      <path d="M40,40 L400,250 M760,40 L400,250 M40,460 L400,250 M760,460 L400,250 M120,40 L400,250 M680,40 L400,250 M200,460 L400,250 M600,460 L400,250" stroke="#334155" stroke-width="1.5" stroke-dasharray="8,4" />
      <circle cx="400" cy="230" r="60" fill="#1e293b" stroke="#e2e8f0" stroke-width="2" />
      <path d="M360,290 Q400,250 440,290 L460,420 L340,420 Z" fill="#1e293b" />
      <path d="M400,180 L490,130 L450,210 Z" fill="#3b82f6" opacity="0.8" />
      <text x="400" y="400" fill="#94a3b8" font-size="14" font-weight="bold" text-anchor="middle" letter-spacing="4">SHONEN MANGA - SCENE ${pageNum}</text>

      <path d="M70,80 Q70,60 160,60 Q250,60 250,110 Q250,150 190,150 L170,175 L160,150 Q70,150 70,110 Z" fill="#ffffff" stroke="#0f172a" stroke-width="3.5" />
      <text x="160" y="98" fill="#0f172a" font-size="15" font-weight="900" text-anchor="middle">何だ…この気配は？！</text>
      <text x="160" y="122" fill="#475569" font-size="11" font-weight="bold" text-anchor="middle">(Nanda... kono kehai wa?!)</text>

      <path d="M520,100 Q520,80 630,80 Q730,80 730,135 Q730,180 660,180 L640,210 L630,180 Q520,180 520,135 Z" fill="#ffffff" stroke="#0f172a" stroke-width="3.5" />
      <text x="625" y="122" fill="#dc2626" font-size="16" font-weight="900" text-anchor="middle">全員、結界を展開しろ！</text>
      <text x="625" y="146" fill="#0f172a" font-size="13" font-weight="bold" text-anchor="middle">急げ、間に合わんぞ！</text>

      <rect x="40" y="480" width="345" height="300" fill="#f1f5f9" stroke="#000" stroke-width="3" />
      <rect x="415" y="480" width="345" height="300" fill="#e2e8f0" stroke="#000" stroke-width="3" />

      <circle cx="210" cy="620" r="50" fill="#64748b" />
      <path d="M70,520 Q70,500 170,500 Q270,500 270,560 Q270,610 200,610 L190,635 L175,610 Q70,610 70,560 Z" fill="#ffffff" stroke="#0f172a" stroke-width="3" />
      <text x="170" y="542" fill="#0f172a" font-size="14" font-weight="900" text-anchor="middle">信じられない強さだ…</text>
      <text x="170" y="566" fill="#0f172a" font-size="13" font-weight="bold" text-anchor="middle">我々の攻撃が通じない！</text>

      <path d="M460,510 Q460,490 580,490 Q700,490 700,550 Q700,600 620,600 L610,630 L595,600 Q460,600 460,550 Z" fill="#ffffff" stroke="#0f172a" stroke-width="3" />
      <text x="580" y="535" fill="#2563eb" font-size="15" font-weight="900" text-anchor="middle">オレに任せてくれ！</text>
      <text x="580" y="560" fill="#0f172a" font-size="13" font-weight="bold" text-anchor="middle">奥義を解放する！！</text>

      <rect x="40" y="800" width="720" height="260" fill="#020617" stroke="#000" stroke-width="3" />
      <path d="M120,830 Q120,810 280,810 Q430,810 430,875 Q430,930 320,930 L300,960 L285,930 Q120,930 120,875 Z" fill="#ffffff" stroke="#0f172a" stroke-width="4" />
      <text x="275" y="855" fill="#dc2626" font-size="18" font-weight="900" text-anchor="middle">これで終わりだァァァッ！</text>
      <text x="275" y="885" fill="#0f172a" font-size="13" font-weight="bold" text-anchor="middle">『覇王連撃・滅竜斬』！！</text>
      <text x="400" y="1045" fill="#64748b" font-size="11" text-anchor="middle">Page ${pageNum} • Raw Japanese Manga Sample</text>
    </svg>`;
  } else if (theme === 'manhwa') {
    svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 3200" width="800" height="3200" style="background:#090d16; font-family:'Segoe UI', sans-serif;">
      <rect x="0" y="0" width="800" height="3200" fill="#090d16" />
      
      <!-- Panel 1: Top -->
      <rect x="30" y="40" width="740" height="460" fill="#111827" stroke="#312e81" stroke-width="3" rx="8" />
      <ellipse cx="400" cy="200" rx="300" ry="120" fill="#1e1b4b" stroke="#6366f1" stroke-width="3" />
      <text x="400" y="205" fill="#e0e7ff" font-size="16" font-weight="bold" text-anchor="middle" letter-spacing="2">RED GATE DUNGEON • EPISODE ${pageNum}</text>
      
      <path d="M70,80 Q70,60 220,60 Q360,60 360,130 Q360,180 250,180 L220,210 L205,180 Q70,180 70,130 Z" fill="#ffffff" stroke="#1e1b4b" stroke-width="4" />
      <text x="215" y="112" fill="#0f172a" font-size="18" font-weight="900" text-anchor="middle">S급 마수가 왜 여기에…?!</text>
      <text x="215" y="142" fill="#4338ca" font-size="13" font-weight="bold" text-anchor="middle">(S-geup masu-ga wae yeogie...?)</text>

      <!-- Panel 2: Upper-mid -->
      <rect x="30" y="550" width="740" height="480" fill="#030712" stroke="#4338ca" stroke-width="3" rx="8" />
      <path d="M430,610 Q430,580 590,580 Q730,580 730,650 Q730,710 620,710 L600,745 L580,710 Q430,710 430,650 Z" fill="#ffffff" stroke="#1e1b4b" stroke-width="4" />
      <text x="580" y="638" fill="#dc2626" font-size="18" font-weight="900" text-anchor="middle">헌터 협회에 지원을 요청해!</text>
      <text x="580" y="668" fill="#0f172a" font-size="14" font-weight="bold" text-anchor="middle">이 녀석은 우리가 감당 못 해!</text>

      <!-- Panel 3: Mid -->
      <rect x="30" y="1090" width="740" height="480" fill="#0f172a" stroke="#1e293b" stroke-width="3" rx="8" />
      <circle cx="400" cy="1330" r="140" fill="#1e1b4b" stroke="#38bdf8" stroke-width="3" />
      <path d="M80,1160 Q80,1130 240,1130 Q380,1130 380,1200 Q380,1260 270,1260 L240,1295 L225,1260 Q80,1260 80,1200 Z" fill="#ffffff" stroke="#0f172a" stroke-width="4" />
      <text x="230" y="1192" fill="#0f172a" font-size="18" font-weight="900" text-anchor="middle">공격이 전혀 통하지 않아…!</text>
      <text x="230" y="1222" fill="#0f172a" font-size="14" font-weight="bold" text-anchor="middle">방어막마저 깨져가고 있어!</text>

      <!-- Panel 4: Lower-mid -->
      <rect x="30" y="1630" width="740" height="480" fill="#090d16" stroke="#6366f1" stroke-width="3" rx="8" />
      <path d="M420,1700 Q420,1670 590,1670 Q730,1670 730,1740 Q730,1800 620,1800 L600,1835 L580,1800 Q420,1800 420,1740 Z" fill="#ffffff" stroke="#1e1b4b" stroke-width="4" />
      <text x="575" y="1730" fill="#2563eb" font-size="18" font-weight="900" text-anchor="middle">모두 뒤로 물러서라.</text>
      <text x="575" y="1760" fill="#0f172a" font-size="14" font-weight="bold" text-anchor="middle">지금부터 내가 직접 나선다.</text>

      <!-- Panel 5: Deep -->
      <rect x="30" y="2170" width="740" height="480" fill="#020617" stroke="#4f46e5" stroke-width="4" rx="8" />
      <path d="M90,2240 Q90,2210 290,2210 Q460,2210 460,2280 Q460,2340 330,2340 L300,2380 L280,2340 Q90,2340 90,2280 Z" fill="#ffffff" stroke="#1e1b4b" stroke-width="4.5" />
      <text x="275" y="2272" fill="#dc2626" font-size="20" font-weight="900" text-anchor="middle">일어나라… 그림자 군단!!</text>
      <text x="275" y="2302" fill="#0f172a" font-size="14" font-weight="bold" text-anchor="middle">적들을 모조리 짓밟아라!</text>

      <!-- Panel 6: Climax -->
      <rect x="30" y="2710" width="740" height="420" fill="#090d16" stroke="#22c55e" stroke-width="3" rx="8" />
      <path d="M410,2770 Q410,2740 590,2740 Q740,2740 740,2810 Q740,2870 620,2870 L600,2905 L580,2870 Q410,2870 410,2810 Z" fill="#ffffff" stroke="#1e1b4b" stroke-width="4" />
      <text x="575" y="2800" fill="#16a34a" font-size="19" font-weight="900" text-anchor="middle">군주님의 명을 받듭니다!</text>
      <text x="575" y="2830" fill="#0f172a" font-size="14" font-weight="bold" text-anchor="middle">전원 진격하라—!!</text>

      <text x="400" y="3170" fill="#64748b" font-size="12" text-anchor="middle">Long Webtoon Strip • 3200px Height • 6 Speech Bubbles</text>
    </svg>`;
  } else {
    svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1100" width="800" height="1100" style="background:#18181b; font-family:'Segoe UI', sans-serif;">
      <rect x="20" y="20" width="760" height="1060" fill="#27272a" stroke="#eab308" stroke-width="3" rx="8" />
      <rect x="40" y="40" width="720" height="420" fill="#18181b" stroke="#eab308" stroke-width="2" />
      <circle cx="400" cy="220" r="90" fill="#3f3f46" stroke="#f59e0b" stroke-width="3" />
      <path d="M400,80 L420,360 L380,360 Z" fill="#fbbf24" stroke="#d97706" stroke-width="2" />
      <text x="400" y="410" fill="#fef08a" font-size="14" font-weight="bold" text-anchor="middle" letter-spacing="4">万剑宗 • 演武场</text>

      <path d="M70,80 Q70,60 210,60 Q340,60 340,120 Q340,170 230,170 L210,200 L195,170 Q70,170 70,120 Z" fill="#ffffff" stroke="#78350f" stroke-width="3.5" />
      <text x="205" y="102" fill="#78350f" font-size="17" font-weight="900" text-anchor="middle">大胆狂徒！</text>
      <text x="205" y="128" fill="#1c1917" font-size="13" font-weight="bold" text-anchor="middle">也敢在此偷学宗门秘法？！</text>

      <path d="M470,90 Q470,70 600,70 Q730,70 730,130 Q730,180 630,180 L610,210 L595,180 Q470,180 470,130 Z" fill="#ffffff" stroke="#78350f" stroke-width="3.5" />
      <text x="600" y="112" fill="#dc2626" font-size="16" font-weight="900" text-anchor="middle">区区外门弟子…</text>
      <text x="600" y="138" fill="#1c1917" font-size="13" font-weight="bold" text-anchor="middle">今日便废了你的修为！</text>

      <rect x="40" y="480" width="345" height="300" fill="#2d2d30" stroke="#a1a1aa" stroke-width="2" />
      <rect x="415" y="480" width="345" height="300" fill="#2d2d30" stroke="#a1a1aa" stroke-width="2" />

      <path d="M100,520 Q100,490 270,490 Q420,490 420,560 Q420,620 300,620 L270,655 L250,620 Q100,620 100,560 Z" fill="#ffffff" stroke="#78350f" stroke-width="3.5" />
      <text x="260" y="538" fill="#1c1917" font-size="15" font-weight="900" text-anchor="middle">这股剑意…怎么会如此强悍？！</text>
      <text x="260" y="564" fill="#047857" font-size="13" font-weight="bold" text-anchor="middle">难道 he 已经参透了第九重？！</text>

      <rect x="40" y="800" width="720" height="260" fill="#1c1917" stroke="#eab308" stroke-width="3.5" />
      <path d="M430,830 Q430,800 600,800 Q740,800 740,870 Q740,930 630,930 L610,965 L590,930 Q430,930 430,870 Z" fill="#ffffff" stroke="#78350f" stroke-width="4" />
      <text x="585" y="855" fill="#dc2626" font-size="18" font-weight="900" text-anchor="middle">九天玄雷，破！</text>
      <text x="585" y="885" fill="#1c1917" font-size="13" font-weight="bold" text-anchor="middle">叫尔等见识真正的天地之力！</text>
      <text x="400" y="1050" fill="#a1a1aa" font-size="11" text-anchor="middle">Chapter ${pageNum} • Raw Chinese Manhua Sample</text>
    </svg>`;
  }

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent.trim())}`;
}

const SAMPLE_CHAPTERS: Record<string, { title: string; images: string[] }> = {
  'sample://manga/chapter-1': {
    title: 'One Piece / Shonen Manga - Chap 1 (Manga Tiếng Nhật)',
    images: [
      generateComicSvgDataUri('manga', 1),
      generateComicSvgDataUri('manga', 2),
    ],
  },
  'sample://manhwa/action': {
    title: 'Solo Leveling / Hunter - Ep 12 (Webtoon Tiếng Hàn)',
    images: [
      generateComicSvgDataUri('manhwa', 1),
      generateComicSvgDataUri('manhwa', 2),
    ],
  },
  'sample://manhua/cultivation': {
    title: 'Đấu Phá Thương Khung - Chap 88 (Manhua Tiếng Trung)',
    images: [
      generateComicSvgDataUri('manhua', 1),
      generateComicSvgDataUri('manhua', 2),
    ],
  },
};

// Scraping function using client-side fallback with AllOrigins CORS proxy
export async function extractComicImagesClient(url: string): Promise<{ title: string; images: string[] }> {
  if (SAMPLE_CHAPTERS[url]) {
    return SAMPLE_CHAPTERS[url];
  }

  try {
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      throw new Error('URL phải bắt đầu bằng http:// hoặc https://');
    }

    // Attempt to scrape HTML via AllOrigins CORS proxy
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) {
      // Direct fetch fallback in case of proxy issues or image files directly
      const directRes = await fetch(targetUrl);
      const ct = directRes.headers.get('content-type') || '';
      if (ct.includes('image/')) {
        return { title: 'Manga Image', images: [targetUrl] };
      }
      throw new Error('Không thể kết nối đến trang truyện.');
    }

    const json = await res.json();
    const html = json.contents || '';

    // Match title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Manga Page';

    // Match all img tags
    const imgRegex = /<img\s+[^>]*>/gi;
    const matches = html.match(imgRegex) || [];
    const candidates: string[] = [];
    const seen = new Set<string>();

    const excludePatterns = [/logo/i, /avatar/i, /icon/i, /banner/i, /advert/i, /fb_share/i, /widget/i, /favicon/i, /1x1/i, /pixel/i];

    for (const imgTag of matches) {
      let src = '';
      
      // Match lazy load srcset or data-srcset
      const srcsetMatch = imgTag.match(/(?:data-srcset|srcset)=["']([^"']+)["']/i);
      if (srcsetMatch) {
        const parts = srcsetMatch[1].split(',').map((s: string) => s.trim().split(/\s+/)[0]);
        if (parts.length > 0) src = parts[parts.length - 1];
      }

      if (!src) {
        const attrMatch = imgTag.match(/(?:data-src|data-original|data-lazy-src|data-url|data-image|src)=["']([^"']+)["']/i);
        if (attrMatch) src = attrMatch[1];
      }

      if (!src || src.startsWith('data:image')) continue;

      try {
        // Resolve absolute URL
        const absoluteUrl = new URL(src, targetUrl).toString();
        if (excludePatterns.some((rx) => rx.test(absoluteUrl))) continue;
        if (!seen.has(absoluteUrl)) {
          seen.add(absoluteUrl);
          candidates.push(absoluteUrl);
        }
      } catch (e) {
        // ignore malformed URLs
      }
    }

    if (candidates.length === 0) {
      // Check if the original URL is a direct image URL
      if (/\.(jpg|jpeg|png|webp|gif|svg)/i.test(targetUrl)) {
        return { title: 'Manga Page', images: [targetUrl] };
      }
      throw new Error('Không phát hiện được trang ảnh nào từ URL này. Bạn có thể lưu ảnh về máy và dùng tab "Tải Ảnh" để dịch trực tiếp.');
    }

    return {
      title,
      images: candidates.slice(0, 40),
    };
  } catch (err: any) {
    throw new Error(err.message || 'Lỗi trích xuất trang truyện từ URL.');
  }
}

export async function ensureImageAsJpegBase64(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:image/jpeg;base64,')) {
    return imageUrl;
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Không khởi tạo được Canvas 2D'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error('Không thể tải hình ảnh để chuyển đổi.'));
    };
    img.src = imageUrl;
  });
}

// Direct client-side Gemini Vision OCR & Translation API connector
export async function runOcrAndTranslationClient(
  base64Image: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string
): Promise<{ ocr_results: OCRBoxItem[]; translations: TranslationItem[] }> {
  // Always convert input image to JPEG Base64 for maximum Gemini API compatibility
  const jpegBase64 = await ensureImageAsJpegBase64(base64Image);
  const base64DataOnly = jpegBase64.replace(/^data:image\/jpeg;base64,/, '');

  // Establish target languages name string
  const targetLangStr = targetLang === 'vi' ? 'Vietnamese (tiếng Việt)' : 'English';

  // We load the image to determine actual dimensions
  const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || 800, height: img.naturalHeight || 1100 });
    };
    img.onerror = () => {
      resolve({ width: 800, height: 1100 });
    };
    img.src = base64Image;
  });

  const W = dimensions.width;
  const H = dimensions.height;

  const prompt = `You are an elite Comic/Manga/Manhwa/Manhua OCR, Vision, and Translation Engine.
This image has dimensions ${W}x${H} pixels (aspect ratio ${(H / W).toFixed(1)}:1).
${H > 2000 ? `CRITICAL NOTICE: This is a very tall vertical strip (webtoon). You MUST scan through the ENTIRE vertical height from ymin=0 (top) down to ymax=1000 (bottom). Do NOT stop after the top panels. Find ALL speech bubbles along the entire height.` : ''}

TASK:
1. Detect ALL speech bubbles, dialogue balloons, shout bubbles, thought clouds, and narration text on this entire page/strip.
2. For EVERY dialogue bubble detected, output a JSON object containing:
   - "text": Exact transcription of original text inside the bubble (Japanese, Korean, Chinese, or English).
   - "translation": Natural, context-appropriate translation into ${targetLangStr} (tiếng Việt chuẩn văn phong truyện tranh).
   - "ymin": Top coordinate of the speech bubble boundary (integer 0 to 1000).
   - "xmin": Left coordinate of the speech bubble boundary (integer 0 to 1000).
   - "ymax": Bottom coordinate of the speech bubble boundary (integer 0 to 1000).
   - "xmax": Right coordinate of the speech bubble boundary (integer 0 to 1000).
   - "bubble_shape": "ellipse" or "rectangle".
   - "bg_color": Background fill color inside the bubble (default "#ffffff").
3. CRITICAL MANDATES:
   - You MUST identify and include EVERY dialogue bubble on the page. Do NOT skip any bubble.
   - Coordinates MUST accurately tightly enclose the speech bubble.
   - Order the items in reading order (top to bottom).
Return a valid JSON array of all detected speech bubbles.`;

  const model = 'gemini-3.8-flash'; // Optimized default model supporting structured outputs and vision
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64DataOnly,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              text: { type: 'STRING', description: 'Original untranslated text in speech bubble' },
              translation: { type: 'STRING', description: 'Translated text inside bubble' },
              ymin: { type: 'INTEGER', description: '0 to 1000 top boundary' },
              xmin: { type: 'INTEGER', description: '0 to 1000 left boundary' },
              ymax: { type: 'INTEGER', description: '0 to 1000 bottom boundary' },
              xmax: { type: 'INTEGER', description: '0 to 1000 right boundary' },
              bubble_shape: { type: 'STRING', enum: ['ellipse', 'rectangle'] },
              bg_color: { type: 'STRING', description: 'Hex background color of bubble, e.g. "#ffffff"' }
            },
            required: ['text', 'translation', 'ymin', 'xmin', 'ymax', 'xmax']
          }
        }
      }
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini API Error: ${message}`);
  }

  const result = await response.json();
  const textResponse = result?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

  let items: any[] = [];
  try {
    items = JSON.parse(textResponse);
  } catch (e) {
    console.error('Failed to parse Gemini output:', textResponse);
    throw new Error('Phản hồi từ Gemini không đúng định dạng JSON.');
  }

  if (!Array.isArray(items)) {
    items = [];
  }

  const ocr_results: OCRBoxItem[] = [];
  const translations: TranslationItem[] = [];

  items.forEach((item, idx) => {
    const id = `bubble_${Date.now()}_${idx}`;
    ocr_results.push({
      id,
      text: item.text || '',
      confidence: 1.0,
      language: sourceLang,
      bbox: {
        x: item.xmin,
        y: item.ymin,
        width: item.xmax - item.xmin,
        height: item.ymax - item.ymin,
        ymin: item.ymin,
        xmin: item.xmin,
        ymax: item.ymax,
        xmax: item.xmax,
        // @ts-ignore
        bubble_shape: item.bubble_shape || 'ellipse',
        bg_color: item.bg_color || '#ffffff',
      },
    });

    translations.push({
      id,
      source_text: item.text || '',
      translated_text: item.translation || '',
      source_language: sourceLang,
      target_language: targetLang,
    });
  });

  return { ocr_results, translations };
}

// Client-Side Canvas-based Inpainting and Text Render
// This function replaces the backend server's SVG + Sharp rendering flow.
export async function renderInpaintedTranslatedImageClient(
  sourceImageBase64: string,
  ocrResults: OCRBoxItem[],
  translations: TranslationItem[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Avoid tainted canvas
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Không thể khởi tạo môi trường Canvas 2D.');
        }

        // 1. Draw original image onto canvas
        ctx.drawImage(img, 0, 0);

        // 2. Clear original text (Inpaint) and Typeset translated text for each bubble
        ocrResults.forEach((item, idx) => {
          const transItem = translations[idx];
          const textToRender = transItem ? transItem.translated_text : '';
          if (!textToRender) return;

          // Normalized coordinates (0 to 1000) scaled to actual canvas dimensions
          const xmin = item.bbox.xmin ?? 0;
          const ymin = item.bbox.ymin ?? 0;
          const xmax = item.bbox.xmax ?? 1000;
          const ymax = item.bbox.ymax ?? 1000;

          const x = (xmin / 1000) * canvas.width;
          const y = (ymin / 1000) * canvas.height;
          const w = ((xmax - xmin) / 1000) * canvas.width;
          const h = ((ymax - ymin) / 1000) * canvas.height;

          // @ts-ignore
          const bubbleShape = item.bbox.bubble_shape || 'ellipse';
          // @ts-ignore
          const bgColor = item.bbox.bg_color || '#ffffff';

          ctx.save();

          // A. Inpainting: Draw background shape slightly inset to preserve original boundary line
          const insetX = Math.max(2, w * 0.03);
          const insetY = Math.max(2, h * 0.03);

          ctx.fillStyle = bgColor;
          if (bubbleShape === 'rectangle') {
            const rx = x + insetX;
            const ry = y + insetY;
            const rw = Math.max(5, w - insetX * 2);
            const rh = Math.max(5, h - insetY * 2);
            ctx.beginPath();
            ctx.roundRect(rx, ry, rw, rh, 8);
            ctx.fill();
          } else {
            const cx = x + w / 2;
            const cy = y + h / 2;
            const rx = Math.max(2, w / 2 - insetX);
            const ry = Math.max(2, h / 2 - insetY);
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
            ctx.fill();
          }

          // B. Typesetting & Render Translated Text
          const layout = layoutDialogueText(textToRender, w, h);
          ctx.font = `900 ${layout.fontSize}px 'Segoe UI', Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Black outline/stroke & White fill parameters
          const strokeWidth = Math.max(2.5, layout.fontSize * 0.18);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = strokeWidth;
          ctx.lineJoin = 'round';
          ctx.fillStyle = '#ffffff';

          const cx = x + w / 2;
          const cy = y + h / 2;
          const lineHeight = layout.lineHeight;
          const totalH = layout.totalH;

          let currentY = cy - (totalH / 2) + (lineHeight / 2);

          layout.lines.forEach((line) => {
            // Draw stroke first to place outline behind text, then fill with white
            ctx.strokeText(line, cx, currentY);
            ctx.fillText(line, cx, currentY);
            currentY += lineHeight;
          });

          ctx.restore();
        });

        // Resolve processed image as Base64 JPEG data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        resolve(dataUrl);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (e) => {
      reject(new Error('Không thể tải hoặc hiển thị hình ảnh gốc trên Canvas.'));
    };

    img.src = sourceImageBase64;
  });
}
