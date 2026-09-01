/*
 * Build anatomy packs from the BodyParts3D GitHub mirror
 * (github.com/Kevin-Mattheus-Moerman/BodyParts3D, CC BY-SA 2.1 JP).
 *
 * Structures are matched by English name (parts_list_e.txt) with anchored
 * regexes, bucketed into concept-level parts (left+right merged, subparts
 * grouped), downloaded as per-FMA-ID binary STLs into the shared cache
 * data/bp3d/, and each pack's manifest.json is generated.
 *
 * Usage:
 *   node tools/fetch-anatomy.mjs --dry [pack…]   # show matching, no downloads
 *   node tools/fetch-anatomy.mjs [pack…]         # build (default: all packs)
 * Packs: skeleton organs brain heart muscles
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CACHE = path.join(root, 'data/bp3d');
const RAW = 'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data';
const ATTRIB = 'BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution-Share Alike 2.1 Japan (via github.com/Kevin-Mattheus-Moerman/BodyParts3D).';

const dry = process.argv.includes('--dry');
const wanted = process.argv.slice(2).filter((a) => a !== '--dry');

/* part tuple: [partId, displayName, layer, regex, {color?, quiz?}?]
 * regex is anchored and tested against the lowercased English name.
 * S = "(right|left) " prefix helper, OF = "of (the )?(right|left) " infix. */
const S = '(right|left) ';
const BONE = '#e8e0cf';

const PACKS = {
  // ================= SKELETON =================
  skeleton: {
    title: 'Human Skeleton',
    blurb: 'Every bone from the BodyParts3D anatomical database — skull, spine, thorax and limbs.',
    camera: { theta: 0.5, phi: 1.35, zoom: 0.9 },
    layers: [
      ['skull', 'Skull'], ['spine', 'Spine'], ['thorax', 'Thorax'],
      ['upper-limb', 'Upper limb'], ['lower-limb', 'Lower limb'],
    ].map(([id, name]) => ({ id, name, color: BONE })),
    parts: [
      ['frontal-bone', 'Frontal bone', 'skull', 'frontal bone'],
      ['parietal-bone', 'Parietal bone', 'skull', `${S}parietal bone`],
      ['temporal-bone', 'Temporal bone', 'skull', `${S}temporal bone`],
      ['occipital-bone', 'Occipital bone', 'skull', 'occipital bone'],
      ['sphenoid', 'Sphenoid bone', 'skull', 'sphenoid( bone)?'],
      ['ethmoid', 'Ethmoid bone', 'skull', 'ethmoid( bone)?'],
      ['zygomatic-bone', 'Zygomatic bone (cheekbone)', 'skull', `${S}zygomatic bone`],
      ['maxilla', 'Maxilla', 'skull', `${S}maxilla`],
      ['nasal-bone', 'Nasal bone', 'skull', `${S}nasal bone`],
      ['vomer', 'Vomer', 'skull', 'vomer'],
      ['mandible', 'Mandible (jawbone)', 'skull', 'mandible'],
      ['hyoid', 'Hyoid bone', 'skull', 'hyoid( bone)?'],
      ['atlas', 'Atlas (C1)', 'spine', 'atlas'],
      ['axis', 'Axis (C2)', 'spine', 'axis'],
      ['cervical-vertebrae', 'Cervical vertebrae (C3–C7)', 'spine', '(third|fourth|fifth|sixth|seventh) cervical vertebra'],
      ['thoracic-vertebrae', 'Thoracic vertebrae (T1–T12)', 'spine', '\\w+ thoracic vertebra'],
      ['lumbar-vertebrae', 'Lumbar vertebrae (L1–L5)', 'spine', '\\w+ lumbar vertebra'],
      ['sacrum', 'Sacrum', 'spine', 'sacrum'],
      ['manubrium', 'Manubrium of sternum', 'thorax', 'manubrium'],
      ['sternum-body', 'Body of sternum', 'thorax', 'body of sternum'],
      ['xiphoid', 'Xiphoid process', 'thorax', 'xiphoid process'],
      ['rib', 'Rib', 'thorax', `${S}\\w+ rib`],
      ['costal-cartilage', 'Costal cartilage', 'thorax', `${S}\\w+ costal cartilage`, { color: '#cfd8dc' }],
      ['clavicle', 'Clavicle (collarbone)', 'upper-limb', `${S}clavicle`],
      ['scapula', 'Scapula (shoulder blade)', 'upper-limb', `${S}scapula`],
      ['humerus', 'Humerus', 'upper-limb', `${S}humerus`],
      ['radius', 'Radius', 'upper-limb', `${S}radius`],
      ['ulna', 'Ulna', 'upper-limb', `${S}ulna`],
      ['carpal-bones', 'Carpal bones (wrist)', 'upper-limb', `${S}(scaphoid|lunate|triquetral|triquetrum|pisiform|trapezium|trapezoid|capitate|hamate)( bone)?`],
      ['metacarpals', 'Metacarpal bones', 'upper-limb', `${S}\\w+ metacarpal( bone)?`],
      ['hand-phalanges', 'Phalanges of the hand', 'upper-limb', `(proximal|middle|distal) phalanx of ${S}(thumb|index finger|middle finger|ring finger|little finger)`],
      ['hip-bone', 'Hip bone (pelvis)', 'lower-limb', `${S}hip bone`],
      ['femur', 'Femur', 'lower-limb', `${S}femur`],
      ['patella', 'Patella (kneecap)', 'lower-limb', `${S}patella`],
      ['tibia', 'Tibia (shinbone)', 'lower-limb', `${S}tibia`],
      ['fibula', 'Fibula', 'lower-limb', `${S}fibula`],
      ['talus', 'Talus', 'lower-limb', `${S}talus`],
      ['calcaneus', 'Calcaneus (heel bone)', 'lower-limb', `${S}calcaneus`],
      ['tarsal-bones', 'Tarsal bones (navicular, cuboid, cuneiforms)', 'lower-limb',
        `(navicular bone of ${S}foot|${S}cuboid bone|${S}(medial|intermediate|lateral) cuneiform( bone)?)`],
      ['metatarsals', 'Metatarsal bones', 'lower-limb', `${S}\\w+ metatarsal( bone)?`],
      ['foot-phalanges', 'Phalanges of the foot', 'lower-limb', `(proximal|middle|distal) phalanx of ${S}(great|second|third|fourth|fifth) toe`],
    ],
    quizzes: [
      { id: 'major', title: 'Major bones', subtitle: 'The ones everyone should know',
        parts: ['mandible', 'clavicle', 'scapula', 'sternum-body', 'rib', 'humerus', 'radius',
          'ulna', 'cervical-vertebrae', 'thoracic-vertebrae', 'lumbar-vertebrae', 'sacrum',
          'hip-bone', 'femur', 'patella', 'tibia', 'fibula', 'calcaneus'] },
      { id: 'skull', title: 'Skull', subtitle: 'Cranial and facial bones', parts: { layer: 'skull' } },
      { id: 'spine-thorax', title: 'Spine & thorax', subtitle: 'Vertebrae, ribs and sternum',
        parts: ['atlas', 'axis', 'cervical-vertebrae', 'thoracic-vertebrae', 'lumbar-vertebrae',
          'sacrum', 'manubrium', 'sternum-body', 'xiphoid', 'rib', 'costal-cartilage'] },
      { id: 'limbs', title: 'Limbs', subtitle: 'Arms, legs, hands and feet',
        parts: ['clavicle', 'scapula', 'humerus', 'radius', 'ulna', 'carpal-bones', 'metacarpals',
          'hand-phalanges', 'hip-bone', 'femur', 'patella', 'tibia', 'fibula', 'talus',
          'calcaneus', 'tarsal-bones', 'metatarsals', 'foot-phalanges'] },
      { id: 'all', title: 'Everything', subtitle: 'The complete skeleton', parts: 'all' },
    ],
  },

  // ================= ORGANS =================
  organs: {
    title: 'Torso Organs',
    blurb: 'Heart, lungs, digestive tract, kidneys and the great vessels — inside a ghosted rib cage.',
    camera: { theta: 0.35, phi: 1.35, zoom: 0.8 },
    layers: [
      { id: 'respiratory', name: 'Respiratory', color: '#e8b4b0' },
      { id: 'digestive', name: 'Digestive', color: '#d9a066' },
      { id: 'urinary', name: 'Urinary & endocrine', color: '#b05f4f' },
      { id: 'vessels', name: 'Great vessels', color: '#b04040' },
      { id: 'other', name: 'Heart & other', color: '#c25450' },
      { id: 'context', name: 'Skeleton (context)', color: BONE },
    ],
    parts: [
      ['heart', 'Heart', 'other', 'wall of heart', { color: '#b8433f' }],
      ['diaphragm', 'Diaphragm', 'other', 'diaphragm', { color: '#c98a7c' }],
      ['thymus', 'Thymus', 'other', `${S}lobe of thymus`, { color: '#d8a89a' }],
      ['lung', 'Lung', 'respiratory', '((upper|middle|lower) lobe of (left |right )?lung)', { color: '#e0a8a4' }],
      ['trachea', 'Trachea (windpipe)', 'respiratory', 'trachea', { color: '#e5d5c5' }],
      ['bronchus', 'Bronchus', 'respiratory', 'bronchus', { color: '#dcc8b8' }],
      ['thyroid-cartilage', 'Thyroid cartilage', 'respiratory', 'thyroid cartilage', { color: '#e5d5c5' }],
      ['esophagus', 'Esophagus', 'digestive', 'esophagus', { color: '#cf9670' }],
      ['stomach', 'Stomach', 'digestive', 'stomach', { color: '#d9a066' }],
      ['duodenum', 'Duodenum', 'digestive', 'duodenum', { color: '#cf8f5c' }],
      ['small-intestine', 'Small intestine (jejunum & ileum)', 'digestive', '(jejunum|ileum)', { color: '#daa878' }],
      ['colon', 'Colon (large intestine)', 'digestive', 'colon, nsn', { color: '#c08850' }],
      ['appendix', 'Appendix', 'digestive', 'appendix', { color: '#b87f48' }],
      ['rectum', 'Rectum', 'digestive', 'rectum', { color: '#b87f48' }],
      ['liver', 'Liver', 'digestive', 'liver', { color: '#8f3f2f' }],
      ['gallbladder', 'Gallbladder', 'digestive', 'gallbladder', { color: '#6d8f3f' }],
      ['pancreas', 'Pancreas', 'digestive', 'pancreas, nsn', { color: '#e0c088' }],
      ['spleen', 'Spleen', 'urinary', 'spleen', { color: '#7d3548' }],
      ['kidney', 'Kidney', 'urinary', `${S}kidney`, { color: '#94473a' }],
      ['adrenal-gland', 'Adrenal gland', 'urinary', `${S}adrenal gland`, { color: '#d8b060' }],
      ['ureter', 'Ureter', 'urinary', `${S}ureter`, { color: '#d8c880' }],
      ['bladder', 'Urinary bladder', 'urinary', 'urinary bladder', { color: '#d8c060' }],
      ['urethra', 'Urethra', 'urinary', 'urethra', { color: '#d0b858' }],
      ['prostate', 'Prostate', 'urinary', 'prostate', { color: '#c0a0a8' }],
      ['aorta', 'Aorta', 'vessels', '(ascending aorta|arch of aorta|descending aorta)', { color: '#c03838' }],
      ['superior-vena-cava', 'Superior vena cava', 'vessels', 'superior vena cava', { color: '#3858b0' }],
      ['inferior-vena-cava', 'Inferior vena cava', 'vessels', 'inferior vena cava', { color: '#3858b0' }],
      ['pulmonary-artery', 'Pulmonary artery', 'vessels', 'pulmonary artery', { color: '#5068c0' }],
      ['pulmonary-vein', 'Pulmonary vein', 'vessels', 'pulmonary vein', { color: '#c05858' }],
      ['carotid-artery', 'Common carotid artery', 'vessels', `${S}common carotid artery`, { color: '#c03838' }],
      ['jugular-vein', 'Internal jugular vein', 'vessels', `${S}internal jugular vein`, { color: '#3858b0' }],
      ['subclavian-artery', 'Subclavian artery', 'vessels', `${S}subclavian artery`, { color: '#c03838' }],
      ['renal-artery', 'Renal artery', 'vessels', `${S}renal artery`, { color: '#c03838' }],
      ['iliac-artery', 'Common iliac artery', 'vessels', `${S}common iliac artery`, { color: '#c03838' }],
      // ghosted skeletal context (reuses skeleton downloads)
      ['ctx-ribcage', 'Rib cage', 'context', `(${S}\\w+ rib|${S}\\w+ costal cartilage|manubrium|body of sternum|xiphoid process)`, { quiz: false }],
      ['ctx-spine', 'Spine', 'context', '(\\w+ (thoracic|lumbar) vertebra|sacrum)', { quiz: false }],
      ['ctx-pelvis', 'Pelvis', 'context', `${S}hip bone`, { quiz: false }],
    ],
    startGhostLayers: ['context'],
    quizzes: [
      { id: 'thoracic', title: 'Chest', subtitle: 'Heart, lungs and airway',
        parts: ['heart', 'lung', 'trachea', 'bronchus', 'esophagus', 'diaphragm', 'thymus', 'thyroid-cartilage'] },
      { id: 'digestive', title: 'Digestive system', subtitle: 'Mouth to rectum', parts: { layer: 'digestive' } },
      { id: 'urinary', title: 'Urinary & glands', subtitle: 'Kidneys, bladder and friends', parts: { layer: 'urinary' } },
      { id: 'vessels', title: 'Great vessels', subtitle: 'Arteries and veins', parts: { layer: 'vessels' } },
      { id: 'all', title: 'Everything', subtitle: 'All organs and vessels', parts: 'all' },
    ],
  },

  // ================= BRAIN =================
  brain: {
    title: 'Brain',
    blurb: 'Gyri, deep structures, ventricles, brainstem and cerebellum.',
    camera: { theta: 1.2, phi: 1.25, zoom: 0.85 },
    layers: [
      { id: 'cortex', name: 'Cortex (gyri)', color: '#d5a8a0' },
      { id: 'deep', name: 'Deep structures', color: '#c09088' },
      { id: 'stem', name: 'Brainstem & cerebellum', color: '#c8a090' },
      { id: 'ventricles', name: 'Ventricles (CSF)', color: '#70a8c8' },
    ],
    parts: [
      ['precentral-gyrus', 'Precentral gyrus (primary motor cortex)', 'cortex', `${S}precentral gyrus`, { color: '#d88878' }],
      ['postcentral-gyrus', 'Postcentral gyrus (primary somatosensory cortex)', 'cortex', `${S}postcentral gyrus`, { color: '#d8a060' }],
      ['superior-frontal-gyrus', 'Superior frontal gyrus', 'cortex', `${S}superior frontal gyrus`],
      ['middle-frontal-gyrus', 'Middle frontal gyrus', 'cortex', `${S}middle frontal gyrus`],
      ['superior-temporal-gyrus', 'Superior temporal gyrus', 'cortex', `(anterior|posterior) part of ${S}superior temporal gyrus`],
      ['middle-temporal-gyrus', 'Middle temporal gyrus', 'cortex', `${S}middle temporal gyrus`],
      ['inferior-temporal-gyrus', 'Inferior temporal gyrus', 'cortex', `${S}inferior temporal gyrus`],
      ['angular-gyrus', 'Angular gyrus', 'cortex', `${S}angular gyrus`],
      ['supramarginal-gyrus', 'Supramarginal gyrus', 'cortex', `${S}supramarginal gyrus`],
      ['cingulate-gyrus', 'Cingulate gyrus', 'cortex', `${S}cingulate gyrus`, { color: '#c8a8b8' }],
      ['fusiform-gyrus', 'Fusiform gyrus', 'cortex', `${S}fusiform gyrus`],
      ['parahippocampal-gyrus', 'Parahippocampal gyrus', 'cortex', `${S}parahippocampal gyrus`],
      ['occipital-lobe', 'Occipital lobe (visual cortex)', 'cortex', `${S}occipital lobe`, { color: '#b8c088' }],
      ['white-matter', 'Cerebral white matter', 'deep', 'white matter structure of cerebral hemisphere', { color: '#e8e0d8' }],
      ['corpus-callosum', 'Corpus callosum', 'deep', 'corpus callosum', { color: '#e0d0b8' }],
      ['fornix', 'Fornix', 'deep', `(${S}fornix of forebrain|commissure of fornix of forebrain)`],
      ['septum-pellucidum', 'Septum pellucidum', 'deep', 'septum pellucidum'],
      ['thalamus', 'Thalamus', 'deep', `${S}thalamus`, { color: '#b87890' }],
      ['hypothalamus', 'Hypothalamus', 'deep', 'hypothalamus, nsn', { color: '#c88868' }],
      ['hippocampus', 'Hippocampus', 'deep', `${S}hippocampus`, { color: '#a05868' }],
      ['pituitary', 'Pituitary gland', 'deep', 'pituitary gland', { color: '#d8a848' }],
      ['choroid-plexus', 'Choroid plexus', 'ventricles', `choroid plexus of ${S}cerebral hemisphere`, { color: '#a05050' }],
      ['lateral-ventricle', 'Lateral ventricle', 'ventricles', `${S}lateral ventricle`],
      ['third-ventricle', 'Third ventricle', 'ventricles', 'third ventricle'],
      ['fourth-ventricle', 'Fourth ventricle', 'ventricles', 'fourth ventricle'],
      ['cerebral-aqueduct', 'Cerebral aqueduct', 'ventricles', 'cerebral aqueduct'],
      ['midbrain', 'Midbrain', 'stem', '(midbrain, nsn|peduncle of midbrain)'],
      ['pons', 'Pons', 'stem', 'pons'],
      ['medulla', 'Medulla oblongata', 'stem', 'medulla oblongata'],
      ['cerebellum', 'Cerebellum', 'stem', 'cerebellum', { color: '#b08878' }],
    ],
    quizzes: [
      { id: 'cortex', title: 'Cortex', subtitle: 'Lobes and gyri', parts: { layer: 'cortex' } },
      { id: 'deep', title: 'Deep structures', subtitle: 'Thalamus, hippocampus and friends', parts: { layer: 'deep' } },
      { id: 'stem-ventricles', title: 'Brainstem & ventricles', subtitle: 'Midbrain to medulla, plus the CSF spaces',
        parts: ['midbrain', 'pons', 'medulla', 'cerebellum', 'lateral-ventricle', 'third-ventricle', 'fourth-ventricle', 'cerebral-aqueduct', 'choroid-plexus'] },
      { id: 'all', title: 'Everything', subtitle: 'The whole brain', parts: 'all' },
    ],
  },

  // ================= HEART =================
  heart: {
    title: 'Heart',
    blurb: 'The heart wall with its valves, papillary muscles, coronary vessels and great vessels — use see-through to look inside.',
    camera: { theta: 0.5, phi: 1.3, zoom: 1.0 },
    layers: [
      { id: 'wall', name: 'Heart wall', color: '#b8433f' },
      { id: 'valves', name: 'Valves & papillary muscles', color: '#e8d8c0' },
      { id: 'coronary', name: 'Coronary vessels', color: '#c03838' },
      { id: 'great', name: 'Great vessels', color: '#a04848' },
    ],
    parts: [
      ['heart-wall', 'Heart wall (myocardium)', 'wall', 'wall of heart', { color: '#b8433f' }],
      ['tricuspid-valve', 'Tricuspid valve', 'valves', 'tricuspid valve', { color: '#e8d8c0' }],
      ['mitral-valve', 'Mitral valve', 'valves', 'mitral valve', { color: '#e8d0b0' }],
      ['pulmonary-valve', 'Pulmonary valve', 'valves', 'pulmonary valve', { color: '#e0c8a8' }],
      ['papillary-muscles', 'Papillary muscles', 'valves', '(\\w+ )?papillary muscle(s)? of (right|left) ventricle(, nsn)?', { color: '#a03830' }],
      ['left-coronary-artery', 'Left coronary artery (LAD & circumflex)', 'coronary',
        '(stem of left coronary artery|anterior interventricular branch of left coronary artery, nsn|circumflex branch of left coronary artery|set of interventricular septal branches of left coronary artery)', { color: '#d84838' }],
      ['right-coronary-artery', 'Right coronary artery', 'coronary',
        '(trunk of right coronary artery|marginal branch of right coronary artery|posterior interventricular branch of right coronary artery, nsn|right posterolateral branch of right coronary artery|set of interventricular septal branches of right coronary artery)', { color: '#e05848' }],
      ['cardiac-veins', 'Cardiac veins', 'coronary', '((great|middle) cardiac vein|set of anterior cardiac veins|set of posterior veins of left ventricle)', { color: '#4858b8' }],
      ['ascending-aorta', 'Ascending aorta', 'great', 'ascending aorta', { color: '#c03838' }],
      ['aortic-arch', 'Arch of aorta', 'great', 'arch of aorta', { color: '#c03838' }],
      ['pulmonary-artery', 'Pulmonary artery', 'great', 'pulmonary artery', { color: '#5068c0' }],
      ['pulmonary-vein', 'Pulmonary vein', 'great', 'pulmonary vein', { color: '#c05858' }],
      ['superior-vena-cava', 'Superior vena cava', 'great', 'superior vena cava', { color: '#3858b0' }],
      ['inferior-vena-cava', 'Inferior vena cava', 'great', 'inferior vena cava', { color: '#3858b0' }],
    ],
    quizzes: [
      { id: 'inside', title: 'Inside the heart', subtitle: 'Valves and papillary muscles (turn up see-through!)',
        parts: ['heart-wall', 'tricuspid-valve', 'mitral-valve', 'pulmonary-valve', 'papillary-muscles'] },
      { id: 'vessels', title: 'Vessels', subtitle: 'Coronary and great vessels',
        parts: ['left-coronary-artery', 'right-coronary-artery', 'cardiac-veins', 'ascending-aorta',
          'aortic-arch', 'pulmonary-artery', 'pulmonary-vein', 'superior-vena-cava', 'inferior-vena-cava'] },
      { id: 'all', title: 'Everything', subtitle: 'The complete heart', parts: 'all' },
    ],
  },

  // ================= MUSCLES =================
  muscles: {
    title: 'Major Muscles',
    blurb: 'The muscles you name at the gym and in anatomy class, over a ghosted skeleton.',
    camera: { theta: 0.5, phi: 1.35, zoom: 0.9 },
    layers: [
      { id: 'head-neck', name: 'Head & neck', color: '#a8544c' },
      { id: 'back', name: 'Back', color: '#a8544c' },
      { id: 'shoulder-chest', name: 'Shoulder & chest', color: '#a8544c' },
      { id: 'arm', name: 'Arm & forearm', color: '#a8544c' },
      { id: 'abdomen', name: 'Abdomen', color: '#a8544c' },
      { id: 'hip-thigh', name: 'Hip & thigh', color: '#a8544c' },
      { id: 'leg', name: 'Lower leg', color: '#a8544c' },
      { id: 'context', name: 'Skeleton (context)', color: BONE },
    ],
    parts: [
      ['masseter', 'Masseter', 'head-neck', `(deep|superficial) part of ${S}masseter`],
      ['sternocleidomastoid', 'Sternocleidomastoid', 'head-neck', `${S}sternocleidomastoid`],
      ['splenius-capitis', 'Splenius capitis', 'head-neck', `${S}splenius capitis`],
      ['trapezius', 'Trapezius', 'back', `(ascending|descending|transverse) part of ${S}trapezius|${S}trapezius`],
      ['latissimus-dorsi', 'Latissimus dorsi', 'back', `${S}latissimus dorsi`],
      ['rhomboid-major', 'Rhomboid major', 'back', `${S}rhomboid major`],
      ['rhomboid-minor', 'Rhomboid minor', 'back', `${S}rhomboid minor`],
      ['levator-scapulae', 'Levator scapulae', 'back', `${S}levator scapulae`],
      ['erector-spinae', 'Erector spinae (iliocostalis)', 'back', `${S}iliocostalis (cervicis|thoracis|lumborum)`],
      ['quadratus-lumborum', 'Quadratus lumborum', 'back', `${S}quadratus lumborum`],
      ['deltoid', 'Deltoid', 'shoulder-chest', `(acromial|clavicular|scapular spinal) part of ${S}deltoid`],
      ['supraspinatus', 'Supraspinatus (rotator cuff)', 'shoulder-chest', `${S}supraspinatus`],
      ['infraspinatus', 'Infraspinatus (rotator cuff)', 'shoulder-chest', `${S}infraspinatus muscle`],
      ['teres-major', 'Teres major', 'shoulder-chest', `${S}teres major`],
      ['teres-minor', 'Teres minor (rotator cuff)', 'shoulder-chest', `${S}teres minor`],
      ['subscapularis', 'Subscapularis (rotator cuff)', 'shoulder-chest', `${S}subscapularis`],
      ['serratus-anterior', 'Serratus anterior', 'shoulder-chest', `${S}serratus anterior`],
      ['pectoralis-major', 'Pectoralis major', 'shoulder-chest', `(abdominal|clavicular) part of ${S}pectoralis major|sternocostal part of ${S}pectoralis major`],
      ['pectoralis-minor', 'Pectoralis minor', 'shoulder-chest', `${S}pectoralis minor`],
      ['biceps-brachii', 'Biceps brachii', 'arm', `(long|short) head of ${S}biceps brachii`],
      ['triceps-brachii', 'Triceps brachii', 'arm', `(long|lateral|medial) head of ${S}triceps brachii`],
      ['brachialis', 'Brachialis', 'arm', `${S}brachialis`],
      ['brachioradialis', 'Brachioradialis', 'arm', `${S}brachioradialis`],
      ['pronator-teres', 'Pronator teres', 'arm', `(humeral|ulnar) head of ${S}pronator teres`],
      ['flexor-carpi-radialis', 'Flexor carpi radialis', 'arm', `${S}flexor carpi radialis`],
      ['flexor-carpi-ulnaris', 'Flexor carpi ulnaris', 'arm', `(humeral|ulnar) head of ${S}flexor carpi ulnaris`],
      ['extensor-digitorum', 'Extensor digitorum', 'arm', `${S}extensor digitorum`],
      ['rectus-abdominis', 'Rectus abdominis (abs)', 'abdomen', `${S}rectus abdominis`],
      ['external-oblique', 'External oblique', 'abdomen', `${S}external oblique`],
      ['gluteus-maximus', 'Gluteus maximus', 'hip-thigh', `${S}gluteus maximus`],
      ['gluteus-medius', 'Gluteus medius', 'hip-thigh', `${S}gluteus medius`],
      ['gluteus-minimus', 'Gluteus minimus', 'hip-thigh', `${S}gluteus minimus`],
      ['iliacus', 'Iliacus', 'hip-thigh', `${S}iliacus`],
      ['psoas-major', 'Psoas major', 'hip-thigh', `${S}psoas major`],
      ['pectineus', 'Pectineus', 'hip-thigh', `${S}pectineus`],
      ['adductor-longus', 'Adductor longus', 'hip-thigh', `${S}adductor longus`],
      ['adductor-magnus', 'Adductor magnus', 'hip-thigh', `${S}adductor magnus`],
      ['gracilis', 'Gracilis', 'hip-thigh', `${S}gracilis`],
      ['sartorius', 'Sartorius', 'hip-thigh', `${S}sartorius`],
      ['tensor-fasciae-latae', 'Tensor fasciae latae', 'hip-thigh', `${S}tensor fasciae latae`],
      ['rectus-femoris', 'Rectus femoris (quadriceps)', 'hip-thigh', `${S}rectus femoris`],
      ['vastus-lateralis', 'Vastus lateralis (quadriceps)', 'hip-thigh', `${S}vastus lateralis`],
      ['vastus-medialis', 'Vastus medialis (quadriceps)', 'hip-thigh', `${S}vastus medialis`],
      ['vastus-intermedius', 'Vastus intermedius (quadriceps)', 'hip-thigh', `${S}vastus intermedius`],
      ['biceps-femoris', 'Biceps femoris (hamstring)', 'hip-thigh', `(long|short) head of ${S}biceps femoris`],
      ['semitendinosus', 'Semitendinosus (hamstring)', 'hip-thigh', `${S}semitendinosus`],
      ['semimembranosus', 'Semimembranosus (hamstring)', 'hip-thigh', `${S}semimembranosus`],
      ['gastrocnemius', 'Gastrocnemius (calf)', 'leg', `(medial|lateral) head of ${S}gastrocnemius`],
      ['soleus', 'Soleus', 'leg', `${S}soleus`],
      ['tibialis-anterior', 'Tibialis anterior', 'leg', `${S}tibialis anterior`],
      ['tibialis-posterior', 'Tibialis posterior', 'leg', `${S}tibialis posterior`],
      ['fibularis-longus', 'Fibularis (peroneus) longus', 'leg', `${S}fibularis longus`],
      ['extensor-digitorum-longus', 'Extensor digitorum longus', 'leg', `${S}extensor digitorum longus`],
      // skeleton context
      ['ctx-skeleton', 'Skeleton', 'context',
        `(${S}(clavicle|scapula|humerus|radius|ulna|hip bone|femur|patella|tibia|fibula|talus|calcaneus|\\w+ rib)|mandible|frontal bone|occipital bone|${S}(parietal|temporal|zygomatic|nasal) bone|${S}maxilla|\\w+ (cervical|thoracic|lumbar) vertebra|atlas|axis|sacrum|manubrium|body of sternum|xiphoid process)`,
        { quiz: false }],
    ],
    startGhostLayers: ['context'],
    quizzes: [
      { id: 'gym', title: 'Gym muscles', subtitle: 'The ones on the workout chart',
        parts: ['trapezius', 'latissimus-dorsi', 'deltoid', 'pectoralis-major', 'biceps-brachii',
          'triceps-brachii', 'brachioradialis', 'rectus-abdominis', 'external-oblique',
          'gluteus-maximus', 'rectus-femoris', 'vastus-lateralis', 'biceps-femoris',
          'gastrocnemius', 'soleus'] },
      { id: 'upper', title: 'Upper body', subtitle: 'Neck to forearm',
        parts: ['masseter', 'sternocleidomastoid', 'trapezius', 'latissimus-dorsi', 'rhomboid-major',
          'levator-scapulae', 'deltoid', 'supraspinatus', 'infraspinatus', 'teres-major', 'teres-minor',
          'serratus-anterior', 'pectoralis-major', 'pectoralis-minor', 'biceps-brachii',
          'triceps-brachii', 'brachialis', 'brachioradialis', 'flexor-carpi-radialis', 'extensor-digitorum'] },
      { id: 'lower', title: 'Lower body', subtitle: 'Hip to ankle',
        parts: ['gluteus-maximus', 'gluteus-medius', 'iliacus', 'psoas-major', 'adductor-longus',
          'adductor-magnus', 'gracilis', 'sartorius', 'tensor-fasciae-latae', 'rectus-femoris',
          'vastus-lateralis', 'vastus-medialis', 'biceps-femoris', 'semitendinosus',
          'semimembranosus', 'gastrocnemius', 'soleus', 'tibialis-anterior', 'fibularis-longus'] },
      { id: 'all', title: 'Everything', subtitle: 'All the muscles', parts: 'all' },
    ],
  },
};

// ---------- shared machinery ----------
console.log('fetching name list + file inventory…');
const listTxt = await (await fetch(`${RAW}/parts_list_e.txt`)).text();
const names = new Map();
for (const line of listTxt.split('\n')) {
  const [id, en] = line.trim().split('\t');
  if (id?.startsWith('FMA') && en) names.set(id.replace(/"/g, ''), en);
}
const tree = await (await fetch(
  'https://api.github.com/repos/Kevin-Mattheus-Moerman/BodyParts3D/git/trees/main?recursive=1'
)).json();
const stlSizes = new Map();
for (const e of tree.tree) {
  if (e.path.endsWith('.stl')) stlSizes.set(path.basename(e.path, '.stl'), e.size);
}

const packIds = wanted.length ? wanted : Object.keys(PACKS);
const toDownload = new Set();

for (const packId of packIds) {
  const pack = PACKS[packId];
  if (!pack) { console.error(`unknown pack "${packId}"`); process.exit(1); }
  console.log(`\n===== ${packId} =====`);
  const files = [];
  const parts = {};
  const misses = [];
  const claimed = new Set(); // first part to match a file wins (within the pack)
  let total = 0;

  for (const [partId, name, layer, regexStr, opts = {}] of pack.parts) {
    const re = new RegExp(`^(${regexStr})$`);
    const hits = [];
    for (const [fma, en] of names) {
      if (!claimed.has(fma) && re.test(en.toLowerCase()) && stlSizes.has(fma)) hits.push(fma);
    }
    if (hits.length === 0) { misses.push(partId); continue; }
    for (const fma of hits) {
      claimed.add(fma);
      files.push({ file: `${fma}.stl`, part: partId });
      toDownload.add(fma);
      total += stlSizes.get(fma);
    }
    parts[partId] = { name, layer, ...(opts.color ? { color: opts.color } : {}), ...(opts.quiz === false ? { quiz: false } : {}) };
    console.log(`  ${partId.padEnd(26)} ×${String(hits.length).padEnd(3)} ${(hits.reduce((s, f) => s + stlSizes.get(f), 0) / 1e6).toFixed(1).padStart(6)} MB`);
  }
  if (misses.length) console.log(`  NO MATCHES: ${misses.join(', ')}`);
  console.log(`  → ${files.length} files, ${(total / 1e6).toFixed(0)} MB`);

  if (!dry) {
    const layers = pack.layers.map((l) =>
      pack.startGhostLayers?.includes(l.id) ? { ...l, ghost: true } : l);
    const manifest = {
      id: packId,
      title: pack.title,
      blurb: pack.blurb,
      attribution: ATTRIB,
      license: 'CC BY-SA 2.1 JP',
      source: { kind: 'stl-set', dir: '../../bp3d/', rotate: [-1.5707963, 0, 0], files },
      camera: pack.camera,
      layers,
      parts,
      quizzes: pack.quizzes,
    };
    const dir = path.join(root, 'data/models', packId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(`  wrote data/models/${packId}/manifest.json`);
  }
}

if (dry) process.exit(0);

// ---------- download whatever isn't cached ----------
fs.mkdirSync(CACHE, { recursive: true });
const queue = [...toDownload].filter((fma) => !fs.existsSync(path.join(CACHE, `${fma}.stl`)));
console.log(`\ndownloading ${queue.length} new files (${toDownload.size - queue.length} already cached)…`);
let done = 0;
async function worker() {
  while (queue.length) {
    const fma = queue.shift();
    const res = await fetch(`${RAW}/stl/${fma}.stl`);
    if (!res.ok) { console.error(`FAILED ${fma}: ${res.status}`); continue; }
    fs.writeFileSync(path.join(CACHE, `${fma}.stl`), Buffer.from(await res.arrayBuffer()));
    if (++done % 25 === 0) console.log(`  ${done}/${queue.length + done}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
console.log(`done: ${done} downloaded`);
