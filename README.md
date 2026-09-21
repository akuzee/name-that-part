# Name That Part

Seterra for objects: 3D quiz games that teach you what every part of a thing is
called. Load a 3D model whose subcomponents are named, and the harness turns it
into a click-the-part quiz — with see-through, explode, cut-away and layer-peel
controls so you can reach parts buried inside.

**▶ Play in your browser: https://akuzee.github.io/name-that-part/** — nothing
to install, download, or unzip.

## Run it locally

No build step, no bundler, no unzipping — the repo is the app.

```sh
git clone https://github.com/akuzee/name-that-part
cd name-that-part
node tools/serve.mjs        # → http://localhost:8023
```

That's it — every pack works immediately, offline, with nothing else to fetch.
Three.js is vendored in `vendor/`, the procedural models generate themselves at
load time, and the anatomy meshes ship in the repo as compressed glTF (35 MB
for all five packs). `npm install` is only needed for the dev tools.

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
| Human Skeleton | BodyParts3D 4.0 (CC BY 4.0) | 41 parts: skull bones, spine, thorax, limbs |
| Torso Organs | BodyParts3D | 37 parts: viscera + great vessels, ghosted rib cage |
| Heart | BodyParts3D | 14 parts: chambers, valve leaflets, papillary muscles, coronaries |
| Brain | BodyParts3D | 30 parts: gyri, deep structures, ventricles, brainstem |
| Major Muscles | BodyParts3D | 54 parts over a ghosted skeleton |
| House: Framing & Systems | procedural (`build.mjs`) | 41 part types: footing→ridge board, plumbing, HVAC, electrical |
| Inline-4 Engine | procedural | 29 part types: block, rotating assembly, valvetrain, bolt-ons |
| Whole Car | procedural | 38 parts: body panels + drivetrain, exhaust, fuel, suspension, steering, brakes under a ghosted shell |
| Animal Cell / Plant Cell | procedural | 14 parts each, textbook cutaway with organelles |
| Flower | procedural | 11 parts: all four whorls, ovules inside the ovary |
| Desktop PC | procedural | 24 parts: open ATX tower, board-level detail |
| CPU Package | procedural | 8 parts: die stack under a quarter-cut heat spreader |

Procedural models are generated as named Three.js meshes at load time — zero
licensing burden, guaranteed-correct names, tiny payload.

Anatomy packs are defined by code: `tools/anatomy-packs.mjs` holds a table of
`part → name-matching regex`, and `tools/build-anatomy.mjs` resolves it against
the BodyParts3D structure list, merges the matching meshes into one glTF per
pack, and writes the manifest. To regroup structures or add a pack, edit the
regex table and rebuild:

```sh
curl -L -o data/bp3d4/isa.zip \
  https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip
unzip -q data/bp3d4/isa.zip -d data/bp3d4/obj     # 2,234 named structures
node tools/build-anatomy.mjs --dry                # report matches
node tools/build-anatomy.mjs                      # build GLBs + manifests
```

The build merges each pack into one OBJ (each part an `o <partId>` object) and
runs it through `gltfpack -kn -cc`, which reindexes, quantizes and meshopt-
compresses — 620 MB of source geometry becomes 35 MB of glTF. gltfpack's
compression strips node names but preserves node order, so the builder writes
the part ids back onto the nodes afterwards and fails loudly if the counts
don't line up.


## Known limitation: model fidelity

The anatomy packs are detailed (real scan-derived meshes from BodyParts3D);
everything else is **deliberately schematic** — procedural primitives with
textbook proportions. Parts are correct and clickable, but a stud is a box and
a piston is a cylinder. This is the main area where contributions help:

- **Replace a procedural pack with a detailed model**: any glTF whose parts are
  separate, sensibly named meshes drops in — run
  `node tools/inspect-glb.mjs model.glb --manifest`, edit names/layers/quizzes,
  add a catalog entry. Vetted CC-BY candidates (engine, cell, flower, PC,
  phone teardown, car chassis) are listed with URLs in [BACKLOG.md](BACKLOG.md);
  most just need a free Sketchfab account to download plus a rename pass in
  Blender.
- **Upgrade a procedural builder**: each model is one self-contained
  `build.mjs` — more detailed geometry (bird's-mouthed rafters, a bored engine
  block, ribbed organelles) is a pure-code contribution with no asset pipeline.

## Sourcing real models (researched Sep 2026, see BACKLOG.md)

- **Anatomy**: BodyParts3D (CC BY 4.0) — ~940 individually named
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
tools/serve.mjs       zero-dependency static server (no npm install needed)
tools/inspect-glb.mjs GLB node-name report + manifest drafter
vendor/               three.js modules (pinned, no build step)
```
