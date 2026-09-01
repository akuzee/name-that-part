# Backlog

Deferred ideas with rationale. Research findings dated 2026-09-01.

## Content: real models (researched, pipelines known)

- **Anatomy: more packs / decimation** — five packs SHIPPED (2026-09-01):
  skeleton, torso organs, heart, brain, muscles, all via tools/fetch-anatomy.mjs
  from the BodyParts3D GitHub mirror (CC BY-SA 2.1 JP; ~940 structures, ~480
  used). Remaining ideas: hand/foot pack (individual carpals/tarsals as quiz
  targets, not groups), head & neck (eye, ear, larynx, salivary glands),
  deep muscles (intercostals, transversus — huge meshes, need decimation
  first). The muscles pack is 474MB of STL — meshoptimizer/gltfpack decimation
  pass would cut load time 5-10x if it ever feels slow. Z-Anatomy (CC BY-SA,
  Blender) has finer structures (heart chambers as cavities, more gyri) if
  BodyParts3D granularity runs out.
- **Sketchfab CC-BY automotive models** — verified candidates (all CC-BY 4.0,
  need a free Sketchfab account to download; archive promptly, Fab/Epic
  migration makes longevity uncertain):
  - devkrsm "4 Cylinder Engine" (57k tris) — sketchfab.com/3d-models/4-cylinder-engine-448e9e6fdd0c469ba14573f1a35c2ee0
  - MarekLeach "3D Printable Inline 4" (47k, per-part files) — sketchfab.com/3d-models/d9a626441161451cb9d802e0c8046550
  - avredu "Manual Transmission Gearbox With Differential" (347k, decimate) — sketchfab.com/3d-models/d48d46543d844857b31475e56f941410
  - Vladi "Brake Disk and Caliper" (6.2k) — sketchfab.com/3d-models/brake-disk-and-caliper-5feda9dbf20a49cf9fd29d550e55e4b9
  - Expect a rename pass in Blender (CAD names like `Body012`), then
    `tools/inspect-glb.mjs --manifest`.
- **iPhone 12 Teardown** (Peter_D, Sketchfab, CC-BY, 365k faces, separated
  display/battery/logic board/Taptic Engine/cameras) —
  sketchfab.com/3d-models/iphone-12-teardown-708eaa5d195544918e5f70b69eedcdfa
- **Framework Laptop 13/16** — official CAD, CC BY 4.0:
  github.com/FrameworkComputer/Framework-Laptop-13 (whole system, battery,
  display, hinges as STEP; FW16 repo has a 97MB populated mainboard STEP).
  Pipeline: FreeCAD/Blender STEP import (names carry through) → decimate → GLB.
- **Duplex Apartment IFC** (buildingSMART, CC BY 4.0) — real building with
  discipline-separated architecture/MEP/electrical/plumbing files, every
  element typed and named. Pipeline: Blender+Bonsai import → glTF, or
  IfcConvert with a GUID→name sidecar. Complements the procedural house with
  a *real* building. github.com/buildingsmart-community/Community-Sample-Test-Files
- **Avoid**: GrabCAD (non-commercial, non-redistributable), SketchUp 3D
  Warehouse (murky per-model terms), Smithsonian scans (fused single meshes),
  BlenderKit royalty-free (extractability clause conflicts with web serving).

## Harness features

- **Type-the-name mode** (reverse quiz: part highlighted, you type/choose the
  name) — doubles the learning direction; multiple-choice variant is easy.
- **Animation support** — the engine model begs for a "running" toggle (crank
  angle drives pistons analytically; glTF animations for downloaded models).
- **Per-quiz camera/layer presets** — e.g. plumbing quiz could start with
  framing ghosted; today the player does it by hand with the toolbox.
- **Click-through cycling** — when x-ray is on, repeated clicks at the same
  spot could cycle through the stack of parts under the cursor. Today: nearest
  pickable wins; rotate or section to reach deeper parts.
- **Instance-level parts** — quiz "left femur vs right femur" or "cylinder 1
  vs cylinder 3" (parts are currently concept-level by design).
- **Pin labels in explore mode** (persistent annotations, like an anatomy atlas).
- **Progress persistence** (localStorage per quiz, like Seterra's best scores).
- **Single-file artifact build** (map games has one; procedural models make
  this small — only vendor three.js is heavy, ~1.2MB minified).
- **Web-ifc runtime loading** — load IFC directly in the browser
  (@thatopen/components), skipping the conversion pipeline for BIM models.

## Known limits

- Raycast picking ignores the explode offset direction ambiguity: exploded
  parts pick fine, but section-plane filtering assumes unexploded positions
  are irrelevant (it tests actual hit points — OK).
- Procedural house rafters use a slight approximation at the ridge/eave cuts
  (boxes rotated, not bird's-mouthed) — visually fine, dimensionally schematic.
- No mobile-specific UI yet (toolbox crowds small screens).
