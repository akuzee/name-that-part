/*
 * Procedural whole car (schematic RWD sedan): a ghosted body shell over the
 * real quiz content — engine, transmission, driveshaft, differential, exhaust,
 * fuel system, cooling, suspension, steering, brakes and wheels, plus simple
 * named exterior panels. Units: meters. +X = front, Y up. Geometry only.
 */

export function build(THREE) {
  const root = new THREE.Group();
  const stub = new THREE.MeshStandardMaterial();

  function box(part, w, h, d, x, y, z, ry = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stub);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.userData.part = part;
    root.add(m);
    return m;
  }
  function cyl(part, r, len, x, y, z, axis = 'y', rBot) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, rBot ?? r, len, 20), stub);
    m.position.set(x, y, z);
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    m.userData.part = part;
    root.add(m);
    return m;
  }
  function tube(part, pts, r) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.15);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 8, r, 10), stub);
    m.userData.part = part;
    root.add(m);
    return m;
  }
  function spring(part, x, y, z, r, h) {
    const pts = [];
    for (let t = 0; t <= 30; t++) {
      const a = (t / 30) * Math.PI * 8;
      pts.push(new THREE.Vector3(x + Math.cos(a) * r, y + (t / 30) * h, z + Math.sin(a) * r));
    }
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.013, 8), stub);
    m.userData.part = part;
    root.add(m);
    return m;
  }

  const WB = 2.7;                     // wheelbase
  const FA = WB / 2, RA = -WB / 2;    // front/rear axle x
  const TRACK = 0.78;                 // half track width
  const WR = 0.32;                    // wheel radius
  const FLOOR = 0.38;

  // ---------- body shell (ghost layer): beveled extrusion, curved roofline ----------
  const s = new THREE.Shape();
  s.moveTo(2.32, 0.38);
  s.lineTo(2.36, 0.62);
  s.quadraticCurveTo(2.2, 0.82, 1.4, 0.9);       // hood
  s.quadraticCurveTo(0.95, 0.95, 0.68, 1.28);    // windshield
  s.quadraticCurveTo(0.25, 1.38, -0.45, 1.36);   // roof
  s.quadraticCurveTo(-1.0, 1.32, -1.5, 0.98);    // rear glass
  s.quadraticCurveTo(-1.9, 0.9, -2.26, 0.86);    // trunk
  s.lineTo(-2.32, 0.4);
  s.lineTo(-1.9, 0.28);
  s.lineTo(1.95, 0.28);
  s.closePath();
  const shellGeo = new THREE.ExtrudeGeometry(s, {
    depth: 1.5, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.09,
    bevelSegments: 4, curveSegments: 24,
  });
  const shell = new THREE.Mesh(shellGeo, stub);
  shell.position.z = -0.75;
  shell.userData.part = 'body-shell';
  root.add(shell);

  // glass, lights and grille: the visible face of the car
  // glass panes: length runs across the car (z), rake tilts about the z axis
  function glass(part, w, h, x, y, tiltZ) {
    const m = box(part, 0.015, h, w, x, y, 0);
    m.rotation.z = tiltZ;
    return m;
  }
  glass('windshield', 1.4, 0.46, 0.8, 1.08, 0.7);      // top leans rearward
  glass('rear-window', 1.15, 0.36, -1.22, 1.08, -0.85);   // top leans forward
  for (const side of [-1, 1]) {
    const w1 = box('side-window', 0.6, 0.3, 0.015, 0.26, 1.08, side * 0.78);
    const w2 = box('side-window', 0.52, 0.28, 0.015, -0.44, 1.08, side * 0.78);
    w1.rotation.x = side * 0.12;
    w2.rotation.x = side * 0.12;
    cyl('headlight', 0.09, 0.03, 2.36, 0.68, side * 0.52, 'x');
    box('taillight', 0.03, 0.09, 0.3, -2.34, 0.68, side * 0.55);
  }
  box('grille', 0.03, 0.16, 0.85, 2.37, 0.5, 0);
  box('license-plate', 0.02, 0.13, 0.36, 2.4, 0.44, 0);

  // ---------- named exterior panels (thin plates just outside the shell) ----------
  box('hood', 0.85, 0.02, 1.5, 1.78, 0.83, 0);
  box('roof-panel', 1.25, 0.02, 1.45, 0.08, 1.36, 0);
  box('trunk-lid', 0.8, 0.02, 1.5, -1.78, 0.93, 0);
  box('front-bumper', 0.12, 0.3, 1.68, 2.32, 0.5, 0);
  box('rear-bumper', 0.12, 0.3, 1.68, -2.32, 0.5, 0);
  for (const side of [-1, 1]) {
    box('front-door', 0.75, 0.55, 0.02, 0.62, 0.72, side * 0.845);
    box('rear-door', 0.7, 0.55, 0.02, -0.16, 0.72, side * 0.845);
    box('fender', 0.7, 0.3, 0.02, FA, 0.78, side * 0.83);
    box('quarter-panel', 0.7, 0.3, 0.02, RA, 0.78, side * 0.83);
    cyl('side-mirror', 0.055, 0.04, 1.05, 1.0, side * 0.88, 'z');
  }

  // ---------- powertrain ----------
  box('engine', 0.62, 0.42, 0.55, 1.35, 0.62, 0);            // block+head lump
  box('engine', 0.5, 0.1, 0.42, 1.35, 0.88, 0);              // valve cover
  cyl('transmission', 0.16, 0.65, 0.72, 0.5, 0, 'x', 0.11);  // tapered bell → tail
  cyl('driveshaft', 0.035, 1.55, -0.42, 0.42, 0, 'x');
  const diff = cyl('differential', 0.14, 0.22, RA, WR, 0, 'x');
  diff.scale.y = 1.2;
  for (const side of [-1, 1]) {
    cyl('half-shaft', 0.025, TRACK - 0.2, RA, WR, side * (TRACK / 2 + 0.08), 'z');
  }

  // ---------- cooling / intake / battery ----------
  box('radiator', 0.06, 0.4, 0.75, 2.05, 0.6, 0);
  tube('radiator-hose', [[2.0, 0.75, 0.15], [1.8, 0.8, 0.18], [1.67, 0.72, 0.15]], 0.028);
  box('air-filter-box', 0.28, 0.16, 0.3, 1.6, 0.85, -0.5);
  tube('intake-duct', [[1.46, 0.85, -0.5], [1.3, 0.8, -0.3], [1.35, 0.72, -0.28]], 0.04);
  box('battery', 0.3, 0.2, 0.19, 1.7, 0.78, 0.55);

  // ---------- exhaust & fuel ----------
  tube('exhaust-pipe', [
    [1.1, 0.45, 0.18], [0.6, 0.3, 0.22], [-0.3, 0.3, 0.28], [-1.2, 0.3, 0.3], [-1.75, 0.32, 0.3],
  ], 0.032);
  box('catalytic-converter', 0.4, 0.14, 0.16, 0.15, 0.3, 0.25);
  box('muffler', 0.55, 0.18, 0.24, -1.95, 0.34, 0.3);
  tube('tailpipe', [[-2.2, 0.32, 0.3], [-2.42, 0.3, 0.34]], 0.028);
  box('fuel-tank', 0.55, 0.18, 0.9, -0.9, 0.33, 0);
  tube('fuel-line', [[-0.9, 0.42, -0.3], [0.2, 0.42, -0.32], [1.2, 0.5, -0.25], [1.35, 0.6, -0.2]], 0.012);

  // ---------- wheels & brakes ----------
  for (const [ax, side] of [[FA, -1], [FA, 1], [RA, -1], [RA, 1]]) {
    const z = side * TRACK;
    const tire = new THREE.Mesh(new THREE.TorusGeometry(WR * 0.76, WR * 0.28, 18, 36), stub);
    tire.position.set(ax, WR, z);
    tire.userData.part = 'tire';
    root.add(tire);
    // rim: outer barrel + hub + 5 spokes
    cyl('wheel-rim', WR * 0.56, 0.16, ax, WR, z, 'z');
    cyl('wheel-rim', WR * 0.16, 0.2, ax, WR, z + side * 0.02, 'z');
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const sp = box('wheel-rim', 0.05, WR * 0.44, 0.03,
        ax + Math.sin(a) * WR * 0.28, WR + Math.cos(a) * WR * 0.28, z + side * 0.055);
      sp.rotation.z = -a;
    }
    cyl('brake-disc', WR * 0.46, 0.03, ax, WR, z - side * 0.13, 'z');
    box('brake-caliper', 0.1, 0.14, 0.06, ax, WR + 0.13, z - side * 0.15);
  }

  // ---------- suspension & steering ----------
  for (const [ax, side] of [[FA, -1], [FA, 1], [RA, -1], [RA, 1]]) {
    const z = side * (TRACK - 0.12);
    box('control-arm', 0.5, 0.035, 0.06, ax - 0.05, 0.3, side * (TRACK - 0.35), side * 1.15);
    spring('coil-spring', ax, 0.42, z, 0.075, 0.3);
    cyl('shock-absorber', 0.028, 0.36, ax, 0.58, z);
  }
  cyl('anti-roll-bar', 0.016, TRACK * 2 - 0.3, FA - 0.35, 0.32, 0, 'z');
  cyl('steering-rack', 0.035, 1.0, FA - 0.18, 0.42, 0, 'z');
  for (const side of [-1, 1]) {
    tube('tie-rod', [[FA - 0.18, 0.42, side * 0.5], [FA - 0.1, 0.4, side * (TRACK - 0.15)]], 0.014);
  }
  tube('steering-column', [[FA - 0.18, 0.46, 0.35], [0.85, 0.85, 0.4], [0.72, 0.95, 0.4]], 0.022);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 10, 24), stub);
  wheel.position.set(0.68, 1.0, 0.4);
  wheel.rotation.y = 0.35;
  wheel.rotation.x = 1.0;
  wheel.userData.part = 'steering-wheel';
  root.add(wheel);

  return root;
}
