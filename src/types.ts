import type { DetailedError, ErrorCategory } from './lib/errorUtils';
export type { DetailedError, ErrorCategory };

export interface OCRBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  // Normalized 0-1000 or percentage coordinates
  ymin?: number;
  xmin?: number;
  ymax?: number;
  xmax?: number;
}

export interface OCRBoxItem {
  id: string;
  text: string;
  bbox: OCRBoundingBox;
  confidence: number;
  language: string;
}

export interface TranslationItem {
  id?: string;
  source_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
}

export interface MangaPage {
  id: string;
  job_id: string;
  page_number: number;
  source_image: string;
  processed_image?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  detailed_error?: DetailedError;
  created_at: string;
  updated_at: string;
  ocr_results: OCRBoxItem[];
  translations: TranslationItem[];
}

export interface MangaJob {
  job_id: string;
  status: 'queued' | 'analyzing' | 'processing' | 'completed' | 'failed' | 'cancelled';
  source_url: string;
  source_language: string;
  target_language: string;
  total_pages: number;
  completed_pages: number;
  current_page: number;
  error_code?: string;
  error_message?: string;
  detailed_error?: DetailedError;
  created_at: string;
  updated_at: string;
  pages?: MangaPage[];
}

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

export interface MangaFolder {
  id: string;
  name: string;
  createdAt: string;
  seriesUrl?: string;
  seriesKey?: string;
  lastUpdated?: string;
}

export interface RecentItem {
  id: string;
  title: string; // Strictly formatted as "Chap X" (e.g., "Chap 0", "Chap 1", "Chap 2")
  chapterNumber?: number; // Parsed numerical value (e.g. 0, 1, 2, 5.5)
  folderId?: string;
  folderName?: string;
  sourceUrl?: string; // Exact original chapter URL
  sourceUrlVerified?: boolean;
  thumbnail?: string;
  totalPages: number;
  completedPages: number;
  timestamp: string;
  job: MangaJob;
  pages: MangaPage[];
}

export interface BatchChapterSummary {
  chapterNumber: number;
  title: string; // "Chap X"
  url: string; // Exact original chapter URL
  pageCount: number;
  completedAt: string;
  recentItemId: string;
}

export interface BatchTranslationSession {
  id: string;
  seriesName: string;
  seriesKey?: string;
  seriesBaseUrl?: string;
  folderId: string;
  sourceLang: string;
  targetLang: string;
  initialUrl: string;
  currentUrl: string;
  currentChapterNumber: number;
  completedChapters: BatchChapterSummary[];
  missingChaptersToProcess?: number[];
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
  errorMessage?: string;
  detailedError?: DetailedError;
  consecutiveErrors: number;
  lastUpdated: string;
  maxChapters?: number;
  logs?: string[]; // Persistent diagnostic logs
}
