/*
 * Inspect a .glb: list mesh node names, group them by auto-slug, and draft a
 * manifest.json parts section — the onboarding step for any downloaded model.
 *
 * Usage:
 *   node tools/inspect-glb.mjs path/to/model.glb            # report
 *   node tools/inspect-glb.mjs path/to/model.glb --manifest # draft manifest JSON
 */
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: node tools/inspect-glb.mjs <model.glb> [--manifest]'); process.exit(1); }
const wantManifest = process.argv.includes('--manifest');

// GLB container: 12-byte header, then chunks; first chunk is the JSON scene.
const buf = fs.readFileSync(file);
if (buf.readUInt32LE(0) !== 0x46546c67) { console.error('not a GLB file'); process.exit(1); }
const jsonLen = buf.readUInt32LE(12);
if (buf.readUInt32LE(16) !== 0x4e4f534a) { console.error('first chunk is not JSON'); process.exit(1); }
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));

const nodes = gltf.nodes || [];
const meshNodes = nodes.filter((n) => n.mesh !== undefined);

// mirror js/data.js autoSlug
function autoSlug(name) {
  return name
    .replace(/\.\d+$/, '')
    .replace(/[_\s]+/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/-?\d+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'part';
}
const pretty = (slug) => slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const groups = new Map();
for (const n of meshNodes) {
  const name = n.name || `(unnamed mesh ${n.mesh})`;
  const slug = autoSlug(name);
  if (!groups.has(slug)) groups.set(slug, []);
  groups.get(slug).push(name);
}

if (wantManifest) {
  const parts = {};
  for (const slug of [...groups.keys()].sort()) {
    parts[slug] = { name: pretty(slug), layer: null };
  }
  console.log(JSON.stringify({
    id: 'CHANGE-ME',
    title: 'CHANGE ME',
    blurb: '',
    attribution: 'CHANGE ME (author, source URL)',
    license: 'CHANGE ME',
    source: { kind: 'gltf', file: 'model.glb' },
    layers: [],
    parts,
    quizzes: [{ id: 'all', title: 'Everything', parts: 'all' }],
  }, null, 2));
} else {
  console.log(`${file}`);
  console.log(`  meshes: ${(gltf.meshes || []).length}, mesh nodes: ${meshNodes.length}, ` +
    `materials: ${(gltf.materials || []).length}`);
  console.log(`  distinct parts after auto-grouping: ${groups.size}\n`);
  for (const slug of [...groups.keys()].sort()) {
    const names = groups.get(slug);
    const sample = names.slice(0, 3).join(', ') + (names.length > 3 ? ', …' : '');
    console.log(`  ${slug.padEnd(32)} ×${String(names.length).padEnd(4)} (${sample})`);
  }
  console.log('\nUseful part names? Run with --manifest to draft a manifest.json.');
  console.log('Garbage names (Body012…)? The model needs a rename pass in Blender first.');
}
