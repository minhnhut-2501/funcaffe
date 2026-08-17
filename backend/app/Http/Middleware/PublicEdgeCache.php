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
 * ĐỆM Ở BIÊN, KHÔNG ĐỆM Ở TRÌNH DUYỆT. Trước đây header là `max-age=300` chung cho cả
 * hai, và cái giá phải trả nằm ở chỗ không ai ngờ: chủ quán sửa đánh giá xong, mở trang
 * chủ thì suốt 5 phút vẫn thấy nguyên văn bản cũ — trình duyệt trả thẳng từ đĩa, request
 * còn không rời khỏi máy. Người dùng không có cách nào biết đó là bản đệm, nên kết luận
 * duy nhất họ rút ra là "phần mềm không lưu".
 *
 * Nay `max-age=0` bắt trình duyệt luôn hỏi lại, còn `s-maxage` chỉ nói với ĐỆM CHUNG
 * (Cloudflare) — lượt hỏi đó dừng ở biên gần nhất chứ không bay sang Virginia, nên vẫn
 * nhanh. Gói Cloudflare Free không cho chọn Edge TTL dưới 2 giờ ở giao diện, nhưng nó
 * TÔN TRỌNG chỉ thị của máy chủ và ưu tiên `s-maxage` hơn `max-age`; đặt luật Cache
 * Rules ở chế độ "Use cache-control header if present" là ăn đúng số giây dưới đây.
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

    /**
     * Biên được giữ bản đệm bao lâu. 60 giây là mức chịu đựng của người vừa bấm lưu:
     * họ sửa đánh giá rồi mở trang chủ xem, chờ tới 5 phút thì tưởng là hỏng, còn một
     * phút thì lần tải lại đầu tiên đã thấy. Đổi lại, mỗi phút chỉ một lượt gọi thật
     * chạm tới máy chủ — phần tiết kiệm lớn nhất vẫn còn nguyên.
     */
    private const SO_GIAY = 60;

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $this->duocDem($request, $response)) {
            return $response;
        }

        $response->headers->set('Access-Control-Allow-Origin', '*');
        $response->headers->set('Cache-Control', 'public, max-age=0, s-maxage='.self::SO_GIAY);

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
