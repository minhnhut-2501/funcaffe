/**
 * Kiem nut "Hoi thu ngay" o khoi AI trang chu.
 *
 * Ba thu can chac, va ca ba deu tung la cho de hong:
 *   1. Bam nut thi hop chat MO ra (su kien cua so toi duoc widget o layout goc)
 *   2. Cau hoi dat san duoc GUI DI, khong phai chi mo hop roi de trong
 *   3. Chi co DUNG MOT hop chat tren trang — widget gan o hai noi doc lap
 *      (AiChatMount cho trang cong khai, UserLayout cho khu quan ly) nen loi
 *      "hai hop chong nhau" la loi that su co the xay ra.
 *
 * Chay: node scripts/kiem-nut-hoi-thu.mjs   (can dev server :3000 va backend :8000)
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => {});

console.log('\n1) Chi co dung mot hop chat tren trang');
ok(await page.locator('button[aria-label="Mở trợ lý AI"]').count() === 1,
  'Dung 1 nut noi', `dem duoc ${await page.locator('button[aria-label="Mở trợ lý AI"]').count()}`);

console.log('\n2) Nut "Hoi thu ngay" o khoi AI');
const nut = page.getByRole('button', { name: /Hỏi thử ngay/ });
await nut.scrollIntoViewIfNeeded();
await page.waitForTimeout(600);
ok(await nut.count() === 1, 'Tim thay nut');

// Bam lai cho toi khi panel mo: Next gan su kien sau khi hydrate xong.
const panel = page.getByRole('dialog');
let moDuoc = false;
for (let lan = 1; lan <= 6 && !moDuoc; lan++) {
  await nut.click();
  moDuoc = await panel.isVisible().catch(() => false)
    || await panel.waitFor({ state: 'visible', timeout: 2500 }).then(() => true).catch(() => false);
}
ok(moDuoc, 'Bam nut thi hop chat mo ra');

if (moDuoc) {
  console.log('\n3) Cau hoi dat san co duoc gui di khong');
  // Bong bong cua NGUOI DUNG (nen xanh, bo goc phai) phai xuat hien ngay.
  const cuaToi = panel.locator('.bg-bean.rounded-br-sm');
  const hienCauHoi = await cuaToi.first().waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true).catch(() => false);
  ok(hienCauHoi, 'Cau hoi dat san da duoc gui');
  if (hienCauHoi) console.log(`        "${(await cuaToi.first().innerText()).trim()}"`);

  // Va co cau tra loi chay ve
  const bong = panel.locator('.bg-sand.rounded-bl-sm').last();
  let chu = '';
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(500);
    const t = (await bong.count()) ? (await bong.innerText()).trim() : '';
    if (t && t === chu && t.length > 60) break;
    chu = t;
  }
  ok(chu.length > 60, 'Co cau tra loi', `${chu.length} ky tu`);
  ok(!chu.startsWith('⚠️'), 'Khong phai thong bao loi');
  console.log('\n--- CAU TRA LOI ---');
  console.log(chu.slice(0, 320));
  console.log('-------------------');
}

await browser.close();
console.log(`\nTONG: ${cong.dat} dat · ${cong.hong} hong`);
process.exit(cong.hong > 0 ? 1 : 0);
