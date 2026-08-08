/** Render các sơ đồ (triển khai, cây thư mục, ERD) từ HTML thành PNG. */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SRC = process.env.SRC;
const OUT = 'doc/report-shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1700, height: 1200 }, deviceScaleFactor: 2.5 });
const page = await ctx.newPage();
await page.goto(pathToFileURL(SRC).href, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

for (const [sel, name] of [
  ['#deploy', 'diagram-deploy'],
  ['#tree-fe', 'diagram-tree-frontend'],
  ['#tree-be', 'diagram-tree-backend'],
  ['#erd', 'diagram-erd'],
]) {
  const el = await page.$(sel);
  if (!el) { console.log('  ! không thấy', sel); continue; }
  await el.screenshot({ path: `${OUT}/${name}.png` });
  const b = await el.boundingBox();
  console.log(`  ✓ ${name}  (${Math.round(b.width)}x${Math.round(b.height)})`);
}
await browser.close();
