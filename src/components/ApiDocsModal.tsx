import React, { useState } from 'react';
import { X, Copy, Check, FileCode2, Terminal } from 'lucide-react';

interface ApiDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiDocsModal: React.FC<ApiDocsModalProps> = ({ isOpen, onClose }) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  const endpoints = [
    {
      method: 'POST',
      path: '/api/v1/chapters/analyze',
      title: 'Trích xuất hình ảnh từ URL Chapter',
      body: '{\n  "url": "https://mangasite.com/one-piece/chap-1090",\n  "source_language": "ja",\n  "target_language": "vi"\n}',
      curl: `curl -X POST http://localhost:3000/api/v1/chapters/analyze \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://mangasite.com/chapter-1"}'`,
    },
    {
      method: 'POST',
      path: '/api/v1/jobs',
      title: 'Tạo tiến trình dịch Chapter mới (Async Job)',
      body: '{\n  "url": "https://mangasite.com/one-piece/chap-1090",\n  "source_language": "ja",\n  "target_language": "vi"\n}',
      curl: `curl -X POST http://localhost:3000/api/v1/jobs \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://mangasite.com/chapter-1","source_language":"ja","target_language":"vi"}'`,
    },
    {
      method: 'GET',
      path: '/api/v1/jobs/{job_id}',
      title: 'Kiểm tra trạng thái & tiến độ dịch',
      body: '',
      curl: `curl http://localhost:3000/api/v1/jobs/job_123456`,
    },
    {
      method: 'GET',
      path: '/api/v1/jobs/{job_id}/pages',
      title: 'Lấy danh sách các trang và URL ảnh đã dịch',
      body: '',
      curl: `curl http://localhost:3000/api/v1/jobs/job_123456/pages`,
    },
    {
      method: 'GET',
      path: '/api/v1/health',
      title: 'Kiểm tra trạng thái hệ thống AI & Storage',
      body: '',
      curl: `curl http://localhost:3000/api/v1/health`,
    },
  ];

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Tài Liệu REST API & OpenAPI</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 space-y-4 overflow-y-auto text-xs">
          <p className="text-slate-400">
            Hệ thống cung cấp đầy đủ các API RESTful theo chuẩn OpenAPI 3.0 với cơ chế xử lý bất đồng bộ (Background Workers), chống tấn công SSRF, và tích hợp AI đa phương thức.
          </p>

          <div className="space-y-3">
            {endpoints.map((ep, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        ep.method === 'POST'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-indigo-500/20 text-indigo-400'
                      }`}
                    >
                      {ep.method}
                    </span>
                    <span className="font-mono text-slate-200 font-semibold">{ep.path}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(ep.curl, idx)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded"
                  >
                    {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedIdx === idx ? 'Đã chép' : 'Copy cURL'}</span>
                  </button>
                </div>

                <p className="text-slate-400 text-[11px]">{ep.title}</p>

                <div className="bg-slate-900 p-2 rounded-lg font-mono text-[11px] text-slate-300 overflow-x-auto">
                  {ep.curl}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
