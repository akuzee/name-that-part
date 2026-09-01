/*
 * Quiz engine: Seterra-style game loop over a Viewer. Ported from map games —
 * same scoring (1st try green / 2nd yellow / 3rd orange, reveal red), same
 * wrong-click teaching, retry-missed. Rendering/picking delegated to Viewer.
 */

const MAX_ATTEMPTS = 3;
const POINTS = [1, 0.7, 0.4, 0];

export class Engine {
  constructor(viewer, dom) {
    this.viewer = viewer;
    this.el = dom; // {prompt, promptName, triesLeft, progress, score, timer,
                   //  wrongLabel, endPanel, endScore, endTime, endBreakdown,
                   //  missedWrap, missedList, btnRestart, btnRetryMissed}
    this.quiz = null;
    this.order = [];
    this.idx = 0;
    this.attempts = 0;
    this.results = new Map();
    this.ackWait = null;   // part awaiting the "I see it now" click after a reveal
    this.timerId = null;
    this.wrongLabelTimer = null;
    this.onFinish = null;

    this.el.btnRestart.onclick = () => this.startRound(this.quiz.targetIds);
    viewer.onPick = (partId, ev) => this.handlePick(partId, ev);
  }

  start(quiz) {
    this.quiz = quiz;
    this.startRound(quiz.targetIds);
  }

  stop() {
    clearInterval(this.timerId);
    clearTimeout(this.wrongLabelTimer);
    this.ackWait = null;
    this.el.endPanel.hidden = true;
    this.el.wrongLabel.hidden = true;
    this.el.prompt.hidden = true;
    this.quiz = null;
    this.order = [];
  }

  startRound(ids) {
    this.order = shuffle(ids);
    this.idx = 0;
    this.attempts = 0;
    this.results = new Map();
    this.ackWait = null;
    this.el.endPanel.hidden = true;
    this.el.prompt.hidden = false;
    this.viewer.clearStates();
    this.viewer.setReveal(null);
    this.viewer.unhideAll();
    this.viewer.setActiveParts(new Set(ids));
    this.startedAt = Date.now();
    clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      this.el.timer.textContent = fmtTime(Date.now() - this.startedAt);
    }, 500);
    this.el.timer.textContent = '00:00';
    this.updateHud();
  }

  updateHud() {
    const want = this.order[this.idx];
    this.el.promptName.textContent = want ? this.viewer.parts.get(want)?.name ?? '' : '';
    this.el.progress.textContent =
      `${Math.min(this.idx + 1, this.order.length)} / ${this.order.length}`;
    this.el.score.textContent = this.scorePercent() + '%';
    const left = MAX_ATTEMPTS - this.attempts;
    this.el.triesLeft.textContent =
      this.attempts === 0 ? '' : `${left} ${left === 1 ? 'try' : 'tries'} left`;
  }

  scorePercent() {
    if (this.results.size === 0) return 100;
    let pts = 0;
    for (const a of this.results.values()) pts += POINTS[a];
    return Math.round((pts / this.results.size) * 100);
  }

  advance() {
    this.attempts = 0;
    this.idx++;
    if (this.idx >= this.order.length) return this.finishRound();
    this.updateHud();
  }

  handlePick(partId, ev) {
    if (!this.quiz || this.idx >= this.order.length) return;
    if (this.ackWait) {
      // revealed part must be clicked before the round moves on
      if (partId === this.ackWait) {
        this.ackWait = null;
        this.viewer.setReveal(null);
        this.advance();
      }
      return;
    }
    if (!this.order.includes(partId)) {
      // context part — name it (teaching) but no penalty, like map games' muted shapes
      const name = this.viewer.parts.get(partId)?.name ?? '?';
      this.showWrongLabel(`${name} — not in this quiz`, ev.clientX, ev.clientY);
      return;
    }
    if (this.results.has(partId)) return;       // already solved
    const want = this.order[this.idx];

    if (partId === want) {
      this.results.set(partId, this.attempts);
      this.viewer.setPartState(partId, `solved-${this.attempts}`);
      this.advance();
      return;
    }

    // wrong guess — name what was clicked so misses teach something
    this.attempts++;
    this.showWrongLabel(this.viewer.parts.get(partId)?.name ?? '?', ev.clientX, ev.clientY);
    this.viewer.flashWrong(partId);
    this.el.prompt.classList.remove('prompt--shake');
    void this.el.prompt.offsetWidth;
    this.el.prompt.classList.add('prompt--shake');

    if (this.attempts >= MAX_ATTEMPTS) {
      this.results.set(want, MAX_ATTEMPTS);
      this.viewer.setPartState(want, 'missed');
      this.viewer.setReveal(want);   // spotlight it even if buried
      this.ackWait = want;
      this.updateHud();
      this.el.triesLeft.textContent = 'click the flashing part to continue';
      return;
    }
    this.updateHud();
  }

  showWrongLabel(name, clientX, clientY) {
    const el = this.el.wrongLabel;
    const stage = el.parentElement.getBoundingClientRect();
    el.textContent = 'That was: ' + name;
    el.hidden = false;
    el.classList.remove('wrong-label--show');
    void el.getBoundingClientRect();
    el.classList.add('wrong-label--show');
    const w = el.offsetWidth;
    const x = Math.min(Math.max(clientX - stage.left, w / 2 + 8), stage.width - w / 2 - 8);
    const y = Math.max(clientY - stage.top, 44);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    clearTimeout(this.wrongLabelTimer);
    this.wrongLabelTimer = setTimeout(() => { el.hidden = true; }, 1600);
  }

  finishRound() {
    clearInterval(this.timerId);
    this.el.prompt.hidden = true;
    const missed = this.order.filter((id) => this.results.get(id) === MAX_ATTEMPTS);
    const firstTry = this.order.filter((id) => this.results.get(id) === 0).length;
    this.el.endScore.textContent = this.scorePercent() + '%';
    this.el.endTime.textContent = fmtTime(Date.now() - this.startedAt);
    this.el.endBreakdown.textContent =
      `${firstTry} of ${this.order.length} on the first try · ${missed.length} revealed`;
    this.el.missedWrap.hidden = missed.length === 0;
    this.el.missedList.replaceChildren(...missed.map((id) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = this.viewer.parts.get(id)?.name ?? id;
      return chip;
    }));
    this.el.btnRetryMissed.hidden = missed.length === 0;
    this.el.btnRetryMissed.textContent = `Retry the ${missed.length} you missed`;
    this.el.btnRetryMissed.onclick = () => this.startRound(missed);
    this.el.endPanel.hidden = false;
    if (this.onFinish) this.onFinish();
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
