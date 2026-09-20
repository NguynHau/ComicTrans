import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns/promises';
import crypto from 'crypto';
import sharp from 'sharp';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '30mb' }));

// Lazy initialize Gemini API client
let genAiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!genAiClient && process.env.GEMINI_API_KEY) {
    genAiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAiClient;
}

// ----------------------------------------------------
// SSRF & Security Utilities
// ----------------------------------------------------
const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./, // Link-local & cloud metadata
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((rx) => rx.test(ip));
}

async function validateUrlSecurity(urlString: string): Promise<string> {
  if (!urlString || typeof urlString !== 'string') {
    throw { code: 'INVALID_SOURCE', message: 'URL không được để trống.', status: 400 };
  }

  // Handle sample schema for direct testing
  if (urlString.startsWith('sample://')) {
    return urlString;
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch (e) {
    throw { code: 'INVALID_SOURCE', message: 'URL không đúng định dạng.', status: 400 };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw { code: 'INVALID_SOURCE', message: 'Chỉ chấp nhận giao thức HTTP hoặc HTTPS.', status: 400 };
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    throw { code: 'INVALID_SOURCE', message: 'Hostname không hợp lệ.', status: 400 };
  }

  if (isPrivateIp(hostname) || hostname === 'localhost') {
    throw { code: 'SSRF_DETECTED', message: 'Truy cập vào mạng nội bộ hoặc IP riêng tư bị từ chối.', status: 403 };
  }

  try {
    const lookup = await dns.lookup(hostname, { all: true });
    for (const record of lookup) {
      if (isPrivateIp(record.address)) {
        throw { code: 'SSRF_DETECTED', message: `Địa chỉ đích ${record.address} thuộc mạng nội bộ.`, status: 403 };
      }
    }
  } catch (e: any) {
    if (e.code === 'SSRF_DETECTED') throw e;
    throw { code: 'INVALID_SOURCE', message: `Không thể phân giải tên miền: ${hostname}`, status: 400 };
  }

  return parsed.toString();
}

// ----------------------------------------------------
// In-Memory Storage & Job State
// ----------------------------------------------------
interface OCRBox {
  id: string;
  text: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
    ymin?: number;
    xmin?: number;
    ymax?: number;
    xmax?: number;
  };
  confidence: number;
  language: string;
}

interface PageRecord {
  id: string;
  job_id: string;
  page_number: number;
  source_image: string;
  processed_image?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  updated_at: string;
  ocr_results: OCRBox[];
  translations: { id?: string; source_text: string; translated_text: string; source_language: string; target_language: string }[];
}

interface JobRecord {
  id: string;
  source_url: string;
  source_language: string;
  target_language: string;
  status: 'queued' | 'analyzing' | 'processing' | 'completed' | 'failed' | 'cancelled';
  total_pages: number;
  completed_pages: number;
  current_page: number;
  error_code?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  pages: PageRecord[];
}

const jobsDb = new Map<string, JobRecord>();
const imageCache = new Map<string, string>(); // hash -> processed data url

// Helper: Generate crisp, authentic manga/manhwa/manhua vector comic pages with dialogue balloons
function generateComicSvgDataUri(theme: 'manga' | 'manhwa' | 'manhua', pageNum: number): string {
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
      
      <!-- Panel 1: Top (y ~ 50-480) -->
      <rect x="30" y="40" width="740" height="460" fill="#111827" stroke="#312e81" stroke-width="3" rx="8" />
      <ellipse cx="400" cy="200" rx="300" ry="120" fill="#1e1b4b" stroke="#6366f1" stroke-width="3" />
      <text x="400" y="205" fill="#e0e7ff" font-size="16" font-weight="bold" text-anchor="middle" letter-spacing="2">RED GATE DUNGEON • EPISODE ${pageNum}</text>
      
      <path d="M70,80 Q70,60 220,60 Q360,60 360,130 Q360,180 250,180 L220,210 L205,180 Q70,180 70,130 Z" fill="#ffffff" stroke="#1e1b4b" stroke-width="4" />
      <text x="215" y="112" fill="#0f172a" font-size="18" font-weight="900" text-anchor="middle">S급 마수가 왜 여기에…?!</text>
      <text x="215" y="142" fill="#4338ca" font-size="13" font-weight="bold" text-anchor="middle">(S-geup masu-ga wae yeogie...?)</text>

      <!-- Panel 2: Upper-mid (y ~ 560-1040) -->
      <rect x="30" y="550" width="740" height="480" fill="#030712" stroke="#4338ca" stroke-width="3" rx="8" />
      <path d="M430,610 Q430,580 590,580 Q730,580 730,650 Q730,710 620,710 L600,745 L580,710 Q430,710 430,650 Z" fill="#ffffff" stroke="#1e1b4b" stroke-width="4" />
      <text x="580" y="638" fill="#dc2626" font-size="18" font-weight="900" text-anchor="middle">헌터 협회에 지원을 요청해!</text>
      <text x="580" y="668" fill="#0f172a" font-size="14" font-weight="bold" text-anchor="middle">이 녀석은 우리가 감당 못 해!</text>

      <!-- Panel 3: Mid (y ~ 1100-1580) -->
      <rect x="30" y="1090" width="740" height="480" fill="#0f172a" stroke="#1e293b" stroke-width="3" rx="8" />
      <circle cx="400" cy="1330" r="140" fill="#1e1b4b" stroke="#38bdf8" stroke-width="3" />
      <path d="M80,1160 Q80,1130 240,1130 Q380,1130 380,1200 Q380,1260 270,1260 L240,1295 L225,1260 Q80,1260 80,1200 Z" fill="#ffffff" stroke="#0f172a" stroke-width="4" />
      <text x="230" y="1192" fill="#0f172a" font-size="18" font-weight="900" text-anchor="middle">공격이 전혀 통하지 않아…!</text>
      <text x="230" y="1222" fill="#0f172a" font-size="14" font-weight="bold" text-anchor="middle">방어막마저 깨져가고 있어!</text>

      <!-- Panel 4: Lower-mid (y ~ 1640-2120) -->
      <rect x="30" y="1630" width="740" height="480" fill="#090d16" stroke="#6366f1" stroke-width="3" rx="8" />
      <path d="M420,1700 Q420,1670 590,1670 Q730,1670 730,1740 Q730,1800 620,1800 L600,1835 L580,1800 Q420,1800 420,1740 Z" fill="#ffffff" stroke="#1e1b4b" stroke-width="4" />
      <text x="575" y="1730" fill="#2563eb" font-size="18" font-weight="900" text-anchor="middle">모두 뒤로 물러서라.</text>
      <text x="575" y="1760" fill="#0f172a" font-size="14" font-weight="bold" text-anchor="middle">지금부터 내가 직접 나선다.</text>

      <!-- Panel 5: Deep (y ~ 2180-2660) -->
      <rect x="30" y="2170" width="740" height="480" fill="#020617" stroke="#4f46e5" stroke-width="4" rx="8" />
      <path d="M90,2240 Q90,2210 290,2210 Q460,2210 460,2280 Q460,2340 330,2340 L300,2380 L280,2340 Q90,2340 90,2280 Z" fill="#ffffff" stroke="#1e1b4b" stroke-width="4.5" />
      <text x="275" y="2272" fill="#dc2626" font-size="20" font-weight="900" text-anchor="middle">일어나라… 그림자 군단!!</text>
      <text x="275" y="2302" fill="#0f172a" font-size="14" font-weight="bold" text-anchor="middle">적들을 모조리 짓밟아라!</text>

      <!-- Panel 6: Climax (y ~ 2720-3150) -->
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

      <path d="M100,520 Q100,490 270,490 Q420,490 420,560 Q420,620 300,620 L270,655 L250,620 Q100,620 100,560 Z" fill="#ffffff" stroke="#78350f" stroke-width="3.5" />
      <text x="260" y="538" fill="#1c1917" font-size="15" font-weight="900" text-anchor="middle">这股剑意…怎么会如此强悍？！</text>
      <text x="260" y="564" fill="#047857" font-size="13" font-weight="bold" text-anchor="middle">难道他已经参透了第九重？！</text>

      <path d="M430,760 Q430,730 600,730 Q740,730 740,800 Q740,860 630,860 L610,895 L590,860 Q430,860 430,800 Z" fill="#ffffff" stroke="#78350f" stroke-width="4" />
      <text x="585" y="785" fill="#dc2626" font-size="18" font-weight="900" text-anchor="middle">九天玄雷，破！</text>
      <text x="585" y="815" fill="#1c1917" font-size="13" font-weight="bold" text-anchor="middle">叫尔等见识真正的天地之力！</text>
      <text x="400" y="1050" fill="#a1a1aa" font-size="11" text-anchor="middle">Chapter ${pageNum} • Raw Chinese Manhua Sample</text>
    </svg>`;
  }

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgContent.trim())}`;
}

// Built-in Sample Chapters for instant zero-setup demonstration
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

// ----------------------------------------------------
// Image Extraction Engine
// ----------------------------------------------------
async function extractComicImages(url: string): Promise<{ title: string; images: string[] }> {
  if (SAMPLE_CHAPTERS[url]) {
    return SAMPLE_CHAPTERS[url];
  }

  const cleanUrl = await validateUrlSecurity(url);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8,vi;q=0.7',
      },
    });
    clearTimeout(timeout);

    if (res.status === 401 || res.status === 403) {
      throw { code: 'LOGIN_REQUIRED', message: 'Trang truyện yêu cầu đăng nhập hoặc bị chặn bởi hệ thống bảo vệ.', status: 403 };
    }
    if (!res.ok) {
      throw { code: 'INVALID_SOURCE', message: `Không thể tải trang truyện (Mã phản hồi HTTP: ${res.status}).`, status: 400 };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      // Direct image URL
      if (contentType.includes('image/')) {
        return { title: 'Manga Page', images: [cleanUrl] };
      }
      throw { code: 'INVALID_SOURCE', message: 'URL không trả về nội dung HTML hoặc hình ảnh hợp lệ.', status: 400 };
    }

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Manga Chapter';

    // Match all img tags and extract various lazy load attributes
    const imgRegex = /<img\s+[^>]*>/gi;
    const matches = html.match(imgRegex) || [];
    const candidates: string[] = [];
    const seen = new Set<string>();

    const excludePatterns = [/logo/i, /avatar/i, /icon/i, /banner/i, /advert/i, /fb_share/i, /widget/i, /favicon/i, /1x1/i, /pixel/i];

    for (const imgTag of matches) {
      let src = '';
      // check data attributes & srcset
      const srcsetMatch = imgTag.match(/(?:data-srcset|srcset)=["']([^"']+)["']/i);
      if (srcsetMatch) {
        const parts = srcsetMatch[1].split(',').map((s) => s.trim().split(/\s+/)[0]);
        if (parts.length > 0) src = parts[parts.length - 1];
      }

      if (!src) {
        const attrMatch = imgTag.match(/(?:data-src|data-original|data-lazy-src|data-url|data-image|src)=["']([^"']+)["']/i);
        if (attrMatch) src = attrMatch[1];
      }

      if (!src || src.startsWith('data:image')) continue;

      try {
        const absoluteUrl = new URL(src, cleanUrl).toString();
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
      throw { code: 'NO_IMAGES_FOUND', message: 'Không tìm thấy hình ảnh truyện trong URL được cung cấp.', status: 400 };
    }

    return {
      title,
      images: candidates.slice(0, 50),
    };
  } catch (err: any) {
    if (err.code) throw err;
    throw { code: 'INVALID_SOURCE', message: `Lỗi khi trích xuất trang truyện: ${err.message || err}`, status: 400 };
  }
}

// ----------------------------------------------------
// OCR + Inpainting + Translation + Typesetting Helpers
// ----------------------------------------------------

function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
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

function layoutDialogueText(
  text: string,
  bubbleWidth: number,
  bubbleHeight: number
): { fontSize: number; lines: string[]; lineHeight: number; totalH: number } {
  // Use 75% width & height to provide comfortable interior margin inside the bubble
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

  // Fallback font size minFont
  const fontSize = minFont;
  const charWidth = fontSize * 0.58;
  const maxChars = Math.max(3, Math.floor(usableWidth / charWidth));
  const lines = wrapText(text, maxChars);
  const lineHeight = fontSize * 1.22;
  return { fontSize, lines, lineHeight, totalH: lines.length * lineHeight };
}

async function getImageBuffer(source: string): Promise<Buffer> {
  if (source.startsWith('data:image/svg+xml;utf8,')) {
    const rawSvg = decodeURIComponent(source.replace('data:image/svg+xml;utf8,', ''));
    return await sharp(Buffer.from(rawSvg)).jpeg({ quality: 95 }).toBuffer();
  }
  if (source.startsWith('data:')) {
    const b64 = source.split(',')[1];
    return Buffer.from(b64, 'base64');
  }
  const res = await fetch(source, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch image: HTTP ${res.status}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// Inpaint old text & typeset translated text to generate the completed image
async function renderInpaintedTranslatedImage(
  baseBuffer: Buffer,
  ocrList: OCRBox[],
  transList: Array<{ translated_text: string; source_text?: string }>
): Promise<{ buffer: Buffer; dataUrl: string; width: number; height: number }> {
  const meta = await sharp(baseBuffer).metadata();
  const W = meta.width || 800;
  const H = meta.height || 1100;

  let inpaintLayer = '';
  let textLayer = '';

  for (let i = 0; i < ocrList.length; i++) {
    const ocr = ocrList[i];
    const trans = transList[i]?.translated_text || ocr.text;
    if (!trans) continue;

    const bbox = ocr.bbox;
    let xmin = bbox.xmin;
    let ymin = bbox.ymin;
    let xmax = bbox.xmax;
    let ymax = bbox.ymax;

    if (ymin === undefined || xmin === undefined || ymax === undefined || xmax === undefined) {
      xmin = (bbox.x / W) * 1000;
      ymin = (bbox.y / H) * 1000;
      xmax = ((bbox.x + bbox.width) / W) * 1000;
      ymax = ((bbox.y + bbox.height) / H) * 1000;
    }

    const x = Math.round((xmin / 1000) * W);
    const y = Math.round((ymin / 1000) * H);
    const w = Math.max(24, Math.round(((xmax - xmin) / 1000) * W));
    const h = Math.max(20, Math.round(((ymax - ymin) / 1000) * H));

    const cx = x + Math.round(w / 2);
    const cy = y + Math.round(h / 2);

    // Inpaint radius: inset by 4px from border so the black outline of the bubble remains 100% intact,
    // while completely erasing all original characters inside the bubble.
    const rx = Math.max(6, Math.round(w / 2) - 4);
    const ry = Math.max(6, Math.round(h / 2) - 4);

    const isRect = (w > 200 && h < 90) || (ocr as any).bubble_shape === 'rectangle';
    const bgColor = (ocr as any).bg_color || '#ffffff';

    // Step 1: Clean/Inpaint only the old text area inside the existing bubble.
    // Preserves background artwork outside and preserves the original bubble contour.
    if (isRect) {
      inpaintLayer += `<rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" rx="8" ry="8" fill="${bgColor}" />\n`;
    } else {
      inpaintLayer += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${bgColor}" />\n`;
    }

    // Step 2: Typeset translated text: "Đè bản dịch tiếng Việt màu trắng trực tiếp vào đúng bong bóng cũ"
    const layout = layoutDialogueText(trans, w, h);
    const startY = Math.round(cy - (layout.totalH / 2) + (layout.fontSize * 0.82));

    let tspans = '';
    layout.lines.forEach((line, lineIdx) => {
      const lineY = Math.round(startY + lineIdx * layout.lineHeight);
      tspans += `<tspan x="${cx}" y="${lineY}">${escapeXml(line)}</tspan>`;
    });

    const strokeWidth = Math.max(2.5, Math.round(layout.fontSize * 0.16 * 10) / 10);

    textLayer += `
      <text font-family="'Liberation Sans', 'FreeSans', 'DejaVu Sans', Arial, sans-serif" font-size="${layout.fontSize}" font-weight="900" text-anchor="middle" fill="#ffffff" stroke="#000000" stroke-width="${strokeWidth}" stroke-linejoin="round" paint-order="stroke fill">
        ${tspans}
      </text>\n`;
  }

  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <g id="inpaint-erase-old-text">${inpaintLayer}</g>
    <g id="typeset-translated-text">${textLayer}</g>
  </svg>`;

  const compositedBuffer = await sharp(baseBuffer)
    .composite([{ input: Buffer.from(svg) }])
    .jpeg({ quality: 92 })
    .toBuffer();

  const dataUrl = `data:image/jpeg;base64,${compositedBuffer.toString('base64')}`;
  return { buffer: compositedBuffer, dataUrl, width: W, height: H };
}

// ----------------------------------------------------
// OCR + Translation + Typesetting Pipeline
// ----------------------------------------------------
async function processMangaPage(
  job: JobRecord,
  page: PageRecord,
  sourceLang: string,
  targetLang: string,
  chapterTitle: string
): Promise<{ processedUrl: string; ocrResults: OCRBox[]; translations: any[] }> {
  const ai = getGeminiClient();

  // 1. Get raw base image buffer
  let imageBuffer: Buffer | null = null;
  try {
    imageBuffer = await getImageBuffer(page.source_image);
  } catch (e) {
    console.warn(`Could not fetch image buffer for page ${page.page_number}:`, e);
  }

  if (!imageBuffer) {
    throw new Error(`Không thể tải hình ảnh trang ${page.page_number}`);
  }

  const imgHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
  const cacheKey = `${imgHash}_${sourceLang}_${targetLang}`;

  // Check cache
  if (imageCache.has(cacheKey)) {
    return {
      processedUrl: imageCache.get(cacheKey)!,
      ocrResults: page.ocr_results?.length > 0 ? page.ocr_results : [],
      translations: page.translations?.length > 0 ? page.translations : [],
    };
  }

  let ocrItems: OCRBox[] = [];
  let translatedItems: { id?: string; source_text: string; translated_text: string; source_language: string; target_language: string }[] = [];

  const meta = await sharp(imageBuffer).metadata();
  const W = meta.width || 800;
  const H = meta.height || 1100;

  // 2. Gemini OCR + Bubble Detection + Translation
  if (ai) {
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];
    
    // Normalize image to high-quality JPEG for Gemini Vision
    let geminiBuffer = imageBuffer;
    if (meta.format !== 'jpeg' || imageBuffer.length > 5 * 1024 * 1024) {
      geminiBuffer = await sharp(imageBuffer)
        .jpeg({ quality: 88 })
        .toBuffer();
    }
    const imageBase64 = geminiBuffer.toString('base64');

    const prompt = `You are an elite Comic/Manga/Manhwa/Manhua OCR, Vision, and Translation Engine.
This image has dimensions ${W}x${H} pixels (aspect ratio ${(H / W).toFixed(1)}:1).
${H > 2000 ? `CRITICAL NOTICE: This is a very tall vertical strip. You MUST scan through the ENTIRE vertical height from ymin=0 (top) down to ymax=1000 (bottom). Do NOT stop after the top panels. Find ALL speech bubbles along the entire height.` : ''}

TASK:
1. Detect ALL speech bubbles, dialogue balloons, shout bubbles, thought clouds, and narration text on this entire page/strip.
2. For EVERY dialogue bubble detected:
   - "text": Exact transcription of original text inside the bubble (Japanese, Korean, Chinese, or English).
   - "translation": Natural, context-appropriate Vietnamese translation (tiếng Việt chuẩn văn phong truyện tranh).
   - "ymin": Top coordinate of the speech bubble boundary (integer 0 to 1000).
   - "xmin": Left coordinate of the speech bubble boundary (integer 0 to 1000).
   - "ymax": Bottom coordinate of the speech bubble boundary (integer 0 to 1000).
   - "xmax": Right coordinate of the speech bubble boundary (integer 0 to 1000).
   - "bubble_shape": "ellipse" or "rectangle".
   - "bg_color": Background fill color inside the bubble (default "#ffffff").
3. CRITICAL:
   - You MUST identify and include EVERY dialogue bubble on the page. Do NOT skip any bubble.
   - Coordinates MUST accurately tightly enclose the speech bubble.
   - Order the items in reading order (top to bottom).
Return a valid JSON array of all detected speech bubbles.`;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageBase64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  translation: { type: Type.STRING },
                  ymin: { type: Type.INTEGER },
                  xmin: { type: Type.INTEGER },
                  ymax: { type: Type.INTEGER },
                  xmax: { type: Type.INTEGER },
                  confidence: { type: Type.NUMBER },
                  language: { type: Type.STRING },
                  bubble_shape: { type: Type.STRING },
                  bg_color: { type: Type.STRING },
                },
                required: ['text', 'translation', 'ymin', 'xmin', 'ymax', 'xmax'],
              },
            },
          },
        });

        const parsed = JSON.parse(response.text || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          ocrItems = parsed.map((item, idx) => {
            const ymin = Math.max(0, Math.min(1000, Number(item.ymin) || 0));
            const xmin = Math.max(0, Math.min(1000, Number(item.xmin) || 0));
            const ymax = Math.max(ymin + 10, Math.min(1000, Number(item.ymax) || 100));
            const xmax = Math.max(xmin + 10, Math.min(1000, Number(item.xmax) || 100));

            return {
              id: `ocr-${page.page_number}-${idx}`,
              text: item.text || '',
              bbox: {
                x: Math.round((xmin / 1000) * W),
                y: Math.round((ymin / 1000) * H),
                width: Math.round(((xmax - xmin) / 1000) * W),
                height: Math.round(((ymax - ymin) / 1000) * H),
                ymin,
                xmin,
                ymax,
                xmax,
              },
              confidence: Number(item.confidence) || 0.98,
              language: item.language || (sourceLang === 'auto' ? 'ja' : sourceLang),
              bubble_shape: item.bubble_shape || 'ellipse',
              bg_color: item.bg_color || '#ffffff',
              text_color: '#ffffff',
            };
          });

          translatedItems = parsed.map((item, idx) => ({
            id: `trans-${page.page_number}-${idx}`,
            source_text: item.text,
            translated_text: item.translation,
            source_language: item.language || sourceLang,
            target_language: targetLang,
          }));

          break;
        }
      } catch (e: any) {
        console.warn(`Gemini OCR model ${modelName} attempt:`, e.message || e);
      }
    }
  }

  // Strict verification: Do NOT use mock/fake translations.
  // Only mark completed if real text bubbles were detected and translated.
  if (ocrItems.length === 0) {
    throw new Error(`Không phát hiện được vùng bong bóng thoại nào trên trang ${page.page_number} để dịch.`);
  }

  // 3. Inpaint old text & render new translated text directly into the original speech bubbles
  const rendered = await renderInpaintedTranslatedImage(imageBuffer, ocrItems, translatedItems);
  const processedUrl = rendered.dataUrl;
  imageCache.set(cacheKey, processedUrl);

  return {
    processedUrl,
    ocrResults: ocrItems,
    translations: translatedItems,
  };
}

// Background Job Worker Loop
async function runJobWorker(jobId: string) {
  const job = jobsDb.get(jobId);
  if (!job) return;

  job.status = 'analyzing';
  job.updated_at = new Date().toISOString();

  try {
    let images: string[] = [];
    let title = 'Manga Chapter';

    if (job.pages && job.pages.length > 0) {
      images = job.pages.map((p) => p.source_image);
      title = 'Custom Uploaded Manga';
    } else {
      const extracted = await extractComicImages(job.source_url);
      images = extracted.images;
      title = extracted.title;
      job.total_pages = images.length;
      job.pages = images.map((imgUrl, i) => ({
        id: `page-${job.id}-${i + 1}`,
        job_id: job.id,
        page_number: i + 1,
        source_image: imgUrl,
        status: 'queued',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ocr_results: [],
        translations: [],
      }));
    }

    job.status = 'processing';
    job.updated_at = new Date().toISOString();

    for (const page of job.pages) {
      if ((job.status as string) === 'cancelled') break;

      job.current_page = page.page_number;
      page.status = 'processing';
      page.updated_at = new Date().toISOString();

      try {
        const result = await processMangaPage(
          job,
          page,
          job.source_language,
          job.target_language,
          title
        );

        page.processed_image = result.processedUrl;
        page.ocr_results = result.ocrResults;
        page.translations = result.translations;
        page.status = 'completed';
        job.completed_pages += 1;
      } catch (err: any) {
        page.status = 'failed';
        page.error_message = err.message || 'Lỗi xử lý trang';
      }

      page.updated_at = new Date().toISOString();
      job.updated_at = new Date().toISOString();

      await new Promise((r) => setTimeout(r, 300));
    }

    job.status = job.completed_pages > 0 ? 'completed' : 'failed';
    job.updated_at = new Date().toISOString();
  } catch (err: any) {
    job.status = 'failed';
    job.error_code = err.code || 'PROCESSING_FAILED';
    job.error_message = err.message || 'Không thể trích xuất và dịch chapter này.';
    job.updated_at = new Date().toISOString();
  }
}

// ----------------------------------------------------
// REST API Routes
// ----------------------------------------------------
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    gemini_configured: !!process.env.GEMINI_API_KEY,
    ocr_provider: process.env.GEMINI_API_KEY ? 'gemini-3.8-flash' : 'mock/heuristic',
    translation_provider: process.env.GEMINI_API_KEY ? 'gemini-3.8-flash' : 'mock/dictionary',
    storage_provider: 'local_cache',
  });
});

// Analyze chapter URL
app.post('/api/v1/chapters/analyze', async (req, res) => {
  try {
    const { url, source_language = 'auto', target_language = 'vi' } = req.body || {};
    const extracted = await extractComicImages(url);

    res.json({
      url,
      title: extracted.title,
      source_language,
      target_language,
      total_images: extracted.images.length,
      images: extracted.images.map((img, i) => ({
        page_number: i + 1,
        image_url: img,
      })),
    });
  } catch (err: any) {
    res.status(err.status || 400).json({
      error: {
        code: err.code || 'INVALID_SOURCE',
        message: err.message || 'Không thể phân tích URL này.',
        details: err.details || {},
      },
    });
  }
});

// Create Job (supports URL or direct base64/image array)
app.post('/api/v1/jobs', async (req, res) => {
  try {
    const { url, images, source_language = 'auto', target_language = 'vi' } = req.body || {};

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let initialPages: PageRecord[] = [];

    if (Array.isArray(images) && images.length > 0) {
      initialPages = images.map((imgData: string, i: number) => ({
        id: `page-${jobId}-${i + 1}`,
        job_id: jobId,
        page_number: i + 1,
        source_image: imgData,
        status: 'queued',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ocr_results: [],
        translations: [],
      }));
    } else {
      if (!url) {
        return res.status(400).json({
          error: { code: 'INVALID_SOURCE', message: 'Vui lòng cung cấp URL truyện hoặc tải ảnh lên.' },
        });
      }
      await validateUrlSecurity(url);
    }

    const newJob: JobRecord = {
      id: jobId,
      source_url: url || 'upload://custom-images',
      source_language,
      target_language,
      status: 'queued',
      total_pages: initialPages.length,
      completed_pages: 0,
      current_page: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pages: initialPages,
    };

    jobsDb.set(jobId, newJob);

    // Trigger background execution
    setImmediate(() => runJobWorker(jobId));

    res.status(201).json({
      job_id: jobId,
      status: 'queued',
    });
  } catch (err: any) {
    res.status(err.status || 400).json({
      error: {
        code: err.code || 'INVALID_SOURCE',
        message: err.message || 'Không thể tạo tiến trình dịch.',
        details: err.details || {},
      },
    });
  }
});

// Get Job Status
app.get('/api/v1/jobs/:jobId', (req, res) => {
  const job = jobsDb.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      error: {
        code: 'JOB_NOT_FOUND',
        message: 'Tiến trình dịch không tồn tại.',
      },
    });
  }

  res.json({
    job_id: job.id,
    status: job.status,
    source_url: job.source_url,
    source_language: job.source_language,
    target_language: job.target_language,
    total_pages: job.total_pages,
    completed_pages: job.completed_pages,
    current_page: job.current_page,
    error_code: job.error_code,
    error_message: job.error_message,
    created_at: job.created_at,
    updated_at: job.updated_at,
  });
});

// Get Job Pages
app.get('/api/v1/jobs/:jobId/pages', (req, res) => {
  const job = jobsDb.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      error: {
        code: 'JOB_NOT_FOUND',
        message: 'Tiến trình dịch không tồn tại.',
      },
    });
  }

  res.json(job.pages);
});

// Get Single Page
app.get('/api/v1/jobs/:jobId/pages/:pageId', (req, res) => {
  const job = jobsDb.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } });
  }
  const page = job.pages.find((p) => p.id === req.params.pageId);
  if (!page) {
    return res.status(404).json({ error: { code: 'PAGE_NOT_FOUND', message: 'Page not found' } });
  }
  res.json(page);
});

// Retry Page
app.post('/api/v1/jobs/:jobId/pages/:pageId/retry', async (req, res) => {
  const job = jobsDb.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } });
  }
  const page = job.pages.find((p) => p.id === req.params.pageId);
  if (!page) {
    return res.status(404).json({ error: { code: 'PAGE_NOT_FOUND', message: 'Page not found' } });
  }

  page.status = 'processing';
  page.error_message = undefined;

  setImmediate(async () => {
    try {
      const result = await processMangaPage(
        job,
        page,
        job.source_language,
        job.target_language,
        'Manga Chapter'
      );
      page.processed_image = result.processedUrl;
      page.ocr_results = result.ocrResults;
      page.translations = result.translations;
      page.status = 'completed';
    } catch (e: any) {
      page.status = 'failed';
      page.error_message = e.message || 'Retry failed';
    }
  });

  res.json({ status: 'retrying', job_id: job.id, page_id: page.id });
});

// Update Dialogue in Page & re-render inpainted image
app.put('/api/v1/jobs/:jobId/pages/:pageId/dialogue', async (req, res) => {
  const job = jobsDb.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } });
  }
  const page = job.pages.find((p) => p.id === req.params.pageId);
  if (!page) {
    return res.status(404).json({ error: { code: 'PAGE_NOT_FOUND', message: 'Page not found' } });
  }

  const { dialogue_index, translated_text } = req.body || {};
  if (typeof dialogue_index === 'number' && page.translations[dialogue_index]) {
    page.translations[dialogue_index].translated_text = translated_text;
    page.updated_at = new Date().toISOString();

    // Re-render the image with the newly updated dialogue text
    try {
      const baseBuffer = await getImageBuffer(page.source_image);
      const rendered = await renderInpaintedTranslatedImage(baseBuffer, page.ocr_results, page.translations);
      page.processed_image = rendered.dataUrl;
    } catch (err) {
      console.warn('Could not re-render inpainted image after dialogue edit:', err);
    }

    return res.json({ success: true, page });
  }

  res.status(400).json({ error: { code: 'INVALID_DIALOGUE', message: 'Không tìm thấy vị trí câu thoại cần sửa.' } });
});

// Cancel / Delete Job
app.delete('/api/v1/jobs/:jobId', (req, res) => {
  const job = jobsDb.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: { code: 'JOB_NOT_FOUND', message: 'Job not found' } });
  }
  job.status = 'cancelled';
  jobsDb.delete(req.params.jobId);
  res.json({ status: 'deleted', job_id: req.params.jobId });
});

// OpenAPI Spec Endpoint
app.get('/api/v1/openapi.json', (req, res) => {
  res.json({
    openapi: '3.0.3',
    info: {
      title: 'Manga Translator API',
      version: '1.0.0',
      description: 'REST API for automated manga/manhwa/manhua URL ingestion, OCR, translation, and typesetting.',
    },
    paths: {
      '/api/v1/chapters/analyze': {
        post: {
          summary: 'Analyze Manga Chapter URL and extract images',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { url: { type: 'string' } } } } },
          },
          responses: { '200': { description: 'Chapter metadata and image list' } },
        },
      },
      '/api/v1/jobs': {
        post: {
          summary: 'Create a new translation job',
          responses: { '201': { description: 'Job created' } },
        },
      },
      '/api/v1/jobs/{job_id}': {
        get: {
          summary: 'Poll job translation progress and status',
          responses: { '200': { description: 'Job progress details' } },
        },
      },
    },
  });
});

// ----------------------------------------------------
// Vite Middleware / Static Asset Serving
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Manga Translator Server running on http://localhost:${PORT}`);
  });
}

startServer();
