/**
 * Kiểm mọi ô nhập số của phần bán hàng bằng trình duyệt thật — CÓ MÔ PHỎNG BỘ GÕ.
 *
 * Vì sao phải có bài này: máy quán bật bộ gõ tiếng Việt, nên mỗi phím đi qua hai lượt
 * `input` (một lượt "đang soạn" rồi một lượt chốt). Ô nào bị SỬA NỘI DUNG giữa hai
 * lượt đó — chấm hàng nghìn, hay chỉ là cú ghi ngược của React khi `Number('')` ra 0 —
 * thì bộ gõ chèn lại ký tự vừa gõ một lần nữa: mỗi phím thành hai chữ số, gõ
 * 2-0-0-0-0-0 ra 200.000.000. Bàn phím tiếng Anh KHÔNG đi qua đường này, nên gõ kiểu
 * thường báo ĐẠT trong khi máy người dùng vẫn hỏng — chỉ `Input.imeSetComposition`
 * của CDP mới dựng lại được.
 *
 * `ONhapSo` có hai chế độ (xem chú thích trong `components/ui/NumberInput.tsx`), và
 * mỗi chế độ phải chạy trong MỘT PHIÊN TRÌNH DUYỆT RIÊNG: chế độ "đã thấy bộ gõ" được
 * nhớ trong sessionStorage, dùng chung một phiên thì bài sau đo nhầm chế độ bài trước.
 *
 * Chạy:
 *   TOKEN='<token sanctum>' node scripts/kiem-o-nhap-tien.mjs
 *
 * Lấy token (chạy trong thư mục backend):
 *   php artisan tinker --execute="echo App\Models\User::where('email','...')->first()->createToken('kiem-thu')->plainTextToken;"
 *
 * Chỉ ĐỌC: có thêm món vào giỏ nhưng KHÔNG thanh toán, và tự hủy order ở cuối. Hộp
 * thêm/sửa thì đóng lại chứ không bấm Lưu.
 */
import { chromium } from 'playwright-core';

const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const TOKEN = process.env.TOKEN;
if (!TOKEN) { console.error('Thiếu TOKEN (xem chú thích đầu tệp).'); process.exit(2); }

const cong = { dat: 0, hong: 0 };
const ok = (dieuKien, chu, them = '') => {
  cong[dieuKien ? 'dat' : 'hong']++;
  console.log(`  ${dieuKien ? 'DAT ' : 'HONG'}  ${chu}${them ? ' — ' + them : ''}`);
};

const browser = await chromium.launch({ executablePath: EDGE, headless: true });

/** Một phiên trình duyệt sạch — chế độ bộ gõ không rò từ bài này sang bài kia. */
async function phienMoi() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  await ctx.addInitScript(t => localStorage.setItem('funcafe_token', t), TOKEN);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  [crash]', String(e).slice(0, 200)));
  const cdp = await page.context().newCDPSession(page);

  /** Gõ y như đi qua bộ gõ: mỗi phím một lượt "đang soạn" rồi mới chốt. */
  const goBoGo = async (chuoi) => {
    for (const phim of chuoi) {
      await cdp.send('Input.imeSetComposition', { text: phim, selectionStart: 1, selectionEnd: 1 });
      await page.waitForTimeout(50);
      await cdp.send('Input.insertText', { text: phim });
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(250);
  };
  return { ctx, page, goBoGo };
}

/** Chờ trang thôi hiện khung xương — chờ theo mốc thời gian đoán chừng là bấm vào khoảng không. */
const choTaiXong = async (page) => {
  await page.waitForFunction(
    () => document.querySelectorAll('.animate-pulse, .skeleton-sweep').length === 0,
    null, { timeout: 60000 },
  ).catch(() => {});
  await page.waitForTimeout(1500);
};

/** Mở màn hình Bán hàng tới bước hộp thanh toán đang mở. */
async function moHopThanhToan(page) {
  await page.goto(BASE + '/user/sales', { waitUntil: 'domcontentloaded' });
  await choTaiXong(page);
  await page.getByRole('button', { name: /Bàn 3/ }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Phin Sữa Đá/ }).first().click();
  await page.waitForTimeout(1200);
  const themVao = page.getByRole('button', { name: /Thêm vào order|Thêm vào giỏ/i });
  if (await themVao.count()) { await themVao.first().click(); await page.waitForTimeout(1200); }
  await page.getByRole('button', { name: /^Thanh toán/ }).first().click();
  await page.waitForTimeout(1500);
}

/** Hủy order mà giỏ hàng vừa mở ra, trả dữ liệu về nguyên trạng. */
async function traDuLieu(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  const huy = page.getByRole('button', { name: /Hủy order|Hủy đơn/i });
  if (!(await huy.count())) { console.log('  CHU Y: khong thay nut huy order — kiem lai Ban 3 bang tay'); return; }
  await huy.first().click();
  await page.waitForTimeout(800);
  const xacNhan = page.getByRole('button', { name: /^(Hủy order|Xác nhận|Đồng ý)$/i });
  if (await xacNhan.count()) await xacNhan.last().click();
  await page.waitForTimeout(1200);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== A. BAN PHIM THUONG (chua he thay bo go: cham hang nghin tung phim) ===');
{
  const { ctx, page } = await phienMoi();
  await moHopThanhToan(page);
  const oTien = page.locator('div', { has: page.locator('label:text("Tiền khách đưa (đ)")') }).last().locator('input').last();

  await oTien.click();
  await page.keyboard.type('200000', { delay: 40 });
  await page.waitForTimeout(400);
  ok(await oTien.inputValue() === '200.000', 'go 200000: cham hang nghin ngay khi go', await oTien.inputValue());

  // Chèn số vào GIỮA: con trỏ phải bám chữ số vừa gõ, không nhảy về cuối.
  await page.evaluate(() => document.activeElement.setSelectionRange(1, 1));
  await page.keyboard.type('0');
  await page.waitForTimeout(400);
  ok(await oTien.inputValue() === '2.000.000', 'chen mot so 0 ngay sau so 2', await oTien.inputValue());
  const caret = await page.evaluate(() => document.activeElement.selectionStart);
  ok(caret === 3, 'con tro o lai ngay sau chu so vua go', 'caret ' + caret);

  await traDuLieu(page);
  await ctx.close();
}

console.log('\n=== B. BO GO TIENG VIET — o Tien khach dua (day la duong tung hong) ===');
{
  const { ctx, page, goBoGo } = await phienMoi();
  await moHopThanhToan(page);
  const khung = page.locator('div', { has: page.locator('label:text("Tiền khách đưa (đ)")') }).last();
  const oTien = khung.locator('input').last();
  const tong = Number((await page.getByRole('dialog').innerText()).match(/Tổng thanh toán\s*([\d.]+)/)[1].replace(/\D/g, ''));

  await oTien.click();
  await goBoGo('200000');
  ok(await oTien.inputValue() === '200000', 'dang go: chu so tran, khong ai chen dau cham vao', await oTien.inputValue());

  // Số phải báo lên trên NGAY từng phím, đừng đợi rời ô: thu ngân nhìn tiền thối.
  const thoi = Number((((await khung.innerText()).match(/Tiền thối: ([\d.]+)/) || [])[1] ?? '').replace(/\D/g, ''));
  ok(thoi === 200000 - tong, `tien thoi dung ngay trong luc go (200.000 - ${tong})`, 'doc duoc ' + thoi);

  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  ok(await oTien.inputValue() === '200.000', 'roi o thi cham hang nghin', await oTien.inputValue());

  // Bôi đen cả ô rồi gõ đè — thao tác quen thuộc khi sửa lại số đã nhập.
  await oTien.click();
  await page.keyboard.press('Control+a');
  await goBoGo('150000');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  ok(await oTien.inputValue() === '150.000', 'boi den ca o roi go de so moi', await oTien.inputValue());

  // Đặt giá trị từ bên ngoài vẫn phải vào được ô.
  await page.getByRole('button', { name: 'Vừa đủ' }).click();
  await page.waitForTimeout(500);
  ok(Number((await oTien.inputValue()).replace(/\D/g, '')) === tong, 'bam Vua du: o dien dung tong tien', await oTien.inputValue());

  await oTien.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  ok(await oTien.inputValue() === '', 'xoa trang duoc');
  ok((await khung.innerText()).includes('Nhập số tiền khách đưa'), 'hien lai loi nhac "chua go gi"');

  await traDuLieu(page);
  await ctx.close();
}

console.log('\n=== C. THUC DON: gia mon va gia size, go qua bo go ===');
{
  const { ctx, page, goBoGo } = await phienMoi();
  await page.goto(BASE + '/user/menu', { waitUntil: 'domcontentloaded' });
  await choTaiXong(page);

  await page.getByRole('button', { name: /Thêm món/i }).first().click();
  await page.waitForTimeout(1200);
  const oGia = page.locator('div', { has: page.locator('label:text("Giá mặc định (đ)")') }).last().locator('input').last();
  ok(await oGia.inputValue() === '', 'o gia cua mon moi rong');
  await oGia.click();
  await goBoGo('120000');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  ok(await oGia.inputValue() === '120.000', 'go 120000 vao gia mon', await oGia.inputValue());

  // Bật "Có size": dòng size đầu lấy sẵn giá mặc định.
  const oTick = page.locator('input[type=checkbox]');
  for (let i = 0; i < await oTick.count(); i++) {
    const nhan = await oTick.nth(i).evaluate(el => el.closest('label')?.innerText?.trim() ?? '');
    if (/^Có size/i.test(nhan)) { await oTick.nth(i).check(); break; }
  }
  await page.waitForTimeout(800);
  const oSize = page.locator('input[placeholder="Giá (đ)"]');
  ok(await oSize.count() > 0, 'co dong size de nhap gia', `${await oSize.count()} dong`);
  ok(await oSize.first().inputValue() === '120.000', 'dong size dau lay san gia mac dinh', await oSize.first().inputValue());

  // Sửa giá size: bôi đen gõ đè.
  await oSize.first().click();
  await page.keyboard.press('Control+a');
  await goBoGo('55000');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  ok(await oSize.first().inputValue() === '55.000', 'go de gia size thu nhat', await oSize.first().inputValue());

  // Thêm dòng size thứ hai: dòng cũ không được đổi theo.
  await page.getByRole('button', { name: /Thêm size/i }).first().click();
  await page.waitForTimeout(800);
  const oSize2 = page.locator('input[placeholder="Giá (đ)"]').nth(1);
  await oSize2.click();
  await goBoGo('69000');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
  ok(await oSize2.inputValue() === '69.000', 'go gia cho size thu hai', await oSize2.inputValue());
  ok(await page.locator('input[placeholder="Giá (đ)"]').first().inputValue() === '55.000',
    'gia size thu nhat con nguyen', await page.locator('input[placeholder="Giá (đ)"]').first().inputValue());

  // ĐÓNG, KHÔNG LƯU.
  await page.getByRole('button', { name: /^(Hủy|Đóng)$/ }).first().click().catch(() => page.keyboard.press('Escape'));
  await page.waitForTimeout(800);
  ok(!(await page.getByRole('dialog').isVisible().catch(() => false)), 'da dong hop ma khong luu');
  await ctx.close();
}

console.log('\n=== D. BAN: o "Suc chua (nguoi)" ===');
{
  const { ctx, page, goBoGo } = await phienMoi();
  await page.goto(BASE + '/user/tables', { waitUntil: 'domcontentloaded' });
  await choTaiXong(page);
  await page.getByRole('button', { name: /Thêm bàn/i }).first().click();
  await page.waitForTimeout(1200);
  const oSuc = page.locator('div', { has: page.locator('label:text("Sức chứa (người)")') }).last().locator('input').last();
  ok(await oSuc.inputValue() === '4', 'mo hop them ban: san 4 nguoi', await oSuc.inputValue());

  // Xóa trắng rồi gõ lại — đây là chỗ ô cũ hỏng: `Number('')` ra 0 nên React ghi
  // ngược "0" vào ô, gõ tiếp số 8 thành "08".
  await oSuc.click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);
  ok(await oSuc.inputValue() === '', 'xoa trang duoc, khong tu nhay ve 0', await oSuc.inputValue());
  await goBoGo('8');
  ok(await oSuc.inputValue() === '8', 'go 8 qua bo go', await oSuc.inputValue());

  await oSuc.click();
  await page.keyboard.press('Control+a');
  await goBoGo('12');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  ok(await oSuc.inputValue() === '12', 'boi den roi go de "12"', await oSuc.inputValue());

  // Kẹp 1–50 chỉ được siết khi RỜI Ô.
  await oSuc.click();
  await page.keyboard.press('Control+a');
  await goBoGo('99');
  ok(await oSuc.inputValue() === '99', 'dang go thi chua kep', await oSuc.inputValue());
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  ok(await oSuc.inputValue() === '50', 'roi o thi kep ve tran 50', await oSuc.inputValue());

  // ĐÓNG, KHÔNG LƯU.
  await page.getByRole('button', { name: /^(Hủy|Đóng)$/ }).first().click().catch(() => page.keyboard.press('Escape'));
  await page.waitForTimeout(800);
  ok(!(await page.getByRole('dialog').isVisible().catch(() => false)), 'da dong hop ma khong luu');
  await ctx.close();
}

await browser.close();
console.log(`\nTONG: ${cong.dat} dat · ${cong.hong} hong`);
process.exit(cong.hong > 0 ? 1 : 0);
