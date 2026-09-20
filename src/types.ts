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
  created_at: string;
  updated_at: string;
  pages?: MangaPage[];
}

export interface LanguageOption {
  code: string;
  name: string;
  flag: string;
}

export interface RecentItem {
  id: string;
  title: string;
  sourceUrl?: string;
  thumbnail?: string;
  totalPages: number;
  completedPages: number;
  timestamp: string;
  job: MangaJob;
  pages: MangaPage[];
}
