/*
 * Build anatomy packs from BodyParts3D 4.0 (CC BY 4.0).
 *
 * Source: https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/
 *         isa_BP3D_4.0_obj_99.zip  (account-free; 2,234 named structures)
 *
 * Each structure's English name lives in a "# English name :" comment in its
 * OBJ, so matching needs no side-car metadata. Structures are bucketed into
 * concept-level parts by the regex table in anatomy-packs.mjs, concatenated
 * into one OBJ per pack (each part an `o <partId>` object), then compressed by
 * gltfpack into a single GLB per pack — one request instead of hundreds, and
 * ~20x smaller than the raw STL sets it replaces.
 *
 * Usage:
 *   node tools/build-anatomy.mjs --dry [pack…]   # report matches only
 *   node tools/build-anatomy.mjs [pack…]         # build GLBs + manifests
 *
 * Options: --keep-obj (leave the intermediate .obj for inspection)
 *          --ratio=0.5 (simplification target; default 1 = no decimation,
 *                       gltfpack still reindexes and quantizes)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PACKS } from './anatomy-packs.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC_DIR = path.join(root, 'data/bp3d4/obj');
const ATTRIB = 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.';
const LICENSE = 'CC BY 4.0';

const argv = process.argv.slice(2);
const dry = argv.includes('--dry');
const keepObj = argv.includes('--keep-obj');
const ratioArg = argv.find((a) => a.startsWith('--ratio='));
const ratio = ratioArg ? Number(ratioArg.split('=')[1]) : 1;
const wanted = argv.filter((a) => !a.startsWith('--'));

if (!fs.existsSync(SRC_DIR)) {
  console.error(`missing ${SRC_DIR}\n` +
    'Fetch and extract the source first:\n' +
    '  curl -L -o data/bp3d4/isa.zip \\\n' +
    '    https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip\n' +
    '  unzip -q data/bp3d4/isa.zip -d data/bp3d4/obj');
  process.exit(1);
}

// ---------- index the source: file → English name ----------
console.log('indexing source OBJs…');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.obj')) files.push(p);
  }
})(SRC_DIR);

// The IS-A and PART-OF archives cover the same body from two hierarchies, so
// most structures appear in both — same File ID, but a different Representation
// ID in each, which makes File ID the cross-archive key. A few structures are
// also meshed more than once under one File ID, so identical geometry is
// dropped by content hash as well. (Same-name meshes whose geometry genuinely
// differs are kept: they are distinct branches that map to one quiz part.)
const structures = []; // {file, name, obj()}
const seenFile = new Set();
const seenGeom = new Set();
let dupFile = 0, dupGeom = 0;
for (const file of files.sort()) {
  const txt = fs.readFileSync(file, 'utf8');
  const m = txt.match(/^# English name\s*:\s*(.+)$/m);
  const name = (m ? m[1] : '').trim();
  if (!name || name.startsWith('#')) continue;   // guard against malformed headers
  const fileId = path.basename(file, '.obj');
  if (seenFile.has(fileId)) { dupFile++; continue; }
  const verts = txt.match(/^v .*$/gm);
  if (!verts?.length) continue;
  const hash = createHash('md5').update(verts.join('\n')).digest('hex');
  if (seenGeom.has(hash)) { dupGeom++; continue; }
  seenFile.add(fileId);
  seenGeom.add(hash);
  structures.push({ file, name, text: txt });
}
console.log(`  ${structures.length} unique structures from 4.0 ` +
  `(${dupFile} cross-archive + ${dupGeom} identical-geometry duplicates skipped)`);

// BodyParts3D 3.0 (the STL cache) still carries structures 4.0 dropped —
// whole lungs and liver, and several major muscles. Index it as a fallback,
// keyed by name, so a pack only reaches for 3.0 where 4.0 has no match.
const LEGACY_DIR = path.join(root, 'data/bp3d');
const legacy = new Map(); // lowercased name → {file, name}
if (fs.existsSync(LEGACY_DIR)) {
  const namesTxt = path.join(root, 'data/bp3d/parts_list_e.txt');
  let legacyNames = new Map();
  if (fs.existsSync(namesTxt)) {
    for (const line of fs.readFileSync(namesTxt, 'utf8').split('\n')) {
      const [id, en] = line.trim().split('\t');
      if (id?.startsWith('FMA') && en) legacyNames.set(id.replace(/"/g, ''), en);
    }
  }
  const have = new Set(structures.map((s) => s.name.toLowerCase()));
  for (const f of fs.readdirSync(LEGACY_DIR)) {
    if (!f.endsWith('.stl')) continue;
    const name = legacyNames.get(path.basename(f, '.stl'));
    if (!name || have.has(name.toLowerCase())) continue;
    legacy.set(name.toLowerCase(), { file: path.join(LEGACY_DIR, f), name, stl: true });
  }
  console.log(`  ${legacy.size} extra structures available from the 3.0 cache`);
}
console.log();

/* gltfpack's compression flags strip node names, but they preserve node order
 * exactly (verified against a fixture with distinct per-object triangle
 * counts). So write the part ids back onto the mesh-bearing nodes in order,
 * refusing to guess if the counts don't line up. */
function restoreNodeNames(glbPath, names) {
  const buf = fs.readFileSync(glbPath);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLen = buf.readUInt32LE(12);
  if (buf.readUInt32LE(16) !== 0x4e4f534a) throw new Error('first chunk is not JSON');
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const rest = buf.subarray(20 + jsonLen);

  const meshNodes = (gltf.nodes || []).filter((n) => n.mesh !== undefined);
  if (meshNodes.length !== names.length) {
    throw new Error(`node/name mismatch in ${path.basename(glbPath)}: ` +
      `${meshNodes.length} mesh nodes vs ${names.length} parts`);
  }
  meshNodes.forEach((n, i) => { n.name = names[i]; });

  let json = Buffer.from(JSON.stringify(gltf), 'utf8');
  if (json.length % 4) json = Buffer.concat([json, Buffer.alloc(4 - (json.length % 4), 0x20)]);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);                     // magic
  head.writeUInt32LE(2, 4);                              // version
  head.writeUInt32LE(20 + json.length + rest.length, 8); // total length
  head.writeUInt32LE(json.length, 12);                   // JSON chunk length
  head.writeUInt32LE(0x4e4f534a, 16);                    // 'JSON'
  fs.writeFileSync(glbPath, Buffer.concat([head, json, rest]));
}

/* Binary STL → OBJ text (mm/Z-up in, same convention as the 4.0 OBJs). */
function stlToObj(file) {
  const buf = fs.readFileSync(file);
  const count = buf.readUInt32LE(80);
  const v = [], vn = [], f = [];
  for (let i = 0; i < count; i++) {
    const o = 84 + i * 50;
    const nx = buf.readFloatLE(o), ny = buf.readFloatLE(o + 4), nz = buf.readFloatLE(o + 8);
    vn.push(`vn ${nx.toFixed(5)} ${nz.toFixed(5)} ${(-ny).toFixed(5)}`);
    const base = i * 3 + 1;
    for (let k = 0; k < 3; k++) {
      const p = o + 12 + k * 12;
      v.push(`v ${(buf.readFloatLE(p) * 0.001).toFixed(5)} ` +
             `${(buf.readFloatLE(p + 8) * 0.001).toFixed(5)} ` +
             `${(-buf.readFloatLE(p + 4) * 0.001).toFixed(5)}`);
    }
    f.push(`f ${base}//${i + 1} ${base + 1}//${i + 1} ${base + 2}//${i + 1}`);
  }
  return v.join('\n') + '\n' + vn.join('\n') + '\n' + f.join('\n') + '\n';
}

const packIds = wanted.length ? wanted : Object.keys(PACKS);
for (const id of packIds) {
  if (!PACKS[id]) { console.error(`unknown pack "${id}"`); process.exit(1); }
}

for (const packId of packIds) {
  const pack = PACKS[packId];
  console.log(`===== ${packId} =====`);
  const parts = {};
  const claimed = new Set();
  const misses = [];
  const chosen = []; // {partId, file}

  for (const [partId, name, layer, regexStr, opts = {}] of pack.parts) {
    const re = new RegExp(`^(${regexStr})$`);
    let hits = structures.filter((s) => !claimed.has(s.file) && re.test(s.name.toLowerCase()));
    let from = '4.0';
    if (!hits.length) {   // fall back to the 3.0 cache for structures 4.0 dropped
      hits = [...legacy.values()].filter((s) => !claimed.has(s.file) && re.test(s.name.toLowerCase()));
      from = '3.0';
    }
    if (!hits.length) { misses.push(partId); continue; }
    for (const h of hits) { claimed.add(h.file); chosen.push({ partId, ...h }); }
    parts[partId] = {
      name, layer,
      ...(opts.color ? { color: opts.color } : {}),
      ...(opts.quiz === false ? { quiz: false } : {}),
    };
    console.log(`  ${partId.padEnd(26)} ×${String(hits.length).padEnd(3)} ${from}`);
  }
  if (misses.length) console.log(`  NO MATCHES: ${misses.join(', ')}`);
  console.log(`  → ${chosen.length} structures, ${Object.keys(parts).length} parts`);
  if (dry) { console.log(); continue; }

  // ---------- merge into one OBJ, each part an `o <partId>` object ----------
  const dir = path.join(root, 'data/models', packId);
  fs.mkdirSync(dir, { recursive: true });
  const objPath = path.join(dir, `${packId}.obj`);
  const out = fs.createWriteStream(objPath);
  const write = (s) => new Promise((r) => (out.write(s) ? r() : out.once('drain', r)));
  await write(`# ${pack.title} — built from BodyParts3D 4.0\n# ${ATTRIB}\n`);

  let vBase = 0, vnBase = 0;
  for (const struct of chosen) {
    await write(`o ${struct.partId}\n`);
    // 3.0 STLs arrive already in final coordinates; 4.0 OBJs are raw mm/Z-up
    const text = struct.stl ? stlToObj(struct.file) : struct.text;
    const transform = !struct.stl;
    let nv = 0, nvn = 0;
    const body = [];
    for (const line of text.split('\n')) {
      if (line.startsWith('v ')) {
        const [x, y, z] = line.slice(2).trim().split(/\s+/).map(Number);
        // mm/Z-up → m/Y-up, matching the source's stated convention
        body.push(transform
          ? `v ${(x * 0.001).toFixed(5)} ${(z * 0.001).toFixed(5)} ${(-y * 0.001).toFixed(5)}`
          : line);
        nv++;
      } else if (line.startsWith('vn ')) {
        const [x, y, z] = line.slice(3).trim().split(/\s+/).map(Number);
        body.push(transform ? `vn ${x.toFixed(5)} ${z.toFixed(5)} ${(-y).toFixed(5)}` : line);
        nvn++;
      } else if (line.startsWith('f ')) {
        // OBJ face indices are file-global, so rebase them onto the running totals
        const verts = line.slice(2).trim().split(/\s+/).map((tok) => {
          const [vi, vt, vni] = tok.split('/');
          const v = Number(vi) + vBase;
          const n = vni ? Number(vni) + vnBase : '';
          return vt !== undefined && vt !== '' ? `${v}/${vt}/${n}` : (n !== '' ? `${v}//${n}` : `${v}`);
        });
        body.push(`f ${verts.join(' ')}`);
      }
    }
    await write(body.join('\n') + '\n');
    vBase += nv;
    vnBase += nvn;
  }
  await new Promise((r) => out.end(r));
  const objMB = fs.statSync(objPath).size / 1e6;

  // ---------- gltfpack: reindex, simplify, quantize, meshopt-compress ----------
  const glbPath = path.join(dir, `${packId}.glb`);
  // -kn keeps each `o` object as a named node (that's our part id);
  // -cc adds EXT_meshopt_compression (~3.6x); the decoder is vendored.
  const args = ['gltfpack', '-i', objPath, '-o', glbPath, '-kn', '-cc'];
  if (ratio < 1) args.push('-si', String(ratio));
  execFileSync('npx', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  restoreNodeNames(glbPath, chosen.map((c) => c.partId));
  const glbMB = fs.statSync(glbPath).size / 1e6;
  if (!keepObj) fs.unlinkSync(objPath);
  console.log(`  obj ${objMB.toFixed(1)} MB → glb ${glbMB.toFixed(1)} MB`);

  // ---------- manifest ----------
  const manifest = {
    id: packId,
    title: pack.title,
    blurb: pack.blurb,
    attribution: ATTRIB,
    license: LICENSE,
    source: { kind: 'gltf', file: `${packId}.glb` },
    camera: pack.camera,
    layers: pack.layers.map((l) =>
      pack.startGhostLayers?.includes(l.id) ? { ...l, ghost: true } : l),
    parts,
    quizzes: pack.quizzes,
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`  wrote data/models/${packId}/manifest.json\n`);
}
