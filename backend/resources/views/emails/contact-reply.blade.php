<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Phản hồi từ FunCafe</title>
</head>
<body style="margin:0; padding:0; background-color:#F1F5F9; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F5F9; padding:32px 16px;">
<tr>
<td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#FFFFFF; border-radius:20px; overflow:hidden; box-shadow:0 1px 3px rgba(15,23,42,0.08);">

  {{-- Header: logo dạng chữ, không phụ thuộc ảnh (nhiều mail client chặn ảnh mặc định) --}}
  <tr>
    <td style="background-color:#2563EB; padding:28px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:36px; height:36px; background-color:rgba(255,255,255,0.15); border-radius:10px; text-align:center; vertical-align:middle; font-size:18px; line-height:36px;">☕</td>
          <td style="padding-left:12px; font-size:19px; font-weight:700; color:#FFFFFF; letter-spacing:-0.01em;">FunCafe</td>
        </tr>
      </table>
    </td>
  </tr>

  {{-- Nội dung --}}
  <tr>
    <td style="padding:32px;">
      <p style="margin:0 0 4px; font-size:12px; font-weight:600; color:#2563EB; text-transform:uppercase; letter-spacing:0.04em;">Phản hồi yêu cầu tư vấn</p>
      <h1 style="margin:0 0 20px; font-size:20px; font-weight:700; color:#1F2933;">Chào anh/chị {{ $contact->full_name }},</h1>

      <p style="margin:0 0 20px; font-size:14px; line-height:1.6; color:#475569;">
        Cảm ơn anh/chị đã liên hệ với FunCafe. Dưới đây là phản hồi của đội ngũ chúng tôi:
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EFF4FF; border-radius:14px; margin-bottom:24px;">
        <tr>
          <td style="padding:18px 20px; font-size:14px; line-height:1.7; color:#1F2933; white-space:pre-wrap;">{{ $reply }}</td>
        </tr>
      </table>

      <p style="margin:0 0 8px; font-size:12px; font-weight:600; color:#94A3B8; text-transform:uppercase; letter-spacing:0.04em;">
        Nội dung anh/chị đã gửi{{ $sentAt ? " ngày {$sentAt}" : '' }}
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:14px; margin-bottom:28px;">
        <tr>
          <td style="padding:16px 20px; font-size:13px; line-height:1.7; color:#64748B; white-space:pre-wrap;">{{ $contact->content }}</td>
        </tr>
      </table>

      <p style="margin:0; font-size:14px; line-height:1.6; color:#475569;">
        Nếu cần hỗ trợ thêm, anh/chị chỉ cần trả lời trực tiếp email này.
      </p>
    </td>
  </tr>

  {{-- Footer --}}
  <tr>
    <td style="padding:20px 32px; border-top:1px solid #E2E8F0; background-color:#F8FAFC;">
      <p style="margin:0 0 4px; font-size:13px; font-weight:600; color:#1F2933;">Đội ngũ FunCafe</p>
      <p style="margin:0; font-size:12px; color:#94A3B8;">support@funcafe.vn · 1900 1234</p>
    </td>
  </tr>

</table>
</td>
</tr>
</table>
</body>
</html>
