/*
 * Procedural eukaryotic cell, textbook-cutaway style, v2.
 *
 * Realism techniques: organic vertex-noise blobs instead of raw spheres,
 * a double-membrane boundary with visible thickness at the cutaway lip,
 * nuclear pores dotting the envelope, wavy rough-ER cisternae studded with
 * ribosomes, a tangled smooth-ER tubule network, curved Golgi cisternae with
 * budding vesicles, one mitochondrion cut open to show its cristae, and
 * 9-fold centriole barrels.
 *
 * build(THREE, variant): 'animal' (default) or 'plant'.
 * Geometry only — names/layers/colors live in each manifest.json.
 */

export function build(THREE, variant = 'animal') {
  const plant = variant === 'plant';
  const root = new THREE.Group();
  const stub = new THREE.MeshStandardMaterial();
  const rand = mulberry(plant ? 7 : 42);

  // deterministic smooth 3D noise: a few incommensurate sine octaves
  function noise3(x, y, z) {
    return (
      Math.sin(x * 5.1 + y * 3.7 + 0.4) * 0.5 +
      Math.sin(y * 6.3 - z * 4.1 + 2.1) * 0.3 +
      Math.sin(z * 7.7 + x * 2.9 + 4.8) * 0.2
    );
  }

  function rv(scale) {
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

  /* organic blob: sphere with vertices displaced along their normal by noise */
  function blobGeo(r, amp, seed = 0, seg = 32) {
    const geo = new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.75));
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = noise3(v.x / r + seed, v.y / r + seed * 1.7, v.z / r + seed * 0.6);
      const k = 1 + amp * n;
      pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function blob(part, r, amp, x, y, z, sx = 1, sy = 1, sz = 1) {
    const m = add(part, blobGeo(r, amp, rand() * 10), x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  }

  /* wavy ribbon: flattened tube along an arc whose radius undulates */
  function ribbon(part, cx, cy, cz, radius, arc, phase, tilt, waviness = 0.06) {
    const pts = [];
    const N = 26;
    for (let i = 0; i <= N; i++) {
      const a = phase + (i / N) * arc;
      const r = radius * (1 + waviness * Math.sin(a * 5 + phase * 3));
      pts.push(new THREE.Vector3(
        Math.cos(a) * r,
        Math.sin(a * 3 + phase) * radius * 0.1,
        Math.sin(a) * r
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const m = add(part, new THREE.TubeGeometry(curve, 60, 0.022, 10), cx, cy, cz);
    m.scale.y = 0.55;
    m.rotation.set(tilt[0], tilt[1], tilt[2]);
    return { mesh: m, curve, tilt };
  }

  // Cutaway wedge faces the default camera (+X+Z): sphere azimuth coverage.
  const PHI_START = 2.57;
  const WEDGE = (Math.PI * 2) - Math.PI / 2.4;
  const SQUASH = plant ? 0.9 : 0.82;

  // ---------- boundary: double membrane with visible thickness ----------
  const R = 1.0;
  function shellPair(part, rOut, thick) {
    for (const r of [rOut, rOut - thick]) {
      const s = add(part, new THREE.SphereGeometry(r, 64, 40, PHI_START, WEDGE));
      s.scale.set(1, SQUASH, 1);
    }
    // lip: two quad strips closing the cut faces so the wall reads as solid
    for (const a of [PHI_START, PHI_START + WEDGE]) {
      const dir = new THREE.Vector3(-Math.cos(a), 0, Math.sin(a));
      const shape = new THREE.Shape();
      shape.absarc(0, 0, rOut, -Math.PI / 2, Math.PI / 2, false);
      shape.absarc(0, 0, rOut - thick, Math.PI / 2, -Math.PI / 2, true);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.001, bevelEnabled: false });
      const m = add(part, geo);
      m.scale.set(SQUASH, 1, 1);          // arc plane is x=vertical after rotation
      m.rotation.set(0, Math.atan2(dir.z, dir.x), Math.PI / 2);
      m.rotateY(Math.PI / 2);
    }
  }
  shellPair('cell-membrane', R, 0.025);
  if (plant) shellPair('cell-wall', R * 1.12, 0.06);

  // ---------- nucleus ----------
  const nx = plant ? -0.42 : 0.1, ny = plant ? 0.28 : 0.05, nz = plant ? -0.25 : -0.05;
  const NR = plant ? 0.26 : 0.34;
  const env = add('nuclear-envelope', new THREE.SphereGeometry(NR, 48, 32, PHI_START, WEDGE), nx, ny, nz);
  add('nuclear-envelope', new THREE.SphereGeometry(NR - 0.015, 48, 32, PHI_START, WEDGE), nx, ny, nz);
  // nuclear pores: small rings dotting the envelope (kept out of the cut wedge)
  for (let i = 0; i < 26; i++) {
    const az = PHI_START + 0.25 + rand() * (WEDGE - 0.5);
    const el = (rand() - 0.5) * Math.PI * 0.8;
    const dir = new THREE.Vector3(
      -Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    const p = add('nuclear-pore', new THREE.TorusGeometry(0.016, 0.007, 8, 14),
      nx + dir.x * NR, ny + dir.y * NR, nz + dir.z * NR);
    p.lookAt(nx + dir.x * 2, ny + dir.y * 2, nz + dir.z * 2);
  }
  blob('nucleolus', NR * 0.34, 0.12, nx - NR * 0.15, ny + NR * 0.08, nz);
  for (let i = 0; i < 4; i++) {   // chromatin squiggles
    const pts = [];
    let p = new THREE.Vector3(nx, ny, nz).add(rv(NR * 0.5));
    for (let k = 0; k < 7; k++) {
      pts.push(p.clone());
      p = p.add(rv(NR * 0.32)).clamp(
        new THREE.Vector3(nx - NR * 0.72, ny - NR * 0.72, nz - NR * 0.72),
        new THREE.Vector3(nx + NR * 0.72, ny + NR * 0.72, nz + NR * 0.72));
    }
    add('chromatin', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.012, 8));
  }

  // ---------- rough ER: stacked wavy cisternae hugging the nucleus ----------
  const erRibbons = [];
  for (let i = 0; i < 5; i++) {
    const rr = NR + 0.1 + i * 0.052;
    erRibbons.push(ribbon('rough-er', nx, ny - 0.06 + i * 0.012, nz, rr,
      Math.PI * (0.55 + 0.1 * (i % 3)), 2.1 + i * 0.55, [0.35 + i * 0.08, -0.5 + i * 0.3, 0.15]));
  }
  // ribosomes studding the cisternae (sampled along each ribbon's curve)
  for (const { mesh, curve } of erRibbons) {
    for (let t = 0.04; t < 1; t += 0.06) {
      const p = curve.getPoint(t);
      const q = p.clone();
      q.y *= mesh.scale.y;
      q.applyEuler(mesh.rotation).add(mesh.position);
      const off = rv(0.03);
      add('ribosome', new THREE.SphereGeometry(0.014, 8, 8), q.x + off.x, q.y + 0.024, q.z + off.z);
    }
  }

  // ---------- smooth ER: tangled tubule network continuing outward ----------
  const sx0 = nx + (plant ? 0.35 : 0.42), sz0 = nz + 0.18;
  for (let i = 0; i < 7; i++) {
    const pts = [];
    let p = new THREE.Vector3(sx0 + (rand() - 0.5) * 0.15, ny + (rand() - 0.5) * 0.2, sz0 + (rand() - 0.5) * 0.15);
    for (let k = 0; k < 8; k++) {
      pts.push(p.clone());
      p = p.clone().add(rv(0.12));
      p.y = THREE.MathUtils.clamp(p.y, ny - 0.22, ny + 0.22);
    }
    add('smooth-er', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.014, 8));
  }

  // ---------- Golgi: curved cisternae stack with budding vesicles ----------
  const gx = plant ? 0.35 : -0.42, gy = -0.2, gz = plant ? 0.3 : 0.28;
  for (let i = 0; i < 6; i++) {
    const arcR = 0.16 + i * 0.012;
    const g = add('golgi', new THREE.TorusGeometry(arcR, 0.055 - i * 0.005, 8, 40, Math.PI * 1.15),
      gx, gy + i * 0.042, gz);
    g.scale.set(1, 0.16, 1);
    g.rotation.set(Math.PI / 2 + 0.32 - i * 0.02, 0, 0.4);
  }
  for (let i = 0; i < 8; i++) {
    const a = rand() * Math.PI * 2;
    blob('vesicle', 0.022 + rand() * 0.014, 0.15,
      gx + Math.cos(a) * (0.2 + rand() * 0.12), gy + 0.05 + rand() * 0.22, gz + Math.sin(a) * 0.18);
  }

  // ---------- mitochondria (one cut open to show cristae) ----------
  const mitoSpots = plant
    ? [[0.45, 0.35, -0.2, 0.8, false], [-0.1, -0.42, 0.35, 2.1, true], [0.15, 0.5, 0.25, 1.2, false], [-0.55, -0.2, 0.25, 0.3, false]]
    : [[0.55, 0.3, 0.25, 0.8, false], [-0.3, 0.42, 0.3, 2.1, false], [0.5, -0.35, -0.3, 1.2, true],
       [-0.6, -0.25, 0.2, 0.3, false], [0.15, -0.52, 0.4, 1.8, false]];
  for (const [x, y, z, a, open] of mitoSpots) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    grp.rotation.set(0.2, a, a * 0.35);
    root.add(grp);
    const put = (geo, px = 0, py = 0, pz = 0) => {
      const m = new THREE.Mesh(geo, stub);
      m.position.set(px, py, pz);
      m.userData.part = 'mitochondrion';
      grp.add(m);
      return m;
    };
    if (open) {
      // outer membrane with a lengthwise wedge removed, cristae inside
      const outer = put(new THREE.SphereGeometry(0.085, 40, 24, 0.6, Math.PI * 2 - 1.2));
      outer.scale.set(1.85, 1, 1);
      outer.rotation.x = -0.5;
      for (let i = -3; i <= 3; i++) {
        const c = put(new THREE.TorusGeometry(0.055, 0.014, 8, 22, Math.PI * 1.3), i * 0.036, 0, 0);
        c.rotation.set(Math.PI / 2 + 0.35, 0, Math.PI / 2);
        c.scale.set(1, 1, 0.85);
      }
    } else {
      put(blobGeo(0.085, 0.1, a * 3)).scale.set(1.85, 1, 1);
    }
  }

  // ---------- variant organelles ----------
  if (plant) {
    const vac = blob('central-vacuole', 0.5, 0.07, 0.12, -0.05, 0.02, 1.15, 0.85, 1);
    vac.userData.part = 'central-vacuole';
    const spots = [[0.6, 0.35, 0.3, 0.4], [-0.35, 0.55, 0.2, 1.4], [0.7, -0.15, -0.35, 2.2],
      [-0.65, -0.3, -0.3, 0.9], [0.2, 0.62, -0.35, 1.7], [-0.15, -0.55, -0.45, 0.2]];
    for (const [x, y, z, a] of spots) {
      const grp = new THREE.Group();
      grp.position.set(x, y, z);
      grp.rotation.set(0.3, a, a);
      root.add(grp);
      const outer = new THREE.Mesh(blobGeo(0.1, 0.06, a * 2), stub);
      outer.scale.set(1.6, 0.7, 1);
      outer.userData.part = 'chloroplast';
      grp.add(outer);
      for (let i = -2; i <= 2; i++) {   // grana stacks
        for (let k = 0; k < 3; k++) {
          const d = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.008, 14), stub);
          d.position.set(i * 0.055, -0.02 + k * 0.014, (i % 2) * 0.02);
          d.userData.part = 'chloroplast';
          grp.add(d);
        }
      }
    }
    blob('amyloplast', 0.07, 0.12, -0.5, 0.05, 0.45, 1.2, 1, 1);
  } else {
    for (const [x, y, z] of [[0.45, 0.05, 0.55], [-0.15, 0.55, -0.1], [0.2, -0.28, -0.5]]) {
      blob('lysosome', 0.055 + rand() * 0.015, 0.18, x, y, z);
    }
    for (const [x, y, z] of [[-0.5, 0.3, -0.25], [0.62, -0.12, 0.1]]) {
      blob('peroxisome', 0.04, 0.2, x, y, z);
    }
    // centrosome: two 9-fold centriole barrels, perpendicular
    const cx = 0.48, cy = 0.42, cz = -0.05;
    for (const [ox, oy, rot] of [[0, 0, 0], [0.075, -0.055, Math.PI / 2]]) {
      const barrel = new THREE.Group();
      barrel.position.set(cx + ox, cy + oy, cz);
      barrel.rotation.z = rot;
      root.add(barrel);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.09, 8), stub);
        t.position.set(Math.cos(a) * 0.026, 0, Math.sin(a) * 0.026);
        t.rotation.y = -a;
        t.userData.part = 'centriole';
        barrel.add(t);
      }
    }
    // microtubules radiating from the centrosome, clamped inside the membrane
    for (let i = 0; i < 8; i++) {
      const dir = rv(1).normalize();
      let len = 0.35 + rand() * 0.45;
      for (; len > 0.1; len -= 0.02) {   // shrink until the tip is inside the ellipsoid
        const tx = cx + dir.x * len, ty = cy + dir.y * len, tz = cz + dir.z * len;
        if (tx * tx + (ty / SQUASH) * (ty / SQUASH) + tz * tz < 0.88 * 0.88) break;
      }
      const mt = add('microtubule', new THREE.CylinderGeometry(0.006, 0.006, len, 6),
        cx + dir.x * len / 2, cy + dir.y * len / 2, cz + dir.z * len / 2);
      mt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
  }

  // ---------- free ribosomes ----------
  for (let i = 0; i < 46; i++) {
    const p = rv(0.55 + rand() * 0.35);
    if (p.distanceTo(new THREE.Vector3(nx, ny, nz)) < NR + 0.05) continue;
    add('ribosome', new THREE.SphereGeometry(0.014, 8, 8), p.x, p.y * (SQUASH - 0.04), p.z);
  }

  return root;
}

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
