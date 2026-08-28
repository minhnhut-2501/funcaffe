/**
 * Chặn `npm run dev` khi đã có một bản Next đang chạy — chạy tự động qua `predev`.
 *
 * VÌ SAO CẦN MỘT CÁI CHẶN, CHỨ KHÔNG CHỈ GHI VÀO TÀI LIỆU: Next thấy cổng 3000 bận
 * thì KHÔNG báo lỗi, nó lặng lẽ nhảy sang 3001 rồi chạy tiếp — nhưng vẫn ghi vào
 * `.next` của bản kia. Hai bản cùng ghi một thư mục dựng thì bản dựng hỏng, và triệu
 * chứng lộ ra muộn, ở chỗ chẳng liên quan gì: vài tuyến trả 404 cho tệp chunk, một
 * tuyến trả 500 kèm `Expected clientReferenceManifest to be defined`, còn trang chủ
 * thì vẫn tốt nên mình không nghi ngờ gì. Cái bẫy này đã sập hai lần trong hai ngày,
 * lần thứ hai là sau khi đã ghi hẳn cảnh báo vào CLAUDE.md. Tài liệu không cứu được
 * một thao tác mà người ta gõ theo phản xạ.
 *
 * Thà dừng ngay và nói rõ, còn hơn để mất nửa tiếng đi tìm lỗi trong mã nguồn.
 *
 * Hai lối thoát, đều có chủ đích:
 *   - Đặt `NEXT_DIST_DIR` (ví dụ máy chủ nháp cho kịch bản đầu–cuối): lúc đó hai bản
 *     ghi hai thư mục khác nhau nên không đụng nhau — bỏ qua phép kiểm này.
 *   - Đặt `BO_QUA_KIEM_CONG=1`: cửa sau cho trường hợp ngoài dự tính.
 *
 * Kiểm bằng cách thử MỞ cổng chứ không gọi lệnh hệ thống: chạy được trên mọi nền,
 * không phụ thuộc PowerShell hay lsof, và trả lời đúng câu cần hỏi — cổng này có mở
 * được không.
 */
import net from 'node:net';

if (process.env.NEXT_DIST_DIR || process.env.BO_QUA_KIEM_CONG) {
  process.exit(0);
}

const cong = Number(process.env.PORT) || 3000;

const dangBan = await new Promise((giaiQuyet) => {
  const may = net.createServer();
  may.once('error', (e) => giaiQuyet(e.code === 'EADDRINUSE'));
  may.once('listening', () => may.close(() => giaiQuyet(false)));
  may.listen(cong, '127.0.0.1');
});

if (!dangBan) process.exit(0);

console.error(`
  ✖ Cổng ${cong} đang có tiến trình khác giữ.

  Đừng để Next tự nhảy sang cổng khác: bản thứ hai vẫn ghi vào cùng thư mục
  ".next" với bản đang chạy, và bản dựng sẽ hỏng theo kiểu rất khó đoán — vài
  tuyến trả 404 cho tệp chunk, một tuyến trả 500, còn trang chủ thì vẫn tốt.

  Xem ai đang giữ cổng (PowerShell):

    Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000..3010 } |
      Select-Object LocalPort, OwningProcess

  Nếu đó là một server dev cũ còn sót, dừng cho tới nơi rồi chạy lại:

    Stop-Process -Id <pid> -Force
    rm -rf .next
    npm run dev

  Lưu ý: đóng cửa sổ terminal thường chỉ giết lớp vỏ "npm", tiến trình "next dev"
  con vẫn sống và vẫn giữ cổng.

  Thật sự cần chạy song song hai bản Next thì đặt thư mục dựng riêng:

    NEXT_DIST_DIR=.next-e2e npx next dev -p 3010
`);
process.exit(1);
