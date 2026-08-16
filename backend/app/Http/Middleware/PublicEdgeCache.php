<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cho phép biên (Cloudflare) đệm mấy đường CÔNG KHAI, đọc thuần.
 *
 * VÌ SAO CẦN: Cloudflare chỉ đệm khi header `Vary` duy nhất là `Accept-Encoding`.
 * HandleCors gắn `Vary: Origin` vào MỌI phản hồi khi `allowed_origins` là danh sách
 * cụ thể (đúng cấu hình production của mình) — nên `/api/*` luôn về `cf-cache-status:
 * DYNAMIC`, kể cả khi đã đặt Cache Rules ở Cloudflare. Đo được: /api/packages 0,65s
 * và /api/reviews 1,3s cho mọi lượt gọi, vì lượt nào cũng bay sang Virginia.
 *
 * Ba đường dưới đây trả CÙNG một nội dung cho mọi người và không đọc gì từ danh tính
 * người gọi, nên đệm chung là đúng đắn. Với riêng chúng, trả `Access-Control-Allow-
 * Origin: *` và hạ `Vary` xuống `Accept-Encoding` — KHÔNG nới CORS cho phần còn lại
 * của API, nơi mỗi quán chỉ được thấy dữ liệu của mình.
 *
 * `max-age=300` do máy chủ tự khai còn có tác dụng thứ hai: gói Cloudflare Free không
 * cho chọn Edge TTL dưới 2 giờ ở giao diện, nhưng nó TÔN TRỌNG max-age của máy chủ.
 * Đặt luật Cache Rules ở chế độ "Use cache-control header if present" là ăn đúng 5 phút.
 *
 * PHẢI PREPEND (xem bootstrap/app.php) để nằm NGOÀI HandleCors: phản hồi đi từ trong
 * ra ngoài, nên chỉ lớp ngoài cùng mới ghi đè được header mà HandleCors vừa gắn.
 */
class PublicEdgeCache
{
    /** Chỉ ba đường này. Thêm đường mới vào đây là quyết định về BẢO MẬT, không phải tốc độ. */
    private const DUONG_CONG_KHAI = [
        'api/packages',
        'api/packages/*/time-subscriptions',
        'api/reviews',
    ];

    /** 5 phút: bảng gói đổi vài tháng một lần, đánh giá mới thì chờ chừng đó là chấp nhận được. */
    private const SO_GIAY = 300;

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $this->duocDem($request, $response)) {
            return $response;
        }

        $response->headers->set('Access-Control-Allow-Origin', '*');
        $response->headers->set('Cache-Control', 'public, max-age='.self::SO_GIAY);

        // Giữ lại Accept-Encoding chứ không xoá trắng Vary: Cloudflare được phép đệm
        // theo nó, mà bỏ hẳn thì bản đã nén có thể bị trả cho máy không nhận nén.
        $response->headers->set('Vary', 'Accept-Encoding');

        return $response;
    }

    /**
     * Chỉ GET và chỉ khi thành công. Lỗi 4xx/5xx mà đem đệm 5 phút thì một cú trục
     * trặc thoáng qua ở CSDL sẽ hoá thành 5 phút hỏng đều cho mọi khách.
     */
    private function duocDem(Request $request, Response $response): bool
    {
        return $request->isMethod('GET')
            && $response->getStatusCode() === 200
            && $request->is(...self::DUONG_CONG_KHAI);
    }
}
