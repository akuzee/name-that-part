/*
 * Mesh file readers for tools/import-kit.mjs. Each returns
 * { pos: Float32Array | number[] (xyz, file units), idx: number[] | null }
 * where idx === null means triangle soup (every 3 vertices form a triangle).
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

export function readStl(file) {
  const buf = fs.readFileSync(file);
  const n = buf.length >= 84 ? buf.readUInt32LE(80) : 0;
  let pos;
  if (84 + n * 50 === buf.length) {
    pos = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 9; k++) pos[i * 9 + k] = buf.readFloatLE(84 + i * 50 + 12 + k * 4);
    }
  } else {                                           // ASCII STL
    pos = Float32Array.from([...buf.toString('utf8').matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)]
      .flatMap((m) => [Number(m[1]), Number(m[2]), Number(m[3])]));
  }
  return { pos, idx: null };                         // triangle soup: no index
}

export function readObj(file) {
  const pos = [], idx = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('v ')) pos.push(...line.slice(2).trim().split(/\s+/).slice(0, 3).map(Number));
    else if (line.startsWith('f ')) {
      const vs = line.slice(2).trim().split(/\s+/).map((t) => {
        const i = Number(t.split('/')[0]);
        return i < 0 ? pos.length / 3 + i : i - 1;
      });
      for (let j = 1; j < vs.length - 1; j++) idx.push(vs[0], vs[j], vs[j + 1]);
    }
  }
  return { pos, idx };
}

/* 3MF: zipped XML. Objects hold meshes or reference other objects as
 * components; build items place objects. Transforms are 3x4, row-vector. */
export function read3mf(file) {
  const xmls = execFileSync('unzip', ['-Z1', file]).toString().split('\n')
    .filter((n) => n.endsWith('.model'))
    .map((n) => execFileSync('unzip', ['-p', file, n], { maxBuffer: 1 << 30 }).toString());
  const objects = new Map();
  for (const xml of xmls) {
    for (const m of xml.matchAll(/<object\b([^>]*)>([\s\S]*?)<\/object>/g)) {
      const oid = m[1].match(/\bid="(\d+)"/)[1];
      const body = m[2];
      const verts = [...body.matchAll(/<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g)]
        .flatMap((v) => [Number(v[1]), Number(v[2]), Number(v[3])]);
      const tris = [...body.matchAll(/<triangle\s+v1="(\d+)"\s+v2="(\d+)"\s+v3="(\d+)"/g)]
        .flatMap((t) => [Number(t[1]), Number(t[2]), Number(t[3])]);
      const comps = [...body.matchAll(/<component\s+([^>]*)\/>/g)].map((c) => ({
        ref: c[1].match(/objectid="(\d+)"/)[1],
        t: (c[1].match(/transform="([^"]+)"/) || [])[1],
      }));
      objects.set(oid, { verts, tris, comps });
    }
  }
  const mat = (t) => (t ? t.trim().split(/\s+/).map(Number) : [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  const apply = (m, x, y, z) => [
    x * m[0] + y * m[3] + z * m[6] + m[9],
    x * m[1] + y * m[4] + z * m[7] + m[10],
    x * m[2] + y * m[5] + z * m[8] + m[11],
  ];
  const mul = (a, b) => {   // apply a, then b (row-vector convention)
    const r = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        r.push((row < 3 ? 0 : b[9 + col]) +
          a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col]);
      }
    }
    return r;
  };
  const pos = [], idx = [];
  const emit = (oid, m, depth = 0) => {
    const o = objects.get(oid);
    if (!o || depth > 8) return;
    const base = pos.length / 3;
    for (let i = 0; i < o.verts.length; i += 3) pos.push(...apply(m, o.verts[i], o.verts[i + 1], o.verts[i + 2]));
    for (const t of o.tris) idx.push(base + t);
    for (const c of o.comps) emit(c.ref, mul(mat(c.t), m), depth + 1);
  };
  const items = xmls.flatMap((x) => [...x.matchAll(/<item\s+([^>]*)\/>/g)]).map((i) => ({
    ref: i[1].match(/objectid="(\d+)"/)[1],
    t: (i[1].match(/transform="([^"]+)"/) || [])[1],
  }));
  for (const it of items) emit(it.ref, mat(it.t));
  return { pos, idx };
}

export const READERS = { '.stl': readStl, '.obj': readObj, '.3mf': read3mf };
