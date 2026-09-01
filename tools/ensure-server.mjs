/* Ensure the static server is up on :8023 — spawn it detached if not. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function ensureServer(port = 8023) {
  const url = `http://localhost:${port}/data/index.json`;
  try {
    const res = await fetch(url);
    if (res.ok) return;
  } catch { /* not running */ }
  const serve = path.join(path.dirname(fileURLToPath(import.meta.url)), 'serve.mjs');
  const child = spawn('node', [serve, String(port)], { detached: true, stdio: 'ignore' });
  child.unref();
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 150));
    try {
      if ((await fetch(url)).ok) return;
    } catch { /* retry */ }
  }
  throw new Error(`server did not come up on :${port}`);
}
