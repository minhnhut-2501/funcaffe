/**
 * Chay MOT GIAO DICH THAT tren moi truong thu nghiem cua cong thanh toan, tu dau
 * den cuoi, roi luu anh trang ket qua de dua vao bao cao.
 *
 * Chay:
 *   MSYS_NO_PATHCONV=1 OWNER_TOKEN='...' node scripts/chay-thu-thanh-toan.mjs momo
 *   MSYS_NO_PATHCONV=1 OWNER_TOKEN='...' node scripts/chay-thu-thanh-toan.mjs vnpay
 *
 * Luu y voi MoMo: can dat MOMO_REQUEST_TYPE=payWithATM trong backend/.env. De
 * captureWallet thi cong hien ma QR va phai co app MoMo Test tren dien thoai.
 *
 * Moi buoc deu luu mot anh vao thu muc tam de con doi chieu khi co buoc nao lech.
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const B = 'http://localhost:3000';

const CONG = process.argv[2];
if (!['momo', 'vnpay'].includes(CONG)) {
  console.error('Dùng: node scripts/chay-thu-thanh-toan.mjs <momo|vnpay>');
  process.exit(1);
}
if (!process.env.OWNER_TOKEN) {
  console.error('Thiếu OWNER_TOKEN.');
  process.exit(1);
}

const BUOC = (process.env.BUOC_DIR
  || 'C:/Users/anh90/AppData/Local/Temp/claude/c--FunCafe/24dd442d-509d-483b-a7b3-af02e816158f/scratchpad')
  + '/' + CONG;
mkdirSync(BUOC, { recursive: true });

/** The thu nghiem cho truong hop THANH CONG, theo tai lieu cua tung cong. */
const THE = {
  momo:  { so: '9704000000000018', ten: 'NGUYEN VAN A', ngay: '03/07', dienthoai: '0912345678', otp: 'OTP' },
  vnpay: { so: '9704198526191432198', ten: 'NGUYEN VAN A', ngay: '07/15', otp: '123456', nganhang: 'NCB' },
}[CONG];

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'vi-VN',
  timezoneId: 'Asia/Ho_Chi_Minh',
});
await ctx.addInitScript(t => localStorage.setItem('funcafe_token', t), process.env.OWNER_TOKEN);

const page = await ctx.newPage();

let n = 0;
const ghi = async (nhan) => {
  n += 1;
  await page.screenshot({ path: `${BUOC}/${String(n).padStart(2, '0')}-${nhan}.png`, fullPage: true });
  console.log(`  ${n}. ${nhan}  —  ${page.url().slice(0, 76)}`);
};

const liet_ke_truong = async () => {
  const ra = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('input, select, button, a')) {
      if (el.offsetParent === null) continue;
      const nhan = (el.placeholder || el.value || el.innerText || '').trim().slice(0, 42);
      if (!nhan && !el.id && !el.name) continue;
      out.push([el.tagName, el.type || '', el.id || '', el.name || '', nhan].join(' | '));
    }
    return out.slice(0, 45);
  });
  console.log('\n  Ô nhập / nút nhìn thấy được:');
  ra.forEach(t => console.log('   ', t));
};

// ---------------------------------------------------------------- Phia ung dung
await page.goto(B + '/user/subscription', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await ghi('trang-goi');

// Dung "Gia hạn gói": tai khoan dang o goi cao nhat, bam vao goi thap hon se bi
// chan va hop thoai khong mo ra.
await page.getByRole('button', { name: /Gia hạn gói/i }).first().click();
await page.waitForTimeout(1500);

const ten_cong = CONG === 'momo' ? 'MoMo' : 'VNPay';
const da_mo = await page.locator('label').filter({ hasText: ten_cong }).first()
  .isVisible().catch(() => false);
if (!da_mo) {
  await page.locator('.grid > div').filter({ hasText: 'Pro Max' }).first().click();
  await page.waitForTimeout(1500);
}

// O chon cong bi an bang sr-only nen phai bam vao nhan bao ngoai
await page.locator('label').filter({ hasText: ten_cong }).first().click();
await page.waitForTimeout(700);
await ghi('da-chon-cong');

await Promise.all([
  page.waitForURL(/momo\.vn|vnpayment\.vn/, { timeout: 45000 }).catch(() => {}),
  page.getByRole('button', { name: new RegExp(`Thanh toán qua ${ten_cong}`, 'i') }).click(),
]);
await page.waitForTimeout(4500);
await ghi('trang-cong');

// ---------------------------------------------------------------- Phia cong
if (CONG === 'momo') {
  await page.fill('#card-number', THE.so);
  await page.fill('#card-expire', THE.ngay);
  await page.fill('#card-name', THE.ten);
  if (await page.locator('#number-phone').isVisible().catch(() => false)) {
    await page.fill('#number-phone', THE.dienthoai);
  }
  await ghi('da-dien-the');
  await page.click('#btn-pay-card');
  await page.waitForTimeout(6000);
  await ghi('sau-khi-gui-the');
} else {
  // VNPay: trang dau liet ke tung ngan hang thanh nut rieng, moi nut co id la ma
  // ngan hang. Ma QR tren sandbox KHONG quet duoc bang app ngan hang that, nen
  // phai di duong the noi dia — bam thang vao nut ngan hang.
  // Trang dau cho chon 4 phuong thuc; danh sach ngan hang nam an trong muc "The noi
  // dia", phai mo muc do ra truoc thi nut ngan hang moi bam duoc.
  await page.getByText('Thẻ nội địa và tài khoản ngân hàng').first().click();
  await page.waitForTimeout(3000);
  await ghi('mo-the-noi-dia');

  await page.locator(`button#${THE.nganhang}`).click();
  await page.waitForTimeout(3500);
  await ghi('chon-ngan-hang');

  // Form the: ten truong khac nhau tuy phien ban trang, do theo nhieu kha nang
  const dien = async (ung_vien, gia_tri, nhan) => {
    for (const sel of ung_vien) {
      const o = page.locator(sel).first();
      if (await o.isVisible().catch(() => false)) {
        await o.fill(gia_tri);
        return true;
      }
    }
    console.log(`   ! không thấy ô ${nhan}`);
    return false;
  };

  await dien(['#card_number', 'input[name="card_number"]', 'input[placeholder*="thẻ" i]'], THE.so, 'số thẻ');
  await dien(['#cardHolder', 'input[name="cardHolder"]', 'input[placeholder*="chủ thẻ" i]'], THE.ten, 'tên chủ thẻ');
  await dien(['#cardDate', 'input[name="cardDate"]', 'input[placeholder*="hiệu lực" i]', 'input[placeholder*="phát hành" i]'], THE.ngay, 'ngày phát hành');
  await ghi('da-dien-the');

  await page.locator('#btnContinue, button:has-text("Tiếp tục"), input[type=submit]').first()
    .click().catch(() => {});
  await page.waitForTimeout(4000);
  await ghi('sau-khi-gui-the');

  // Mot so phien ban co them buoc xac nhan thong tin truoc khi gui OTP
  const nut_tt = page.locator('#btnAgree, button:has-text("Thanh toán"), button:has-text("Đồng ý")').first();
  if (await nut_tt.isVisible().catch(() => false)) {
    await nut_tt.click().catch(() => {});
    await page.waitForTimeout(4000);
    await ghi('sau-xac-nhan');
  }
}

// ---------------------------------------------------------------- Buoc OTP
const o_otp = page.locator(
  'input[name*="otp" i], input[id*="otp" i], input[placeholder*="OTP" i], input[placeholder*="mã" i]',
).first();
if (await o_otp.isVisible({ timeout: 15000 }).catch(() => false)) {
  await o_otp.fill(THE.otp);
  await ghi('da-dien-otp');
  await page.locator('button[type=submit], button:has-text("Xác nhận"), button:has-text("Thanh Toán"), input[type=submit]')
    .first().click().catch(() => {});
  console.log('  → đã gửi OTP, chờ cổng xử lý...');
}

// ---------------------------------------------------------------- Ket qua
await page.waitForURL(/payment-result/, { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(4000);
await ghi('ket-qua');

const url = page.url();
console.log('\n  URL cuối:', url);
if (url.includes('payment-result') && url.includes('status=success')) {
  const ra = `doc/report-shots/user-payment-result-${CONG}.png`;
  await page.screenshot({ path: ra, fullPage: true });
  console.log(`\n  ✓ Đã lưu ${ra}`);
} else {
  console.log('  ! Chưa về được trang kết quả thành công — xem ảnh từng bước');
  await liet_ke_truong();
}

await browser.close();
console.log(`\nẢnh từng bước: ${BUOC}`);
