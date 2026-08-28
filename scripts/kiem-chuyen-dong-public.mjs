/**
 * KIỂM CHUYỂN ĐỘNG có nghĩa trên trang public — không phải đếm xem có bao nhiêu hiệu ứng.
 *
 * `do-hieu-ung-public.mjs` trả lời câu "bao nhiêu phần tử đang động". Bài này trả lời
 * câu khó hơn và đáng hơn: chuyển động đó CÓ NÓI GÌ KHÔNG, và nó có biết im lặng đúng
 * lúc không. Cả hai đều phải đo trong trình duyệt, vì cùng một lỗi kiểu "class vẫn nằm
 * trên DOM nhưng không làm gì cả" đã bắt được hai lần ở dự án này.
 *
 * Ba loại bẫy bài này canh:
 *
 *  1. Hiệu ứng CHẾT LẶNG — lớp còn đó, animation bị ghi đè mất. Nên chỗ nào cũng đọc
 *     `getComputedStyle` chứ không kiểm tra tên lớp.
 *
 *  2. Vá trợ năng CHỈ NHÌN THÌ CÓ — `.troi-le` chạy theo timeline cuộn, mà animation
 *     theo timeline thì BỎ QUA thời lượng. Luật gộp `animation-duration: 0.001ms` ở
 *     cuối globals.css không dừng nó được. Nên phải mở hẳn một ngữ cảnh
 *     `reducedMotion: 'reduce'` và đo lại.
 *
 *  3. Vòng lặp vô hạn KHÔNG BIẾT DỪNG — khung POS diễn hoạt phải đứng im khi cuộn ra
 *     khỏi màn hình. Đo bằng cách xem lời thuyết minh có đổi câu nữa không.
 *
 * Chạy: node scripts/kiem-chuyen-dong-public.mjs   (cần dev server ở :3000)
 */
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.BASE ?? 'http://localhost:3000';

const cong = { dat: 0, hong: 0 };
const ok = (dieuKien, chu, them = '') => {
  cong[dieuKien ? 'dat' : 'hong']++;
  console.log(`  ${dieuKien ? 'DAT ' : 'HONG'}  ${chu}${them ? ' — ' + them : ''}`);
};

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
/**
 * Hạn 30 giây mặc định của Playwright KHÔNG đủ cho lượt điều hướng đầu tiên sau khi
 * server dev vừa khởi động lại: Next biên dịch nguội từng tuyến, riêng /features mất
 * hơn 30 giây. Hết giờ ở đó chẳng nói lên điều gì về chuyển động cả, chỉ làm bài kiểm
 * chập chờn — mà một bài kiểm chập chờn thì sớm muộn cũng bị bỏ qua.
 */
const HAN_DIEU_HUONG = 120_000;

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
ctx.setDefaultNavigationTimeout(HAN_DIEU_HUONG);

/** Lời thuyết minh dưới khung POS — dấu hiệu duy nhất đọc được là kịch bản đang chạy. */
const loiThuyetMinh = (page) => page.locator('figure figcaption span').last().textContent();
const khungPos = (page) =>
  page.locator('figure:has([role="img"][aria-label*="Bán hàng"])').first();

// ============ 1. Mục lục dính ở /features biết đang đọc chương nào ============
{
  console.log('\n/features — muc luc dinh theo doi chuong dang doc');
  const page = await ctx.newPage();
  await page.goto(BASE + '/features', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  for (const id of ['thuc-don', 'thanh-toan', 'doanh-thu']) {
    await page.evaluate((x) => document.getElementById(x)?.scrollIntoView(), id);
    await page.waitForTimeout(900);
    const danh = await page.$$eval('#muc-luc-chuong a[data-dang-xem="true"]', (as) =>
      as.map((a) => a.getAttribute('href')),
    );
    // Đúng MỘT chip: nhiều chương cùng cắt qua dải nhận diện là dấu hiệu dải đặt sai.
    ok(danh.length === 1, `cuon toi #${id}: dung MOT chip duoc danh dau`, `thay ${danh.length}`);
    ok(danh[0] === '#' + id, `chip duoc danh dau tro dung #${id}`, `thay ${danh[0]}`);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);
  const con = await page.$$eval('#muc-luc-chuong a[data-dang-xem="true"]', (as) => as.length);
  ok(con === 0, 've dau trang thi khong chip nao sang', `con ${con}`);
  await page.close();
}

// ============ 2. Giá lăn số khi đổi thời hạn ============
{
  console.log('\n/pricing — gia chay khi doi thoi han (khong nhay phut)');
  const page = await ctx.newPage();
  await page.goto(BASE + '/pricing', { waitUntil: 'domcontentloaded' });
  // Mỗi gói phải gọi riêng một lượt lấy mốc thời hạn, gọi tuần tự; máy chủ miễn phí
  // vừa ngủ dậy thì cả ba lượt cộng lại có thể hơn 10 giây. Chờ tới khi giá thật hiện
  // chứ đừng đoán bằng một con số cố định.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.lift .text-4xl')].every(
        (e) => (e.textContent || '').trim().length > 0,
      ),
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(600);

  const oGia = '.lift .text-4xl';
  const docGia = async () => (await page.$$eval(oGia, (e) => e.map((x) => x.textContent)))[2];

  const truoc = await docGia();
  await page.click('button:has-text("12 tháng")');
  await page.waitForTimeout(140);
  const giua = await docGia();
  await page.waitForTimeout(1200);
  const sau = await docGia();

  ok(truoc !== sau, 'gia doi khi chon 12 thang', `${truoc} -> ${sau}`);
  // Khung hình trung gian mới là bằng chứng con số ĐANG ĐẾM. Thiếu nó thì `SoDemLen`
  // vẫn hiện đúng giá cuối, chỉ là nó nhảy phụp — đúng thứ vừa đi sửa.
  ok(
    giua !== truoc && giua !== sau,
    'co khung hinh TRUNG GIAN (that su dang dem)',
    `giua = ${giua}`,
  );

  const moiNgay = await page.$$eval('.lift p.text-sm.font-medium', (e) =>
    e.map((x) => x.textContent),
  );
  ok(
    moiNgay.some((t) => t && t.includes('đ/ngày')),
    'don gia moi ngay van dung dinh dang',
    moiNgay.filter(Boolean).join(' | '),
  );
  await page.close();
}

// ============ 3. Ngăn kéo menu di động trượt, không hiện phụp ============
{
  console.log('\n/ [390px] — ngan keo menu truot');
  const ctxDi = await browser.newContext({ viewport: { width: 390, height: 844 } });
  ctxDi.setDefaultNavigationTimeout(HAN_DIEU_HUONG);
  const page = await ctxDi.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const doMo = () => page.$eval('#mobile-nav', (el) => Number(getComputedStyle(el).opacity));
  const thoiLuong = await page.$eval('#mobile-nav', (el) =>
    getComputedStyle(el).transitionDuration,
  );
  ok(parseFloat(thoiLuong) > 0, 'ngan keo co khai thoi luong chuyen tiep', thoiLuong);
  ok((await doMo()) === 0, 'dong thi trong suot hoan toan');

  for (let t = 0; t < 5; t++) {
    await page.click('button[aria-controls="mobile-nav"]');
    await page.waitForTimeout(90);
    if ((await doMo()) > 0) break;
    await page.waitForTimeout(500);
  }
  const giua = await doMo();
  ok(giua > 0 && giua < 1, 'bat duoc khung hinh DANG TRUOT VAO', `opacity = ${giua.toFixed(2)}`);
  await page.waitForTimeout(500);
  ok((await doMo()) === 1, 'mo xong thi hien hoan toan');
  await ctxDi.close();
}

// ============ 4. Trôi lệch nhịp chạy theo cuộn, không theo đồng hồ ============
{
  console.log('\n/ — troi lech nhip (animation-timeline: view)');
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const kq = await page.$$eval('.troi-le', (els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return { ten: s.animationName, timeline: s.animationTimeline };
    }),
  );
  ok(kq.length >= 2, 'co phan tu mang lop .troi-le', `${kq.length} phan tu`);
  ok(
    kq.length > 0 && kq.every((k) => k.ten === 'funcafe-troi-le'),
    'animation duoc gan that, khong chi co ten lop',
    JSON.stringify(kq[0]),
  );
  ok(
    kq.length > 0 && kq.every((k) => k.timeline && k.timeline !== 'auto'),
    'chay theo timeline cuon chu khong theo dong ho',
    kq[0]?.timeline,
  );
  await page.close();
}

// ============ 5. Khung POS dừng khi không ai nhìn ============
{
  console.log('\n/ — khung POS dung khi cuon ra ngoai man hinh');
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await khungPos(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const a1 = await loiThuyetMinh(page);
  await page.waitForTimeout(2600);
  const a2 = await loiThuyetMinh(page);
  ok(a1 !== a2, 'trong tam nhin thi kich ban CHAY', `${a1} -> ${a2}`);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
  const b1 = await loiThuyetMinh(page);
  await page.waitForTimeout(2600);
  const b2 = await loiThuyetMinh(page);
  ok(b1 === b2, 'ra ngoai man hinh thi DUNG han', b1 === b2 ? b1 : `${b1} -> ${b2}`);
  await page.close();
}

// ============ 6. Tôn trọng "giảm chuyển động" của hệ điều hành ============
{
  console.log('\n/ — prefers-reduced-motion');
  const ctxIt = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  ctxIt.setDefaultNavigationTimeout(HAN_DIEU_HUONG);
  const page = await ctxIt.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await khungPos(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);

  const c1 = await loiThuyetMinh(page);
  await page.waitForTimeout(3000);
  const c2 = await loiThuyetMinh(page);
  ok(c1 === c2, 'khung POS dung yen hoan toan', c1 || '(rong)');
  // Đứng ở khung đầy đủ nhất, không phải khung rỗng: người bật giảm chuyển động vẫn
  // phải THẤY ĐƯỢC sản phẩm, chứ không nhận một phiếu order trống trơn.
  ok((c1 || '').includes('Trà đào'), 'dung o khung day du nhat (du ca hai mon)', c1 || '(rong)');

  const tl = await page.$$eval('.troi-le', (els) =>
    els.map((el) => getComputedStyle(el).animationName),
  );
  ok(tl.every((n) => n === 'none'), 'troi lech nhip bi tat han', tl.join(',') || '(khong co)');
  await ctxIt.close();
}

await browser.close();
console.log(`\nTONG: ${cong.dat} dat · ${cong.hong} hong`);
process.exit(cong.hong ? 1 : 0);
