// Client-Side Manga Translation Pipeline
// This module contains the complete logic for OCR, Translation, Inpainting, and Typesetting running entirely in the browser.

import { MangaPage, OCRBoxItem, TranslationItem } from '../types';

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

// Scraping function using client-side fallback with multiple CORS proxies
export async function extractComicImagesClient(url: string): Promise<{ title: string; images: string[] }> {
  let targetUrl = url.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    throw new Error('URL_ACCESS_DENIED: URL phải bắt đầu bằng http:// hoặc https://');
  }

  // Check if target URL itself is a direct image
  if (/\.(jpe?g|png|webp|avif|gif)(\?.*)?$/i.test(targetUrl)) {
    return { title: 'Trang truyện ảnh', images: [targetUrl] };
  }

  let htmlOrMd = '';
  let lastFetchErr = '';

  // Multi-tier proxy pool:
  // 1. Jina Reader (bypasses Cloudflare, renders JS, outputs clean markdown with full image URLs)
  // 2. allorigins raw & codetabs proxies
  const proxyEndpoints = [
    `https://r.jina.ai/${targetUrl}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`,
  ];

  // Try fetching HTML or Markdown via proxy pool
  for (const proxyUrl of proxyEndpoints) {
    try {
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(9000) });
      if (!res.ok) continue;

      if (proxyUrl.includes('allorigins.win/get')) {
        const json = await res.json();
        if (json?.contents && json.contents.length > 200) {
          htmlOrMd = json.contents;
          break;
        }
      } else {
        const text = await res.text();
        if (text && text.length > 200) {
          // Check if proxy returned an error JSON or blocked page
          if (text.includes('"error":"A valid API key is required') || text.includes('Error 403')) {
            continue;
          }
          htmlOrMd = text;
          break;
        }
      }
    } catch (e: any) {
      lastFetchErr = e?.message || '';
    }
  }

  if (!htmlOrMd) {
    throw new Error(
      `URL_ACCESS_DENIED: Không thể kết nối đến trang truyện do máy chủ chặn truy cập (CORS / Cloudflare). ${lastFetchErr ? `Chi tiết: ${lastFetchErr}` : ''}`
    );
  }

  // Check if page returned a Cloudflare Bot Protection Challenge
  if (
    (htmlOrMd.includes('Just a moment...') ||
     htmlOrMd.includes('cf-browser-verification') ||
     htmlOrMd.includes('Cloudflare Ray ID') ||
     htmlOrMd.includes('Enable JavaScript and cookies to continue')) &&
    !htmlOrMd.includes('http')
  ) {
    throw new Error(
      'CLOUDFLARE_PROTECTED: Trang web truyện này đang bật tường lửa Cloudflare chống bot khiến máy chủ proxy bị chặn tạm thời. Vui lòng chuyển sang tab "Tải ảnh lên" hoặc chọn file ZIP truyện để dịch tức thì.'
    );
  }

  // Match title
  const titleMatch = htmlOrMd.match(/<title[^>]*>([^<]+)<\/title>/i) || htmlOrMd.match(/^Title:\s*(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Manga Page';

  const candidates: string[] = [];
  const seen = new Set<string>();
  const excludePatterns = [
    /logo/i,
    /avatar/i,
    /icon/i,
    /banner/i,
    /advert/i,
    /fb_share/i,
    /widget/i,
    /favicon/i,
    /1x1/i,
    /pixel/i,
    /dflazy/i,
    /emoji/i,
    /\.svg(\?.*)?$/i,
  ];

  // 1. Extract Markdown image links: ![alt](url)
  const mdImgRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/gi;
  let mdMatch;
  while ((mdMatch = mdImgRegex.exec(htmlOrMd)) !== null) {
    const rawUrl = mdMatch[1].trim();
    if (excludePatterns.some((rx) => rx.test(rawUrl))) continue;
    if (!seen.has(rawUrl)) {
      seen.add(rawUrl);
      candidates.push(rawUrl);
    }
  }

  // 2. Extract HTML <img> tags
  const imgRegex = /<img\s+[^>]*>/gi;
  const matches = htmlOrMd.match(imgRegex) || [];

  for (const imgTag of matches) {
    let src = '';

    // Match lazy load srcset or data-srcset
    const srcsetMatch = imgTag.match(/(?:data-srcset|srcset)=["']([^"']+)["']/i);
    if (srcsetMatch) {
      const parts = srcsetMatch[1].split(',').map((s: string) => s.trim().split(/\s+/)[0]);
      if (parts.length > 0) src = parts[parts.length - 1].trim();
    }

    if (!src) {
      const attrMatch = imgTag.match(
        /(?:data-src|data-original|data-lazy-src|data-url|data-image|data-cdn|src)=["']([^"']+)["']/i
      );
      if (attrMatch) src = attrMatch[1].trim();
    }

    if (!src || src.startsWith('data:image')) continue;

    try {
      // Resolve absolute URL & clean whitespace
      const cleanedSrc = src.trim().replace(/^[\r\n\t\s]+|[\r\n\t\s]+$/g, '');
      const absoluteUrl = new URL(cleanedSrc, targetUrl).toString();
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
    throw new Error('NO_IMAGES_FOUND: Không phát hiện được trang ảnh nào từ URL này.');
  }

  return {
    title,
    images: candidates.slice(0, 40),
  };
}

export async function ensureImageAsJpegBase64(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:image/jpeg;base64,')) {
    return imageUrl;
  }

  // If it's already another base64 data URL, draw onto canvas to convert to JPEG
  if (imageUrl.startsWith('data:image/')) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Không khởi tạo được Canvas 2D'));
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('IMAGE_LOAD_FAILED: Không thể tải dữ liệu ảnh'));
      img.src = imageUrl;
    });
  }

  // It's a remote URL: first attempt standard Canvas load with anonymous crossOrigin
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas 2D context error'));
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.92));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Direct CORS image load failed'));
      img.src = imageUrl;
    });
    return dataUrl;
  } catch (directErr) {
    // If direct load fails (common due to CORS or Hotlink protection), proxy the image Blob
    // Use images.weserv.nl first (global high-speed CDN image proxy with hotlink bypass)
    const proxyUrls = [
      `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}&output=jpg&q=90`,
      `https://corsproxy.io/?url=${encodeURIComponent(imageUrl)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(imageUrl)}`,
    ];

    for (const pUrl of proxyUrls) {
      try {
        const res = await fetch(pUrl, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const blob = await res.blob();
          const base64 = await new Promise<string>((resBlob, rejBlob) => {
            const reader = new FileReader();
            reader.onload = () => resBlob(reader.result as string);
            reader.onerror = () => rejBlob(new Error('Blob read error'));
            reader.readAsDataURL(blob);
          });
          // Convert that base64 to JPEG if needed
          return await ensureImageAsJpegBase64(base64);
        }
      } catch {
        // try next proxy
      }
    }

    throw new Error('IMAGE_LOAD_FAILED: Không thể tải hình ảnh từ máy chủ truyện tranh do bị chặn truy cập chéo (CORS/Hotlink).');
  }
}

// Available Gemini models ordered by priority with automatic fallback on quota/rate-limits
const CANDIDATE_GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
];

// Direct client-side Gemini Vision OCR & Translation API connector
export async function runOcrAndTranslationClient(
  base64Image: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string
): Promise<{ ocr_results: OCRBoxItem[]; translations: TranslationItem[]; model_used?: string }> {
  const cleanApiKey = apiKey.trim();
  if (!cleanApiKey) {
    throw new Error('API_KEY_MISSING: Chưa tìm thấy Gemini API Key. Vui lòng vào Cài đặt để thêm API Key.');
  }

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
    img.src = jpegBase64;
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

  const requestBody = JSON.stringify({
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
  });

  let lastModelError: any = null;

  // Multi-model fallback loop: tries models sequentially
  for (const model of CANDIDATE_GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const rawErrMessage = errorData?.error?.message || `HTTP ${response.status}`;

        // If invalid API key (400 or 403), stop immediately - no other model will succeed
        if (response.status === 400 || response.status === 403) {
          throw new Error(`API_KEY_INVALID: ${rawErrMessage}`);
        }

        // If Quota Exceeded (429), log and automatically fall back to next model
        if (response.status === 429) {
          console.warn(`Model ${model} returned 429 (Resource Exhausted). Attempting fallback to next model...`);
          lastModelError = new Error(`API_QUOTA_EXCEEDED: ${rawErrMessage}`);
          continue;
        }

        // If model not found (404) or server temporary error (503), try next model
        if (response.status === 404 || response.status === 503) {
          console.warn(`Model ${model} returned HTTP ${response.status}. Trying next model...`);
          lastModelError = new Error(`Gemini API Error (${model}): ${rawErrMessage}`);
          continue;
        }

        lastModelError = new Error(`Gemini API Error (${model}): ${rawErrMessage}`);
        continue;
      }

      // Success with this model!
      const result = await response.json();
      const textResponse = result?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

      // Check if blocked by Google safety filters
      if (result?.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error('AI_SAFETY_BLOCKED: Trang truyện bị bộ lọc an toàn của Google AI chặn.');
      }

      let items: any[] = [];
      try {
        items = JSON.parse(textResponse);
      } catch (e) {
        console.error('Failed to parse Gemini output:', textResponse);
        throw new Error('AI_PARSE_ERROR: Phản hồi từ Gemini không đúng định dạng JSON.');
      }

      if (!Array.isArray(items)) {
        items = [];
      }

      const ocr_results: OCRBoxItem[] = [];
      const translations: TranslationItem[] = [];

      items.forEach((item, idx) => {
        const ymin = typeof item.ymin === 'number' ? item.ymin : 0;
        const xmin = typeof item.xmin === 'number' ? item.xmin : 0;
        const ymax = typeof item.ymax === 'number' ? item.ymax : 1000;
        const xmax = typeof item.xmax === 'number' ? item.xmax : 1000;

        ocr_results.push({
          id: `bubble_${Date.now()}_${idx}`,
          text: item.text || '',
          confidence: 1.0,
          language: sourceLang,
          bbox: {
            x: Math.round((xmin / 1000) * W),
            y: Math.round((ymin / 1000) * H),
            width: Math.round(((xmax - xmin) / 1000) * W),
            height: Math.round(((ymax - ymin) / 1000) * H),
            ymin,
            xmin,
            ymax,
            xmax,
            // @ts-ignore
            bubble_shape: item.bubble_shape || 'ellipse',
            // @ts-ignore
            bg_color: item.bg_color || '#ffffff',
          },
        });

        translations.push({
          id: `trans_${Date.now()}_${idx}`,
          source_text: item.text || '',
          translated_text: item.translation || '',
          source_language: sourceLang,
          target_language: targetLang,
        });
      });

      return { ocr_results, translations, model_used: model };
    } catch (err: any) {
      if (
        err.message?.includes('API_KEY_INVALID') ||
        err.message?.includes('AI_SAFETY_BLOCKED') ||
        err.message?.includes('API_KEY_MISSING')
      ) {
        throw err;
      }
      lastModelError = err;
    }
  }

  throw lastModelError || new Error('API_QUOTA_EXCEEDED: Tất cả các phiên bản model Gemini đều tạm thời quá tải hoặc hết hạn mức.');
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
