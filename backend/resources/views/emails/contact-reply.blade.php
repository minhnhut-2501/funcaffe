<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Phản hồi từ FunCafe</title>
</head>
<body style="margin:0; padding:0; background-color:#EEF2F7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">

{{-- Dòng xem trước trong hộp thư: hiện ở danh sách mail, ẩn khi mở thư ra --}}
<div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
  Đội ngũ FunCafe đã phản hồi yêu cầu tư vấn của anh/chị.
  &#8199;&#65279;&#8199;&#65279;&#8199;&#65279;&#8199;&#65279;&#8199;&#65279;&#8199;&#65279;&#8199;&#65279;&#8199;&#65279;&#8199;&#65279;&#8199;&#65279;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#EEF2F7; padding:32px 16px;">
<tr>
<td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background-color:#FFFFFF; border-radius:20px; overflow:hidden; box-shadow:0 4px 24px -8px rgba(15,23,42,0.18);">

  {{-- Thanh nhấn mảnh phía trên: tạo điểm nhìn mà không cần ảnh --}}
  <tr><td style="height:5px; background-color:#1D4ED8; line-height:5px; font-size:0;">&nbsp;</td></tr>

  {{-- Đầu thư với logo thật.
       Logo được ĐÍNH KÈM vào thư (CID) chứ không trỏ tới URL ngoài: Gmail và Outlook
       chặn ảnh ngoài theo mặc định, còn data: URI thì Gmail lọc bỏ. Ảnh đính kèm thì
       hiện ngay, không cần người nhận bấm "hiển thị ảnh".
       Bản dùng cho email là bản đảo màu (ô trắng, ly xanh) vì logo gốc nền xanh sẽ
       chìm vào nền xanh của đầu thư. --}}
  <tr>
    <td style="background-color:#2563EB; padding:30px 36px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;">
            <img src="{{ $message->embed(resource_path('mail-assets/logo-funcafe.png')) }}"
                 width="48" height="48" alt="FunCafe"
                 style="display:block; width:48px; height:48px; border:0; border-radius:13px;">
          </td>
          <td style="padding-left:14px; vertical-align:middle;">
            <div style="font-size:21px; font-weight:700; color:#FFFFFF; letter-spacing:-0.02em; line-height:1.2;">FunCafe</div>
            <div style="font-size:12px; color:#BFDBFE; line-height:1.4; padding-top:2px;">Nền tảng quản lý quán cà phê</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  {{-- Nội dung --}}
  <tr>
    <td style="padding:36px 36px 8px;">
      <p style="margin:0 0 6px; font-size:11px; font-weight:700; color:#2563EB; text-transform:uppercase; letter-spacing:0.08em;">Phản hồi yêu cầu tư vấn</p>
      <h1 style="margin:0 0 18px; font-size:22px; font-weight:700; color:#0F172A; letter-spacing:-0.02em; line-height:1.3;">Chào anh/chị {{ $contact->full_name }},</h1>

      <p style="margin:0 0 22px; font-size:15px; line-height:1.65; color:#475569;">
        Cảm ơn anh/chị đã liên hệ với FunCafe. Dưới đây là phản hồi từ đội ngũ của chúng tôi.
      </p>

      {{-- Phản hồi: viền trái đậm để mắt bắt ngay vào phần quan trọng nhất --}}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:26px;">
        <tr>
          <td style="width:4px; background-color:#2563EB; border-radius:4px 0 0 4px; font-size:0; line-height:0;">&nbsp;</td>
          <td style="background-color:#EFF6FF; border-radius:0 14px 14px 0; padding:20px 22px; font-size:15px; line-height:1.7; color:#1E293B; white-space:pre-wrap;">{{ $reply }}</td>
        </tr>
      </table>

      {{-- Nội dung gốc: nhạt hơn hẳn để không tranh chỗ với phần phản hồi --}}
      <p style="margin:0 0 8px; font-size:11px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:0.06em;">
        Nội dung anh/chị đã gửi{{ $sentAt ? " · {$sentAt}" : '' }}
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC; border:1px solid #E9EEF5; border-radius:14px; margin-bottom:28px;">
        <tr>
          <td style="padding:16px 20px; font-size:14px; line-height:1.7; color:#64748B; white-space:pre-wrap;">{{ $contact->content }}</td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:30px;">
        <tr>
          <td style="background-color:#F8FAFC; border-radius:14px; padding:16px 20px; font-size:14px; line-height:1.6; color:#475569;">
            Cần hỗ trợ thêm? Anh/chị chỉ cần <b style="color:#1E293B;">trả lời trực tiếp email này</b> — chúng tôi sẽ phản hồi trong vòng 24 giờ làm việc.
          </td>
        </tr>
      </table>
    </td>
  </tr>

  {{-- Chân thư: thông tin liên hệ đầy đủ --}}
  <tr>
    <td style="padding:24px 36px 30px; border-top:1px solid #E9EEF5; background-color:#FBFCFE;">
      <p style="margin:0 0 12px; font-size:14px; font-weight:700; color:#0F172A;">Đội ngũ FunCafe</p>

      {{-- Nhãn chữ thay cho biểu tượng: ký tự ✆ và ⚑ hiện mỗi ứng dụng mail một kiểu,
           có nơi ra ô vuông rỗng. Chữ thì ở đâu cũng đọc được. --}}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-size:13px; line-height:1.6; color:#64748B;">
        <tr>
          <td style="padding:0 14px 7px 0; vertical-align:top; white-space:nowrap; font-size:11px; font-weight:700; color:#A3AEBF; text-transform:uppercase; letter-spacing:0.05em; padding-top:2px;">Email</td>
          <td style="padding:0 0 7px;"><a href="mailto:nphec4007@gmail.com" style="color:#2563EB; text-decoration:none; font-weight:600;">nphec4007@gmail.com</a></td>
        </tr>
        <tr>
          <td style="padding:0 14px 7px 0; vertical-align:top; white-space:nowrap; font-size:11px; font-weight:700; color:#A3AEBF; text-transform:uppercase; letter-spacing:0.05em; padding-top:2px;">Điện thoại</td>
          <td style="padding:0 0 7px;"><a href="tel:0795966549" style="color:#475569; text-decoration:none;">0795 966 549</a></td>
        </tr>
        <tr>
          <td style="padding:0 14px 0 0; vertical-align:top; white-space:nowrap; font-size:11px; font-weight:700; color:#A3AEBF; text-transform:uppercase; letter-spacing:0.05em; padding-top:2px;">Địa chỉ</td>
          <td style="padding:0;">Tòa nhà QTSC9 (toà T), đường Tô Ký,<br>Phường Trung Mỹ Tây, TP. Hồ Chí Minh</td>
        </tr>
      </table>

      <p style="margin:16px 0 0; padding-top:14px; border-top:1px solid #E9EEF5; font-size:11px; line-height:1.6; color:#A3AEBF;">
        Email này được gửi tới {{ $contact->email }} vì anh/chị đã gửi yêu cầu tư vấn qua trang Liên hệ của FunCafe.
      </p>
    </td>
  </tr>

</table>
</td>
</tr>
</table>
</body>
</html>
