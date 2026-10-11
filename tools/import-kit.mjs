/*
 * Turn a folder of downloaded model files into a playable pack.
 *
 *   node tools/import-kit.mjs inbox/animal-cell --id animal-cell \
 *     --title "Animal Cell" --license "CC BY 4.0" \
 *     --attribution "Animal cell model by PhilipTreml (printables.com/model/1144666)"
 *
 * Reads STL (binary or ASCII), 3MF and OBJ, and unpacks any .zip it finds.
 * Each file becomes one mesh; its part id comes from the filename (printable
 * kits name files after parts: Mitochondria.stl, Con-Rod.stl), or from rules
 * in data/models/<id>/import.json. All meshes are merged into one compressed
 * GLB with creased smooth normals baked in, and a manifest is written —
 * or, if one exists, merged into without touching curated names, layers,
 * colors or quizzes. Re-running is safe.
 *
 * import.json (optional, all keys optional; CLI flags win):
 *   { "rules": [ { "match": "^Latch Arm", "part": "latch-arm" },
 *                { "match": "master-geometry", "ignore": true } ],
 *     "default": "slug" | "ignore" | "<partId>",   // for files no rule matches
 *     "up": "z" | "y", "layout": "auto" | "assembled" | "tray", "smooth": 35 }
 *
 * Flags: --dry (report the file → part mapping only), --up, --layout, --smooth,
 *        --max-tris (per-mesh cap, default 80k), --no-catalog (don't list in the app).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { toCreasedNormals, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import { autoSlug, prettyName } from '../js/data.js';
import { packGlb } from './lib/glb.mjs';
import { READERS } from './lib/readers.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// ---------- args ----------
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const inDir = argv[0];
const id = flag('id');
if (!inDir || !id || inDir.startsWith('--')) {
  console.error('usage: node tools/import-kit.mjs <folder> --id <pack-id> ' +
    '[--title ..] [--license ..] [--attribution ..] [--up z|y] ' +
    '[--layout auto|assembled|tray] [--smooth deg] [--dry]');
  process.exit(1);
}
const dry = argv.includes('--dry');
const outDir = path.join(root, 'data/models', id);
const cfgPath = path.join(outDir, 'import.json');
const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, 'utf8')) : {};
const up = flag('up') ?? cfg.up ?? 'z';            // printable kits are Z-up
const layoutOpt = flag('layout') ?? cfg.layout ?? 'auto';
const smoothDeg = Number(flag('smooth') ?? cfg.smooth ?? 35);
// scanned or CAD-exported parts can run to millions of triangles; cap each
const maxTris = Number(flag('max-tris') ?? cfg.maxTris ?? 80000);

// ---------- collect files (unpacking zips) ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'import-kit-'));
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const ext = path.extname(e.name).toLowerCase();
    if (e.isDirectory()) walk(p);
    else if (ext === '.zip') {
      const dest = path.join(tmp, path.basename(e.name, ext));
      fs.mkdirSync(dest, { recursive: true });
      execFileSync('unzip', ['-q', '-o', p, '-d', dest]);
      walk(dest);
    } else if (['.stl', '.3mf', '.obj'].includes(ext)) files.push(p);
  }
})(path.resolve(inDir));
files.sort();
if (!files.length) { console.error(`no .stl/.3mf/.obj files under ${inDir}`); process.exit(1); }


// ---------- file → part id ----------
const rules = (cfg.rules || []).map((r) => ({ ...r, re: new RegExp(r.match, 'i') }));
const baseName = (f) => path.basename(f, path.extname(f));
const slugs = files.map((f) => autoSlug(baseName(f).replace(/^\d+[\s_-]*/, '')));
// kits often prefix every file with the kit name (Motor-Rotor, Motor-Fan…)
const first = slugs[0].split('-')[0];
const sharedPrefix = slugs.length > 2 && slugs.every((s) => s.startsWith(first + '-')) ? first + '-' : '';

const plan = files.map((file, i) => {
  const name = baseName(file);
  const rule = rules.find((r) => r.re.test(name));
  if (rule?.ignore) return { file, name, part: null, why: 'rule: ignore' };
  if (rule) return { file, name, part: rule.part, why: 'rule' };
  const dflt = cfg.default ?? 'slug';
  if (dflt === 'ignore') return { file, name, part: null, why: 'default: ignore' };
  if (dflt !== 'slug') return { file, name, part: dflt, why: 'default' };
  return { file, name, part: slugs[i].slice(sharedPrefix.length) || slugs[i], why: 'filename' };
});

const used = plan.filter((p) => p.part);
console.log(`${files.length} files → ${new Set(used.map((p) => p.part)).size} parts ` +
  `(${files.length - used.length} ignored)${sharedPrefix ? `, stripped prefix "${sharedPrefix}"` : ''}`);
const byPart = new Map();
for (const p of used) byPart.set(p.part, [...(byPart.get(p.part) || []), p.name]);
for (const [part, names] of [...byPart].sort()) {
  console.log(`  ${part.padEnd(30)} ×${String(names.length).padEnd(3)} ${names.slice(0, 3).join(', ')}${names.length > 3 ? ', …' : ''}`);
}
if (dry) process.exit(0);

// ---------- load + transform ----------
const scaleUp = up === 'z'
  ? (P) => { for (let i = 0; i < P.length; i += 3) { const y = P[i + 1]; P[i] *= 0.001; P[i + 1] = P[i + 2] * 0.001; P[i + 2] = -y * 0.001; } }
  : (P) => { for (let i = 0; i < P.length; i++) P[i] *= 0.001; };   // mm → m (Z-up → Y-up)
await MeshoptSimplifier.ready;
const meshes = [];
const seen = new Set();
let dupes = 0, simplified = 0;
for (const p of used) {
  const g = READERS[path.extname(p.file).toLowerCase()](p.file);
  const raw = Float32Array.from(g.pos);
  if (!raw.length) { console.warn(`  (empty mesh: ${p.name})`); continue; }
  // a re-exported copy of the same part (Hinge v17 / Hinge v17 (2)) collapses;
  // distinct parts that happen to share geometry are kept as separate targets
  const hash = p.part + ':' + createHash('md5').update(Buffer.from(raw.buffer)).digest('hex');
  if (seen.has(hash)) { dupes++; continue; }
  seen.add(hash);
  scaleUp(raw);

  // weld the soup (STL repeats every shared vertex), then cap triangle count
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(raw, 3));
  if (g.idx) geo.setIndex(Array.from(g.idx));
  geo = mergeVertices(geo, 1e-6);
  let pos = geo.attributes.position.array;
  let idx = Uint32Array.from(geo.index.array);
  if (idx.length / 3 > maxTris) {
    const [out] = MeshoptSimplifier.simplify(idx, Float32Array.from(pos), 3, maxTris * 3, 0.02);
    console.log(`  simplified ${p.name}: ${(idx.length / 3).toLocaleString()} → ${(out.length / 3).toLocaleString()} tris`);
    idx = out;
    simplified++;
  }
  const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position);
  meshes.push({ ...p, pos: Float32Array.from(pos), idx, box });
}
if (dupes) console.log(`  dropped ${dupes} exact-duplicate meshes`);

// ---------- layout ----------
// Print kits are often laid out on a bed or all centred at the origin, so
// parts pile on top of each other. Detect a pile and lay parts out on a tray.
let layout = layoutOpt;
if (layout === 'auto') {
  const centers = meshes.map((m) => m.box.getCenter(new THREE.Vector3()));
  const sizes = meshes.map((m) => m.box.getSize(new THREE.Vector3()).length());
  let close = 0, pairs = 0;
  for (let i = 0; i < meshes.length; i++) {
    for (let j = i + 1; j < meshes.length; j++) {
      pairs++;
      if (centers[i].distanceTo(centers[j]) < 0.15 * Math.max(sizes[i], sizes[j])) close++;
    }
  }
  layout = pairs && close / pairs > 0.3 ? 'tray' : 'assembled';
  console.log(`  layout: ${layout} (${pairs ? Math.round((100 * close) / pairs) : 0}% of part pairs co-located)`);
}
if (layout === 'tray') {
  const order = [...meshes].sort((a, b) =>
    a.part.localeCompare(b.part) || b.box.getSize(new THREE.Vector3()).length() - a.box.getSize(new THREE.Vector3()).length());
  const cell = Math.max(...meshes.map((m) => { const s = m.box.getSize(new THREE.Vector3()); return Math.max(s.x, s.z); })) * 1.25;
  const cols = Math.ceil(Math.sqrt(order.length));
  order.forEach((m, i) => {
    const c = m.box.getCenter(new THREE.Vector3());
    const dx = (i % cols) * cell - c.x, dz = Math.floor(i / cols) * cell - c.z, dy = -m.box.min.y;
    for (let k = 0; k < m.pos.length; k += 3) { m.pos[k] += dx; m.pos[k + 1] += dy; m.pos[k + 2] += dz; }
  });
}

// ---------- normals + merged OBJ ----------
fs.mkdirSync(outDir, { recursive: true });
const objPath = path.join(outDir, `${id}.obj`);
const lines = [`# ${id} — imported by tools/import-kit.mjs`];
let vBase = 0;
for (const m of meshes) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
  geo.setIndex(new THREE.BufferAttribute(m.idx, 1));
  const smooth = toCreasedNormals(geo, (smoothDeg * Math.PI) / 180);  // non-indexed out
  const P = smooth.attributes.position.array, N = smooth.attributes.normal.array;
  lines.push(`o ${m.part}`);
  for (let i = 0; i < P.length; i += 3) lines.push(`v ${P[i].toFixed(6)} ${P[i + 1].toFixed(6)} ${P[i + 2].toFixed(6)}`);
  for (let i = 0; i < N.length; i += 3) lines.push(`vn ${N[i].toFixed(4)} ${N[i + 1].toFixed(4)} ${N[i + 2].toFixed(4)}`);
  for (let i = 0; i < P.length / 3; i += 3) {
    const a = vBase + i + 1;
    lines.push(`f ${a}//${a} ${a + 1}//${a + 1} ${a + 2}//${a + 2}`);
  }
  vBase += P.length / 3;
}
fs.writeFileSync(objPath, lines.join('\n') + '\n');
const glbPath = path.join(outDir, `${id}.glb`);
packGlb(root, objPath, glbPath, meshes.map((m) => m.part));
fs.unlinkSync(objPath);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`  wrote data/models/${id}/${id}.glb (${(fs.statSync(glbPath).size / 1e6).toFixed(2)} MB, ${meshes.length} meshes)`);

// ---------- manifest (merge, never clobber curation) ----------
const manPath = path.join(outDir, 'manifest.json');
const prev = fs.existsSync(manPath) ? JSON.parse(fs.readFileSync(manPath, 'utf8')) : null;
const hueColor = (i) => '#' + new THREE.Color().setHSL(((i * 137.508) % 360) / 360, 0.42, 0.58).getHexString();
const parts = { ...(prev?.parts || {}) };
const partIds = [...new Set(meshes.map((m) => m.part))];
partIds.forEach((pid, i) => {
  if (!parts[pid]) parts[pid] = { name: prettyName(pid), layer: 'parts', color: hueColor(i) };
});
const stale = Object.keys(parts).filter((pid) => !partIds.includes(pid));
const manifest = {
  id,
  title: flag('title') ?? prev?.title ?? prettyName(id),
  blurb: prev?.blurb ?? '',
  attribution: flag('attribution') ?? prev?.attribution ?? 'CHANGE ME: author, source URL',
  license: flag('license') ?? prev?.license ?? 'CHANGE ME',
  source: { kind: 'gltf', file: `${id}.glb` },
  camera: prev?.camera ?? { theta: 0.7, phi: 1.15, zoom: 1 },
  layers: prev?.layers ?? [{ id: 'parts', name: 'Parts' }],
  parts,
  quizzes: prev?.quizzes ?? [{ id: 'all', title: 'Everything', parts: 'all' }],
};
fs.writeFileSync(manPath, JSON.stringify(manifest, null, 2));
console.log(`  ${prev ? 'updated' : 'wrote'} data/models/${id}/manifest.json (${partIds.length} parts)`);
if (stale.length) console.log(`  note: manifest parts with no mesh now: ${stale.join(', ')}`);

// ---------- catalog ----------
const catPath = path.join(root, 'data/index.json');
const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));
if (!argv.includes('--no-catalog') && !cat.models.some((m) => m.id === id)) {
  cat.models.push({ id, title: manifest.title, blurb: manifest.blurb, badge: manifest.license });
  fs.writeFileSync(catPath, JSON.stringify(cat, null, 2));
  console.log('  added to data/index.json');
}
