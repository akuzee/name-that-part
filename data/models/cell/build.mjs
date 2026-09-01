/*
 * Procedural eukaryotic cell, textbook-cutaway style: the membrane (and the
 * plant cell wall) have a wedge opened toward the default camera so the
 * organelles inside are visible, while the boundary itself stays clickable.
 *
 * build(THREE, variant): variant 'animal' (default) or 'plant'.
 * Geometry only — names/layers/colors live in each manifest.json.
 */

export function build(THREE, variant = 'animal') {
  const plant = variant === 'plant';
  const root = new THREE.Group();
  const stub = new THREE.MeshStandardMaterial();
  const rand = mulberry(plant ? 7 : 42); // deterministic layout per variant

  /* random vector in a ball of the given radius */
  function rv(_, scale) {
    const v = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
    if (v.lengthSq() < 1e-6) v.set(0, 1, 0);
    return v.normalize().multiplyScalar(scale * Math.cbrt(rand()));
  }

  function add(part, geo, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, stub);
    m.position.set(x, y, z);
    m.userData.part = part;
    root.add(m);
    return m;
  }
  const sphere = (part, r, x, y, z, seg = 24) =>
    add(part, new THREE.SphereGeometry(r, seg, seg), x, y, z);

  /* capsule-ish blob: scaled sphere */
  function blob(part, r, sx, sy, sz, x, y, z) {
    const m = sphere(part, r, x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  }

  // Sphere azimuth α covers [PHI_START, PHI_START+WEDGE]; the ~75° gap is
  // centered so its opening faces the default camera direction (+X+Z).
  const PHI_START = 2.57;
  const WEDGE = (Math.PI * 2) - Math.PI / 2.4;

  // ---------- boundary ----------
  const R = 1.0;
  const shell = new THREE.SphereGeometry(R, 48, 32, PHI_START, WEDGE);
  const membrane = add('cell-membrane', shell, 0, 0, 0);
  membrane.scale.set(1, plant ? 0.9 : 0.82, 1);

  if (plant) {
    const wall = new THREE.SphereGeometry(R * 1.09, 48, 32, PHI_START, WEDGE);
    add('cell-wall', wall, 0, 0, 0).scale.set(1, 0.9, 1);
  }

  // ---------- nucleus ----------
  const nx = plant ? -0.42 : 0.1, ny = plant ? 0.28 : 0.05, nz = plant ? -0.25 : -0.05;
  const NR = plant ? 0.26 : 0.34;
  const envGeo = new THREE.SphereGeometry(NR, 32, 24, PHI_START, WEDGE);
  add('nuclear-envelope', envGeo, nx, ny, nz);
  sphere('nucleolus', NR * 0.36, nx - NR * 0.15, ny + NR * 0.1, nz);
  // chromatin: squiggle tubes inside the nucleus
  for (let i = 0; i < 3; i++) {
    const pts = [];
    let p = new THREE.Vector3(nx, ny, nz).add(rv(rand, NR * 0.45));
    for (let k = 0; k < 6; k++) {
      pts.push(p.clone());
      p = p.add(rv(rand, NR * 0.3)).clamp(
        new THREE.Vector3(nx - NR * 0.7, ny - NR * 0.7, nz - NR * 0.7),
        new THREE.Vector3(nx + NR * 0.7, ny + NR * 0.7, nz + NR * 0.7));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    add('chromatin', new THREE.TubeGeometry(curve, 32, 0.014, 8));
  }

  // ---------- endoplasmic reticulum ----------
  // rough ER: concentric ribbon arcs hugging the nucleus
  for (let i = 0; i < 4; i++) {
    const r = NR + 0.09 + i * 0.055;
    const t = new THREE.TorusGeometry(r, 0.016, 10, 40, Math.PI * (0.65 + 0.12 * (i % 3)));
    const m = add('rough-er', t, nx, ny - 0.05, nz);
    m.rotation.set(0.45 + i * 0.12, -0.7 + i * 0.35, 0.9 - i * 0.18);
    m.scale.set(1, 0.75, 1);
  }
  // smooth ER: looser tubes continuing outward
  for (let i = 0; i < 3; i++) {
    const r = NR + 0.32 + i * 0.06;
    const t = new THREE.TorusGeometry(r, 0.013, 10, 40, Math.PI * 0.55);
    const m = add('smooth-er', t, nx + 0.12, ny, nz + 0.05);
    m.rotation.set(-0.5 - i * 0.2, 0.8 + i * 0.4, 1.9 + i * 0.15);
    m.scale.set(1, 0.7, 1);
  }

  // ---------- Golgi apparatus ----------
  const gx = plant ? 0.35 : -0.42, gy = -0.18, gz = plant ? 0.3 : 0.28;
  for (let i = 0; i < 5; i++) {
    const w = 0.2 - Math.abs(i - 2) * 0.025;
    const m = blob('golgi', 1, w, 0.016, w * 0.75, gx, gy + i * 0.045, gz);
    m.rotation.z = 0.25;
  }
  for (let i = 0; i < 6; i++) {
    const a = rand() * Math.PI * 2;
    sphere('vesicle', 0.022 + rand() * 0.012,
      gx + Math.cos(a) * 0.26, gy + 0.1 + rand() * 0.16, gz + Math.sin(a) * 0.2, 12);
  }

  // ---------- mitochondria ----------
  const mitoSpots = plant
    ? [[0.45, 0.35, -0.2, 0.8], [-0.1, -0.42, 0.35, 2.1], [0.15, 0.5, 0.25, 1.2], [-0.55, -0.2, 0.25, 0.3]]
    : [[0.55, 0.3, 0.25, 0.8], [-0.3, 0.42, 0.3, 2.1], [0.5, -0.35, -0.3, 1.2],
       [-0.6, -0.25, 0.2, 0.3], [0.15, -0.5, 0.4, 1.8]];
  for (const [x, y, z, a] of mitoSpots) {
    const m = blob('mitochondrion', 0.09, 1.7, 1, 1, x, y, z);
    m.rotation.set(0, a, a * 0.4);
    // cristae ridges: small tori inside silhouette (same part)
    for (let i = -1; i <= 1; i++) {
      const c = add('mitochondrion', new THREE.TorusGeometry(0.055, 0.01, 8, 20, Math.PI), x + i * 0.055 * 1.6, y, z);
      c.rotation.set(Math.PI / 2, 0, a);
    }
  }

  // ---------- variant organelles ----------
  if (plant) {
    // central vacuole: big blob dominating the middle
    blob('central-vacuole', 0.5, 1.15, 0.85, 1, 0.12, -0.05, 0.02);
    // chloroplasts: green lens capsules near the boundary
    const spots = [[0.6, 0.35, 0.3, 0.4], [-0.35, 0.55, 0.2, 1.4], [0.7, -0.15, -0.35, 2.2],
      [-0.65, -0.3, -0.3, 0.9], [0.2, 0.62, -0.35, 1.7], [-0.15, -0.55, -0.45, 0.2]];
    for (const [x, y, z, a] of spots) {
      const m = blob('chloroplast', 0.1, 1.6, 0.75, 1, x, y, z);
      m.rotation.set(0.3, a, a);
      for (let i = -1; i <= 1; i++) { // grana stacks (same part)
        blob('chloroplast', 0.028, 1, 0.5, 1, x + i * 0.07, y, z).rotation.y = a;
      }
    }
    blob('amyloplast', 0.07, 1.2, 1, 1, -0.5, 0.05, 0.45);
  } else {
    // lysosomes / peroxisomes / centrioles are animal-cell furniture
    for (const [x, y, z] of [[0.45, 0.05, 0.55], [-0.15, 0.55, -0.1], [0.2, -0.28, -0.5]]) {
      sphere('lysosome', 0.055 + rand() * 0.015, x, y, z);
    }
    for (const [x, y, z] of [[-0.5, 0.3, -0.25], [0.62, -0.12, 0.1]]) {
      sphere('peroxisome', 0.04, x, y, z);
    }
    const cx = 0.48, cy = 0.42, cz = -0.05;
    add('centriole', new THREE.CylinderGeometry(0.03, 0.03, 0.09, 12), cx, cy, cz);
    const c2 = add('centriole', new THREE.CylinderGeometry(0.03, 0.03, 0.09, 12), cx + 0.07, cy - 0.05, cz);
    c2.rotation.z = Math.PI / 2;
    // microtubules radiating from the centrosome
    for (let i = 0; i < 7; i++) {
      const dir = rv(rand, 1).normalize();
      const len = 0.35 + rand() * 0.4;
      const mt = add('microtubule', new THREE.CylinderGeometry(0.006, 0.006, len, 6),
        cx + dir.x * len / 2, cy + dir.y * len / 2, cz + dir.z * len / 2);
      mt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
  }

  // ---------- ribosomes ----------
  // free ribosomes scattered + studding the rough ER arcs
  for (let i = 0; i < 40; i++) {
    const p = rv(rand, 0.55 + rand() * 0.35);
    if (p.distanceTo(new THREE.Vector3(nx, ny, nz)) < NR + 0.05) continue;
    sphere('ribosome', 0.014, p.x, p.y * (plant ? 0.85 : 0.78), p.z, 8);
  }
  for (let i = 0; i < 22; i++) {
    const a = rand() * Math.PI * 1.4 - 0.4;
    const r = NR + 0.1 + rand() * 0.16;
    sphere('ribosome', 0.014, nx + Math.cos(a) * r, ny - 0.05 + (rand() - 0.5) * 0.3, nz + Math.sin(a) * r * 0.8, 8);
  }

  return root;
}

/* deterministic PRNG so layouts don't shuffle between loads */
function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
