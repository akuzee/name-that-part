# Model sources

Results of a source sweep (2026-09-22). Everything here was verified live —
licenses quoted from the actual page/API, downloads tested with curl.

**Rule for this repo: CC0 / CC-BY / CC-BY-SA / MIT only.** NC and ND are
disqualifying (this is a public repo that redistributes the meshes). A
"Standard Digital File License" on Printables is *not* Creative Commons and is
also disqualifying.

## Shipped

| Pack | Source | License |
|---|---|---|
| 5 anatomy packs | [BodyParts3D 4.0](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html) | CC BY 4.0 |
| Turbofan | [krabduke/f110-turbofan](https://github.com/krabduke/f110-turbofan) | MIT |

## Bucket A — account-free, fetchable now

Not yet integrated; `curl` works today.

| Subject | URL | License | Notes |
|---|---|---|---|
| Apollo 11 hatch mechanism | Commons API: `action=query&list=search&srsearch=Apollo 11 Hatch Crew Smithsonian filetype:3d` | **CC0** | 334 STLs, ~150 named mechanism parts (`Latch Arm`, `Main Ratchet Gear`, `Ball Follower`, `Plunger`). Rich ratchet/linkage assembly. Needs curation — many files are plain pins/bushings, and Commons throttles hard (use a real UA + 1.5s delay). |
| Z-Anatomy | [Models-of-human-anatomy](https://github.com/Z-Anatomy/Models-of-human-anatomy) `Z-Anatomy.zip`, 87MB | CC BY-SA 4.0 | Finer than BodyParts3D: eye, ear, teeth. Blender → glTF export needed. |
| Z-Anatomy for web | [nqwrc/3d-anatomy](https://github.com/nqwrc/3d-anatomy) `public/models/*.glb` | CC BY-SA | 7 GLBs by system, already web-ready, Terminologia Anatomica names. |
| Low-poly vehicles | [OpenGameArt](https://opengameart.org/sites/default/files/free_low_poly_vehicles_pack_by_rgsdev.zip) | **CC0** | 20 vehicles, FBX. Only body/wheels/lights granularity. |
| Cutaway lock (partial) | `https://files.printables.com/media/prints/250197/stls/<id_uuid>/<name>.stl` | CC BY | CDN serves anonymously (verified `core.stl`, `driver-standard.stl`), but the other 19 UUIDs are only in the Cloudflare-blocked page. Grab the file list in a browser, then curl. |

**Provenance-flagged — decide before shipping:**
- [ETA-6497 watch movement](https://github.com/jmogl/ETA-6497_Watch_Movement_Sim) — GLB with **221 named horology parts** (`105_BarrelBridge`, `180_BarrelMainSpring`, `201_CenterWheel`). Repo is MIT, but its README says the meshes derive from a GrabCAD model, and GrabCAD's terms are non-commercial/no-redistribution. The MIT stamp may not be the author's to give. Would be a superb pack; needs a licensing call first.
- Khronos [2CylinderEngine](https://github.com/KhronosGroup/glTF-Sample-Models) / GearboxAssy — **no explicit license**, and dropped from the successor sample repo. 2CylinderEngine names only piston/rod/lifter; GearboxAssy is all `body_N`.

## Bucket B — needs a free account (download in a browser, then drop in)

Both Printables and Thingiverse now gate downloads: Thingiverse's `download:` endpoint
returns 403 and `/zip` redirects to HTML; Printables goes through an authenticated
GraphQL mutation. A free account on each unlocks all of it.

### Biology — the strongest haul; filenames are already part labels
| Subject | URL | License |
|---|---|---|
| Animal cell | [printables 1144666](https://www.printables.com/model/1144666-animal-cell-model) | CC BY |
| Animal cell (alt) | [printables 399944](https://www.printables.com/model/399944-animal-cell) | CC BY |
| Animal **+** plant cell kit | [thing:1242293](https://www.thingiverse.com/thing:1242293) | CC BY |
| Plant cell | [printables 295227](https://www.printables.com/model/295227-small-plant-cell-model-for-biology) | **CC0** |
| Plant cell (alt) | [printables 149969](https://www.printables.com/model/149969-plant-cell-organells) | CC BY |
| DNA (base-level) | [printables 187539](https://www.printables.com/model/187539-folding-dna-model-kit) | CC BY |
| DNA | [printables 124897](https://www.printables.com/model/124897-dna-model) | **CC0** |
| Leaf cross-section | [printables 1208610](https://www.printables.com/model/1208610-leaf-anatomy-layers-structure) | CC BY-SA |
| Flower (peony) | [printables 1650501](https://www.printables.com/model/1650501-paeonia-sp-peony) | CC BY-SA |
| Eyeball (exterior) | [printables 166884](https://www.printables.com/model/166884-eyeball) | **CC0** |
| Horse skeleton | [printables 365835](https://www.printables.com/model/365835-horse-skeleton) | CC BY |
| Dog skull & spine | [thing:2121839](https://www.thingiverse.com/thing:2121839) | CC BY |
| Bacteriophage | [printables 764074](https://www.printables.com/model/764074-virus-bacteriophage-biology-model) | GPL-2.0 |

### Mechanisms
| Subject | URL | License |
|---|---|---|
| Door lock (cutaway) | [printables 250197](https://www.printables.com/model/250197-cutaway-lock) | CC BY |
| 4-stroke engine | [thing:4082307](https://www.thingiverse.com/thing:4082307) | CC BY |
| Electric motor | [thing:5857212](https://www.thingiverse.com/thing:5857212) | CC BY |
| Mechanical watch | [thing:1249221](https://www.thingiverse.com/thing:1249221) | CC BY |
| Pendulum clock | [thing:328569](https://www.thingiverse.com/thing:328569) | CC BY-SA |
| SLR camera | [thing:113865](https://www.thingiverse.com/thing:113865) | CC BY-SA |
| Turbofan (CFM56 cutaway) | [thing:7208822](https://www.thingiverse.com/thing:7208822) | CC BY-SA |
| Automatic transmission | [thing:34778](https://www.thingiverse.com/thing:34778) | CC BY-SA |
| Differential | [printables 1020154](https://www.printables.com/model/1020154-functional-differential-gear-system) | CC BY-SA |
| V8 engine | [printables 278110](https://www.printables.com/model/278110-v8-engine-mechanical-movement) | CC 4.0 (confirm flavor) |
| 2-stroke engine | [thing:4647106](https://www.thingiverse.com/thing:4647106) | likely CC BY, confirm |
| 3-speed gearbox | [thing:4654447](https://www.thingiverse.com/thing:4654447) | likely CC BY, confirm |

### Sketchfab (free account)
Engine/gearbox/brake/teardown candidates from the earlier sweep are in
[BACKLOG.md](BACKLOG.md). Newly added: [front derailleur](https://sketchfab.com/3d-models/front-derailleur-a8cf28f7f414420f8a672a864425fd46)
(CC BY), [fixed-gear bike](https://sketchfab.com/3d-models/fixed-gear-bike-8a1d2e6bfd704556b5be85ca9998997f) (CC BY),
AM4 processor with die, and a keyboard switch with internal mechanism.

## Textures (CC0, account-free)

Shipped: [Poly Haven `studio_small_09` 1K HDRI](https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr).

If a pack ever needs real surface texture, both sources are CC0 with curl-able CDNs:
- **ambientCG**: `https://ambientcg.com/get?file=<AssetID>_1K-JPG.zip` (`Wood060`,
  `Planks021`, `Metal009`, `Metal055A`, `Chip004`/`Chip005` for PCB, `Rubber004`).
  Keep only Color/NormalGL/Roughness/AO/Metalness; recompress to 512px (~12x smaller).
- **Poly Haven**: per-map, no zip cruft —
  `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/<slug>/<slug>_{diff,nor_gl,arm}_1k.jpg`.
  Its `arm` map packs AO/Roughness/Metalness into one file, which is exactly what
  three.js reads (R/G/B respectively).

Verdict from testing: at diagram scale the HDRI plus tuned PBR parameters gets most
of the realism; texture files are garnish. Don't ship 1K sets for everything.

## Disqualified — don't re-research these

| Source | Why |
|---|---|
| GrabCAD | ToS: non-commercial, internal use, no redistribution right |
| MorphoSource | `CommercialUseNotPermitted`, plus per-file institutional approval |
| DMG-Lib / Europeana mechanisms | CC BY-NC-ND (painful — excellent mechanism CAD) |
| DigiMorph | Commercial reproduction/redistribution prohibited |
| Toyota 22RE engine + 5-speed (thing:644933, 713815) | CC BY-NC (the best-known working engine models) |
| InterlinkKnight Allison 6-speed (thing:1094616) | CC BY-NC |
| Honey bee (printables 404917) | CC BY-NC (naming was ideal) |
| Tooth implant (printables 1029643) | CC BY-NC-ND |
| garan1610/cell-architecture-studio | MIT-stamped but meshes are Sketchfab rips (`Object_0…3`) and Tripo AI output; provenance laundered |
| NIH 3D | Single fused print meshes — no parts to click |
| Smithsonian / MyMiniFactory scans | Fused single meshes |
| OpenGameArt bicycle | Verified: one fused mesh |
| Onshape | Free-plan public docs grant rights by ToS, not a license; account needed even to view |
| Thangs, Phenome10K | Bot-walled (403), unverifiable |
| FreePBR | Not CC0 — prohibits redistributing the texture files |

## Subjects with nothing usable (build procedurally)

Neuron, bacterium, insect/bee anatomy, tooth, ear, bicycle (full assembly),
guitar, piano action, faucet, toilet, furnace, refrigerator, washing machine,
power drill, dog/cat skeletons.
