import Link from 'next/link';
import type { LegalSection } from '@/components/public/LegalPage';

/**
 * Ngày sửa văn bản — chuỗi cứng, KHÔNG dùng new Date(). Ngày cập nhật điều khoản
 * là ngày người viết sửa nó, không phải ngày người đọc mở trang.
 */
export const UPDATED_AT = '05/08/2026';

export const sections: LegalSection[] = [
  {
    id: 'gioi-thieu',
    title: 'Về tài liệu này',
    body: (
      <>
        <p>
          Điều khoản dịch vụ (gọi tắt là “Điều khoản”) mô tả các quy tắc khi bạn sử dụng phần mềm
          quản lý quán shop FunCafe, bao gồm trang giới thiệu, khu vực dành cho chủ quán và các gói
          dịch vụ đi kèm.
        </p>
        <p>
          Khi bạn tạo tài khoản, bạn tick vào ô đồng ý với Điều khoản này và{' '}
          <Link href="/privacy">Chính sách bảo mật</Link>. Nếu bạn không đồng ý với bất kỳ nội dung
          nào, vui lòng không tạo tài khoản và không sử dụng hệ thống.
        </p>
        <p>
          FunCafe là sản phẩm đồ án tốt nghiệp, chưa vận hành thương mại. Những gì viết ở đây phản
          ánh đúng cách hệ thống đang hoạt động tại thời điểm cập nhật.
        </p>
      </>
    ),
  },
  {
    id: 'dinh-nghia',
    title: 'Các khái niệm dùng trong tài liệu',
    body: (
      <ul>
        <li><strong>FunCafe</strong> — phần mềm và toàn bộ trang web mô tả trong tài liệu này.</li>
        <li><strong>Chủ quán</strong> — người tạo tài khoản để quản lý một hoặc nhiều quán trên hệ thống.</li>
        <li><strong>Quán</strong> — một cơ sở kinh doanh do chủ quán khai báo, có thực đơn, bàn và hóa đơn riêng.</li>
        <li><strong>Gói dịch vụ</strong> — Fun Free, Pro hoặc Pro Max; quyết định giới hạn và tính năng của <em>từng quán</em>.</li>
        <li><strong>Quản trị viên</strong> — người vận hành hệ thống, xác nhận giao dịch và xử lý các trường hợp vi phạm.</li>
        <li><strong>Khách của quán</strong> — người tới uống nước tại quán. Khách <strong>không</strong> có tài khoản trên FunCafe.</li>
      </ul>
    ),
  },
  {
    id: 'tai-khoan',
    title: 'Tài khoản',
    body: (
      <ul>
        <li>Mỗi địa chỉ email chỉ đăng ký được một tài khoản. Bạn cần cung cấp họ tên, email và số điện thoại chính xác.</li>
        <li>Bạn chịu trách nhiệm giữ bí mật mật khẩu của mình và mọi hoạt động diễn ra dưới tài khoản đó.</li>
        <li>Nếu nghi ngờ tài khoản bị người khác truy cập, hãy đổi mật khẩu ngay trong mục Tài khoản và báo cho chúng tôi.</li>
        <li>
          Các quán bạn tạo thuộc về tài khoản của bạn. Một tài khoản có thể quản lý nhiều quán, và
          mỗi quán có dữ liệu vận hành hoàn toàn tách biệt.
        </li>
      </ul>
    ),
  },
  {
    id: 'goi-dich-vu',
    title: 'Gói dịch vụ và giới hạn',
    body: (
      <>
        <p>
          <strong>Gói gắn với từng quán, không gắn với tài khoản.</strong> Nếu bạn có ba quán, mỗi
          quán cần gói riêng và có hạn sử dụng riêng.
        </p>
        <ul>
          <li><strong>Fun Free</strong> — bản dùng thử. Mỗi quán chỉ được dùng thử <strong>một lần duy nhất</strong>; hết thời gian dùng thử, quán đó không thể quay lại gói này.</li>
          <li><strong>Pro</strong> — giới hạn số bàn và số món trong thực đơn.</li>
          <li><strong>Pro Max</strong> — không giới hạn số bàn và số món, có trợ lý AI.</li>
        </ul>
        <p>
          Giới hạn cụ thể của từng gói do quản trị viên cấu hình và được hiển thị tại trang{' '}
          <Link href="/pricing">Phí dịch vụ</Link>. Khi gói của một quán hết hạn, quán đó chuyển sang
          trạng thái <strong>chỉ xem</strong>: dữ liệu vẫn còn nguyên và bạn vẫn tra cứu được hóa đơn
          cũ, nhưng không thêm/sửa được món, bàn, topping và không tạo được đơn hàng mới cho tới khi
          gia hạn.
        </p>
      </>
    ),
  },
  {
    id: 'thanh-toan',
    title: 'Thanh toán',
    body: (
      <>
        <p>
          Khi mua gói, bạn chọn thanh toán qua <strong>VNPay</strong> hoặc <strong>MoMo</strong>. Cả
          hai đều <strong>đang chạy ở môi trường thử nghiệm</strong> của nhà cung cấp: mọi giao dịch
          trên hệ thống là giao dịch mô phỏng và <strong>không phát sinh tiền thật</strong>. Đây là hệ
          quả trực tiếp của việc FunCafe là đồ án tốt nghiệp chưa vận hành thương mại.
        </p>
        <ul>
          <li>Thanh toán qua cổng online được <strong>kích hoạt tự động</strong> sau khi cổng xác nhận, không cần quản trị viên duyệt tay.</li>
          <li>Giá gói hiển thị đã bao gồm thuế giá trị gia tăng theo mức do quản trị viên cấu hình; gói dùng thử không tính thuế.</li>
          <li>Với hình thức chuyển khoản, giao dịch ở trạng thái <strong>chờ xác nhận</strong> cho tới khi quản trị viên đối chiếu và xác nhận. Gói chỉ được kích hoạt sau bước này.</li>
          <li>Toàn bộ giao dịch của bạn được lưu lại và xem được trong mục Gói dịch vụ.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'gia-han',
    title: 'Gia hạn, nâng cấp và chính sách không hoàn tiền',
    body: (
      <>
        <p>
          Khi bạn nâng cấp gói giữa chừng, phần thời gian còn lại của gói cũ được{' '}
          <strong>cấn trừ trực tiếp vào giá gói mới</strong>. Khoản cấn trừ này hiển thị rõ trước khi
          bạn xác nhận thanh toán.
        </p>
        <p>
          <strong>Hệ thống không có luồng hoàn tiền mặt.</strong> Giá trị còn lại của gói cũ chỉ được
          quy đổi thành khoản giảm trừ cho gói mới, không hoàn lại bằng tiền dưới bất kỳ hình thức
          nào.
        </p>
      </>
    ),
  },
  {
    id: 'du-lieu-quan',
    title: 'Dữ liệu quán và trách nhiệm của chủ quán',
    body: (
      <ul>
        <li>
          Toàn bộ thực đơn, giá, bàn, đơn hàng và hóa đơn do bạn tự nhập. Bạn chịu trách nhiệm về
          tính chính xác và tính hợp pháp của những dữ liệu đó.
        </li>
        <li>
          FunCafe không kiểm duyệt nội dung thực đơn và không xác minh thông tin quán. Chúng tôi chỉ
          cung cấp công cụ lưu trữ và hiển thị.
        </li>
        <li>
          Số liệu doanh thu trên hệ thống được tính từ các hóa đơn bạn tạo. Đây là số liệu tham khảo
          phục vụ quản lý, <strong>không thay thế sổ sách kế toán hay chứng từ thuế</strong>.
        </li>
        <li>
          Thông tin tài khoản ngân hàng bạn khai báo được dùng để sinh mã VietQR cho khách quét khi
          thanh toán. Hãy kiểm tra kỹ trước khi lưu — chúng tôi không xác minh thông tin này.
        </li>
      </ul>
    ),
  },
  {
    id: 'danh-gia',
    title: 'Đánh giá và nội dung bạn đăng',
    body: (
      <ul>
        <li>
          Đánh giá về FunCafe được <strong>hiển thị công khai trên trang chủ</strong>, kèm họ tên,
          tên quán và ảnh đại diện của bạn nếu có. Đừng viết vào đó những gì bạn không muốn người lạ
          đọc được.
        </li>
        <li>Mỗi tài khoản có một đánh giá. Gửi lại là cập nhật đánh giá cũ; các bản trước được lưu lại làm lịch sử.</li>
        <li>
          Quản trị viên có thể <strong>ẩn</strong> một đánh giá vi phạm khỏi trang giới thiệu, nhưng
          không sửa nội dung bạn đã viết.
        </li>
        <li>Không đăng nội dung xúc phạm, sai sự thật về bên thứ ba, hoặc chứa thông tin cá nhân của người khác.</li>
      </ul>
    ),
  },
  {
    id: 'tro-ly-ai',
    title: 'Trợ lý AI',
    body: (
      <>
        <p>
          Trợ lý AI chỉ có ở gói Pro Max. Khi bạn dùng tính năng này, nội dung hội thoại và thông tin
          ngữ cảnh về quán được gửi tới dịch vụ Google Gemini để xử lý — chi tiết xem mục Bên thứ ba
          trong <Link href="/privacy">Chính sách bảo mật</Link>.
        </p>
        <ul>
          <li>
            <strong>Câu trả lời của AI chỉ mang tính tham khảo và có thể sai.</strong> Hãy tự kiểm
            tra trước khi ra quyết định kinh doanh dựa trên nó.
          </li>
          <li>Trợ lý AI không thay thế tư vấn kế toán, thuế hay pháp lý.</li>
          <li>
            Các con số doanh thu do hệ thống tự tính từ hóa đơn của bạn; AI chỉ diễn giải phần số
            liệu đã có, không tự sinh ra số mới.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'hanh-vi-cam',
    title: 'Những việc không được làm',
    body: (
      <ul>
        <li>Dò tìm, khai thác hoặc lợi dụng lỗ hổng bảo mật của hệ thống.</li>
        <li>Truy cập hoặc cố truy cập dữ liệu của quán không thuộc tài khoản của bạn.</li>
        <li>Dùng công cụ tự động gửi lượng lớn yêu cầu gây quá tải hệ thống.</li>
        <li>Sao chép, phát tán lại phần mềm hoặc dùng hệ thống để lưu trữ nội dung trái pháp luật.</li>
      </ul>
    ),
  },
  {
    id: 'tam-ngung',
    title: 'Tạm ngừng và chấm dứt',
    body: (
      <>
        <p>
          Quản trị viên có thể khóa tài khoản nếu phát hiện vi phạm mục 10, hoặc có dấu hiệu gian lận
          trong giao dịch mua gói. Tài khoản bị khóa không đăng nhập được, nhưng dữ liệu quán vẫn
          được giữ lại.
        </p>
        <p>
          Bạn có thể ngừng sử dụng bất cứ lúc nào. Nếu muốn xóa hẳn tài khoản và dữ liệu, gửi yêu cầu
          tới <a href="mailto:nphec4007@gmail.com">nphec4007@gmail.com</a> từ chính email đã đăng ký.
        </p>
      </>
    ),
  },
  {
    id: 'gioi-han-trach-nhiem',
    title: 'Tính sẵn sàng và giới hạn trách nhiệm',
    body: (
      <>
        <p>
          <strong>Chúng tôi không cam kết mức độ sẵn sàng (SLA) nào.</strong> Hệ thống đang chạy trên
          hạ tầng miễn phí, nên có thể gián đoạn, bảo trì đột xuất, hoặc phản hồi chậm ở lần truy cập
          đầu tiên sau một thời gian không ai dùng.
        </p>
        <p>
          Dữ liệu của bạn được lưu trên dịch vụ cơ sở dữ liệu đám mây, nhưng chúng tôi không cam kết
          lịch sao lưu định kỳ. Với dữ liệu quan trọng, hãy tự xuất báo cáo để giữ bản sao.
        </p>
        <p>
          Trong phạm vi pháp luật cho phép, FunCafe không chịu trách nhiệm cho thiệt hại gián tiếp
          phát sinh từ việc sử dụng hoặc không sử dụng được hệ thống.
        </p>
      </>
    ),
  },
  {
    id: 'thay-doi',
    title: 'Thay đổi điều khoản, luật áp dụng và liên hệ',
    body: (
      <>
        <p>
          Chúng tôi có thể cập nhật Điều khoản này khi hệ thống thay đổi. Ngày cập nhật gần nhất luôn
          hiển thị ở đầu trang. Việc bạn tiếp tục sử dụng sau khi cập nhật được hiểu là bạn đồng ý
          với bản mới.
        </p>
        <p>Điều khoản này được điều chỉnh bởi pháp luật Việt Nam.</p>
        <p>
          Mọi thắc mắc xin gửi về <a href="mailto:nphec4007@gmail.com">nphec4007@gmail.com</a> hoặc qua
          trang <Link href="/contact">Liên hệ</Link>.
        </p>
      </>
    ),
  },
];
