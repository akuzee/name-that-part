/*
 * Procedural single-story house: foundation, floor/wall/roof framing,
 * plumbing, HVAC, and electrical — every member a named part.
 * Units: meters. Origin at slab center, +Y up, ridge runs along X.
 *
 * Each mesh gets userData.part = <partId>; display names/layers/colors live
 * in manifest.json. Dimensional lumber: 2x4 = 0.038 x 0.089, 2x8 = 0.038 x 0.184,
 * 2x10 = 0.038 x 0.235. Stud/joist spacing 0.4 (16" o.c.), rafters 0.6 (24" o.c.).
 */

export function build(THREE) {
  const root = new THREE.Group();
  const geoCache = new Map();

  const L = 6.0;   // house length (X, ridge direction)
  const W = 4.0;   // house width (Z)
  const H = 2.44;  // wall height above subfloor
  const T2 = 0.038, D4 = 0.089, D8 = 0.184, D10 = 0.235;
  const SPACING = 0.4;

  // materials are assigned by the viewer; builder only supplies geometry + part ids
  const stub = new THREE.MeshStandardMaterial();

  function box(part, w, h, d, x, y, z, ry = 0) {
    const key = `${w.toFixed(4)}|${h.toFixed(4)}|${d.toFixed(4)}`;
    if (!geoCache.has(key)) geoCache.set(key, new THREE.BoxGeometry(w, h, d));
    const m = new THREE.Mesh(geoCache.get(key), stub);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.userData.part = part;
    root.add(m);
    return m;
  }

  /* tube along a polyline of [x,y,z] points */
  function pipe(part, points, radius) {
    const curve = new THREE.CurvePath();
    for (let i = 0; i < points.length - 1; i++) {
      curve.add(new THREE.LineCurve3(
        new THREE.Vector3(...points[i]), new THREE.Vector3(...points[i + 1])
      ));
    }
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 6, radius, 10), stub);
    m.userData.part = part;
    root.add(m);
    return m;
  }

  function cyl(part, rTop, rBot, h, x, y, z, rx = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 20), stub);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.rotation.z = rz;
    m.userData.part = part;
    root.add(m);
    return m;
  }

  // ============ foundation (crawlspace) ============
  const stemH = 0.6, stemT = 0.2, footH = 0.2, footW = 0.5;
  const floorY = 0;                 // top of subfloor = y 0
  const joistTop = -0.019;          // subfloor is 19mm
  const joistY = joistTop - D10 / 2;
  const sillY = joistTop - D10 - D4 / 2;
  const stemTop = sillY - D4 / 2;
  const stemY = stemTop - stemH / 2;
  const footY = stemTop - stemH - footH / 2;

  // footings + stem walls, one per side
  box('footing', L + footW, footH, footW, 0, footY, -W / 2);
  box('footing', L + footW, footH, footW, 0, footY, W / 2);
  box('footing', footW, footH, W - stemT, -L / 2, footY, 0);
  box('footing', footW, footH, W - stemT, L / 2, footY, 0);
  box('stem-wall', L + stemT, stemH, stemT, 0, stemY, -W / 2);
  box('stem-wall', L + stemT, stemH, stemT, 0, stemY, W / 2);
  box('stem-wall', stemT, stemH, W - stemT, -L / 2, stemY, 0);
  box('stem-wall', stemT, stemH, W - stemT, L / 2, stemY, 0);

  // ============ floor framing ============
  box('sill-plate', L, D4, stemT, 0, sillY, -W / 2);
  box('sill-plate', L, D4, stemT, 0, sillY, W / 2);
  box('sill-plate', stemT, D4, W - stemT, -L / 2, sillY, 0);
  box('sill-plate', stemT, D4, W - stemT, L / 2, sillY, 0);
  // rim joists on the long sides? joists span Z (width), rims run along X
  box('rim-joist', L, D10, T2, 0, joistY, -W / 2 + T2 / 2);
  box('rim-joist', L, D10, T2, 0, joistY, W / 2 - T2 / 2);
  const nJoist = Math.floor(L / SPACING);
  for (let i = 0; i <= nJoist; i++) {
    const x = -L / 2 + T2 / 2 + i * ((L - T2) / nJoist);
    box('floor-joist', T2, D10, W - 2 * T2, x, joistY, 0);
  }
  box('subfloor', L, 0.019, W, 0, floorY - 0.0095, 0);

  // ============ wall framing ============
  const plateY = floorY + T2 / 2;                 // bottom plate
  const studY = floorY + T2 + (H - 3 * T2) / 2;   // stud between plates
  const studH = H - 3 * T2;
  const topY = floorY + H - 1.5 * T2;
  const capY = floorY + H - 0.5 * T2;

  function wallAlongX(z, openings) {
    box('bottom-plate', L, T2, D4, 0, plateY, z);
    box('top-plate', L, T2, D4, 0, topY, z);
    box('cap-plate', L, T2, D4, 0, capY, z);
    const n = Math.floor(L / SPACING);
    for (let i = 0; i <= n; i++) {
      const x = -L / 2 + T2 / 2 + i * ((L - T2) / n);
      const inOpening = openings.some((o) => x > o.x0 - 0.02 && x < o.x1 + 0.02);
      if (!inOpening) box('stud', T2, studH, D4, x, studY, z);
    }
    for (const o of openings) frameOpening(z, o);
  }

  /* window: {x0,x1, sillY, headY}; door: sillY null */
  function frameOpening(z, o) {
    const kingX0 = o.x0 - T2 * 1.5, kingX1 = o.x1 + T2 * 1.5;
    box('king-stud', T2, studH, D4, kingX0, studY, z);
    box('king-stud', T2, studH, D4, kingX1, studY, z);
    const jackH = o.headY - (floorY + T2);
    box('jack-stud', T2, jackH, D4, o.x0 - T2 / 2, floorY + T2 + jackH / 2, z);
    box('jack-stud', T2, jackH, D4, o.x1 + T2 / 2, floorY + T2 + jackH / 2, z);
    const headW = o.x1 - o.x0 + 2 * T2;
    box('header', headW, D8, D4, (o.x0 + o.x1) / 2, o.headY + D8 / 2, z);
    // cripples above header to top plate
    const cripH = topY - T2 / 2 - (o.headY + D8);
    if (cripH > 0.05) {
      for (let x = o.x0 + SPACING / 2; x < o.x1; x += SPACING) {
        box('cripple-stud', T2, cripH, D4, x, o.headY + D8 + cripH / 2, z);
      }
    }
    if (o.sillY != null) {
      box('window-sill', o.x1 - o.x0, T2, D4, (o.x0 + o.x1) / 2, o.sillY - T2 / 2, z);
      const lowH = o.sillY - T2 - (floorY + T2);
      for (let x = o.x0 + SPACING / 2; x < o.x1; x += SPACING) {
        box('cripple-stud', T2, lowH, D4, x, floorY + T2 + lowH / 2, z);
      }
    }
  }

  const front = W / 2 - D4 / 2, back = -W / 2 + D4 / 2;
  wallAlongX(front, [
    { x0: -1.9, x1: -1.0, sillY: floorY + 0.9, headY: floorY + 2.05 },  // window
    { x0: 0.6, x1: 1.5, sillY: null, headY: floorY + 2.05 },            // door
  ]);
  wallAlongX(back, [
    { x0: -0.5, x1: 0.7, sillY: floorY + 0.9, headY: floorY + 2.05 },   // window
  ]);

  function wallAlongZ(x) {
    const len = W - 2 * D4;
    box('bottom-plate', D4, T2, len, x, plateY, 0);
    box('top-plate', D4, T2, len, x, topY, 0);
    box('cap-plate', D4, T2, len, x, capY, 0);
    const n = Math.floor(len / SPACING);
    for (let i = 0; i <= n; i++) {
      const z = -len / 2 + T2 / 2 + i * ((len - T2) / n);
      box('stud', D4, studH, T2, x, studY, z);
    }
  }
  wallAlongZ(-L / 2 + D4 / 2);
  wallAlongZ(L / 2 - D4 / 2);

  // ============ roof framing (gable, ridge along X) ============
  const pitch = 0.75;                          // rise/run
  const ceilY = floorY + H;
  const ridgeH = (W / 2) * pitch;
  const ridgeY = ceilY + ridgeH;               // rafter-top height at the ridge
  const angle = Math.atan2(ridgeH, W / 2);
  const OV = 0.3;                              // eave overhang (horizontal)

  box('ridge-board', L, D10, T2, 0, ridgeY - D10 / 2 + 0.02, 0);
  const nRaft = Math.floor(L / 0.6);
  for (let i = 0; i <= nRaft; i++) {
    const x = -L / 2 + T2 / 2 + i * ((L - T2) / nRaft);
    for (const side of [-1, 1]) {
      // rafter runs from the ridge face down past the wall to the eave tip
      const run = W / 2 + OV - T2 / 2;
      const rafterLen = run / Math.cos(angle);
      const topZ = side * (T2 / 2), topY = ridgeY;
      const botZ = side * (W / 2 + OV), botY = ridgeY - run * pitch;
      const r = box('rafter', T2, D8, rafterLen, x,
        (topY + botY) / 2 - D8 / 2 * Math.cos(angle),
        (topZ + botZ) / 2);
      r.rotation.x = side * angle;
    }
    // ceiling joists tie the rafter feet
    box('ceiling-joist', T2, D8, W - 2 * D4, x, ceilY + D8 / 2 - T2, 0);
    if (i % 2 === 0 && i > 0 && i < nRaft) {
      box('collar-tie', T2, D4, W * 0.45, x, ridgeY - ridgeH * 0.33, 0);
    }
  }
  // gable studs on end walls
  for (const ex of [-L / 2 + D4 / 2, L / 2 - D4 / 2]) {
    for (let z = -W / 2 + 0.4; z < W / 2 - 0.2; z += 0.4) {
      const hh = Math.max(0.05, ridgeH - Math.abs(z) * pitch - D10);
      box('gable-stud', D4, hh, T2, ex, ceilY + hh / 2 + T2, z);
    }
  }

  // ============ sheathing & roofing (peelable layer) ============
  for (const side of [-1, 1]) {
    const run = W / 2 + OV;
    const slopeLen = run / Math.cos(angle);
    const s = box('roof-sheathing', L + 0.2, 0.012, slopeLen,
      0, (ridgeY + (ridgeY - run * pitch)) / 2 + 0.02, side * run / 2);
    s.rotation.x = side * angle;
  }
  box('wall-sheathing', L, H, 0.012, 0, floorY + H / 2, -W / 2 - 0.006 + 0.02);
  box('wall-sheathing', L, H, 0.012, 0, floorY + H / 2, W / 2 + 0.006 - 0.02);
  box('wall-sheathing', 0.012, H, W, -L / 2 - 0.006 + 0.02, floorY + H / 2, 0);
  box('wall-sheathing', 0.012, H, W, L / 2 + 0.006 - 0.02, floorY + H / 2, 0);

  // ============ plumbing ============
  // utility corner near back-left; fixtures at back wall
  const uhX = -2.2, uhZ = -1.2;
  cyl('water-heater', 0.28, 0.28, 0.9, uhX, floorY + 0.45, uhZ);
  cyl('main-shutoff', 0.05, 0.05, 0.12, -2.7, joistY, 1.2, Math.PI / 2);
  // cold main: enters under floor, rises to heater + branches to fixture wall
  pipe('cold-supply', [
    [-2.7, joistY, 1.6], [-2.7, joistY, 0.4], [uhX, joistY, uhZ + 0.4],
    [uhX, floorY + 0.95, uhZ + 0.28],
  ], 0.016);
  pipe('cold-supply', [
    [-2.7, joistY, 0.4], [1.6, joistY, 0.4], [1.6, joistY, -W / 2 + 0.35],
    [1.6, floorY + 0.6, -W / 2 + 0.35],
  ], 0.016);
  pipe('hot-supply', [
    [uhX - 0.1, floorY + 0.95, uhZ], [uhX - 0.1, joistY - 0.05, uhZ],
    [1.75, joistY - 0.05, 0.35], [1.75, joistY - 0.05, -W / 2 + 0.42],
    [1.75, floorY + 0.6, -W / 2 + 0.42],
  ], 0.016);
  // drain: fixture wall → main drain slope out front-left, with vent stack up through roof
  pipe('drain-line', [
    [1.68, floorY + 0.4, -W / 2 + 0.3], [1.68, joistY - 0.1, -W / 2 + 0.3],
    [-2.9, joistY - 0.28, -0.6], [-3.4, joistY - 0.34, -0.6],
  ], 0.045);
  pipe('vent-stack', [
    [1.68, joistY - 0.1, -W / 2 + 0.3], [1.68, floorY + H, -W / 2 + 0.3],
    [1.68, ridgeY + 0.35, -W / 2 + 0.9],
  ], 0.04);

  // ============ HVAC ============
  const fX = -2.2, fZ = 0.9;
  box('furnace', 0.55, 1.1, 0.55, fX, floorY + 0.55, fZ);
  box('supply-plenum', 0.45, 0.35, 0.45, fX, floorY + 1.28, fZ);
  pipe('flue', [[fX + 0.18, floorY + 1.1, fZ], [fX + 0.18, ridgeY + 0.3, fZ - 0.5]], 0.05);
  // supply trunk in attic + two branch ducts down to registers
  pipe('supply-duct', [
    [fX, floorY + 1.45, fZ], [fX, ceilY + 0.35, fZ], [2.3, ceilY + 0.35, 0.9],
  ], 0.12);
  pipe('supply-duct', [[0.0, ceilY + 0.35, 0.9], [0.0, ceilY - 0.02, 1.35]], 0.08);
  pipe('supply-duct', [[2.3, ceilY + 0.35, 0.9], [2.3, ceilY - 0.02, 1.35]], 0.08);
  box('supply-register', 0.3, 0.04, 0.15, 0.0, ceilY - 0.03, 1.5);
  box('supply-register', 0.3, 0.04, 0.15, 2.3, ceilY - 0.03, 1.5);
  // return: floor grille near center back to furnace under floor
  box('return-grille', 0.45, 0.04, 0.25, 0.4, floorY + 0.01, -0.9);
  pipe('return-duct', [
    [0.4, joistY, -0.9], [fX + 0.9, joistY, fZ], [fX, joistY, fZ], [fX, floorY + 0.3, fZ],
  ], 0.14);

  // ============ electrical ============
  box('electric-meter', 0.25, 0.35, 0.12, -L / 2 - 0.07, floorY + 1.5, -1.4);
  box('service-panel', 0.36, 0.6, 0.1, -L / 2 + D4 + 0.05, floorY + 1.45, -1.4);
  // branch circuits: panel → attic → drops
  pipe('branch-wire', [
    [-L / 2 + 0.15, floorY + 1.75, -1.4], [-L / 2 + 0.15, ceilY + 0.15, -1.4],
    [0.9, ceilY + 0.15, -1.5], [0.9, floorY + 1.15, -W / 2 + 0.08],
  ], 0.011);
  pipe('branch-wire', [
    [-L / 2 + 0.15, ceilY + 0.15, -1.4], [-0.8, ceilY + 0.15, 0.2],
  ], 0.011);
  pipe('branch-wire', [
    [-0.8, ceilY + 0.15, 0.2], [-0.8, floorY + 0.35, front - 0.06],
  ], 0.011);
  box('receptacle', 0.08, 0.12, 0.05, -0.8, floorY + 0.3, front - 0.04);
  box('receptacle', 0.08, 0.12, 0.05, 0.9, floorY + 0.3, -W / 2 + 0.06);
  box('light-switch', 0.08, 0.12, 0.05, 0.45, floorY + 1.15, front - 0.04);
  pipe('branch-wire', [
    [0.45, floorY + 1.2, front - 0.06], [0.45, ceilY + 0.15, front - 0.3],
    [-0.8, ceilY + 0.12, 0.2],
  ], 0.011);
  cyl('light-fixture', 0.16, 0.16, 0.07, -0.8, ceilY - 0.055, 0.2);

  return root;
}
