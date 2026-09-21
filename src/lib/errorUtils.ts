// Error classification and diagnosis utility for RiXia
// Translates technical API and scraping errors into clear, actionable Vietnamese instructions

export type ErrorCategory =
  | 'API_KEY_MISSING'       // Chưa cấu hình API Key
  | 'API_KEY_INVALID'       // API Key không đúng hoặc bị vô hiệu hóa
  | 'API_QUOTA_EXCEEDED'    // Hết lượt dùng miễn phí (429 / RESOURCE_EXHAUSTED)
  | 'API_PERMISSION_DENIED' // API Key không có quyền truy cập model
  | 'NO_IMAGES_FOUND'       // Không tìm thấy ảnh trong trang web
  | 'URL_ACCESS_DENIED'     // Không truy cập được link web (CORS / Cloudflare)
  | 'IMAGE_LOAD_FAILED'     // Không tải được ảnh do máy chủ chặn (Hotlink)
  | 'AI_SAFETY_BLOCKED'     // Bộ lọc an toàn AI từ chối phân tích
  | 'AI_PARSE_ERROR'        // Phản hồi AI không đúng định dạng
  | 'NETWORK_ERROR'         // Lỗi kết nối mạng
  | 'UNKNOWN_ERROR';        // Lỗi không xác định

export interface DetailedError {
  category: ErrorCategory;
  categoryLabel: string;
  title: string;
  message: string;
  suggestion: string;
  actionType?: 'open_settings' | 'upload_tab' | 'retry';
  actionLabel?: string;
  rawDetails?: string;
}

export function parseTranslationError(err: any): DetailedError {
  const rawMsg = (err?.message || (typeof err === 'string' ? err : 'Lỗi không xác định')).trim();
  const rawStr = JSON.stringify(err || '');

  // 1. Missing API Key
  if (
    rawMsg.includes('Chưa tìm thấy Gemini API Key') ||
    rawMsg.includes('chưa nhập Gemini API Key') ||
    rawMsg.includes('API_KEY_MISSING')
  ) {
    return {
      category: 'API_KEY_MISSING',
      categoryLabel: 'Chưa Nhập API Key',
      title: 'Chưa có Gemini API Key',
      message: 'Bạn chưa cài đặt mã khóa Gemini API. Ứng dụng cần API Key miễn phí từ Google để nhận diện chữ và dịch truyện.',
      suggestion: 'Vui lòng nhấn nút bên dưới để mở Cài đặt và dán API Key của bạn (có thể lấy miễn phí tại aistudio.google.com).',
      actionType: 'open_settings',
      actionLabel: 'Mở Cài Đặt API Key',
      rawDetails: rawMsg,
    };
  }

  // 2. Invalid API Key
  if (
    rawMsg.includes('API_KEY_INVALID') ||
    rawMsg.includes('API key not valid') ||
    rawMsg.includes('INVALID_ARGUMENT') && rawMsg.includes('API key') ||
    rawMsg.includes('400') && (rawMsg.includes('API key') || rawMsg.includes('key=')) ||
    rawMsg.includes('403') && (rawMsg.includes('API key') || rawMsg.includes('key='))
  ) {
    return {
      category: 'API_KEY_INVALID',
      categoryLabel: 'Lỗi API Key',
      title: 'Mã khóa API Key không hợp lệ',
      message: 'Google AI Studio từ chối mã API Key này. Mã khóa có thể bị gõ sai ký tự, đã bị thu hồi hoặc xóa bỏ trên Google Cloud.',
      suggestion: 'Vào aistudio.google.com/app/apikey, bấm "Create API key", sao chép chính xác và dán lại vào phần Cài đặt của ứng dụng.',
      actionType: 'open_settings',
      actionLabel: 'Kiểm tra & Nhập lại API Key',
      rawDetails: rawMsg,
    };
  }

  // 3. Quota Exceeded (429 / RESOURCE_EXHAUSTED)
  if (
    rawMsg.includes('429') ||
    rawMsg.includes('RESOURCE_EXHAUSTED') ||
    rawMsg.includes('quota') ||
    rawMsg.includes('rate limit') ||
    rawMsg.includes('limit: 20')
  ) {
    return {
      category: 'API_QUOTA_EXCEEDED',
      categoryLabel: 'Hết Hạn Mức (Quota 429)',
      title: 'Vượt quá giới hạn lượt gọi API',
      message: 'Google Gemini giới hạn số lượt dịch miễn phí mỗi phút/ngày cho mỗi API Key. Tất cả các phiên bản model dự phòng đều đang bận hoặc quá tải.',
      suggestion: 'Vui lòng chờ khoảng 1 đến 2 phút rồi bấm "Thử lại". Bạn cũng có thể tạo thêm một API Key từ tài khoản Google khác để tiếp tục ngay lập tức.',
      actionType: 'retry',
      actionLabel: 'Thử lại ngay',
      rawDetails: rawMsg,
    };
  }

  // 4. Permission Denied
  if (rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('403')) {
    return {
      category: 'API_PERMISSION_DENIED',
      categoryLabel: 'Lỗi Phân Quyền API',
      title: 'API Key bị từ chối truy cập',
      message: 'Mã API Key không được cấp quyền sử dụng dịch vụ Generative Language của Google.',
      suggestion: 'Hãy kiểm tra lại dự án Google Cloud của bạn hoặc tạo một API Key mới hoàn toàn tại Google AI Studio.',
      actionType: 'open_settings',
      actionLabel: 'Cấu hình lại API Key',
      rawDetails: rawMsg,
    };
  }

  // 5. No Images Found in URL
  if (
    rawMsg.includes('NO_IMAGES_FOUND') ||
    rawMsg.includes('Không phát hiện được trang ảnh') ||
    rawMsg.includes('Không phát hiện trang ảnh nào') ||
    rawMsg.includes('Không tìm thấy hình ảnh')
  ) {
    return {
      category: 'NO_IMAGES_FOUND',
      categoryLabel: 'Không Thấy Hình Trong Trang',
      title: 'Không phát hiện được hình ảnh từ URL',
      message: 'Trang web bạn cung cấp không chứa ảnh truyện trực tiếp, hoặc trang yêu cầu đăng nhập, hoặc sử dụng hệ thống chống cào dữ liệu (Cloudflare Turnstile).',
      suggestion: 'Bạn hãy mở trang web đó trên trình duyệt, lưu các trang truyện về máy (hoặc chụp màn hình) rồi dùng tab "Tải Tệp Lên" để dịch tức thì!',
      actionType: 'upload_tab',
      actionLabel: 'Chuyển sang Tải Ảnh Trực Tiếp',
      rawDetails: rawMsg,
    };
  }

  // 6. Cloudflare Bot Protection or URL Access Denied
  if (
    rawMsg.includes('CLOUDFLARE_PROTECTED') ||
    rawMsg.includes('URL_ACCESS_DENIED') ||
    rawMsg.includes('Không thể kết nối đến trang truyện') ||
    rawMsg.includes('CORS') && rawMsg.includes('trang') ||
    rawMsg.includes('Cloudflare')
  ) {
    const isCloudflare = rawMsg.includes('CLOUDFLARE_PROTECTED') || rawMsg.includes('Cloudflare');
    return {
      category: 'URL_ACCESS_DENIED',
      categoryLabel: isCloudflare ? 'Chặn Bởi Cloudflare' : 'Lỗi Truy Cập Trang Web',
      title: isCloudflare ? 'Trang truyện bật bảo vệ chống bot' : 'Không thể kết nối đến địa chỉ truyện',
      message: isCloudflare
        ? 'Website truyện tranh này vừa bật tường lửa Cloudflare chống cào dữ liệu, khiến máy chủ trung gian bị chặn tạm thời.'
        : 'Máy chủ trang truyện đã chặn yêu cầu trích xuất từ bên ngoài hoặc đường dẫn URL tạm thời không phản hồi.',
      suggestion: 'Để không bị phụ thuộc vào link web, bạn có thể lưu ảnh/chương truyện về máy rồi bấm "Tải Ảnh / Tệp ZIP" để dịch 100% mượt mà.',
      actionType: 'upload_tab',
      actionLabel: 'Tải Ảnh / Tệp ZIP Lên',
      rawDetails: rawMsg,
    };
  }

  // 7. Image Load Failed / Hotlink Protection
  if (
    rawMsg.includes('IMAGE_LOAD_FAILED') ||
    rawMsg.includes('Không thể tải hình ảnh để chuyển đổi') ||
    rawMsg.includes('Tainted canvases') ||
    rawMsg.includes('Hotlink')
  ) {
    return {
      category: 'IMAGE_LOAD_FAILED',
      categoryLabel: 'Lỗi Chặn Tải Hình Ảnh',
      title: 'Máy chủ chặn tải dữ liệu ảnh (Hotlink)',
      message: 'Trang truyện có tính năng bảo vệ bản quyền, cấm các trang web khác tải trực tiếp ảnh từ máy chủ của họ.',
      suggestion: 'Hãy tải ảnh truyện trực tiếp về máy rồi chọn "Tải Tệp Lên", ứng dụng sẽ xử lý offline hoàn toàn không qua máy chủ web.',
      actionType: 'upload_tab',
      actionLabel: 'Tải Ảnh Từ Máy Của Bạn',
      rawDetails: rawMsg,
    };
  }

  // 8. AI Safety Filter Blocked
  if (rawMsg.includes('SAFETY') || rawMsg.includes('HARM') || rawMsg.includes('BLOCKED_BY_SAFETY')) {
    return {
      category: 'AI_SAFETY_BLOCKED',
      categoryLabel: 'Bộ Lọc An Toàn Chặn',
      title: 'Google AI từ chối phân tích nội dung',
      message: 'Trang truyện chứa hình ảnh hoặc yếu tố bị hệ thống an toàn của Google Gemini đánh giá là không phù hợp.',
      suggestion: 'Vui lòng kiểm tra lại hình ảnh hoặc thử với trang truyện khác.',
      actionType: 'retry',
      actionLabel: 'Thử trang khác',
      rawDetails: rawMsg,
    };
  }

  // 9. Network Connection Error
  if (
    rawMsg.includes('Failed to fetch') ||
    rawMsg.includes('NetworkError') ||
    rawMsg.includes('net::ERR_') ||
    !navigator.onLine
  ) {
    return {
      category: 'NETWORK_ERROR',
      categoryLabel: 'Lỗi Kết Nối Mạng',
      title: 'Không thể kết nối Internet',
      message: 'Không thể kết nối tới Google Gemini API hoặc máy chủ truyện tranh. Vui lòng kiểm tra kết nối Wi-Fi / 4G của bạn.',
      suggestion: 'Kiểm tra lại đường truyền mạng, VPN (nếu có) và nhấn nút Thử lại.',
      actionType: 'retry',
      actionLabel: 'Thử lại kết nối',
      rawDetails: rawMsg,
    };
  }

  // 10. Default / Unknown Error
  return {
    category: 'UNKNOWN_ERROR',
    categoryLabel: 'Lỗi Dịch Thuật',
    title: 'Xảy ra lỗi trong quá trình xử lý',
    message: rawMsg || 'Không thể hoàn tất tiến trình nhận diện và dịch trang truyện.',
    suggestion: 'Vui lòng kiểm tra lại API Key trong Cài đặt hoặc thử lại với hình ảnh tải lên trực tiếp.',
    actionType: 'retry',
    actionLabel: 'Thử lại',
    rawDetails: rawMsg,
  };
}

// Diagnostic API test function
export async function testGeminiApiKey(apiKey: string): Promise<{
  ok: boolean;
  model?: string;
  error?: DetailedError;
}> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return {
      ok: false,
      error: parseTranslationError('Chưa tìm thấy Gemini API Key'),
    };
  }

  const testModels = [
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
  ];

  let lastError: any = null;

  for (const m of testModels) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${cleanKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Ping test' }] }],
          }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        return {
          ok: true,
          model: m,
        };
      }

      // If invalid key, stop immediately
      if (res.status === 400 || res.status === 403) {
        return {
          ok: false,
          error: parseTranslationError(`API_KEY_INVALID: ${data?.error?.message || 'Key không hợp lệ'}`),
        };
      }

      // If 429 quota, save and try next model
      if (res.status === 429) {
        lastError = new Error(`Model ${m} bị giới hạn tần suất (429)`);
        continue;
      }

      lastError = new Error(data?.error?.message || `HTTP ${res.status}`);
    } catch (e: any) {
      lastError = e;
    }
  }

  return {
    ok: false,
    error: parseTranslationError(lastError || 'Lỗi kiểm tra API Key'),
  };
}

export const classifyPipelineError = parseTranslationError;
