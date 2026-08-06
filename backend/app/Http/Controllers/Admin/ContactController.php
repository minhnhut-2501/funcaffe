<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Mail\ContactReplyMail;
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

    /**
     * Danh sách tin nhắn, PHÂN TRANG.
     *
     * Trước đây chặn cứng `limit(200)` không kèm đường đi tiếp: tin thứ 201 trở đi nằm
     * trong CSDL nhưng không có cách nào đọc tới. Vì endpoint gửi liên hệ là công khai,
     * chỉ cần vài trăm tin rác là liên hệ thật của khách bị đẩy ra ngoài tầm nhìn.
     */
    public function index(Request $request)
    {
        $perPage = min(max((int) $request->query('per_page', 50), 1), 200);

        return response()->json(
            ContactMessage::orderBy('created_at', 'desc')->paginate($perPage)
        );
    }

    /**
     * Đặt trạng thái đã đọc.
     *
     * Nhận giá trị MONG MUỐN thay vì đảo trạng thái hiện tại: đảo thì hai quản trị
     * viên bấm cùng lúc (hoặc một người bấm hai lần do mạng chậm) sẽ ra kết quả phụ
     * thuộc thứ tự đến, có khi quay về đúng chỗ cũ. Thiếu tham số thì vẫn đảo để các
     * bản frontend cũ không hỏng.
     */
    public function toggleRead(Request $request, ContactMessage $contact)
    {
        $isRead = $request->has('is_read')
            ? $request->boolean('is_read')
            : !$contact->is_read;

        $contact->update(['is_read' => $isRead]);
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

        Mail::to($contact->email)->send(new ContactReplyMail($contact, $validated['reply']));

        $contact->update([
            'reply'      => $validated['reply'],
            'replied_at' => now(),
            'replied_by' => $request->user()->full_name ?? 'Quản trị viên',
            'is_read'    => true,
        ]);

        return response()->json($contact->fresh());
    }
}
