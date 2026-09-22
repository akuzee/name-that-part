/*
 * Procedural desktop PC: open-sided ATX tower with every component a named
 * part. Case interior faces +Z+X (the default camera). Units ~meters/10
 * (a 45cm-tall case is 0.45). Geometry only — names/colors in manifest.json.
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
  function cyl(part, r, len, x, y, z, axis = 'y') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24), stub);
    m.position.set(x, y, z);
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    m.userData.part = part;
    root.add(m);
    return m;
  }
  function tube(part, pts, r) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.2);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 8, r, 10), stub);
    m.userData.part = part;
    root.add(m);
    return m;
  }

  /* real fan: frame ring + hub + 7 pitched blades. axis: which way it blows. */
  function fan(part, r, x, y, z, axis) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    if (axis === 'z') grp.rotation.x = Math.PI / 2;
    if (axis === 'x') grp.rotation.z = Math.PI / 2;
    root.add(grp);
    const put = (geo, rot, px = 0, py = 0, pz = 0) => {
      const m = new THREE.Mesh(geo, stub);
      m.position.set(px, py, pz);
      if (rot) m.rotation.copy(rot);
      m.userData.part = part;
      grp.add(m);
      return m;
    };
    put(new THREE.TorusGeometry(r * 0.94, r * 0.07, 8, 28),
      new THREE.Euler(Math.PI / 2, 0, 0));                       // frame ring
    put(new THREE.CylinderGeometry(r * 0.3, r * 0.3, r * 0.22, 16)); // hub
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const blade = put(new THREE.BoxGeometry(r * 0.62, r * 0.02, r * 0.34),
        null, Math.cos(a) * r * 0.55, 0, Math.sin(a) * r * 0.55);
      blade.rotation.set(0.5, -a, 0, 'YXZ');                     // pitch then yaw
    }
    // corner mounts
    for (const [cx, cz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      put(new THREE.BoxGeometry(r * 0.18, r * 0.16, r * 0.18), null, cx * r * 0.88, 0, cz * r * 0.88);
    }
    return grp;
  }

  // Case: W=0.21 (x), H=0.45 (y), D=0.42 (z). Open side = +X (glass side off).
  const W = 0.21, H = 0.45, D = 0.42, T = 0.006;

  // ---------- case panels (part 'case') ----------
  box('case', W, T, D, 0, 0, 0);                    // floor
  box('case', W, T, D, 0, H, 0);                    // top
  box('case', W, H, T, 0, H / 2, -D / 2);           // rear... wait: rear should be -Z? front -Z, rear +Z? Use front +Z.
  box('case', T, H, D, -W / 2, H / 2, 0);           // closed side (-X); +X side open
  box('front-panel', W, H, T, 0, H / 2, D / 2);     // front

  // ---------- motherboard on the -X wall ----------
  const MB_X = -W / 2 + T + 0.008; // board surface plane
  const mb = box('motherboard', 0.005, 0.305, 0.244, MB_X, 0.26, -0.06);
  // I/O area at rear-top of board
  box('rear-io', 0.02, 0.04, 0.16, MB_X + 0.008, 0.395, -0.1);

  const SX = MB_X + 0.0045; // surface x for on-board parts
  // CPU socket + CPU + cooler
  box('cpu', 0.006, 0.038, 0.038, SX + 0.004, 0.33, -0.05);
  // tower cooler: fin stack + heatpipes + fan
  for (let i = 0; i < 9; i++) {
    box('cpu-cooler', 0.002, 0.09, 0.09, SX + 0.035 + i * 0.006, 0.33, -0.05);
  }
  for (const dz of [-0.025, 0, 0.025]) {
    tube('cpu-cooler', [
      [SX + 0.012, 0.30, -0.05 + dz], [SX + 0.02, 0.28, -0.05 + dz],
      [SX + 0.06, 0.285, -0.05 + dz], [SX + 0.07, 0.33, -0.05 + dz],
      [SX + 0.06, 0.375, -0.05 + dz], [SX + 0.02, 0.38, -0.05 + dz],
      [SX + 0.012, 0.36, -0.05 + dz],
    ], 0.004);
  }
  fan('cpu-fan', 0.045, SX + 0.105, 0.33, -0.05, 'x');
  // RAM: 4 DIMMs
  for (let i = 0; i < 4; i++) {
    box('ram', 0.032, 0.13, 0.0035, SX + 0.016, 0.33, 0.03 + i * 0.011);
    box('ram', 0.034, 0.012, 0.006, SX + 0.016, 0.398, 0.03 + i * 0.011); // heat spreader cap
  }
  // VRM heatsinks flanking CPU
  box('vrm-heatsink', 0.012, 0.11, 0.02, SX + 0.006, 0.33, -0.125);
  box('vrm-heatsink', 0.012, 0.018, 0.1, SX + 0.006, 0.408, -0.03);
  // chipset heatsink low on the board
  box('chipset-heatsink', 0.008, 0.045, 0.045, SX + 0.004, 0.17, 0.02);
  // M.2 SSD
  box('m2-ssd', 0.004, 0.022, 0.08, SX + 0.002, 0.245, 0.0);
  // PCIe slots ×3
  for (let i = 0; i < 3; i++) {
    box('pcie-slot', 0.008, 0.011, 0.16, SX + 0.004, 0.20 - i * 0.04, -0.06);
  }
  // 24-pin ATX connector at board edge
  box('atx-connector', 0.01, 0.05, 0.012, SX + 0.005, 0.30, 0.062);
  // CMOS battery
  cyl('cmos-battery', 0.01, 0.003, SX + 0.002, 0.13, -0.04, 'x');

  // ---------- GPU in the top PCIe slot ----------
  box('gpu', 0.115, 0.008, 0.27, MB_X + 0.065, 0.207, -0.02); // pcb (horizontal, sticking out)
  box('gpu', 0.1, 0.038, 0.25, MB_X + 0.06, 0.183, -0.02);    // cooler shroud
  fan('gpu-fan', 0.036, MB_X + 0.06, 0.158, -0.09, 'y');
  fan('gpu-fan', 0.036, MB_X + 0.06, 0.158, 0.03, 'y');
  box('gpu-backplate', 0.11, 0.002, 0.26, MB_X + 0.062, 0.213, -0.02);
  for (let i = 0; i < 12; i++) {   // cooler fin stack peeking between the fans
    box('gpu', 0.09, 0.03, 0.003, MB_X + 0.058, 0.185, -0.145 + i * 0.021);
  }
  box('gpu', 0.004, 0.035, 0.11, MB_X + 0.115, 0.2, -0.135); // PCIe bracket
  tube('power-cable', [   // GPU 8-pin: drapes from the card down behind the shroud
    [MB_X + 0.08, 0.192, 0.05], [MB_X + 0.1, 0.155, 0.075],
    [MB_X + 0.1, 0.11, 0.085], [MB_X + 0.09, 0.095, 0.09],
  ], 0.006);
  tube('power-cable', [   // CPU EPS: hugs the rear corner up to the board's top edge
    [-W / 2 + 0.06, 0.095, -D / 2 + 0.04], [-W / 2 + 0.025, 0.22, -D / 2 + 0.025],
    [-W / 2 + 0.025, 0.4, -D / 2 + 0.03], [SX + 0.008, 0.425, -0.14],
  ], 0.005);

  // ---------- PSU (shrouded, bottom rear) ----------
  box('psu', 0.15, 0.086, 0.16, -W / 2 + 0.085, 0.05, -D / 2 + 0.09);
  fan('psu-fan', 0.05, -W / 2 + 0.085, 0.098, -D / 2 + 0.09, 'y');

  // ---------- storage ----------
  box('hdd', 0.101, 0.026, 0.147, -W / 2 + 0.06, 0.05, D / 2 - 0.1);   // 3.5" HDD
  box('ssd-25', 0.07, 0.007, 0.1, -W / 2 + 0.045, 0.09, D / 2 - 0.09); // 2.5" SATA SSD

  // ---------- case fans ----------
  for (const y of [0.32, 0.2]) fan('case-fan', 0.055, 0, y, D / 2 - 0.025, 'z');  // front intake ×2
  fan('case-fan', 0.055, 0, 0.37, -D / 2 + 0.025, 'z');                           // rear exhaust

  // ---------- cables ----------
  tube('power-cable', [   // 24-pin: out of the PSU, along the closed side, up the front edge
    [-W / 2 + 0.14, 0.07, -D / 2 + 0.09], [-W / 2 + 0.03, 0.09, 0.02],
    [-W / 2 + 0.035, 0.16, 0.1], [-W / 2 + 0.035, 0.29, 0.095],
    [SX + 0.012, 0.3, 0.068],
  ], 0.007);
  tube('sata-cable', [
    [-W / 2 + 0.06, 0.065, D / 2 - 0.02], [-W / 2 + 0.1, 0.12, 0.12], [SX + 0.01, 0.15, 0.06],
  ], 0.003);

  return root;
}
