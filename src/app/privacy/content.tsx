import Link from 'next/link';
import type { LegalSection } from '@/components/public/LegalPage';

/** Ngày sửa văn bản — chuỗi cứng, không phải ngày người dùng mở trang. */
export const UPDATED_AT = '05/08/2026';

/** Bảng nhỏ dùng lại cho mục dữ liệu thu thập và mục bên thứ ba. */
function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div>
      <div className="legal-table">
        <table>
          <thead>
            <tr>{head.map(h => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Trên điện thoại bảng cuộn ngang trong khung của nó (cả trang thì không được
          phép cuộn ngang). Cột cuối bị cắt là tín hiệu yếu, nói thẳng ra cho chắc. */}
      <p className="sm:hidden mt-2 text-xs text-ink/55">Vuốt ngang trong bảng để xem đủ các cột.</p>
    </div>
  );
}

export const sections: LegalSection[] = [
  {
    id: 'pham-vi',
    title: 'Phạm vi của chính sách',
    body: (
      <>
        <p>
          Chính sách này mô tả FunCafe thu thập dữ liệu gì, dùng để làm gì, chia sẻ với ai, và bạn có
          quyền gì với dữ liệu của mình.
        </p>
        <p>
          Chính sách áp dụng cho <strong>chủ quán</strong> — người tạo tài khoản và sử dụng hệ thống.
          Khách tới uống nước tại quán không có tài khoản và không được hệ thống thu thập thông tin
          (xem mục 3).
        </p>
        <p>
          Nội dung dưới đây mô tả đúng những gì phần mềm đang thực sự làm, không phải một mẫu chính
          sách chung chung.
        </p>
      </>
    ),
  },
  {
    id: 'du-lieu-thu-thap',
    title: 'Dữ liệu chúng tôi thu thập',
    body: (
      <>
        <p>Toàn bộ dữ liệu dưới đây do chính bạn nhập vào hệ thống:</p>
        <Table
          head={['Nhóm', 'Cụ thể']}
          rows={[
            ['Tài khoản', 'Họ tên, email, số điện thoại, ảnh đại diện (nếu bạn tải lên), mật khẩu ở dạng đã băm'],
            ['Thông tin quán', 'Tên quán, địa chỉ, số điện thoại, logo, và thông tin tài khoản ngân hàng nhận tiền để sinh mã VietQR'],
            ['Dữ liệu vận hành', 'Danh mục, món, size, topping, bàn, đơn hàng và hóa đơn của quán bạn'],
            ['Giao dịch mua gói', 'Mã giao dịch, tên gói, số tiền, phương thức, trạng thái và thời điểm xác nhận'],
            ['Liên hệ', 'Họ tên, email, số điện thoại, tên quán và nội dung bạn gửi qua trang Liên hệ, cùng nội dung trả lời của chúng tôi'],
            ['Đánh giá', 'Số sao, tiêu đề, nội dung và các bản chỉnh sửa trước đó'],
            ['Trợ lý AI', 'Nội dung hội thoại bạn gõ vào hộp chat, chỉ khi bạn chủ động dùng tính năng này'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'khong-thu-thap',
    title: 'Dữ liệu chúng tôi KHÔNG thu thập',
    body: (
      <>
        <p>
          <strong>FunCafe không lưu bất kỳ thông tin cá nhân nào của khách tới quán bạn.</strong> Một
          đơn hàng trong hệ thống chỉ gắn với <em>số bàn</em>; không có trường tên khách, số điện
          thoại khách, hay lịch sử mua của từng người. Hóa đơn cũng vậy.
        </p>
        <p>Ngoài ra hệ thống không thu thập:</p>
        <ul>
          <li>Thông tin thẻ ngân hàng của bạn — luồng thanh toán do cổng thanh toán xử lý, FunCafe không nhìn thấy số thẻ.</li>
          <li>Vị trí địa lý, danh bạ, hay bất kỳ quyền truy cập thiết bị nào.</li>
          <li>Dữ liệu hành vi duyệt web phục vụ quảng cáo.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'muc-dich',
    title: 'Chúng tôi dùng dữ liệu để làm gì',
    body: (
      <ul>
        <li><strong>Tài khoản</strong> — xác thực khi đăng nhập, khôi phục mật khẩu, và liên hệ với bạn khi cần.</li>
        <li><strong>Thông tin quán</strong> — hiển thị trên hóa đơn của quán và sinh mã VietQR cho khách quét.</li>
        <li><strong>Dữ liệu vận hành</strong> — chạy nghiệp vụ bán hàng và tính báo cáo doanh thu cho chính quán bạn.</li>
        <li><strong>Giao dịch</strong> — kích hoạt gói, đối soát khi có tranh chấp, và hiển thị lịch sử mua cho bạn.</li>
        <li><strong>Liên hệ</strong> — trả lời câu hỏi của bạn qua email.</li>
        <li><strong>Đánh giá</strong> — hiển thị công khai trên trang giới thiệu.</li>
      </ul>
    ),
  },
  {
    id: 'co-so-xu-ly',
    title: 'Cơ sở của việc xử lý dữ liệu',
    body: (
      <p>
        Chúng tôi xử lý dữ liệu của bạn dựa trên <strong>sự đồng ý</strong> mà bạn thể hiện khi tick ô
        chấp nhận Chính sách này lúc đăng ký, và dựa trên nhu cầu <strong>thực hiện dịch vụ</strong>{' '}
        mà bạn yêu cầu (không có dữ liệu quán thì không thể có phần mềm quản lý quán). Bạn có thể rút
        lại sự đồng ý bằng cách yêu cầu xóa tài khoản — xem mục 10.
      </p>
    ),
  },
  {
    id: 'ben-thu-ba',
    title: 'Bên thứ ba nhận dữ liệu',
    body: (
      <>
        <p>
          FunCafe <strong>không bán dữ liệu của bạn</strong> và không chia sẻ cho bên nào vì mục đích
          quảng cáo. Những dịch vụ dưới đây tham gia vào việc vận hành hệ thống:
        </p>
        <Table
          head={['Dịch vụ', 'Dữ liệu được gửi', 'Mục đích']}
          rows={[
            ['Google Gemini', 'Nội dung hội thoại bạn gõ và số liệu tổng hợp về quán', 'Sinh câu trả lời cho trợ lý AI — chỉ chạy khi bạn chủ động dùng tính năng này (gói Pro Max)'],
            ['Cloudinary', 'Ảnh bạn tải lên (logo quán, ảnh món, ảnh đại diện)', 'Lưu trữ và phân phối hình ảnh'],
            ['MongoDB Atlas', 'Toàn bộ cơ sở dữ liệu của hệ thống', 'Lưu trữ dữ liệu'],
            ['VNPay (sandbox)', 'Mã giao dịch, số tiền, nội dung thanh toán', 'Xử lý luồng thanh toán mô phỏng'],
            ['Vercel, Render', 'Dữ liệu đi qua trong quá trình xử lý yêu cầu', 'Hạ tầng chạy giao diện và máy chủ'],
          ]}
        />
        <p>
          <strong>Máy chủ của các dịch vụ này có thể đặt ngoài lãnh thổ Việt Nam.</strong> Khi bạn sử
          dụng hệ thống, dữ liệu của bạn được truyền và lưu trữ trên hạ tầng đó.
        </p>
        <p>
          Riêng với trợ lý AI: nếu bạn không muốn nội dung nào được gửi sang Google, chỉ cần không sử
          dụng hộp chat và tính năng phân tích doanh thu bằng AI. Mọi chức năng còn lại của FunCafe
          hoạt động độc lập với dịch vụ này.
        </p>
      </>
    ),
  },
  {
    id: 'cookie',
    title: 'Cookie và bộ nhớ trình duyệt',
    body: (
      <>
        <p>
          <strong>FunCafe không dùng cookie quảng cáo và không cài mã theo dõi của bên thứ ba.</strong>{' '}
          Không có Google Analytics, không có pixel mạng xã hội, không có công cụ đo hành vi người
          dùng nào.
        </p>
        <p>Hệ thống chỉ dùng bộ nhớ sẵn có của trình duyệt để lưu hai thứ:</p>
        <ul>
          <li>
            <strong>Mã đăng nhập</strong> — để bạn không phải nhập lại mật khẩu ở mỗi trang. Nếu bạn
            tick “Ghi nhớ đăng nhập”, mã được lưu bền qua các phiên; nếu không, mã chỉ tồn tại tới
            khi bạn đóng tab.
          </li>
          <li><strong>Quán đang chọn</strong> — để lần sau mở lên vẫn đúng quán bạn đang làm việc.</li>
        </ul>
        <p>Khi bạn bấm Đăng xuất, cả hai bị xóa khỏi trình duyệt ngay lập tức.</p>
      </>
    ),
  },
  {
    id: 'bao-mat',
    title: 'Chúng tôi bảo vệ dữ liệu thế nào',
    body: (
      <>
        <ul>
          <li><strong>Mật khẩu được băm</strong> bằng bcrypt trước khi lưu — kể cả quản trị viên cũng không đọc được mật khẩu của bạn.</li>
          <li>Mã đăng nhập lưu trong cơ sở dữ liệu ở dạng băm SHA-256, không lưu bản gốc.</li>
          <li>Mật khẩu và mã đặt lại mật khẩu không bao giờ được trả về qua API, kể cả ở màn hình quản trị.</li>
          <li>Toàn bộ kết nối tới máy chủ đi qua HTTPS.</li>
          <li>Mỗi yêu cầu tới dữ liệu của một quán đều được kiểm tra quyền sở hữu — tài khoản này không đọc được dữ liệu quán của tài khoản khác.</li>
        </ul>
        <p>
          Dù vậy, không hệ thống nào an toàn tuyệt đối. Hãy dùng mật khẩu riêng cho FunCafe và không
          chia sẻ tài khoản với người khác.
        </p>
      </>
    ),
  },
  {
    id: 'luu-tru',
    title: 'Thời gian lưu trữ',
    body: (
      <ul>
        <li>Dữ liệu tài khoản và dữ liệu quán được giữ trong suốt thời gian tài khoản của bạn còn tồn tại.</li>
        <li>Hóa đơn và giao dịch mua gói được giữ lại để bạn tra cứu và để đối soát khi có tranh chấp.</li>
        <li>Đánh giá cũ không bị xóa khi bạn sửa — các bản trước được lưu thành lịch sử của chính đánh giá đó.</li>
        <li>Khi bạn yêu cầu xóa tài khoản, dữ liệu cá nhân sẽ được xóa; chúng tôi sẽ xác nhận lại với bạn qua email trước khi thực hiện.</li>
      </ul>
    ),
  },
  {
    id: 'quyen-cua-ban',
    title: 'Quyền của bạn với dữ liệu',
    body: (
      <>
        <p>Phần lớn các quyền dưới đây bạn tự thực hiện được ngay trong hệ thống:</p>
        <ul>
          <li><strong>Xem và sửa</strong> họ tên, số điện thoại, ảnh đại diện — trong mục Tài khoản.</li>
          <li><strong>Sửa hoặc ẩn</strong> dữ liệu quán: thông tin quán, thực đơn, bàn, topping.</li>
          <li><strong>Sửa hoặc gỡ</strong> đánh giá bạn đã gửi.</li>
          <li>
            <strong>Yêu cầu xóa tài khoản và dữ liệu</strong> — gửi email từ chính địa chỉ đã đăng ký
            tới <a href="mailto:support@funcafe.vn">support@funcafe.vn</a>.
          </li>
        </ul>
        <p>
          Các quyền này tương ứng với quyền của chủ thể dữ liệu theo Nghị định 13/2023/NĐ-CP về bảo
          vệ dữ liệu cá nhân.
        </p>
        <p>
          FunCafe không dành cho người dưới 18 tuổi. Nếu bạn chưa đủ tuổi, vui lòng không tạo tài
          khoản.
        </p>
      </>
    ),
  },
  {
    id: 'thay-doi',
    title: 'Thay đổi chính sách và liên hệ',
    body: (
      <>
        <p>
          Khi hệ thống thay đổi cách xử lý dữ liệu, chúng tôi sẽ cập nhật tài liệu này và đổi ngày ở
          đầu trang. Những thay đổi quan trọng sẽ được thông báo trong ứng dụng.
        </p>
        <p>
          Câu hỏi về dữ liệu cá nhân xin gửi tới{' '}
          <a href="mailto:support@funcafe.vn">support@funcafe.vn</a> hoặc qua trang{' '}
          <Link href="/contact">Liên hệ</Link>. Xem thêm{' '}
          <Link href="/terms">Điều khoản dịch vụ</Link>.
        </p>
      </>
    ),
  },
];
