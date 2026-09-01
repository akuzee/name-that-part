/*
 * Smoke test: load every cataloged model in a headless browser and check
 * that (a) it loads without page errors, (b) every manifest part actually
 * exists in the built scene, (c) every quiz resolves to ≥2 targets, and
 * (d) no scene part is missing from the manifest.
 * Usage: node tools/audit.mjs   (server must be running on :8023)
 */
import puppeteer from 'puppeteer-core';
import { ensureServer } from './ensure-server.mjs';

await ensureServer();

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'shell',
  args: ['--window-size=1280,800', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));

const catalog = await (await fetch('http://localhost:8023/data/index.json')).json();
let failed = false;

for (const model of catalog.models) {
  errors.length = 0;
  await page.goto(`http://localhost:8023/#/explore/${model.id}`, { waitUntil: 'networkidle0' });
  try {
    await page.waitForFunction(
      () => window.__pg?.viewer?.root && document.getElementById('loading').hidden,
      { timeout: 20000 });
  } catch {
    console.log(`✗ ${model.id}: model never finished loading`);
    failed = true;
    continue;
  }
  const report = await page.evaluate(() => {
    const v = window.__pg.viewer;
    const manifest = window.__pg.current.manifest;
    const found = [...v.parts.keys()];
    const declared = Object.keys(manifest.parts || {});
    const layerIds = new Set((manifest.layers || []).map((l) => l.id));
    return {
      found,
      meshCount: v.meshes.length,
      missingFromScene: declared.filter((id) => !v.parts.has(id)),
      missingFromManifest: found.filter((id) => !manifest.parts?.[id]),
      badLayer: found.filter((id) => {
        const l = v.parts.get(id).layer;
        return l && !layerIds.has(l);
      }),
      quizzes: (manifest.quizzes || []).map((q) => {
        const parts = q.parts === 'all' || q.parts === undefined
          ? found.filter((id) => v.parts.get(id).quiz !== false)
          : Array.isArray(q.parts) ? q.parts.filter((id) => v.parts.has(id))
          : found.filter((id) => v.parts.get(id).layer === q.parts.layer);
        return { id: q.id, n: parts.length };
      }),
    };
  });
  const problems = [];
  if (errors.length) problems.push(`page errors: ${errors.join(' | ')}`);
  if (report.missingFromScene.length)
    problems.push(`manifest parts not in scene: ${report.missingFromScene.join(', ')}`);
  if (report.missingFromManifest.length)
    problems.push(`scene parts not in manifest: ${report.missingFromManifest.join(', ')}`);
  if (report.badLayer.length)
    problems.push(`parts with unknown layer: ${report.badLayer.join(', ')}`);
  for (const q of report.quizzes)
    if (q.n < 2) problems.push(`quiz "${q.id}" resolves to ${q.n} part(s)`);

  if (problems.length) {
    failed = true;
    console.log(`✗ ${model.id} (${report.found.length} parts, ${report.meshCount} meshes)`);
    for (const p of problems) console.log(`    ${p}`);
  } else {
    console.log(`✓ ${model.id}: ${report.found.length} parts, ${report.meshCount} meshes, ` +
      `quizzes: ${report.quizzes.map((q) => `${q.id}=${q.n}`).join(' ')}`);
  }
}

await browser.close();
process.exit(failed ? 1 : 0);
