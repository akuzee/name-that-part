# Part Games

Seterra for objects: 3D quiz games that teach you what every part of a thing is
called. Load a 3D model whose subcomponents are named, and the harness turns it
into a click-the-part quiz — with see-through, explode, cut-away and layer-peel
controls so you can reach parts buried inside.

Sibling of `../map games` (same game loop and scoring, ported from 2D SVG maps
to 3D models).

## Run

```sh
node tools/serve.mjs        # → http://localhost:8023
```

## Play

- **Explore** mode: hover any part to see its name; click to spotlight it.
- **Quiz** mode: you're prompted with a part name; click it on the model.
  1st try = green, 2nd = yellow, 3rd = orange; after 3 misses the part flashes
  red while everything else fades — and you must click the revealed part to
  move on, so small buried parts actually register. A wrong click names the
  part you actually clicked — misses teach you the model. Parts that aren't in
  the current round render darkened.
- Solved parts fade to translucent by default so you can peel your way inward
  (toggle "Fade solved parts" off to keep them solid).
- **Option-click** (⌥) any part to hide it — dig straight down to a buried
  structure and click it directly; "Unhide all" in the toolbox restores them.
- View tools (right panel): **See-through** (x-ray), **Explode**, **Cut away**
  (section plane, axis-selectable and flippable), **Layers** (per-system
  visibility), drag to orbit, scroll to zoom, right-drag to pan.

## The harness idea

Everything is model-agnostic. A "model" is a folder under `data/models/<id>/`:

```
manifest.json    names, layers, quizzes, license
model.glb        (gltf source)  — or —  build.mjs  (procedural source)
```

A **part** is a concept, not a mesh: 30 stud meshes all map to part `stud`,
and clicking any of them answers "Stud". Mesh→part mapping:

- **Procedural** models tag meshes directly (`mesh.userData.part = 'stud'`).
- **glTF** models map node names via `nodeMap` rules in the manifest
  (`exact` / `prefix` / `regex` → part, or `ignore`), with automatic
  fallback: `"Left_Femur.003"` → part `left-femur`. Display names and layer
  assignments live in the manifest's `parts` dict; unmapped nodes self-register
  with prettified names.

Quizzes are declarative: `"parts": "all"`, an explicit id list, or
`{"layer": "plumbing"}`.

### Onboarding a downloaded model

```sh
node tools/inspect-glb.mjs downloaded.glb              # are the node names any good?
node tools/inspect-glb.mjs downloaded.glb --manifest   # draft a manifest.json
```

Then drop the `.glb` + edited manifest into `data/models/<id>/` and add an
entry to `data/index.json`. If node names are garbage (`Body012`), the model
needs a rename pass in Blender first — that's the main manual labor for any
downloaded model.

## Current content

| Model | Source | Parts |
|---|---|---|
| Human Skeleton | BodyParts3D (CC BY-SA 2.1 JP) | 41 parts: skull bones, spine, thorax, limbs |
| Torso Organs | BodyParts3D | 35 parts: viscera + great vessels, ghosted rib cage |
| Heart | BodyParts3D | 14 parts: wall, valves, papillary muscles, coronaries |
| Brain | BodyParts3D | 30 parts: gyri, deep structures, ventricles, brainstem |
| Major Muscles | BodyParts3D | 55 parts over a ghosted skeleton |
| House: Framing & Systems | procedural (`build.mjs`) | 41 part types: footing→ridge board, plumbing, HVAC, electrical |
| Inline-4 Engine | procedural | 29 part types: block, rotating assembly, valvetrain, bolt-ons |
| Whole Car | procedural | 38 parts: body panels + drivetrain, exhaust, fuel, suspension, steering, brakes under a ghosted shell |
| Animal Cell / Plant Cell | procedural | 14 parts each, textbook cutaway with organelles |
| Flower | procedural | 11 parts: all four whorls, ovules inside the ovary |
| Desktop PC | procedural | 24 parts: open ATX tower, board-level detail |
| CPU Package | procedural | 8 parts: die stack under a quarter-cut heat spreader |

Procedural models are generated as named Three.js meshes at load time — zero
licensing burden, guaranteed-correct names, tiny payload.

Anatomy packs share one STL cache, `data/bp3d/` (gitignored, ~600MB,
regenerable): `node tools/fetch-anatomy.mjs [pack…]` downloads from the
BodyParts3D GitHub mirror and rebuilds each pack's manifest. Name-matching is
code (the `PACKS` table in that script), so packs are reproducible and
tweakable — edit a part's regex to regroup structures, then re-run.

## Sourcing real models (researched Sep 2026, see BACKLOG.md)

- **Anatomy**: BodyParts3D (CC BY-SA 2.1 JP) — ~940 individually named
  structures as per-FMA-ID STLs on the Kevin-Mattheus-Moerman GitHub mirror;
  `parts_list_e.txt` maps FMA IDs → English names. Five packs shipped
  (skeleton, organs, heart, brain, muscles); Z-Anatomy (CC BY-SA) is the
  richer Blender-based alternative when finer structures are needed.
- **Cars**: Sketchfab CC-BY — verified candidates: devkrsm "4 Cylinder Engine"
  (57k tris), MarekLeach "3D Printable Inline 4", avredu gearbox+differential,
  Vladi brake assembly. Download needs a free Sketchfab account.
- **Phone**: Peter_D "iPhone 12 Teardown" (Sketchfab, CC-BY, separated parts).
- **Laptop**: Framework publishes official CAD (CC BY 4.0, GitHub) as STEP —
  convert via FreeCAD/Blender → GLB.
- **Buildings**: buildingSMART "Duplex Apartment" IFC set (CC BY 4.0) has named,
  typed MEP elements; convert via Blender+Bonsai or IfcConvert.
- GrabCAD and SketchUp 3D Warehouse: license problems, avoid.

## Project layout

```
index.html            app shell: library, model, play views
css/styles.css        dark theme + HUD/toolbox styling
js/data.js            catalog/manifest loading, node-name mapping, quiz resolution
js/viewer.js          the 3D harness: loading, picking, states, x-ray/explode/section/layers
js/engine.js          game loop (scoring identical to map games)
js/app.js             routing, library, toolbox wiring
data/index.json       model catalog
data/models/<id>/     manifest.json + model.glb or build.mjs
tools/serve.mjs       zero-dependency static server
tools/inspect-glb.mjs GLB node-name report + manifest drafter
vendor/               three.js modules (pinned, no build step)
```
