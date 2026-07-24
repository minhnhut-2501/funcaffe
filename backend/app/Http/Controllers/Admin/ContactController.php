<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

/**
 * B6: Tin nhắn Liên hệ từ trang public trước đây được lưu vào DB nhưng
 * KHÔNG có nơi nào cho admin đọc — controller này bổ sung phần còn thiếu.
 */
class ContactController extends Controller
{
    public function __construct()
    {
        $this->middleware(['auth:sanctum', 'admin']);
    }

    public function index()
    {
        return response()->json(
            ContactMessage::orderBy('created_at', 'desc')->limit(200)->get()
        );
    }

    /** Đánh dấu đã đọc / chưa đọc (toggle). */
    public function toggleRead(ContactMessage $contact)
    {
        $contact->update(['is_read' => !$contact->is_read]);
        return response()->json($contact);
    }

    /**
     * Admin trả lời khách bằng EMAIL, và lưu lại nội dung đã trả lời.
     *
     * THỨ TỰ QUAN TRỌNG: gửi mail TRƯỚC, ghi CSDL SAU và không bọc try/catch nuốt lỗi.
     * Nếu làm ngược lại, khi SMTP hỏng hệ thống sẽ ghi nhận "đã trả lời" trong khi
     * khách không nhận được gì — admin không có cách nào biết để gửi lại.
     */
    public function reply(Request $request, ContactMessage $contact)
    {
        $validated = $request->validate([
            'reply' => 'required|string|min:10|max:5000',
        ]);

        $sentAt = $contact->created_at?->format('d/m/Y H:i') ?? '';
        $body = "Chào anh/chị {$contact->full_name},\n\n"
            . "Cảm ơn anh/chị đã liên hệ với FunCafe. Về câu hỏi của anh/chị:\n\n"
            . $validated['reply'] . "\n\n"
            . "--- Nội dung anh/chị đã gửi ngày {$sentAt} ---\n"
            . $contact->content . "\n\n"
            . "Trân trọng,\nĐội ngũ FunCafe\nsupport@funcafe.vn · 1900 1234";

        Mail::raw($body, function ($m) use ($contact) {
            $m->to($contact->email)->subject('[FunCafe] Phản hồi yêu cầu tư vấn của bạn');
        });

        $contact->update([
            'reply'      => $validated['reply'],
            'replied_at' => now(),
            'replied_by' => $request->user()->full_name ?? 'Quản trị viên',
            'is_read'    => true,
        ]);

        return response()->json($contact->fresh());
    }
}
