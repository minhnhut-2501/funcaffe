/**
 * Đếm số lượt gọi API đang bay, để vẽ một thanh tiến trình chung cho cả ứng dụng.
 *
 * VÌ SAO KHÔNG DÙNG React context: `api-client` là một module thuần, không nằm trong
 * cây React — nó được gọi từ service, từ hook, từ `useEffect`, và cả từ nơi không có
 * component nào đang vẽ. Một bộ đếm cấp module là chỗ duy nhất cả hai phía chạm tới
 * được mà không phải kéo state lên tận layout gốc.
 *
 * VÌ SAO ĐẾM CHỨ KHÔNG PHẢI CỜ BẬT/TẮT: các trang mở đầu bằng 5 lượt gọi SONG SONG
 * (`Promise.all` ở màn Bán hàng). Với cờ, lượt xong đầu tiên tắt thanh trong khi bốn
 * lượt còn lại vẫn đang chờ. Đếm lên rồi đếm xuống thì thanh chỉ tắt khi lượt cuối
 * cùng về.
 *
 * Ứng dụng đã có khung xương lúc mở trang và chữ "Đang lưu..." trên nút, nhưng cả hai
 * đều phải gắn TỪNG CHỖ. Thanh này phủ những lượt chờ không ai nghĩ tới lúc viết:
 * đổi quán, đổi bộ lọc ngày, tải lại nền sau khi lưu.
 */

type Listener = (dangChay: number) => void;

let dangChay = 0;
const listeners = new Set<Listener>();

function bao(): void {
  for (const l of listeners) l(dangChay);
}

export function batDauMotLuot(): void {
  dangChay += 1;
  bao();
}

export function ketThucMotLuot(): void {
  // Không cho tụt xuống âm: một lượt gọi bị huỷ giữa chừng có thể chạy nhánh kết thúc
  // hai lần, và số âm sẽ khiến thanh không bao giờ tắt được nữa.
  dangChay = Math.max(0, dangChay - 1);
  bao();
}

/** Trả về hàm huỷ đăng ký. Gọi listener ngay một lần để bắt kịp trạng thái hiện tại. */
export function theoDoiApi(listener: Listener): () => void {
  listeners.add(listener);
  listener(dangChay);
  return () => {
    listeners.delete(listener);
  };
}
