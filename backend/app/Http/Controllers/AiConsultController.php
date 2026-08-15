<?php

namespace App\Http\Controllers;

use App\Services\ConsultKnowledgeService;
use App\Services\GeminiService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Trợ lý TƯ VẤN ở trang công khai — hỏi được khi CHƯA đăng nhập.
 *
 * Vì sao tách hẳn khỏi AiController thay vì thêm một hàm vào đó:
 *
 *  1. Hai lớp có thế đứng bảo mật ngược nhau. AiController gắn `auth:sanctum` ngay
 *     trong constructor và mọi tuyến của nó đi qua middleware 'ai'; lớp này thì cố ý
 *     mở. Trộn chung là một lần sửa middleware bất cẩn đủ để mở toang cả hai.
 *  2. Hai lớp nạp hai nguồn khác nhau: AiController nạp SỐ LIỆU QUÁN, lớp này chỉ
 *     nạp thông tin sản phẩm. Tách file làm ranh giới đó nhìn thấy được, và bài kiểm
 *     thử chống rò rỉ có chỗ để bám vào.
 *
 * KHÔNG có `auth:sanctum`, nhưng vẫn ĐỌC được người dùng nếu họ có token — qua
 * `$request->user('sanctum')`, cùng cách AppServiceProvider dùng cho trần tần suất.
 * Nhờ vậy một hộp chat phục vụ được cả ba nhóm: khách lạ, người còn quyền dùng thử,
 * và người chỉ còn đường nâng gói.
 */
class AiConsultController extends Controller
{
    public function __construct(
        private GeminiService $gemini,
        private ConsultKnowledgeService $kienThuc,
    ) {
    }

    /** POST api/ai/consult — trả về nguyên câu trả lời. */
    public function chat(Request $request)
    {
        $tin = $this->docTin($request);

        try {
            $reply = $this->gemini->chat($tin, $this->kienThuc->loiDan($request->user('sanctum')));
            return response()->json(['reply' => $reply]);
        } catch (Throwable $e) {
            return response()->json(['message' => $this->loiThanThien($e)], 502);
        }
    }

    /**
     * POST api/ai/consult/stream — trả text dần cho hiệu ứng gõ chữ.
     *
     * Giữ cả hai tuyến (có luồng và không luồng) là cố ý: luồng chữ đi qua proxy của
     * Render có thể bị gom đệm, khi đó chữ đứng im vài giây rồi đổ ra một cục. Có sẵn
     * tuyến không luồng thì đổi một dòng ở frontend là xong, không phải sửa server
     * ngay trước buổi bảo vệ.
     */
    public function chatStream(Request $request)
    {
        $tin = $this->docTin($request);
        $loiDan = $this->kienThuc->loiDan($request->user('sanctum'));

        return response()->stream(function () use ($tin, $loiDan) {
            while (ob_get_level() > 0) {
                ob_end_flush();
            }
            try {
                $this->gemini->streamChat($tin, $loiDan, function ($text) {
                    echo $text;
                    flush();
                });
            } catch (Throwable $e) {
                echo "\n⚠️ " . $this->loiThanThien($e);
                flush();
            }
        }, 200, [
            'Content-Type'      => 'text/plain; charset=utf-8',
            'Cache-Control'     => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * Đọc và kiểm tin nhắn.
     *
     * Giới hạn chặt hơn tuyến trong portal (10 lượt thay vì 30, 1000 ký tự thay vì
     * 4000): tuyến này không cần đăng nhập, nên mỗi ký tự gửi lên đều là token trả
     * phí mà bất kỳ ai trên mạng cũng bơm được. Hội thoại tư vấn bán hàng thật thì
     * vài lượt là đủ.
     */
    private function docTin(Request $request): array
    {
        $validated = $request->validate([
            'messages'           => 'required|array|min:1|max:10',
            'messages.*.role'    => 'required|string|in:user,assistant',
            'messages.*.content' => 'required|string|max:1000',
        ]);

        return $validated['messages'];
    }

    /**
     * Đổi lỗi kỹ thuật thành câu người dùng đọc được.
     *
     * Tuyến trong portal ném thẳng `$e->getMessage()` ra ngoài — chấp nhận được vì
     * người đọc là chủ quán đã trả tiền. Ở trang công khai thì người đọc là khách
     * đang cân nhắc mua: đập vào mặt họ dòng "Gemini API lỗi (429): quota exceeded"
     * vừa lộ hạ tầng vừa làm mất niềm tin đúng lúc cần nhất.
     */
    private function loiThanThien(Throwable $e): string
    {
        $chu = $e->getMessage();

        // GHI LOG nguyên nhân thật trước khi thay bằng câu tử tế. Không có dòng này
        // thì mọi trục trặc của hộp chat trên bản đã triển khai đều biến mất không
        // dấu vết: người dùng thấy "thử lại giúp mình", còn ta không biết vì sao.
        Log::warning('[tu-van] Gọi Gemini hỏng', [
            'loi'  => $chu,
            'loai' => $e::class,
        ]);

        if (str_contains($chu, 'Chưa cấu hình GEMINI_API_KEY')) {
            return 'Trợ lý tư vấn đang tạm nghỉ. Anh/chị để lại lời nhắn ở trang Liên hệ nhé, '
                . 'bên mình sẽ trả lời sớm.';
        }

        if (str_contains($chu, '429') || stripos($chu, 'quota') !== false) {
            return 'Trợ lý tư vấn đang quá tải, anh/chị thử lại sau ít phút giúp mình. '
                . 'Cần gấp thì để lại lời nhắn ở trang Liên hệ nhé.';
        }

        return 'Mình chưa trả lời được ngay, anh/chị thử lại giúp mình. '
            . 'Nếu vẫn chưa được thì để lại lời nhắn ở trang Liên hệ nhé.';
    }
}
