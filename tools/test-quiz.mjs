/*
 * End-to-end quiz-flow test: plays a full round of a quiz headlessly.
 * Answers each prompt (a few deliberately wrong to exercise the miss/reveal
 * path), then checks the end panel and score math. Also sanity-checks that
 * raycast picking can actually hit prompted parts from screen coordinates.
 * Usage: node tools/test-quiz.mjs [model quizId]   (server on :8023)
 */
import puppeteer from 'puppeteer-core';
import { ensureServer } from './ensure-server.mjs';

await ensureServer();

const model = process.argv[2] || 'house';
const quizId = process.argv[3] || 'framing';

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'shell',
  args: ['--window-size=1280,800', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));

await page.goto(`http://localhost:8023/#/play/${model}/${quizId}`, { waitUntil: 'networkidle0' });
await page.waitForFunction(
  () => window.__pg?.viewer?.root && document.getElementById('loading').hidden
    && !document.getElementById('prompt').hidden,
  { timeout: 20000 });

const result = await page.evaluate(async () => {
  const v = window.__pg.viewer;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const promptName = () => document.getElementById('prompt-name').textContent;
  const nameToId = new Map([...v.parts.values()].map((p) => [p.name, p.id]));
  const fakeEv = { clientX: 640, clientY: 400 };

  let raycastHits = 0, raycastTries = 0;
  let wrongsInjected = 0, prompts = 0;

  for (let guard = 0; guard < 200; guard++) {
    if (!document.getElementById('end-panel').hidden) break;
    const want = nameToId.get(promptName());
    if (!want) break;
    prompts++;

    // raycast sanity: can screen-space picking hit this part's center?
    const pos = v.screenPos(want);
    if (pos) {
      raycastTries++;
      if (v.pick({ clientX: pos.x, clientY: pos.y }) === want) raycastHits++;
    }

    // every 4th prompt: burn all 3 tries on a wrong part → reveal path
    // (the wrong part must be an unsolved member of the current round —
    //  clicks on parts outside the round are context, not wrong answers)
    if (prompts % 4 === 0) {
      const eng = window.__pg.engine;
      const wrong = eng.order.find((id) => id !== want && !eng.results.has(id));
      if (!wrong) { v.onPick(want, fakeEv); await sleep(30); continue; }
      wrongsInjected++;
      for (let k = 0; k < 3; k++) { v.onPick(wrong, fakeEv); await sleep(30); }
      // reveal now waits for an acknowledgment click on the revealed part
      if (!v.revealTarget || v.revealTarget !== want) return { bug: 'reveal not armed for ' + want };
      if (!v.parts.get(want).pickable) return { bug: 'revealed part not pickable: ' + want };
      v.onPick(want, fakeEv);
      await sleep(30);
      if (v.revealTarget) return { bug: 'reveal did not clear after ack click' };
    } else {
      v.onPick(want, fakeEv);
      await sleep(30);
    }
  }
  await sleep(200);
  return {
    prompts,
    wrongsInjected,
    raycastHits,
    raycastTries,
    ended: !document.getElementById('end-panel').hidden,
    endScore: document.getElementById('end-score').textContent,
    endBreakdown: document.getElementById('end-breakdown').textContent,
    missedChips: document.querySelectorAll('#missed-list .chip').length,
    retryVisible: !document.getElementById('btn-retry-missed').hidden,
  };
});

console.log(`${model}/${quizId}:`, JSON.stringify(result, null, 2));
const ok = result.ended && result.missedChips === result.wrongsInjected && errors.length === 0;
if (errors.length) console.log('page errors:', errors);
console.log(ok ? '✓ quiz flow OK' : '✗ quiz flow FAILED');
console.log(`  raycast pick from part centers: ${result.raycastHits}/${result.raycastTries} ` +
  '(low is expected for buried parts; 0 would mean picking is broken)');
await browser.close();
process.exit(ok ? 0 : 1);
