/**
 * In hóa đơn ra khổ bill 80mm — tự cắt đúng chiều dài, tự đặt tên tệp.
 *
 * Hai chuyện trình duyệt không tự làm được, phải nhúng tay vào:
 *
 * 1. CHIỀU DÀI TỜ GIẤY. Giấy bill là cuộn liên tục nên đúng ra chỉ cần khai
 *    `@page { size: 80mm auto }` — nhưng đó là CÚ PHÁP KHÔNG HỢP LỆ (đặc tả CSS chỉ
 *    cho một/hai số đo, hoặc mỗi chữ `auto`), trình duyệt bỏ nguyên dòng khai và lặng
 *    lẽ quay về khổ mặc định. Đo bằng tay thì thấy PDF ra Letter 216×279mm — đúng cái
 *    tờ giấy trắng lỗ chỗ mà ta đang muốn bỏ. Nên chiều dài phải do mình đo và ghi ra.
 *
 * 2. TÊN TỆP khi khách bấm "Lưu thành PDF": trình duyệt lấy `document.title`, vốn là
 *    tên quán — mọi hóa đơn lưu ra trùng một tên, tờ thứ hai thành "... (1).pdf".
 */

const MA_STYLE = 'funcafe-kho-bill';
const RONG_MM = 80;
const LE_MM = 4;
/** Trần chiều dài: hóa đơn hỏng/dài bất thường cũng không đẻ ra tờ giấy vô tận. */
const CAO_TOI_DA_MM = 2000;

const pxSangMm = (px: number) => (px / 96) * 25.4;

/**
 * Đo chiều cao hóa đơn ĐÚNG NHƯ LÚC IN, chứ không phải như đang thấy trên màn hình.
 *
 * Bản in hẹp hơn hẳn (72mm sau lề, so với hộp thoại rộng 460px) và cỡ chữ gốc hạ
 * xuống 12px, nên cùng một hóa đơn ra hai chiều cao rất khác nhau — đo trên màn hình
 * rồi lấy số đó làm chiều dài giấy là hụt mất phần cuối hoặc dư ra một khúc trắng.
 *
 * Cách đo: nhân bản khối hóa đơn ra ngoài màn hình, ép đúng bề ngang bản in, và tạm
 * hạ cỡ chữ gốc y như quy tắc @media print. Cả đoạn chạy đồng bộ trong một lượt, chưa
 * kịp vẽ ra màn hình lần nào nên người dùng không thấy chớp.
 */
function doChieuCaoBanIn(): number | null {
  const goc = document.querySelector('.print-area');
  if (!(goc instanceof HTMLElement)) return null;

  const ban = goc.cloneNode(true) as HTMLElement;
  ban.querySelectorAll('.no-print').forEach(n => n.remove());
  // .do-bill: kéo theo mấy luật in làm đổi chiều cao mà bản nhân bản không tự có
  // (nó nằm ngoài @media print). Xem chú thích ở cuối globals.css.
  ban.classList.add('do-bill');
  ban.style.cssText = `position:fixed;left:-10000px;top:0;width:${RONG_MM - LE_MM * 2}mm;max-width:none;margin:0;padding:0;`;

  const chuGoc = document.documentElement.style.fontSize;
  document.documentElement.style.fontSize = '12px';
  document.body.appendChild(ban);
  const cao = ban.getBoundingClientRect().height;
  ban.remove();
  document.documentElement.style.fontSize = chuGoc;

  return cao > 0 ? cao : null;
}

/**
 * Ghi khổ giấy cho lượt in sắp tới. Trả về chiều cao (mm) đã đặt, hoặc null nếu
 * không đo được — lúc đó quy tắc dự phòng trong globals.css lo phần còn lại.
 */
export function datKhoBill(): number | null {
  const caoPx = doChieuCaoBanIn();
  if (caoPx == null) return null;

  // Cộng lề trên/dưới, thêm 2mm nới tay: bản sao đo trên màn hình không có mấy quy
  // tắc chỉ sống trong @media print (ví dụ cấm rớt dòng ở cột tiền), nên số đo có thể
  // lệch chút ít. Dư 2mm chỉ là mẩu giấy thừa; thiếu 2mm là mất dòng "Cảm ơn quý khách".
  const cao = Math.min(Math.ceil(pxSangMm(caoPx)) + LE_MM * 2 + 2, CAO_TOI_DA_MM);

  let style = document.getElementById(MA_STYLE);
  if (!style) {
    style = document.createElement('style');
    style.id = MA_STYLE;
    document.head.appendChild(style);
  }
  style.textContent = `@page { size: ${RONG_MM}mm ${cao}mm; margin: ${LE_MM}mm; }`;
  return cao;
}

/** Mở hộp thoại in cho một hóa đơn: khổ giấy vừa vặn, tên tệp là mã hóa đơn. */
export function inBill(maHoaDon?: string) {
  datKhoBill();

  const tieuDeCu = document.title;
  if (maHoaDon) document.title = maHoaDon;
  // Trả tiêu đề về ở `afterprint`: trả ngay sau window.print() thì thanh tab đổi qua
  // đổi lại ngay trước mắt người dùng trong lúc hộp thoại in còn đang mở.
  const traLai = () => {
    document.title = tieuDeCu;
    window.removeEventListener('afterprint', traLai);
  };
  window.addEventListener('afterprint', traLai);

  window.print();
}
