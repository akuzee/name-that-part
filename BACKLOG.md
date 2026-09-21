# Backlog

Deferred ideas with rationale. Research findings dated 2026-09-01.

## Content: real models (researched, pipelines known)

- **Anatomy: new packs now cheap to add** — five packs shipped, rebuilt
  2026-09-21 onto BodyParts3D 4.0 (CC BY 4.0) via tools/build-anatomy.mjs;
  620MB of source geometry now ships as 35MB of committed glTF. 4.0 has 2,234
  structures and we use ~630, so the obvious next packs are nearly free:
  **arteries (639 structures), veins (404), nerves (139), teeth**, plus a
  hand/foot pack (individual carpals/tarsals as targets) and head & neck
  (eye, ear, larynx). Add rows to tools/anatomy-packs.mjs and rebuild.
  Note 4.0 dropped some structures 3.0 had (whole lungs/liver, masseter,
  latissimus dorsi, rectus abdominis, quadratus lumborum, septum pellucidum);
  the builder falls back to the 3.0 STL cache for those, so keep data/bp3d/
  around when rebuilding. Z-Anatomy (CC BY-SA, Blender) remains the richer
  alternative if 4.0 granularity runs out.
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

- **Biology sourcing (researched 2026-09-01)**: NIH 3D models are single fused
  meshes (print-oriented) — unusable for part quizzes. Best real sources are
  Sketchfab CC-BY (free account needed): "Simple Animal Cell Model" (maryk),
  "Anatomy of a Flower" (arloopa, 22k tris), "Plant Cell | Biology" (okchs),
  bacterium (uid 19618642dad34d0b82219c162aa522e8). Z-Anatomy veterinary repo
  (CC-BY-SA, account-free) currently has only a pig. Procedural was endorsed
  for: neuron, DNA helix, leaf cross-section, bacterium — good future packs.
- **Computer sourcing (researched 2026-09-01)**: Sketchfab CC-BY "MotherBoard +
  Components" and "Custom Gaming PC" (account needed); Raspberry Pi official
  STEP CAD at pip.raspberrypi.com (account-free, license unstated — per-component
  named solids, needs STEP→GLB). Chip die/package: nothing open exists —
  procedural confirmed as the right call (shipped).
- **Whole-car sourcing (researched 2026-09-01)**: no free model has both named
  panels and named systems (those exist only as CC-BY-NC). CC-BY leads:
  Gerhald "Car Chassis" (641k tris), Lexyc16 Mercedes 300 SL. CC0 Kenney Car
  Kit (account-free) is the base if we ever want prettier panels (cut+name in
  Blender, ~1hr). Procedural whole-car shipped instead.

## AI 3D generation (researched 2026-09-21)

Assessed Tripo and Hunyuan3D for generating multi-part models. Verdict:
**generation cannot model internals it never saw** — an image-to-3D engine
yields a plausible exterior, never a piston or a die stack — so it cannot fix
the engine/chip/car packs. It is viable only for externally-visible subjects
(laptop, phone, bicycle, PC).
- **Tripo** is the only tool returning *semantically named* parts
  (`/v3/mesh/smartsegment`, `hint` steers vocabulary, ~$0.55-0.85/call,
  realistically $2-4/finished model). Free tier: **Tripo retains all rights to
  outputs** — unusable here; a paid plan grants full rights.
- **Hunyuan3D-Part / P3-SAM**: free, local, best-in-class mesh splitter, but
  unnamed segments and its licence **excludes the EU/UK/South Korea and that
  exclusion extends to outputs** — bad fit for a public repo.
- **PartCrafter / HoloPart**: MIT for code *and* weights, unnamed parts; add a
  VLM naming pass constrained to our existing answer key (~150 lines).
- **CubePart** (SIGGRAPH 2026) is exactly the tool we'd want — text prompt plus
  an open-vocabulary part schema — but no code is released. Watch it, and
  SAM3D-Part.
- Standing conclusion: real CAD assemblies already ship as named part
  hierarchies, so sourcing beats generating for mechanical topics.

## Model fidelity (top contribution target)

Only the BodyParts3D anatomy packs are high-detail; the procedural packs
(house, engine, car, cells, flower, PC, chip) are schematic primitives. Two
upgrade paths per pack, in order of preference:
1. Swap in a detailed CC-licensed glTF with named parts (candidates with URLs
   below — most need a free Sketchfab account + a Blender rename pass, then
   `tools/inspect-glb.mjs --manifest`).
2. Enrich the `build.mjs` geometry (pure code, no assets): bevels, bird's-mouth
   rafter cuts, bored engine block, lathed organelles, PCB texture detail.

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
