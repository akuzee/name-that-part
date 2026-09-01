/*
 * Procedural inline-4 engine (schematic but recognizable, SOHC).
 * Units: meters. Crankshaft centerline = origin, running along X.
 * Cylinder 1 at the front (-X); front of engine carries the timing set.
 *
 * Geometry only — display names/layers/colors come from manifest.json.
 */

export function build(THREE) {
  const root = new THREE.Group();
  const stub = new THREE.MeshStandardMaterial();

  const BORE = 0.082, SPACING = 0.112;
  const CYL_X = [-1.5, -0.5, 0.5, 1.5].map((k) => k * SPACING);
  const THROW = [0, Math.PI, Math.PI, 0];       // crank angles per cylinder
  const R = 0.044, ROD = 0.135;                 // crank radius, rod length
  const DECK = 0.26;                            // top of block
  const FRONT = CYL_X[0] - SPACING * 0.72;      // front face x
  const REAR = CYL_X[3] + SPACING * 0.72;

  function add(part, geo, x, y, z, rot) {
    const m = new THREE.Mesh(geo, stub);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    m.userData.part = part;
    root.add(m);
    return m;
  }
  const box = (part, w, h, d, x, y, z, rot) =>
    add(part, new THREE.BoxGeometry(w, h, d), x, y, z, rot);
  const cylX = (part, r, len, x, y, z) =>   // cylinder along X
    add(part, new THREE.CylinderGeometry(r, r, len, 24), x, y, z, [0, 0, Math.PI / 2]);
  const cylY = (part, r, len, x, y, z, rTop) =>
    add(part, new THREE.CylinderGeometry(rTop ?? r, r, len, 20), x, y, z);

  function tube(part, pts, r, closed = false) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', 0.15);
    return add(part, new THREE.TubeGeometry(curve, pts.length * 8, r, 12, closed), 0, 0, 0);
  }

  // ---------- block & pan ----------
  box('engine-block', REAR - FRONT, DECK - 0.03, 0.24, (FRONT + REAR) / 2, (DECK + 0.03) / 2, 0);
  box('oil-pan', REAR - FRONT - 0.02, 0.11, 0.2, (FRONT + REAR) / 2, -0.115, 0);

  // ---------- crankshaft (journals + webs + pins), pistons, rods ----------
  for (let i = 0; i <= 4; i++) {  // main journals between/outside cylinders
    const x = i === 0 ? CYL_X[0] - SPACING / 2 : CYL_X[i - 1] + SPACING / 2;
    cylX('crankshaft', 0.026, 0.032, x, 0, 0);
  }
  for (let i = 0; i < 4; i++) {
    const a = THROW[i];
    const py = Math.cos(a) * R, pz = Math.sin(a) * R;
    // webs
    box('crankshaft', 0.014, R * 2 + 0.05, 0.07, CYL_X[i] - 0.024, py / 2, pz / 2, [Math.atan2(pz, py) === 0 ? 0 : 0, 0, 0]);
    box('crankshaft', 0.014, R * 2 + 0.05, 0.07, CYL_X[i] + 0.024, py / 2, pz / 2);
    // crank pin
    cylX('crankshaft', 0.024, 0.036, CYL_X[i], py, pz);
    // piston at correct height for this crank angle
    const pistonY = py + Math.sqrt(ROD * ROD - pz * pz);
    cylY('piston', BORE / 2 - 0.002, 0.062, CYL_X[i], pistonY + 0.01, 0);
    // connecting rod: from pin to piston
    const midY = (py + pistonY) / 2;
    const len = Math.hypot(pistonY - py, pz);
    box('connecting-rod', 0.02, len - 0.02, 0.03, CYL_X[i], midY + 0.005, pz / 2,
      [Math.atan2(pz - 0, pistonY - py) * -1, 0, 0]);
  }
  cylX('flywheel', 0.15, 0.03, REAR + 0.035, 0, 0);
  cylX('crank-pulley', 0.07, 0.035, FRONT - 0.075, 0, 0);

  // ---------- head, gasket, valve cover ----------
  box('head-gasket', REAR - FRONT, 0.006, 0.24, (FRONT + REAR) / 2, DECK + 0.003, 0);
  box('cylinder-head', REAR - FRONT, 0.09, 0.24, (FRONT + REAR) / 2, DECK + 0.051, 0);
  box('valve-cover', REAR - FRONT - 0.01, 0.07, 0.2, (FRONT + REAR) / 2, DECK + 0.13, 0);

  // ---------- valvetrain ----------
  const camY = DECK + 0.125;
  cylX('camshaft', 0.016, REAR - FRONT - 0.02, (FRONT + REAR) / 2, camY, 0);
  for (let i = 0; i < 4; i++) {
    for (const [part, z] of [['intake-valve', -0.045], ['exhaust-valve', 0.045]]) {
      const v = cylY(part, 0.006, 0.075, CYL_X[i], DECK + 0.055, z);
      add(part, new THREE.CylinderGeometry(0.018, 0.014, 0.006, 20), CYL_X[i], DECK + 0.016, z);
      // spring around the stem
      const spring = [];
      for (let t = 0; t <= 24; t++) {
        const ang = (t / 24) * Math.PI * 7;
        spring.push([CYL_X[i] + Math.cos(ang) * 0.014, DECK + 0.045 + (t / 24) * 0.05, z + Math.sin(ang) * 0.014]);
      }
      tube('valve-spring', spring, 0.0028);
      // cam lobes over each valve
      const lobe = add('camshaft', new THREE.CylinderGeometry(0.024, 0.024, 0.012, 20), CYL_X[i], camY, z * 0.55);
      lobe.rotation.z = Math.PI / 2;
      lobe.scale.z = 1.35;
    }
    // spark plug angled on the intake side of the head
    const plug = cylY('spark-plug', 0.008, 0.075, CYL_X[i], DECK + 0.1, -0.095);
    plug.rotation.x = -0.5;
  }
  cylX('cam-sprocket', 0.055, 0.02, FRONT - 0.045, camY, 0);
  cylX('crank-sprocket', 0.03, 0.02, FRONT - 0.045, 0, 0);
  // timing belt: closed loop around both sprockets
  const beltPts = [];
  const bx = FRONT - 0.045;
  for (let t = 0; t < 12; t++) {
    const a = Math.PI * (t / 11) - Math.PI / 2;
    beltPts.push([bx, camY + Math.cos(a) * 0.058, Math.sin(a) * 0.058]);
  }
  for (let t = 0; t < 12; t++) {
    const a = Math.PI * (t / 11) + Math.PI / 2;
    beltPts.push([bx, Math.cos(a) * 0.033, Math.sin(a) * 0.033]);
  }
  tube('timing-belt', beltPts, 0.006, true);

  // ---------- intake side (−Z) ----------
  box('intake-plenum', REAR - FRONT - 0.06, 0.07, 0.07, (FRONT + REAR) / 2, DECK + 0.02, -0.24);
  for (const x of CYL_X) {
    tube('intake-runner', [
      [x, DECK + 0.05, -0.12], [x, DECK + 0.06, -0.18], [x, DECK + 0.035, -0.22],
    ], 0.019);
  }
  const tb = cylX('throttle-body', 0.026, 0.06, REAR - 0.02, DECK + 0.02, -0.24);
  tb.rotation.set(Math.PI / 2, 0, 0);
  cylY('air-filter', 0.07, 0.05, REAR + 0.09, DECK + 0.02, -0.24);

  // ---------- exhaust side (+Z) ----------
  for (const x of CYL_X) {
    tube('exhaust-runner', [
      [x, DECK + 0.045, 0.12], [x, DECK + 0.02, 0.19],
      [x * 0.35 + 0.06, 0.1, 0.21], [0.06, 0.04, 0.2],
    ], 0.02);
  }
  tube('exhaust-collector', [[0.06, 0.04, 0.2], [0.09, -0.02, 0.2], [0.3, -0.05, 0.2]], 0.03);

  // ---------- accessories ----------
  const alt = cylX('alternator', 0.055, 0.09, FRONT - 0.09, 0.16, -0.14);
  cylX('alternator', 0.03, 0.02, FRONT - 0.145, 0.16, -0.14);
  const wp = cylX('water-pump', 0.04, 0.05, FRONT - 0.03, 0.12, 0.1);
  cylX('oil-filter', 0.038, 0.075, CYL_X[2], 0.05, 0.155).rotation.set(Math.PI / 2, 0, 0);
  const sm = cylX('starter-motor', 0.04, 0.13, REAR - 0.03, -0.05, 0.14);
  cylY('dipstick', 0.004, 0.16, CYL_X[1] - 0.03, 0.2, -0.13);

  return root;
}
