/**
 * Bốn bước ở trang chủ phải nằm trên MỘT hàng từ 1024px trở lên, và đường nối phải
 * chạy GIỮA các bước chứ không chiếm một ô lưới.
 *
 * Lỗi từng có: `.duong-noi { position: relative }` trong globals.css ghi đè lớp
 * `absolute` của Tailwind (cùng độ ưu tiên, khai báo sau thắng). Mất `absolute` thì
 * thẻ đường kẻ thôi làm lớp phủ và quay về làm một ô lưới bình thường — nó ăn ô số 1,
 * đẩy bước 4 xuống hàng dưới, và để lại một vạch lửng bên trái bước 1.
 *
 * Đo bằng TỌA ĐỘ THẬT chứ không đọc CSS: chỉ có tọa độ mới nói được "bốn cái này có
 * cùng nằm trên một hàng không".
 *
 *   BASE=http://localhost:3100 node scripts/kiem-luoi-4-buoc.mjs
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://localhost:3000';
const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

let dat = 0;
let hong = 0;

function kiem(ten, dung, chiTiet = '') {
  if (dung) {
    dat += 1;
    console.log(`  OK   ${ten}`);
  } else {
    hong += 1;
    console.log(`  HONG ${ten}${chiTiet ? ` -> ${chiTiet}` : ''}`);
  }
}

const trinhDuyet = await chromium.launch({ executablePath: EDGE });

try {
  for (const rong of [1440, 1280, 1024]) {
    const trang = await trinhDuyet.newPage({ viewport: { width: rong, height: 900 } });
    await trang.goto(`${BASE}/`, { waitUntil: 'networkidle' });

    const so = await trang.evaluate(() => {
      const tieuDe = [...document.querySelectorAll('h2')].find((h) => h.textContent?.includes('4 bước'));
      const luoi = tieuDe?.closest('div')?.parentElement?.querySelector('.relative.grid');
      if (!luoi) return null;
      const cot = getComputedStyle(luoi).gridTemplateColumns.split(' ').length;
      const buoc = [...luoi.children]
        .filter((el) => !el.classList.contains('duong-noi'))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { top: Math.round(r.top), left: Math.round(r.left) };
        });
      const ke = luoi.querySelector('.duong-noi');
      return {
        cot,
        buoc,
        keViTri: ke ? getComputedStyle(ke).position : null,
        keTrai: ke ? Math.round(ke.getBoundingClientRect().left) : null,
      };
    });

    console.log(`\n[${rong}px]`);
    if (!so) {
      kiem('tim thay khoi 4 buoc', false);
      await trang.close();
      continue;
    }

    kiem('luoi co 4 cot', so.cot === 4, `dang ${so.cot} cot`);
    kiem('dung 4 buoc', so.buoc.length === 4, `dem duoc ${so.buoc.length}`);

    const dongTren = new Set(so.buoc.map((b) => b.top));
    kiem('ca 4 buoc tren MOT hang', dongTren.size === 1, `co ${dongTren.size} hang: ${[...dongTren].join(', ')}`);

    kiem('duong ke van la lop phu', so.keViTri === 'absolute', `position: ${so.keViTri}`);

    // Đường kẻ đặt left-[12.5%] right-[12.5%] nên nó phải bắt đầu SAU mép trái của
    // bước 1 — nằm giữa các bước, không thò ra ngoài bên trái.
    const traiBuoc1 = Math.min(...so.buoc.map((b) => b.left));
    kiem('duong ke nam trong long luoi', so.keTrai !== null && so.keTrai >= traiBuoc1 - 1,
      `ke o ${so.keTrai}px, buoc dau o ${traiBuoc1}px`);

    await trang.close();
  }
} finally {
  await trinhDuyet.close();
}

console.log(`\n=== ${dat} dat / ${hong} hong ===`);
process.exit(hong ? 1 : 0);
