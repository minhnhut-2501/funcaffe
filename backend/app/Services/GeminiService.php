<?php

namespace App\Services;

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

        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:streamGenerateContent?alt=sse";

        $response = Http::withHeaders(['x-goog-api-key' => $this->apiKey])
            ->withOptions(['stream' => true, 'verify' => $this->verify()])
            ->timeout(120)
            ->post($url, $body);

        if ($response->failed()) {
            $msg = $response->json('error.message') ?? 'Lỗi không xác định';
            throw new RuntimeException("Gemini API lỗi ({$response->status()}): {$msg}");
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

        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent";

        $response = Http::withHeaders(['x-goog-api-key' => $this->apiKey])
            ->withOptions(['verify' => $this->verify()])
            ->timeout(60)
            ->post($url, $body);

        if ($response->failed()) {
            $msg = $response->json('error.message') ?? 'Lỗi không xác định';
            throw new RuntimeException("Gemini API lỗi ({$response->status()}): {$msg}");
        }

        return $response->json() ?? [];
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
