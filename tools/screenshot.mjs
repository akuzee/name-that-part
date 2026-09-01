/*
 * Headless visual smoke test: screenshot any route, dump console errors.
 * Usage: node tools/screenshot.mjs "#/explore/house" out.png [--click x,y]
 */
import puppeteer from 'puppeteer-core';
import { ensureServer } from './ensure-server.mjs';

await ensureServer();

const route = process.argv[2] || '#/';
const out = process.argv[3] || 'shot.png';
const clickArg = process.argv.indexOf('--click');
const clicks = [];
for (let i = clickArg; i > 0 && i < process.argv.length - 1; i += 2) {
  if (process.argv[i] !== '--click') break;
  const [x, y] = process.argv[i + 1].split(',').map(Number);
  clicks.push([x, y]);
}

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'shell',
  args: ['--window-size=1280,800', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') console.log(`[${msg.type()}]`, msg.text());
});
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto('http://localhost:8023/' + route, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction(
  () => document.getElementById('loading')?.hidden !== false, { timeout: 30000 });
await new Promise((r) => setTimeout(r, 1200)); // let a few frames render
for (const [x, y] of clicks) {
  await page.mouse.click(x, y);
  await new Promise((r) => setTimeout(r, 700));
}
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
