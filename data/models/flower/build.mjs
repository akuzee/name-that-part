/*
 * Procedural flower: a complete perfect flower with all four whorls — sepals,
 * petals, stamens (filament + anther) and the pistil (ovary, style, stigma,
 * ovules) — plus stem and leaf. Schematic textbook proportions.
 */

export function build(THREE) {
  const root = new THREE.Group();
  const stub = new THREE.MeshStandardMaterial();

  function add(part, geo) {
    const m = new THREE.Mesh(geo, stub);
    m.userData.part = part;
    root.add(m);
    return m;
  }

  // ---------- stem ----------
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.06, -1.5, 0.02),
    new THREE.Vector3(-0.03, -0.8, -0.02),
    new THREE.Vector3(0.02, -0.2, 0.01),
    new THREE.Vector3(0, 0, 0),
  ]);
  add('peduncle', new THREE.TubeGeometry(stemCurve, 24, 0.035, 12));

  // leaf: flattened stretched sphere on a small petiole
  const leaf = add('leaf', new THREE.SphereGeometry(0.22, 20, 14));
  leaf.scale.set(1.6, 0.08, 0.7);
  leaf.position.set(-0.35, -0.85, -0.05);
  leaf.rotation.set(0.15, 0.4, 0.5);
  const petiole = add('leaf', new THREE.CylinderGeometry(0.012, 0.016, 0.3, 8));
  petiole.position.set(-0.14, -0.82, -0.035);
  petiole.rotation.z = 1.25;

  // receptacle: bulge where everything attaches
  const rec = add('receptacle', new THREE.SphereGeometry(0.09, 16, 12));
  rec.scale.set(1, 0.75, 1);
  rec.position.y = 0.02;

  // ---------- calyx: 5 sepals ----------
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const s = add('sepal', new THREE.SphereGeometry(0.16, 14, 10));
    s.scale.set(0.45, 0.06, 1.6);
    s.position.set(Math.sin(a) * 0.18, 0.02, Math.cos(a) * 0.18);
    s.rotation.y = a;
    s.rotateX(-0.45); // droop outward/down
  }

  // ---------- corolla: 6 petals ----------
  for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) / 6) * Math.PI * 2;
    const p = add('petal', new THREE.SphereGeometry(0.3, 16, 12));
    p.scale.set(0.62, 0.09, 1.35);
    p.position.set(Math.sin(a) * 0.3, 0.12, Math.cos(a) * 0.3);
    p.rotation.y = a;
    p.rotateX(-0.75); // cupped upward
  }

  // ---------- androecium: 6 stamens (filament + anther) ----------
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    const dx = Math.sin(a), dz = Math.cos(a);
    const filCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(dx * 0.06, 0.08, dz * 0.06),
      new THREE.Vector3(dx * 0.13, 0.32, dz * 0.13),
      new THREE.Vector3(dx * 0.2, 0.5, dz * 0.2),
    ]);
    add('filament', new THREE.TubeGeometry(filCurve, 12, 0.011, 8));
    const anther = add('anther', new THREE.SphereGeometry(0.05, 12, 8));
    anther.scale.set(0.55, 1.5, 0.55);
    anther.position.set(dx * 0.21, 0.545, dz * 0.21);
    anther.rotation.z = dx * 0.3;
    anther.rotation.x = -dz * 0.3;
  }

  // ---------- gynoecium: pistil in the center ----------
  const ovary = add('ovary', new THREE.SphereGeometry(0.085, 16, 12));
  ovary.scale.set(1, 1.25, 1);
  ovary.position.y = 0.16;
  // ovules inside (visible with see-through/section)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const ov = add('ovule', new THREE.SphereGeometry(0.02, 8, 8));
    ov.position.set(Math.sin(a) * 0.038, 0.16 + (i % 2) * 0.03 - 0.015, Math.cos(a) * 0.038);
  }
  const style = add('style', new THREE.CylinderGeometry(0.016, 0.026, 0.42, 10));
  style.position.y = 0.44;
  const stigma = add('stigma', new THREE.SphereGeometry(0.045, 12, 10));
  stigma.scale.set(1, 0.7, 1);
  stigma.position.y = 0.67;
  for (let i = 0; i < 3; i++) { // three-lobed sticky top
    const a = (i / 3) * Math.PI * 2;
    const lobe = add('stigma', new THREE.SphereGeometry(0.028, 10, 8));
    lobe.position.set(Math.sin(a) * 0.035, 0.685, Math.cos(a) * 0.035);
  }

  return root;
}
