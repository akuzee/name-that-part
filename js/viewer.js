/*
 * Viewer: the model-agnostic 3D harness. Loads a manifest (glTF or procedural
 * builder), flattens the scene into a registry of named parts (a part = one
 * concept, possibly many meshes: 30 studs → part "stud"), and exposes the
 * interactions every quiz needs: picking, hover highlight, per-part visual
 * states, x-ray, explode, section cut, layer peeling, camera framing.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { mapNodeName, autoSlug, prettyName } from './data.js';

const STATE_COLORS = {
  'solved-0': 0x38c172, // green
  'solved-1': 0xe8b131, // yellow
  'solved-2': 0xe8722e, // orange
  missed: 0xe0455a,     // red
};
const GHOST_OPACITY = 0.14;
const SOLVED_GHOST_OPACITY = 0.3;
const XRAY_MIN_OPACITY = 0.08;

export class Viewer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x14161a);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;

    this.scene.add(new THREE.HemisphereLight(0xdde4f0, 0x2a2620, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x8899bb, 0.5);
    fill.position.set(-4, 2, -3);
    this.scene.add(fill);

    this.root = null;          // flattened model group
    this.parts = new Map();    // partId → {id,name,layer,quiz,meshes[],center}
    this.meshes = [];          // all part meshes
    this.layers = [];          // [{id,name}]
    this.layerVisible = new Map();

    this.states = new Map();   // partId → state string
    this.hovered = null;
    this.revealTarget = null;  // part temporarily spotlighted
    this.activeParts = null;   // Set of partIds in the current round (null = all)
    this.userHidden = new Set(); // parts the player alt-clicked away
    this.onHiddenChange = null;  // cb(count)
    this.ghostSolved = true;
    this.xray = 0;             // 0..1
    this.explode = 0;          // 0..1
    this.section = { axis: 'z', t: 1, flip: false, plane: new THREE.Plane() };
    this.interactive = true;

    this.onHover = null;       // cb(partId|null, ev)
    this.onPick = null;        // cb(partId, ev)

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._pulseUntil = 0;

    this._bindEvents();
    this._resize();
    this._raf = requestAnimationFrame(this._tick.bind(this));
  }

  // ---------- loading ----------
  async load(manifest) {
    this.unload();
    const src = manifest.source;
    let sceneRoot;
    if (src.kind === 'procedural') {
      const mod = await import(new URL(manifest.baseUrl + src.module, document.baseURI).href);
      sceneRoot = mod.build(THREE);
    } else if (src.kind === 'gltf') {
      const loader = new GLTFLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath('vendor/draco/');
      loader.setDRACOLoader(draco);
      const gltf = await loader.loadAsync(manifest.baseUrl + src.file);
      sceneRoot = gltf.scene;
    } else if (src.kind === 'stl-set') {
      // one STL per structure, part id assigned per file in the manifest
      sceneRoot = new THREE.Group();
      const loader = new STLLoader();
      const stub = new THREE.MeshStandardMaterial();
      let done = 0;
      const onProgress = this.onLoadProgress;
      const queue = [...src.files];
      const workers = Array.from({ length: 12 }, async () => {
        while (queue.length) {
          const { file, part } = queue.shift();
          const geo = await loader.loadAsync(manifest.baseUrl + (src.dir || '') + file);
          const mesh = new THREE.Mesh(geo, stub);
          mesh.userData.part = part;
          sceneRoot.add(mesh);
          if (onProgress) onProgress(++done, src.files.length);
        }
      });
      await Promise.all(workers);
    } else {
      throw new Error(`unknown source kind: ${src.kind}`);
    }
    if (src.rotate) sceneRoot.rotation.set(...src.rotate);
    this._ingest(sceneRoot, manifest);
    this._frameModel(manifest.camera);
  }

  /* Flatten to a single group of world-space meshes and build the part registry. */
  _ingest(sceneRoot, manifest) {
    sceneRoot.updateMatrixWorld(true);
    this.root = new THREE.Group();
    const partDefs = manifest.parts || {};
    const src = manifest.source;

    const meshes = [];
    sceneRoot.traverse((node) => { if (node.isMesh) meshes.push(node); });

    for (const mesh of meshes) {
      // part id: explicit tag from procedural builders, else name-mapped
      let partId = mesh.userData.part;
      if (!partId) {
        // glTF: a mesh may carry its parent Object3D's name (loader splits
        // multi-primitive meshes into children named after the parent)
        const name = mesh.name || mesh.parent?.name || '';
        const mapped = mapNodeName(name, src);
        if (!mapped || mapped.ignore) continue;
        partId = mapped.part;
      }

      const def = partDefs[partId] || {};
      if (def.quiz === 'exclude') continue;

      let part = this.parts.get(partId);
      if (!part) {
        part = {
          id: partId,
          name: def.name || prettyName(partId),
          layer: def.layer || null,
          quiz: def.quiz !== false,
          meshes: [],
        };
        this.parts.set(partId, part);
      }

      // bake world transform so explode/section work on a flat list
      const world = mesh.matrixWorld.clone();
      const m = mesh.clone();
      m.geometry = mesh.geometry;
      world.decompose(m.position, m.quaternion, m.scale);

      // own material instance per mesh so states can mutate freely
      const srcMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      m.material = this._gameMaterial(srcMat, def, manifest);
      m.userData = { part: partId };
      part.meshes.push(m);
      this.meshes.push(m);
      this.root.add(m);
    }
    this.scene.add(this.root);

    // per-mesh centers + model bounds → explode vectors
    const bbox = new THREE.Box3().setFromObject(this.root);
    this.bounds = bbox;
    this.modelCenter = bbox.getCenter(new THREE.Vector3());
    this.modelRadius = bbox.getSize(new THREE.Vector3()).length() / 2;
    for (const m of this.meshes) {
      const c = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3());
      m.userData.basePos = m.position.clone();
      const dir = c.clone().sub(this.modelCenter);
      if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
      m.userData.explodeDir = dir.normalize();
    }
    for (const part of this.parts.values()) {
      const b = new THREE.Box3();
      for (const m of part.meshes) b.expandByObject(m);
      part.center = b.getCenter(new THREE.Vector3());
      part.bounds = b;
    }

    // layers
    this.layers = manifest.layers || [];
    this.layerVisible = new Map(this.layers.map((l) => [l.id, !l.startHidden]));
    this.ghostLayers = new Set(this.layers.filter((l) => l.ghost).map((l) => l.id));

    this._applySection();
    this.applyAppearance();
  }

  _gameMaterial(srcMat, def, manifest) {
    const layerDef = (manifest.layers || []).find((l) => l.id === def.layer);
    let color;
    if (def.color) color = new THREE.Color(def.color);
    else if (srcMat?.color && manifest.source.kind === 'gltf') color = srcMat.color.clone();
    else if (layerDef?.color) color = new THREE.Color(layerDef.color);
    else color = new THREE.Color(0x8b939e);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: srcMat?.roughness ?? 0.75,
      metalness: srcMat?.metalness ?? 0.05,
      map: manifest.source.kind === 'gltf' ? (srcMat?.map ?? null) : null,
      side: THREE.DoubleSide,
      clippingPlanes: [this.section.plane],
      clipShadows: true,
    });
    mat.userData.baseColor = color.clone();
    return mat;
  }

  unload() {
    if (this.root) {
      this.scene.remove(this.root);
      for (const m of this.meshes) m.material.dispose();
    }
    this.root = null;
    this.parts = new Map();
    this.meshes = [];
    this.states = new Map();
    this.hovered = null;
    this.revealTarget = null;
    this.activeParts = null;
    this.userHidden = new Set();
    this.xray = 0;
    this.explode = 0;
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this.unload();
    this.controls.dispose();
    this.renderer.dispose();
  }

  // ---------- appearance ----------
  setPartState(partId, state) {
    if (state === null) this.states.delete(partId);
    else this.states.set(partId, state);
    this.applyAppearance();
  }
  clearStates() {
    this.states = new Map();
    this.revealTarget = null;
    this.applyAppearance();
  }

  /* limit the "active" (undimmed) parts to the current round; null = all */
  setActiveParts(ids) {
    this.activeParts = ids;
    this.applyAppearance();
  }

  toggleHidden(partId) {
    if (this.userHidden.has(partId)) this.userHidden.delete(partId);
    else this.userHidden.add(partId);
    this.applyAppearance();
    if (this.onHiddenChange) this.onHiddenChange(this.userHidden.size);
  }

  unhideAll() {
    if (this.userHidden.size === 0) return;
    this.userHidden.clear();
    this.applyAppearance();
    if (this.onHiddenChange) this.onHiddenChange(0);
  }
  setGhostSolved(v) { this.ghostSolved = v; this.applyAppearance(); }
  setXray(v) { this.xray = v; this.applyAppearance(); }

  setExplode(v) {
    this.explode = v;
    const d = this.explode * this.modelRadius * 0.9;
    for (const m of this.meshes) {
      m.position.copy(m.userData.basePos).addScaledVector(m.userData.explodeDir, d);
    }
  }

  setSection(axis, t, flip) {
    if (axis !== undefined) this.section.axis = axis;
    if (t !== undefined) this.section.t = t;
    if (flip !== undefined) this.section.flip = flip;
    this._applySection();
  }
  _applySection() {
    const { axis, t, flip, plane } = this.section;
    const n = new THREE.Vector3(
      axis === 'x' ? -1 : 0, axis === 'y' ? -1 : 0, axis === 'z' ? -1 : 0
    );
    if (flip) n.negate();
    if (!this.bounds) return;
    const min = this.bounds.min[axis], max = this.bounds.max[axis];
    const pad = (max - min) * 0.001 + 1e-6;
    // t=1 → plane fully outside (nothing cut); t=0 → everything cut
    const pos = flip ? max - t * (max - min) - pad : min + t * (max - min) + pad;
    const point = new THREE.Vector3();
    point[axis] = pos;
    plane.setFromNormalAndCoplanarPoint(n, point);
  }

  setLayerVisible(layerId, v) {
    this.layerVisible.set(layerId, v);
    this.applyAppearance();
  }

  /* One pass: state + xray + layer + hover + reveal → material props. */
  applyAppearance() {
    const revealOn = this.revealTarget !== null;
    for (const part of this.parts.values()) {
      const state = this.states.get(part.id) || 'normal';
      const layerOn = !part.layer || this.layerVisible.get(part.layer) !== false;
      const solved = state.startsWith('solved-') || state === 'missed';

      let visible = layerOn;
      let opacity = 1;
      let color = null;
      let pickable = layerOn;
      // parts outside the current round render dark so quiz targets stand out
      const dim = this.activeParts && !this.activeParts.has(part.id) && !solved;

      if (state === 'hidden' || this.userHidden.has(part.id)) { visible = false; pickable = false; }
      else if (state === 'ghost') { opacity = GHOST_OPACITY; pickable = false; }
      else if (part.layer && this.ghostLayers?.has(part.layer)) {
        // context layer: always translucent, never blocks clicks
        opacity = GHOST_OPACITY; pickable = false;
      }
      else if (solved) {
        color = STATE_COLORS[state];
        if (this.ghostSolved) { opacity = SOLVED_GHOST_OPACITY; pickable = false; }
      } else if (this.xray > 0) {
        opacity = Math.max(XRAY_MIN_OPACITY, 1 - this.xray);
      }

      if (revealOn) {
        if (part.id === this.revealTarget) {
          // force the reveal through user-hides; stays clickable to acknowledge
          opacity = 1; visible = layerOn; pickable = layerOn;
        } else {
          opacity = Math.min(opacity, 0.08);
          pickable = false;
        }
      }

      const hoverBoost = this.hovered === part.id && !solved && !revealOn;
      part.pickable = pickable && visible;
      for (const m of part.meshes) {
        m.visible = visible;
        const mat = m.material;
        mat.color.copy(color !== null ? new THREE.Color(color) : mat.userData.baseColor);
        // linear-space multiply: 0.07 linear ≈ one third perceptual brightness
        if (dim && !revealOn) mat.color.multiplyScalar(0.07);
        mat.transparent = opacity < 1;
        mat.opacity = opacity;
        mat.depthWrite = opacity >= 0.5;
        mat.emissive.setHex(hoverBoost ? 0x2255aa : 0x000000);
        if (hoverBoost) mat.emissiveIntensity = 0.9;
      }
    }
  }

  setHovered(partId) {
    if (this.hovered === partId) return;
    this.hovered = partId;
    this.applyAppearance();
  }

  /* Spotlight one part (used for reveals + explore clicks). Restores on null. */
  setReveal(partId) {
    this.revealTarget = partId;
    this.applyAppearance();
    this._pulseUntil = partId ? performance.now() + 60000 : 0;
  }

  flashWrong(partId) {
    const part = this.parts.get(partId);
    if (!part) return;
    for (const m of part.meshes) {
      m.material.emissive.setHex(0xcc2233);
      m.material.emissiveIntensity = 0.9;
    }
    setTimeout(() => this.applyAppearance(), 550);
  }

  // ---------- picking ----------
  _bindEvents() {
    let downPos = null;
    this.canvas.addEventListener('pointerdown', (ev) => {
      downPos = [ev.clientX, ev.clientY];
    });
    this.canvas.addEventListener('pointerup', (ev) => {
      if (!downPos) return;
      const moved = Math.abs(ev.clientX - downPos[0]) + Math.abs(ev.clientY - downPos[1]) > 6;
      downPos = null;
      if (moved || !this.interactive) return;
      const partId = this.pick(ev);
      if (!partId) return;
      if (ev.altKey) {
        // alt-click hides an obstructing part (restore via "Unhide all")
        if (partId !== this.revealTarget) this.toggleHidden(partId);
        return;
      }
      if (this.onPick) this.onPick(partId, ev);
    });
    this.canvas.addEventListener('pointermove', (ev) => {
      if (!this.interactive) return;
      this._lastMove = ev;
    });
    this.canvas.addEventListener('pointerleave', () => {
      this.setHovered(null);
      if (this.onHover) this.onHover(null, null);
    });
    window.addEventListener('resize', () => this._resize());
  }

  pick(ev) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.meshes, false);
    for (const h of hits) {
      const part = this.parts.get(h.object.userData.part);
      if (!part || !part.pickable) continue;
      // respect the section cut: skip surfaces that are clipped away
      if (this.section.t < 1 && this.section.plane.distanceToPoint(h.point) < 0) continue;
      return part.id;
    }
    return null;
  }

  // ---------- camera ----------
  _frameModel(cameraHint) {
    const size = this.bounds.getSize(new THREE.Vector3());
    const dist = Math.max(size.x, size.y, size.z) * 1.4 / Math.tan((this.camera.fov * Math.PI) / 360) * 0.5;
    const theta = cameraHint?.theta ?? 0.7;   // radians around Y
    const phi = cameraHint?.phi ?? 1.15;      // from +Y axis
    const zoom = cameraHint?.zoom ?? 1;
    const d = dist * zoom;
    this.camera.position.set(
      this.modelCenter.x + d * Math.sin(phi) * Math.sin(theta),
      this.modelCenter.y + d * Math.cos(phi),
      this.modelCenter.z + d * Math.sin(phi) * Math.cos(theta)
    );
    this.camera.near = d / 100;
    this.camera.far = d * 20;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(this.modelCenter);
    this.controls.update();
    this._homeCam = {
      pos: this.camera.position.clone(),
      target: this.controls.target.clone(),
    };
  }

  resetView() {
    if (!this._homeCam) return;
    this.camera.position.copy(this._homeCam.pos);
    this.controls.target.copy(this._homeCam.target);
    this.controls.update();
  }

  /* screen-space position of a part's center (for labels) */
  screenPos(partId) {
    const part = this.parts.get(partId);
    if (!part) return null;
    const v = part.center.clone().project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + ((v.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - v.y) / 2) * rect.height,
    };
  }

  // ---------- loop ----------
  _resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _tick(now) {
    this._raf = requestAnimationFrame(this._tick.bind(this));
    const rect = this.canvas.getBoundingClientRect();
    if (this.canvas.width !== Math.floor(rect.width * this.renderer.getPixelRatio())) this._resize();
    this.controls.update();

    // hover raycast, throttled to the frame
    if (this._lastMove && this.root) {
      const partId = this.pick(this._lastMove);
      if (partId !== this.hovered) {
        this.setHovered(partId);
        if (this.onHover) this.onHover(partId, this._lastMove);
      } else if (this.onHover && partId) {
        this.onHover(partId, this._lastMove);
      }
      this._lastMove = null;
    }

    // reveal pulse
    if (this.revealTarget && now < this._pulseUntil) {
      const part = this.parts.get(this.revealTarget);
      if (part) {
        const k = (Math.sin(now / 130) + 1) / 2;
        for (const m of part.meshes) {
          m.material.emissive.setHex(0xe0455a);
          m.material.emissiveIntensity = 0.25 + k * 0.9;
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
