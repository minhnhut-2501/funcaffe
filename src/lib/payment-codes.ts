/**
 * Dịch mã lỗi của cổng thành câu người dùng đọc được.
 *
 * "Mã lỗi: 24" không nói gì với chủ quán, mà mỗi mã lại đòi một hành động khác hẳn:
 * sai OTP thì thử lại được ngay, thẻ bị khóa thì phải gọi ngân hàng, hết hạn chờ thì
 * chỉ cần bấm mua lại. Đoán sai hành động là mất một khách.
 *
 * Nguồn mã: bảng mã phản hồi của VNPay (vnp_ResponseCode) và MoMo (resultCode).
 * Mã lạ thì rơi về câu chung — thà nói ít còn hơn nói sai.
 */
const LY_DO_VNPAY: Record<string, string> = {
  '07': 'Giao dịch bị ngân hàng đánh dấu nghi ngờ. Vui lòng liên hệ ngân hàng của bạn.',
  '09': 'Thẻ hoặc tài khoản chưa đăng ký dịch vụ Internet Banking.',
  '10': 'Xác thực thông tin thẻ sai quá 3 lần.',
  '11': 'Đã hết thời gian chờ thanh toán. Vui lòng bấm mua lại.',
  '12': 'Thẻ hoặc tài khoản đang bị khóa.',
  '13': 'Sai mã OTP. Vui lòng thử lại.',
  '24': 'Bạn đã hủy giao dịch trên cổng thanh toán.',
  '51': 'Tài khoản không đủ số dư.',
  '65': 'Tài khoản đã vượt hạn mức giao dịch trong ngày.',
  '75': 'Ngân hàng đang bảo trì. Vui lòng thử lại sau.',
  '79': 'Nhập sai mật khẩu thanh toán quá số lần cho phép.',
  '99': 'Giao dịch không thành công (lỗi từ phía cổng thanh toán).',
};

const LY_DO_MOMO: Record<string, string> = {
  '1001': 'Giao dịch thất bại do tài khoản không đủ tiền.',
  '1003': 'Giao dịch đã bị hủy.',
  '1004': 'Số tiền vượt hạn mức thanh toán của tài khoản.',
  '1005': 'Đường dẫn hoặc mã QR đã hết hạn. Vui lòng bấm mua lại.',
  '1006': 'Bạn đã từ chối xác nhận thanh toán.',
  '1007': 'Tài khoản MoMo không tồn tại hoặc đang bị khóa.',
  '1017': 'Giao dịch bị hủy bởi đối tác.',
  '1026': 'Giao dịch bị hạn chế theo chương trình khuyến mãi.',
};

/** Mã do CHÍNH hệ thống này đặt (không phải của cổng) — dùng chung cho cả hai cổng. */
const LY_DO_NOI_BO: Record<string, string> = {
  invalid_signature: 'Dữ liệu trả về từ cổng thanh toán không hợp lệ nên đã bị từ chối. Không có khoản tiền nào bị trừ.',
  not_found: 'Không tìm thấy giao dịch tương ứng. Vui lòng bấm mua lại từ trang gói dịch vụ.',
};

export function lyDoLoi(code: string | null, gateway: string | null): string | null {
  if (!code) return null;
  if (LY_DO_NOI_BO[code]) return LY_DO_NOI_BO[code];
  const bang = gateway === 'momo' ? LY_DO_MOMO : LY_DO_VNPAY;
  return bang[code] ?? null;
}
