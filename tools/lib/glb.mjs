/*
 * Shared GLB build helpers: run gltfpack on a merged OBJ, then restore the
 * part names its compression strips.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/* gltfpack's compression flags strip node names, but they preserve node order
 * exactly (verified against a fixture with distinct per-object triangle
 * counts). So write the part ids back onto the mesh-bearing nodes in order,
 * refusing to guess if the counts don't line up. */
export function restoreNodeNames(glbPath, names) {
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

/* OBJ (one `o <partId>` object per mesh, in `names` order) → compressed GLB.
 * -kn keeps each object as its own node; -cc adds EXT_meshopt_compression,
 * whose decoder is vendored. */
export function packGlb(root, objPath, glbPath, names, { ratio = 1 } = {}) {
  const args = ['gltfpack', '-i', objPath, '-o', glbPath, '-kn', '-cc'];
  if (ratio < 1) args.push('-si', String(ratio));
  execFileSync('npx', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  restoreNodeNames(glbPath, names);
}
