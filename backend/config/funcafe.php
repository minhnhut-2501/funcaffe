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
    // Đường dẫn bộ chứng chỉ CA (fix cURL error 60 khi PHP local thiếu cert).
    // Để trống trên Linux/Render (dùng cert hệ thống). Windows: trỏ tới cacert.pem.
    'gemini_ca_bundle' => env('GEMINI_CA_BUNDLE', ''),
];
