# Manga Translator PWA (URL-to-Translated Manga)

A modern, production-oriented Progressive Web App (PWA) that automates the extraction, OCR, translation, inpainting, and typesetting of Manga, Manhwa, and Manhua chapters directly from a webpage URL.

---

## 🏗️ System Architecture

```
[User / Mobile Browser]
        │  (PWA App Shell / Next.js / Vite React)
        ▼
[Reverse Proxy / API Router]
        │
   ┌────┴──────────────────────────────────────┐
   │                                           │
   ▼                                           ▼
[Source Extraction & SSRF Guard]       [Job Manager & Queue]
   │ (Generic HTML, img, srcset, lazy)         │ (Status, Retries, Caching)
   │                                           │
   ▼                                           ▼
[Image Validation & Download]          [Storage Service (Local / S3)]
   │
   ▼
[Multimodal Vision AI / OCR] (Gemini-3.8-flash / Tesseract)
   │ (Detects speech balloons, text coordinates, reading order)
   │
   ▼
[Context-Aware Translation] (Gemini / Multilingual Engine)
   │ (Preserves character tones, slang, natural Vietnamese localization)
   │
   ▼
[Inpainting & Text Removal] (OpenCV Telea / Navier-Stokes)
   │ (Cleans speech bubbles without destroying panel artwork)
   │
   ▼
[Typesetting Engine] (Pillow / Dynamic Canvas Typesetter)
   │ (Auto-fits font size, word wrap, centering, boundary clamping)
   │
   ▼
[Interactive Manga Reader & ZIP Downloader]
```

---

## ✨ Key Features

1. **Simple 1-Click Workflow**:
   - Paste Chapter URL (or choose from built-in Japanese/Korean/Chinese samples).
   - Select *Translate From* (Auto Detect, Japanese, Korean, Chinese, English).
   - Select *Translate To* (Vietnamese, English, French, Spanish, etc.).
   - Click **Translate Chapter** and enjoy reading!

2. **Mobile-First PWA Experience**:
   - Installable on iOS (Safari Add to Home Screen) and Android (Chrome WebAPK).
   - Offline App Shell cached via Service Worker.
   - Dual Reading Modes: **Single Page Flip** and **Vertical Webtoon Scroll**.
   - Original vs. Translated instant toggle.
   - Interactive dialogue inspector (tap any bubble to compare OCR vs Translation).
   - Export full translated chapter as a ZIP file.

3. **Enterprise Security & Safeguards**:
   - **SSRF Protection**: Strict IP/CIDR blocking, DNS validation, private network / AWS metadata (`169.254.169.254`) filtering.
   - **Resource Limits**: Max page limits (50 pages/job), image size checks, HTML size limit, request timeouts.
   - **Resilience**: Per-page retry mechanism, background workers, and SHA256 image caching.

---

## 📦 Project Structure

```
├── backend/                       # Python FastAPI Backend
│   ├── app/
│   │   ├── api/v1/                # REST Endpoints (chapters, jobs, health)
│   │   ├── core/                  # Config, Security (SSRF), Error codes
│   │   ├── db/                    # SQLAlchemy engine & session
│   │   ├── models/                # DB Models (Job, Page, OCRResult, Translation)
│   │   ├── schemas/               # Pydantic Schemas
│   │   ├── services/
│   │   │   ├── source_extractor/  # Web scrapers & generic HTML parser
│   │   │   ├── ocr/               # OCR interface & Gemini adapter
│   │   │   ├── translation/       # Contextual translation engine
│   │   │   ├── inpainting/        # Speech bubble inpainter
│   │   │   ├── typesetting/       # Auto-fit typography engine
│   │   │   ├── storage/           # Local & S3 Storage providers
│   │   │   └── pipeline.py        # End-to-end processing pipeline
│   │   ├── jobs/                  # Background worker queue & cancellation
│   │   └── main.py                # FastAPI Application
│   ├── tests/                     # Unit & Integration Tests (SSRF, OCR, API)
│   ├── Dockerfile
│   └── requirements.txt
│
├── src/                           # Live React PWA Client
│   ├── components/                # UI Components (Reader, Navbar, Progress, Modals)
│   ├── hooks/                     # usePWAInstall, useOnlineStatus
│   ├── types.ts                   # TypeScript Interfaces
│   └── App.tsx                    # Main App Controller
│
├── frontend/                      # Standalone Next.js App
│   ├── app/                       # App Router pages
│   ├── package.json
│   └── next.config.js
│
├── server.ts                      # Full-stack Node/Express Dev & API Proxy Server
├── docker-compose.yml             # Docker Compose full-stack orchestration
├── .env.example                   # Environment configuration template
└── metadata.json
```

---

## 🚀 Quick Start & Local Setup

### Option 1: Full-Stack Container (Recommended)

1. Clone repository and copy `.env`:
   ```bash
   cp .env.example .env
   ```
2. Start development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.

### Option 2: Docker Compose (Production Stack)

```bash
docker-compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- API Swagger Docs: `http://localhost:8000/api/v1/docs`

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/chapters/analyze` | Scrapes chapter URL and lists comic pages |
| `POST` | `/api/v1/jobs` | Enqueues a translation job |
| `GET` | `/api/v1/jobs/{job_id}` | Polls job status and completion progress |
| `GET` | `/api/v1/jobs/{job_id}/pages` | Retrieves translated page records and images |
| `POST` | `/api/v1/jobs/{job_id}/pages/{page_id}/retry` | Retries an individual failed page |
| `DELETE` | `/api/v1/jobs/{job_id}` | Cancels and cleans up a job |
| `GET` | `/api/v1/health` | System health and provider status |

---

## ⚙️ Configuration Options

| Environment Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | *(optional)* | Gemini Multimodal API Key for high-accuracy OCR & translation |
| `OCR_PROVIDER` | `gemini` | `gemini` \| `tesseract` \| `mock` |
| `TRANSLATION_PROVIDER` | `gemini` | `gemini` \| `mock` |
| `STORAGE_PROVIDER` | `local` | `local` \| `s3` |
| `MAX_PAGES_PER_JOB` | `50` | Maximum pages allowed in a single chapter job |
| `MAX_IMAGE_SIZE_MB` | `20` | Max allowed individual image size |
