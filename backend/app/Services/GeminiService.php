<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Gọi Google Gemini API (gói free tier) qua REST — không cần composer SDK.
 * API key CHỈ nằm ở server (config funcafe.gemini_key), frontend không bao giờ
 * gọi thẳng Gemini. Đổi model qua env GEMINI_MODEL.
 *
 * Docs: https://ai.google.dev/api/generate-content
 */
class GeminiService
{
    private string $apiKey;
    private string $model;

    public function __construct()
    {
        $this->apiKey = (string) config('funcafe.gemini_key');
        $this->model  = (string) config('funcafe.gemini_model');
    }

    public function isConfigured(): bool
    {
        return $this->apiKey !== '';
    }

    /**
     * Giá trị 'verify' cho Guzzle: trỏ tới cacert.pem nếu có (fix cURL error 60
     * khi PHP local thiếu chứng chỉ), ngược lại dùng cert hệ thống (Linux/Render).
     */
    private function verify(): string|bool
    {
        $bundle = (string) config('funcafe.gemini_ca_bundle');
        return ($bundle !== '' && is_file($bundle)) ? $bundle : true;
    }

    /**
     * Hạn chờ gọi Gemini, và nới hạn chạy của chính tiến trình PHP cho khớp.
     *
     * Hai hạn chờ này PHẢI đi cùng nhau. Cả `php artisan serve` ở máy phát triển lẫn
     * trên Render đều chạy qua SAPI `cli-server`, nơi `max_execution_time` mặc định
     * là 30 giây — ngắn hơn hạn chờ HTTP ở đây. Hệ quả: PHP giết tiến trình TRƯỚC khi
     * Guzzle kịp bỏ cuộc, nên thay vì bắt được ngoại lệ và trả câu báo tử tế, người
     * dùng nhận nguyên một trang 500 "Server Error".
     *
     * Nới bằng set_time_limit() thay vì sửa php.ini vì nó có tác dụng ở MỌI nơi chạy
     * — máy phát triển, Docker, hay bất kỳ máy chủ nào sau này — mà không phụ thuộc
     * vào tệp cấu hình có được nạp hay không.
     */
    private function hanCho(): int
    {
        $giay = max(5, (int) config('funcafe.gemini_timeout', 45));

        // +15 giây để phần dựng ngữ cảnh và đọc phản hồi cũng nằm gọn trong hạn.
        if (function_exists('set_time_limit')) {
            @set_time_limit($giay + 15);
        }

        return $giay;
    }

    /**
     * Yêu cầu HTTP dùng chung cho mọi lời gọi Gemini, CÓ THỬ LẠI.
     *
     * Bậc miễn phí của Gemini thỉnh thoảng trả 503 "This model is currently
     * experiencing high demand" — lỗi tạm thời phía Google, thử lại sau một nhịp là
     * qua. Không thử lại thì mỗi cú 503 là một lần hộp chat chết trước mặt người dùng,
     * và nó xảy ra ngẫu nhiên nên hoàn toàn có thể rơi đúng vào lúc đang trình diễn.
     *
     * KHÔNG thử lại với 429: đó là chạm hạn ngạch, gọi thêm chỉ làm tình hình xấu đi
     * và đốt nhanh hơn phần còn lại. Cũng không thử lại với 4xx khác — lỗi ở phía
     * mình thì gọi lại vẫn sai y như vậy.
     */
    /**
     * Danh sách mô hình theo thứ tự ưu tiên: mô hình chính, rồi mô hình dự phòng.
     *
     * Lý do có dự phòng, tìm ra khi chạy thử thật: bậc miễn phí của Gemini có lúc trả
     * 503 "This model is currently experiencing high demand" cho MỘT mô hình cụ thể
     * trong khi mô hình khác vẫn trả lời trong chưa tới một giây. Nghẽn kiểu đó xảy ra
     * ngẫu nhiên và không báo trước — không có đường lui thì hộp chat chết đúng vào
     * lúc đang có người xem.
     *
     * Chỉ đổi mô hình khi lỗi là do phía Google (xem dangNghen). Lỗi 4xx là do yêu cầu
     * của mình sai, gửi lại cho mô hình khác cũng sai y hệt, chỉ tốn thêm một lượt.
     */
    private function danhSachModel(): array
    {
        return array_values(array_unique(array_filter([
            $this->model,
            trim((string) config('funcafe.gemini_model_fallback', '')),
        ])));
    }

    /** Mã lỗi cho thấy phía Google đang nghẽn/hỏng, đổi mô hình thì có cửa qua. */
    private function dangNghen(int $ma): bool
    {
        // 429 cũng tính: hạn ngạch bậc miễn phí đếm RIÊNG cho từng mô hình, nên cạn
        // lượt ở mô hình này không có nghĩa là cạn ở mô hình kia.
        return $ma === 429 || ($ma >= 500 && $ma !== 501);
    }

    private function yeuCau(): PendingRequest
    {
        return Http::withHeaders(['x-goog-api-key' => $this->apiKey])
            ->timeout($this->hanCho())
            ->retry(3, 800, function ($e) {
                // CHỈ thử lại khi máy chủ trả về mã lỗi — những cái đó hỏng NGAY, nên
                // thử lại gần như không tốn thời gian.
                //
                // KHÔNG thử lại khi hết hạn chờ hay đứt kết nối: mỗi lần như vậy đã ăn
                // trọn 45 giây, nhân lên ba lần thành hơn hai phút ngồi nhìn màn hình
                // đứng im — người dùng bỏ đi từ lâu trước khi câu trả lời kịp tới.
                // (Đây chính là lỗi bắt được khi chạy thử thật: một câu hỏi treo tới
                // mức trình duyệt tự cắt.)
                if (!$e instanceof RequestException) {
                    return false;
                }
                $ma = $e->response->status();
                return $ma >= 500 && $ma !== 501;
            }, throw: false);
    }

    /**
     * Hội thoại nhiều lượt. $messages: [['role' => 'user'|'assistant', 'content' => '...'], ...]
     * Trả về chuỗi text trả lời.
     */
    public function chat(array $messages, string $systemPrompt = ''): string
    {
        $contents = [];
        foreach ($messages as $m) {
            $role = ($m['role'] ?? 'user') === 'assistant' ? 'model' : 'user';
            $text = (string) ($m['content'] ?? '');
            if ($text === '') {
                continue;
            }
            $contents[] = ['role' => $role, 'parts' => [['text' => $text]]];
        }

        $body = ['contents' => $contents];
        if ($systemPrompt !== '') {
            $body['system_instruction'] = ['parts' => [['text' => $systemPrompt]]];
        }
        $body['generationConfig'] = ['temperature' => 0.7];

        $data = $this->send($body);
        return $this->extractText($data);
    }

    /**
     * Hội thoại có STREAMING: gọi $onText($chunk) cho từng đoạn text Gemini sinh ra.
     * Dùng cho hiệu ứng gõ chữ ở chat box.
     */
    public function streamChat(array $messages, string $systemPrompt, callable $onText): void
    {
        if (!$this->isConfigured()) {
            throw new RuntimeException('Chưa cấu hình GEMINI_API_KEY trên server.');
        }

        $contents = [];
        foreach ($messages as $m) {
            $role = ($m['role'] ?? 'user') === 'assistant' ? 'model' : 'user';
            $text = (string) ($m['content'] ?? '');
            if ($text === '') {
                continue;
            }
            $contents[] = ['role' => $role, 'parts' => [['text' => $text]]];
        }

        $body = ['contents' => $contents, 'generationConfig' => ['temperature' => 0.7]];
        if ($systemPrompt !== '') {
            $body['system_instruction'] = ['parts' => [['text' => $systemPrompt]]];
        }

        // Thử lần lượt từng mô hình cho tới khi có một cái nhận. An toàn vì lỗi được
        // phát hiện TRƯỚC khi đọc thân phản hồi — chưa có ký tự nào chảy ra ngoài
        // nên đổi mô hình giữa chừng không làm câu trả lời bị chắp vá.
        $response = null;
        $loiCuoi = '';

        foreach ($this->danhSachModel() as $model) {
            $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:streamGenerateContent?alt=sse";

            $thu = $this->yeuCau()
                ->withOptions(['stream' => true, 'verify' => $this->verify()])
                ->post($url, $body);

            if (!$thu->failed()) {
                $response = $thu;
                break;
            }

            $loiCuoi = "Gemini API lỗi ({$thu->status()}): "
                . ($thu->json('error.message') ?? 'Lỗi không xác định');

            if (!$this->dangNghen($thu->status())) {
                break; // lỗi của mình, đổi mô hình cũng vô ích
            }
        }

        if ($response === null) {
            throw new RuntimeException($loiCuoi !== '' ? $loiCuoi : 'Gemini API không phản hồi.');
        }

        // Đọc thân phản hồi dạng SSE (các dòng "data: {json}") theo từng khối.
        $stream = $response->toPsrResponse()->getBody();
        $buffer = '';
        while (!$stream->eof()) {
            $buffer .= $stream->read(2048);
            while (($pos = strpos($buffer, "\n")) !== false) {
                $line = trim(substr($buffer, 0, $pos));
                $buffer = substr($buffer, $pos + 1);
                if ($line === '' || !str_starts_with($line, 'data:')) {
                    continue;
                }
                $json = trim(substr($line, 5));
                if ($json === '' || $json === '[DONE]') {
                    continue;
                }
                $data = json_decode($json, true);
                $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
                if (is_string($text) && $text !== '') {
                    $onText($text);
                }
            }
        }
    }

    /**
     * Yêu cầu Gemini trả JSON đúng khuôn (structured output).
     * Trả về mảng đã decode. Ném RuntimeException nếu không parse được.
     */
    public function generateJson(string $prompt, string $systemPrompt, array $responseSchema): array
    {
        $body = [
            'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
            'system_instruction' => ['parts' => [['text' => $systemPrompt]]],
            'generationConfig' => [
                'temperature' => 0.4,
                'responseMimeType' => 'application/json',
                'responseSchema' => $responseSchema,
            ],
        ];

        $data = $this->send($body);
        $text = $this->extractText($data);
        $json = json_decode($text, true);

        if (!is_array($json)) {
            throw new RuntimeException('Gemini không trả về JSON hợp lệ.');
        }
        return $json;
    }

    private function send(array $body): array
    {
        if (!$this->isConfigured()) {
            throw new RuntimeException('Chưa cấu hình GEMINI_API_KEY trên server.');
        }

        $loiCuoi = '';

        foreach ($this->danhSachModel() as $model) {
            $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent";

            $response = $this->yeuCau()
                ->withOptions(['verify' => $this->verify()])
                ->post($url, $body);

            if (!$response->failed()) {
                return $response->json() ?? [];
            }

            $loiCuoi = "Gemini API lỗi ({$response->status()}): "
                . ($response->json('error.message') ?? 'Lỗi không xác định');

            if (!$this->dangNghen($response->status())) {
                break;
            }
        }

        throw new RuntimeException($loiCuoi !== '' ? $loiCuoi : 'Gemini API không phản hồi.');
    }

    private function extractText(array $data): string
    {
        $parts = $data['candidates'][0]['content']['parts'] ?? [];
        $text = '';
        foreach ($parts as $p) {
            $text .= $p['text'] ?? '';
        }

        if ($text === '') {
            throw new RuntimeException('Gemini trả về rỗng (có thể bị chặn nội dung).');
        }
        return $text;
    }
}
