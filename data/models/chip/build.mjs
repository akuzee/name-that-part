/*
 * Procedural CPU package, quarter-cutaway: what's under the heat spreader of
 * a flip-chip BGA/LGA processor. The IHS and underfill have a quarter removed
 * (toward +X+Z, the default camera) so the die stack is visible.
 * Units: ~mm/10 (a 40mm package is 4.0). Geometry only.
 */

export function build(THREE) {
  const root = new THREE.Group();
  const stub = new THREE.MeshStandardMaterial();

  function box(part, w, h, d, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stub);
    m.position.set(x, y, z);
    m.userData.part = part;
    root.add(m);
    return m;
  }

  /* box with a quarter (x>cx, z>cz corner) removed: built from 2 boxes */
  function cutBox(part, w, h, d, x, y, z, cutW, cutD) {
    box(part, w - cutW, h, d, x - cutW / 2, y, z);                       // full-depth slab
    box(part, cutW, h, d - cutD, x + (w - cutW) / 2, y, z - cutD / 2);   // corner column minus cut
  }

  const PKG = 4.0;   // package substrate size
  const DIE = 1.6;

  // ---------- PCB scrap under the package ----------
  box('pcb', PKG * 1.6, 0.12, PKG * 1.6, 0, -0.36, 0);
  // solder balls (BGA) between PCB and substrate
  const rows = 12, pitch = (PKG * 0.9) / rows;
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= rows; j++) {
      const bx = -PKG * 0.45 + i * pitch, bz = -PKG * 0.45 + j * pitch;
      if ((i + j) % 2) continue; // thin out for polycount
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), stub);
      b.position.set(bx, -0.25, bz);
      b.userData.part = 'solder-ball';
      root.add(b);
    }
  }

  // ---------- package substrate ----------
  box('substrate', PKG, 0.14, PKG, 0, -0.13, 0);

  // ---------- die stack ----------
  box('die', DIE, 0.1, DIE, 0, 0.0, 0);
  // micro-bumps under the die (flip-chip)
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      if ((i + j) % 2) continue;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), stub);
      b.position.set(-DIE * 0.4 + i * DIE * 0.1, -0.062, -DIE * 0.4 + j * DIE * 0.1);
      b.userData.part = 'micro-bump';
      root.add(b);
    }
  }
  box('tim', DIE * 1.02, 0.03, DIE * 1.02, 0, 0.065, 0);   // thermal interface material
  // SMD capacitors on the substrate around the die
  for (const [cx, cz, n, dz] of [[-1.4, -0.5, 5, 0.25], [1.1, -1.35, 4, 0], [-0.5, 1.3, 4, 0]]) {
    for (let k = 0; k < n; k++) {
      box('smd-capacitor', 0.16, 0.08, 0.09,
        cx + (dz === 0 ? k * 0.25 : 0), -0.02, cz + (dz ? k * dz : 0));
    }
  }

  // ---------- integrated heat spreader, quarter cut away ----------
  const IHS = PKG * 0.78, CUT = IHS * 0.5;
  cutBox('ihs', IHS, 0.22, IHS, 0, 0.19, 0, CUT, CUT);
  // IHS flange feet (glued rim)
  box('ihs', IHS * 0.9, 0.1, 0.28, 0, 0.03, -IHS / 2 + 0.1);
  box('ihs', 0.28, 0.1, IHS * 0.9, -IHS / 2 + 0.1, 0.03, 0);

  return root;
}
