<?php

namespace App\Mail;

use App\Models\ContactMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Email trả lời tin nhắn Liên hệ — thay cho Mail::raw() (chỉ text thô).
 * Có logo chữ + bố cục thẻ để trông chuyên nghiệp hơn khi khách nhận được.
 */
class ContactReplyMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public ContactMessage $contact,
        public string $reply,
    ) {}

    public function build(): self
    {
        return $this
            ->subject('[FunCafe] Phản hồi yêu cầu tư vấn của bạn')
            ->view('emails.contact-reply')
            ->with([
                'contact' => $this->contact,
                'reply' => $this->reply,
                'sentAt' => $this->contact->created_at?->format('d/m/Y H:i') ?? '',
            ]);
    }
}
