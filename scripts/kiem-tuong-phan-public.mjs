/**
 * Kiem tuong phan chu tren cac mang ANH cua trang public (banner + khoi CTA).
 *
 * Lay MAU DIEM ANH ngay duoi tung dong chu, khong tin vao mau nen khai bao trong
 * CSS: nen o day la anh that phu nhieu lop chong nhau, doc `background-color` chi
 * ra `rgba(0,0,0,0)` — khong noi len duoc gi. Chu nam tren cho anh sang hay cho anh
 * toi la hai ket qua khac han, ma cho sang moi la cho truot chuan AA.
 *
 * Cach do: an chu di, chup lai vung do, roi lay mau tai 9 diem trai qua phai duoi
 * moi dong va giu cho TE NHAT. Giai ma anh bang canvas ngay trong trinh duyet nen
 * khong can them thu vien nao.
 *
 * Chay: node scripts/kiem-tuong-phan-public.mjs   (can dev server :3000)
 */
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const BE_RONG = [390, 768, 1440];

/** [ten khoi, bo chon khung, [bo chon chu, nhan, san tuong phan][]] */
const KHOI = [
  ['Banner anh', 'section.photo-tint', [
    ['.banner-title', 'Tieu de banner (chu lon)', 3.0],
    ['.banner-sub', 'Phu de banner', 4.5],
  ]],
  ['Khoi CTA cuoi trang', 'section.bg-paper .rounded-3xl', [
    ['h2', 'Tieu de CTA (chu lon)', 3.0],
    ['p', 'Doan phu CTA', 4.5],
    ['li', 'Y tran an CTA', 4.5],
  ]],
];

const TRANG = ['/pricing', '/features', '/contact', '/support', '/'];

const cong = { dat: 0, hong: 0 };
const loi = [];
const browser = await chromium.launch({ executablePath: EDGE, headless: true });

for (const duong of TRANG) {
  console.log(`\n########  ${duong}  ########`);
  for (const w of BE_RONG) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.goto(BASE + duong, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    for (const [tenKhoi, chonKhung, muc] of KHOI) {
      const khung = page.locator(chonKhung).last();
      if (await khung.count() === 0) continue;
      await khung.scrollIntoViewIfNeeded();
      await page.waitForTimeout(700);
      const hop = await khung.boundingBox();
      if (!hop || hop.height < 40) continue;

      const viTri = await page.evaluate(({ chonKhung, muc }) => {
        const ds = document.querySelectorAll(chonKhung);
        const k = ds[ds.length - 1];
        if (!k) return [];
        const kr = k.getBoundingClientRect();
        return muc.map(([chon, nhan, san]) => {
          const el = k.querySelector(chon);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return null;
          return { nhan, san, x: r.left - kr.left, y: r.top - kr.top, w: r.width, h: r.height };
        }).filter(Boolean);
      }, { chonKhung, muc });
      if (viTri.length === 0) continue;

      const che = muc.map(([c]) => `${chonKhung} ${c}`).join(',');
      await page.addStyleTag({ content: `${che}{visibility:hidden !important}` });
      await page.waitForTimeout(150);
      const anh = (await page.screenshot({
        clip: { x: hop.x, y: Math.max(0, hop.y), width: hop.width, height: Math.min(hop.height, 900) },
      })).toString('base64');
      await page.addStyleTag({ content: `${che}{visibility:visible !important}` });

      const ket = await page.evaluate(async ({ anh, viTri }) => {
        const im = new Image();
        im.src = 'data:image/png;base64,' + anh;
        await im.decode();
        const cv = document.createElement('canvas');
        cv.width = im.width; cv.height = im.height;
        const ctx = cv.getContext('2d');
        ctx.drawImage(im, 0, 0);

        const kenh = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
        const sang = (r, g, b) => 0.2126 * kenh(r) + 0.7152 * kenh(g) + 0.0722 * kenh(b);
        const tp = (a, b) => { const [x, y] = [sang(...a), sang(...b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
        const dpr = window.devicePixelRatio || 1;

        return viTri.map(({ nhan, san, x, y, w, h }) => {
          let te = null;
          for (let i = 0; i <= 8; i++) {
            const px = Math.round((x + (w * i) / 8) * dpr);
            const py = Math.round((y + h / 2) * dpr);
            if (px < 1 || py < 1 || px >= cv.width - 1 || py >= cv.height - 1) continue;
            const d = ctx.getImageData(px, py, 1, 1).data;
            const v = tp([255, 255, 255], [d[0], d[1], d[2]]);
            if (!te || v < te.v) te = { v, nen: [d[0], d[1], d[2]] };
          }
          return te ? { nhan, san, v: te.v, nen: te.nen } : null;
        }).filter(Boolean);
      }, { anh, viTri });

      for (const r of ket) {
        const ok = r.v >= r.san;
        cong[ok ? 'dat' : 'hong']++;
        if (!ok) loi.push(`${duong} @${w}px · ${tenKhoi} · ${r.nhan}: ${r.v.toFixed(2)}:1 < ${r.san}`);
        console.log(`  ${ok ? 'DAT ' : 'HONG'} [${String(w).padStart(4)}px] ${tenKhoi.padEnd(20)} ${r.nhan.padEnd(26)} ${r.v.toFixed(2)}:1 (san ${r.san})`);
      }
    }
    await page.close();
  }
}

await browser.close();
console.log(`\nTONG: ${cong.dat} dat · ${cong.hong} hong`);
if (loi.length) {
  console.log('\nCHO TRUOT:');
  loi.forEach((l) => console.log('  · ' + l));
}
process.exit(cong.hong > 0 ? 1 : 0);
