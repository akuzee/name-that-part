/*
 * Fixture test for the kit importer: one file per supported format, checked
 * at two levels — exact reader output (incl. nested 3MF transforms) and the
 * part names that survive the full import → GLB pipeline.
 * Usage: node tools/test-import.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { read3mf, readStl, readObj } from './lib/readers.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-fixture-'));
const outId = '_test-import';
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failed++; };
const near = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-5);

// --- fixtures (a kit that prefixes every file, like Motor-Rotor.stl) ---
const tri = [0, 0, 0, 10, 0, 0, 0, 10, 0];
const bin = Buffer.alloc(84 + 50);
bin.writeUInt32LE(1, 80);
tri.forEach((v, i) => bin.writeFloatLE(v, 84 + 12 + i * 4));
fs.writeFileSync(path.join(dir, 'Motor-Rotor.stl'), bin);
fs.writeFileSync(path.join(dir, 'Motor-End_Bell.stl'),
  'solid x\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 5 0 0\nvertex 0 5 0\nendloop\nendfacet\nendsolid x\n');
fs.writeFileSync(path.join(dir, 'Motor-Fan.obj'), 'v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 1 2 3 4\n');
// 3MF: object 2 places object 1 scaled ×2 and moved +10x; the build item moves it +5y
const m3 = path.join(dir, '3mf-src');
fs.mkdirSync(path.join(m3, '3D'), { recursive: true });
fs.writeFileSync(path.join(m3, '3D', '3dmodel.model'), `<?xml version="1.0"?>
<model unit="millimeter"><resources>
  <object id="1" type="model"><mesh>
    <vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices>
    <triangles><triangle v1="0" v2="1" v3="2"/></triangles>
  </mesh></object>
  <object id="2" type="model"><components>
    <component objectid="1" transform="2 0 0 0 2 0 0 0 2 10 0 0"/>
  </components></object>
</resources>
<build><item objectid="2" transform="1 0 0 0 1 0 0 0 1 0 5 0"/></build></model>`);
execFileSync('zip', ['-q', '-r', path.join(dir, 'Motor-Housing.3mf'), '3D'], { cwd: m3 });
fs.rmSync(m3, { recursive: true });
// a zip of further parts, as a download often arrives
const zsrc = path.join(dir, 'zsrc');
fs.mkdirSync(zsrc);
fs.writeFileSync(path.join(zsrc, 'Motor-Fan_Cover.stl'), bin);
execFileSync('zip', ['-q', '-j', path.join(dir, 'extra-parts.zip'), path.join(zsrc, 'Motor-Fan_Cover.stl')]);
fs.rmSync(zsrc, { recursive: true });

// --- readers ---
check(near(Array.from(readStl(path.join(dir, 'Motor-Rotor.stl')).pos), tri), 'binary STL vertices');
check(readStl(path.join(dir, 'Motor-End_Bell.stl')).pos.length === 9, 'ASCII STL: one triangle');
check(JSON.stringify(readObj(path.join(dir, 'Motor-Fan.obj')).idx) === '[0,1,2,0,2,3]', 'OBJ quad fan-triangulated');
const h = read3mf(path.join(dir, 'Motor-Housing.3mf'));
check(near(Array.from(h.pos), [10, 5, 0, 12, 5, 0, 10, 7, 0]),
  `3MF component ×2 +10x under item +5y → ${Array.from(h.pos).join(',')}`);

// --- full pipeline ---
const outDir = path.join(root, 'data/models', outId);
try {
  const log = execFileSync('node', ['tools/import-kit.mjs', dir, '--id', outId, '--no-catalog'],
    { cwd: root }).toString();
  check(/stripped prefix "motor-"/.test(log), 'shared "Motor-" prefix stripped');
  const man = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));
  const want = ['end-bell', 'fan', 'fan-cover', 'housing', 'rotor'];
  check(JSON.stringify(Object.keys(man.parts).sort()) === JSON.stringify(want),
    `manifest parts = ${Object.keys(man.parts).sort().join(', ')}`);
  const glb = fs.readFileSync(path.join(outDir, `${outId}.glb`));
  const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
  const names = gltf.nodes.filter((n) => n.mesh !== undefined).map((n) => n.name).sort();
  check(JSON.stringify(names) === JSON.stringify(want), `GLB node names = ${names.join(', ')}`);
  check(gltf.extensionsUsed?.includes('EXT_meshopt_compression'), 'GLB is meshopt-compressed');
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall import checks passed');
process.exit(failed ? 1 : 0);
