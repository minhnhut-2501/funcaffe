<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Thuế giá trị gia tăng (VAT) áp cho GÓI DỊCH VỤ
    |--------------------------------------------------------------------------
    | Đơn vị: phần trăm (10 = 10%). Áp khi chủ quán mua/nâng cấp/gia hạn gói.
    | Giá niêm yết trên time_subscriptions là giá CHƯA gồm VAT; số tiền
    | thanh toán thực tế = giá gói + VAT. Đổi qua biến môi trường VAT_RATE.
    */
    'vat_rate' => (float) env('VAT_RATE', 10),

    /*
    |--------------------------------------------------------------------------
    | Trợ lý AI — Google Gemini (gói free tier)
    |--------------------------------------------------------------------------
    | API key CHỈ nằm ở server, frontend không gọi thẳng. Lấy key miễn phí tại
    | https://aistudio.google.com. Đổi model qua env GEMINI_MODEL.
    */
    'gemini_key'   => env('GEMINI_API_KEY', ''),
    'gemini_model' => env('GEMINI_MODEL', 'gemini-flash-latest'),
    // Mô hình dự phòng khi mô hình chính nghẽn (503) hoặc cạn hạn ngạch (429).
    // Hạn ngạch bậc miễn phí đếm riêng cho từng mô hình nên đây là đường lui thật.
    // Xem GeminiService::danhSachModel(). Để trống là tắt dự phòng.
    'gemini_model_fallback' => env('GEMINI_MODEL_FALLBACK', 'gemini-flash-lite-latest'),
    // Đường dẫn bộ chứng chỉ CA (fix cURL error 60 khi PHP local thiếu cert).
    // Để trống trên Linux/Render (dùng cert hệ thống). Windows: trỏ tới cacert.pem.
    'gemini_ca_bundle' => env('GEMINI_CA_BUNDLE', ''),

    /*
    |--------------------------------------------------------------------------
    | Trần tần suất cho trợ lý AI tư vấn (tuyến công khai)
    |--------------------------------------------------------------------------
    | Xem AppServiceProvider::gioiHanTroLyAi() để biết vì sao cần cả ba lớp.
    |
    | `ai_chung_moi_ngay` là lớp bảo vệ hạn ngạch Gemini bậc miễn phí: nó tính
    | trên CẢ KHÓA API chứ không theo từng khách, nên phải đặt thấp hơn hẳn hạn
    | ngạch thật để chủ quán trả tiền không bị khách vãng lai giành mất lượt.
    */
    // Hạn chờ mỗi lời gọi Gemini (giây). Xem GeminiService::hanCho() — con số này
    // đồng thời quyết định hạn chạy của tiến trình PHP, nên đừng đặt quá cao: người
    // dùng ngồi nhìn màn hình đứng im lâu hơn thế là họ bỏ đi rồi.
    'gemini_timeout'    => (int) env('GEMINI_TIMEOUT', 45),

    'ai_moi_phut'       => (int) env('AI_MOI_PHUT', 6),
    'ai_moi_ngay'       => (int) env('AI_MOI_NGAY', 40),
    'ai_chung_moi_ngay' => (int) env('AI_CHUNG_MOI_NGAY', 120),

    /*
    |--------------------------------------------------------------------------
    | Bộ chứng chỉ CA dùng chung cho MỌI lời gọi HTTPS ra ngoài
    |--------------------------------------------------------------------------
    | Cùng mục đích với gemini_ca_bundle nhưng không gắn với một dịch vụ nào —
    | MoMo cũng cần nó. Mặc định rơi về giá trị của Gemini để máy nào đã cấu hình
    | trước đây thì không phải khai lại.
    */
    'ca_bundle' => env('CA_BUNDLE', env('GEMINI_CA_BUNDLE', '')),
];
