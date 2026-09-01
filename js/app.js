/*
 * App shell: hash routing (#/ · #/model/<id> · #/play/<model>/<quiz> ·
 * #/explore/<model>), library + model views, toolbox wiring.
 */
import { loadCatalog, loadManifest, resolveQuiz } from './data.js';
import { Viewer } from './viewer.js';
import { Engine } from './engine.js';

const $ = (id) => document.getElementById(id);
const views = { library: $('view-library'), model: $('view-model'), play: $('view-play') };

let catalog = null;
let viewer = null;
let engine = null;
let current = { modelId: null, manifest: null };

function show(name) {
  for (const [k, v] of Object.entries(views)) v.hidden = k !== name;
}

// ---------- library ----------
async function renderLibrary() {
  show('library');
  if (!catalog) catalog = await loadCatalog();
  const grid = $('library-grid');
  grid.replaceChildren(...catalog.models.map((m) => {
    const a = document.createElement('a');
    a.className = 'lib-card';
    a.href = `#/model/${m.id}`;
    a.innerHTML = `<h2></h2><p></p><span class="badge"></span>`;
    a.querySelector('h2').textContent = m.title;
    a.querySelector('p').textContent = m.blurb || '';
    a.querySelector('.badge').textContent = m.badge || '3D model';
    return a;
  }));
}

// ---------- model view ----------
async function renderModel(modelId) {
  show('model');
  const manifest = await loadManifest(modelId);
  $('model-title').textContent = manifest.title;
  $('model-blurb').textContent = manifest.blurb || '';
  $('btn-explore').href = `#/explore/${modelId}`;
  $('model-attribution').textContent = [manifest.attribution, manifest.license]
    .filter(Boolean).join(' · ');
  const list = $('quiz-list');
  list.replaceChildren(...(manifest.quizzes || []).map((q) => {
    const a = document.createElement('a');
    a.className = 'quiz-card';
    a.href = `#/play/${modelId}/${q.id}`;
    a.innerHTML = `<span class="quiz-card-title"></span><span class="quiz-card-sub"></span>`;
    a.querySelector('.quiz-card-title').textContent = q.title;
    a.querySelector('.quiz-card-sub').textContent = q.subtitle || '';
    return a;
  }));
}

// ---------- play / explore ----------
async function ensureViewer() {
  if (!viewer) {
    viewer = new Viewer($('canvas3d'));
    engine = new Engine(viewer, {
      prompt: $('prompt'), promptName: $('prompt-name'), triesLeft: $('tries-left'),
      progress: $('stat-progress'), score: $('stat-score'), timer: $('stat-timer'),
      wrongLabel: $('wrong-label'), endPanel: $('end-panel'), endScore: $('end-score'),
      endTime: $('end-time'), endBreakdown: $('end-breakdown'),
      missedWrap: $('missed-wrap'), missedList: $('missed-list'),
      btnRestart: $('btn-restart'), btnRetryMissed: $('btn-retry-missed'),
    });
    wireToolbox();
    window.__pg = {
      get viewer() { return viewer; },
      get current() { return current; },
      get engine() { return engine; },
    };
  }
  return viewer;
}

async function loadModelIntoViewer(modelId) {
  await ensureViewer();
  if (current.modelId !== modelId || !viewer.root) {
    $('loading').hidden = false;
    $('loading-msg').textContent = 'Loading model…';
    current.manifest = await loadManifest(modelId);
    viewer.onLoadProgress = (done, total) => {
      $('loading-msg').textContent = `Loading model… ${done} / ${total}`;
    };
    try {
      await viewer.load(current.manifest);
    } finally {
      $('loading').hidden = true;
    }
    current.modelId = modelId;
    renderLayerTools(current.manifest);
    resetToolbox();
  }
  return current.manifest;
}

async function renderPlay(modelId, quizId) {
  show('play');
  engine?.stop();
  const manifest = await loadModelIntoViewer(modelId);
  viewer.clearStates();
  const quiz = resolveQuiz(manifest, quizId, viewer.parts);
  if (quiz.targetIds.length === 0) {
    alert('This quiz has no matching parts in the model.');
    location.hash = `#/model/${modelId}`;
    return;
  }
  $('quiz-title').textContent = quiz.title;
  $('quiz-subtitle').textContent = quiz.subtitle;
  $('explore-tip').hidden = true;
  $('play-stats').style.visibility = 'visible';
  $('hover-label').hidden = true;
  viewer.onHover = null;
  $('btn-play-back').onclick = () => { location.hash = `#/model/${modelId}`; };
  engine.start(quiz);
}

async function renderExplore(modelId) {
  show('play');
  engine?.stop();
  const manifest = await loadModelIntoViewer(modelId);
  viewer.clearStates();
  viewer.setActiveParts(null);
  viewer.unhideAll();
  $('quiz-title').textContent = manifest.title;
  $('quiz-subtitle').textContent = 'Explore';
  $('explore-tip').hidden = false;
  $('play-stats').style.visibility = 'hidden';
  $('btn-play-back').onclick = () => { location.hash = `#/model/${modelId}`; };

  const label = $('hover-label');
  let pinned = null;
  viewer.onHover = (partId, ev) => {
    if (pinned) return;
    if (!partId) { label.hidden = true; return; }
    label.textContent = viewer.parts.get(partId)?.name ?? partId;
    label.hidden = false;
    const stage = $('stage').getBoundingClientRect();
    label.style.left = (ev.clientX - stage.left) + 'px';
    label.style.top = (ev.clientY - stage.top) + 'px';
  };
  viewer.onPick = (partId) => {
    // click: spotlight the part briefly (helps in dense assemblies)
    pinned = partId;
    viewer.setReveal(partId);
    label.textContent = viewer.parts.get(partId)?.name ?? partId;
    label.hidden = false;
    const pos = viewer.screenPos(partId);
    if (pos) {
      const stage = $('stage').getBoundingClientRect();
      label.style.left = (pos.x - stage.left) + 'px';
      label.style.top = (pos.y - stage.top) + 'px';
    }
    setTimeout(() => {
      if (pinned === partId) { pinned = null; viewer.setReveal(null); label.hidden = true; }
    }, 1500);
  };
}

// ---------- toolbox ----------
function wireToolbox() {
  $('ctl-xray').oninput = (e) => viewer.setXray(e.target.value / 100);
  $('ctl-explode').oninput = (e) => viewer.setExplode(e.target.value / 100);
  $('ctl-section').oninput = (e) => viewer.setSection(undefined, e.target.value / 100, undefined);
  $('ctl-ghost-solved').onchange = (e) => viewer.setGhostSolved(e.target.checked);
  $('btn-reset-view').onclick = () => viewer.resetView();
  $('btn-unhide').onclick = () => viewer.unhideAll();
  viewer.onHiddenChange = (n) => {
    const b = $('btn-unhide');
    b.hidden = n === 0;
    b.textContent = `Unhide all (${n})`;
  };
  const axisSeg = $('ctl-section-axis');
  axisSeg.querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.axis === 'flip') {
        b.classList.toggle('on');
        viewer.setSection(undefined, undefined, b.classList.contains('on'));
      } else {
        axisSeg.querySelectorAll('button:not([data-axis=flip])')
          .forEach((x) => x.classList.toggle('on', x === b));
        viewer.setSection(b.dataset.axis, undefined, undefined);
      }
    };
  });
}

function resetToolbox() {
  $('ctl-xray').value = 0;
  $('ctl-explode').value = 0;
  $('ctl-section').value = 100;
  $('ctl-ghost-solved').checked = true;
  viewer.setXray(0);
  viewer.setExplode(0);
  viewer.setSection('z', 1, false);
  viewer.setGhostSolved(true);
  const axisSeg = $('ctl-section-axis');
  axisSeg.querySelectorAll('button').forEach((b) =>
    b.classList.toggle('on', b.dataset.axis === 'z'));
}

function renderLayerTools(manifest) {
  const wrap = $('layer-tools');
  wrap.replaceChildren();
  if (!manifest.layers?.length) return;
  const title = document.createElement('div');
  title.className = 'layers-title';
  title.textContent = 'Layers';
  wrap.appendChild(title);
  for (const layer of manifest.layers) {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !layer.startHidden;
    cb.onchange = () => viewer.setLayerVisible(layer.id, cb.checked);
    label.append(cb, document.createTextNode(' ' + layer.name));
    wrap.appendChild(label);
  }
}

// ---------- routing ----------
$('btn-model-back').onclick = () => { location.hash = '#/'; };

async function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [a, b, c] = h.split('/').map(decodeURIComponent);
  try {
    if (a === 'model' && b) await renderModel(b);
    else if (a === 'play' && b && c) await renderPlay(b, c);
    else if (a === 'explore' && b) await renderExplore(b);
    else await renderLibrary();
  } catch (err) {
    console.error(err);
    alert('Failed to load: ' + err.message);
    if (a) location.hash = '#/';
  }
}

window.addEventListener('hashchange', route);
route();
