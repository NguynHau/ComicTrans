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

// Scraping function using client-side fallback with AllOrigins CORS proxy
export async function extractComicImagesClient(url: string): Promise<{ title: string; images: string[] }> {
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
