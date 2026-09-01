/*
 * Data layer: model catalog, manifests, quiz resolution.
 *
 * Manifest shape (data/models/<id>/manifest.json):
 *   {
 *     id, title, blurb, attribution, license,
 *     source: { kind: 'procedural', module: 'build.mjs' }
 *           | { kind: 'gltf', file: 'model.glb', nodeMap?: [rule], autoParts?: true },
 *     parts:  { partId: { name, layer?, quiz?: false } },      // registry (may be
 *              // partial for gltf+autoParts — unmatched nodes self-register)
 *     layers: [ { id, name, color?, startHidden?: true } ],    // optional peel groups
 *     quizzes:[ { id, title, subtitle?, parts: 'all'|[partId]|{layer} } ],
 *     camera?: { theta?, phi?, zoom? }                          // initial view hint
 *   }
 *
 * nodeMap rules (applied in order to glTF node names):
 *   { exact: 'Femur_L', part: 'femur-l' }
 *   { prefix: 'Stud',   part: 'stud' }
 *   { regex: '^Rib_\\d+$', part: 'rib' }
 *   { prefix: 'Gizmo',  ignore: true }        // exclude from game entirely
 */

const BASE = 'data/models/';

export async function loadCatalog() {
  const res = await fetch('data/index.json');
  if (!res.ok) throw new Error('failed to load catalog');
  return res.json();
}

export async function loadManifest(modelId) {
  const res = await fetch(`${BASE}${encodeURIComponent(modelId)}/manifest.json`);
  if (!res.ok) throw new Error(`no manifest for model "${modelId}"`);
  const manifest = await res.json();
  manifest.baseUrl = `${BASE}${modelId}/`;
  return manifest;
}

/* Map a glTF node name to a part id via manifest rules, else auto-slug.
 * Returns { part } | { ignore: true } | null (no auto and no match). */
export function mapNodeName(name, source) {
  for (const rule of source.nodeMap || []) {
    if (rule.exact !== undefined && name === rule.exact) return rule;
    if (rule.prefix !== undefined && name.startsWith(rule.prefix)) return rule;
    if (rule.regex !== undefined && new RegExp(rule.regex).test(name)) return rule;
  }
  if (source.autoParts === false) return null;
  return { part: autoSlug(name) };
}

/* "Left_Femur.003" → "left-femur"; "pistonRing2" → "piston-ring" */
export function autoSlug(name) {
  return name
    .replace(/\.\d+$/, '')             // blender duplicate suffix
    .replace(/[_\s]+/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/-?\d+$/, '')             // trailing instance numbers
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'part';
}

export function prettyName(slug) {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* Resolve a quiz config into the engine's shape.
 * `parts` here is the registry the viewer actually found in the model. */
export function resolveQuiz(manifest, quizId, foundParts) {
  const q = (manifest.quizzes || []).find((x) => x.id === quizId);
  if (!q) throw new Error(`no quiz "${quizId}" in ${manifest.id}`);
  let ids;
  if (q.parts === 'all' || q.parts === undefined) {
    ids = [...foundParts.keys()].filter((id) => foundParts.get(id).quiz !== false);
  } else if (Array.isArray(q.parts)) {
    ids = q.parts.filter((id) => foundParts.has(id));
  } else if (q.parts.layer) {
    ids = [...foundParts.keys()].filter(
      (id) => foundParts.get(id).layer === q.parts.layer && foundParts.get(id).quiz !== false
    );
  } else {
    ids = [];
  }
  return {
    title: q.title,
    subtitle: q.subtitle || manifest.title,
    targetIds: ids,
  };
}
