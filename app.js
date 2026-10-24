'use strict';
/* Morse code trainer – plain JS, no libraries; works by opening index.html. */

// ---------- Data ----------
const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
};

// Groups as in the reference course
const LESSONS = [
  { title: 'Foundation Letters: E & T', chars: 'ET' },
  { title: 'Common Letters: I, M, S, O', chars: 'IMSO' },
  { title: 'Expanding Skills: A, N, R, W', chars: 'ANRW' },
  { title: 'Building Speed: D, K, G, U', chars: 'DKGU' },
  { title: 'Advanced: L, P, J, B, X, C, Y, Z', chars: 'LPJBXCYZ' },
  { title: 'Completing: Q, F, H, V', chars: 'QFHV' },
];

// ---------- Settings (remembered in the browser) ----------
const STORE_KEY = 'morse-trener.v1';
const DEFAULTS = {
  groups: LESSONS.map((_, i) => i === 0),
  wpm: 20, tone: 650, volume: 60,
  count: 20, gap: 1.5,
  mode: 'practice', sidebar: true,
  theme: 'system',   // system | light | dark
  kbMode: 'auto',    // on-screen keyboard: auto (touch) | on | off
  kbLayout: 'auto',  // auto | qwerty | abc
};

function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { saved = {}; }
  const s = { ...DEFAULTS, ...saved };
  if (!Array.isArray(s.groups) || s.groups.length !== LESSONS.length) s.groups = DEFAULTS.groups.slice();
  s.wpm = clamp(+s.wpm || DEFAULTS.wpm, 5, 40);
  s.tone = clamp(+s.tone || DEFAULTS.tone, 400, 1000);
  s.volume = clamp(Number.isFinite(+s.volume) ? +s.volume : DEFAULTS.volume, 0, 100);
  s.count = clamp(Math.round(+s.count) || DEFAULTS.count, 1, 200);
  s.gap = clamp(+s.gap || DEFAULTS.gap, 0.5, 4);
  if (s.mode !== 'practice' && s.mode !== 'test') s.mode = 'practice';
  if (!['system', 'light', 'dark'].includes(s.theme)) s.theme = 'system';
  if (!['auto', 'on', 'off'].includes(s.kbMode)) s.kbMode = 'auto';
  if (!['auto', 'qwerty', 'abc'].includes(s.kbLayout)) s.kbLayout = 'auto';
  return s;
}

function saveSettings() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable – never mind */ }
}

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Bag of shuffled characters – each comes up equally often; the first one drawn != avoid
function refillBag(chars, avoid) {
  const bag = shuffle(chars.slice());
  const last = bag.length - 1;
  if (last > 0 && bag[last] === avoid) [bag[0], bag[last]] = [bag[last], bag[0]];
  return bag;
}

// Dots and dashes as shapes (clearer than text characters)
function codeHTML(code) {
  const label = code.replace(/\./g, '·').replace(/-/g, '–');
  return '<span class="code" aria-label="' + label + '">' +
    [...code].map((c) => (c === '.' ? '<i></i>' : '<i class="h"></i>')).join('') + '</span>';
}

function activeChars() {
  return LESSONS.flatMap((l, i) => (S.groups[i] ? [...l.chars] : []));
}

const S = loadSettings();

// ---------- Sound (Web Audio) ----------
const audio = { ctx: null, master: null, cur: null };

function ensureAudio() {
  if (!audio.ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.connect(audio.ctx.destination);
  }
  if (audio.ctx.state === 'suspended') audio.ctx.resume();
  applyVolume();
}

function applyVolume() {
  if (audio.master) audio.master.gain.value = Math.pow(S.volume / 100, 2) * 0.8;
}

// Plays one character. Promise: true when finished, false when interrupted.
function playChar(ch) {
  stopSound();
  ensureAudio();
  const ctx = audio.ctx;
  const unit = 1.2 / S.wpm;               // dot length in seconds (PARIS standard)
  const ramp = Math.min(0.006, unit / 4); // soft edges – no clicks
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = S.tone;
  env.gain.value = 0;
  osc.connect(env).connect(audio.master);

  const t0 = ctx.currentTime + 0.03;
  let t = t0;
  for (const sym of MORSE[ch]) {
    const len = sym === '.' ? unit : 3 * unit;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + ramp);
    env.gain.setValueAtTime(1, t + len - ramp);
    env.gain.linearRampToValueAtTime(0, t + len);
    t += len + unit;
  }
  const end = t - unit;
  osc.start(t0);
  osc.stop(end + 0.02);

  return new Promise((resolve) => {
    const cur = { osc, env, resolve };
    cur.timer = setTimeout(() => {
      if (audio.cur === cur) audio.cur = null;
      resolve(true);
    }, (end - ctx.currentTime) * 1000 + 30);
    audio.cur = cur;
  });
}

function stopSound() {
  const cur = audio.cur;
  if (!cur) return;
  audio.cur = null;
  clearTimeout(cur.timer);
  const now = audio.ctx.currentTime;
  try {
    cur.env.gain.cancelScheduledValues(now);
    cur.env.gain.setValueAtTime(cur.env.gain.value, now);
    cur.env.gain.linearRampToValueAtTime(0, now + 0.005);
    cur.osc.stop(now + 0.01);
  } catch (e) { /* the oscillator may have stopped already */ }
  cur.resolve(false);
}

// ---------- Practice mode ----------
const P = {
  state: 'idle',   // idle | await (waiting for a key) | feedback (showing the result)
  run: 0,          // session counter – invalidates pending timers after a pause
  playId: 0,
  started: false,
  current: null,
  bag: [],
  ok: 0, bad: 0, streak: 0, best: 0,
  letters: {},     // letter -> { ok, bad }
};

function pShow(kind, letter, note) {
  $('pDisplay').className = 'display ' + kind;
  $('pLetter').textContent = letter || '?';
  $('pCode').innerHTML = letter ? codeHTML(MORSE[letter]) : '';
  $('pNote').innerHTML = note || '&nbsp;';
}

function pIdleText() {
  if (!activeChars().length) return 'Select at least one character group in the left panel.';
  return P.started ? 'Paused – press “Resume” or Space.' : 'Press “Start” or Space to begin.';
}

function pStart() {
  if (!activeChars().length) return;
  ensureAudio();
  P.run++;
  P.started = true;
  $('pStart').textContent = 'Pause';
  $('pRepeat').disabled = false;
  renderKeyboard();
  pNext(P.run, 300);
}

function pPause() {
  P.run++;
  stopSound();
  P.state = 'idle';
  $('pStart').textContent = P.started ? 'Resume' : 'Start';
  $('pRepeat').disabled = true;
  pShow('idle');
  updateAvailability();
}

async function pNext(run, delay) {
  if (delay) {
    await sleep(delay);
    if (run !== P.run) return;
  }
  const chars = activeChars();
  if (!chars.length) { pPause(); return; }
  if (!P.bag.length) P.bag = refillBag(chars, P.current);
  P.current = P.bag.pop();
  P.state = 'await';
  kbClearMarks();
  $('pStatus').textContent = 'Which letter is it?';
  pShow('listening');
  pPlay();
}

async function pPlay() {
  const id = ++P.playId;
  const d = $('pDisplay');
  d.classList.add('playing');
  const finished = await playChar(P.current);
  if (id === P.playId) d.classList.remove('playing');
  return finished;
}

function pAnswer(key) {
  if (P.state !== 'await') return;
  stopSound();
  P.state = 'feedback';
  const ch = P.current;
  const st = P.letters[ch] || (P.letters[ch] = { ok: 0, bad: 0 });
  if (key === ch) {
    P.ok++; P.streak++; st.ok++;
    P.best = Math.max(P.best, P.streak);
    $('pStatus').textContent = 'Correct!';
    pShow('correct', ch);
    kbMark(ch, 'ok');
    pNext(P.run, 750);
  } else {
    P.bad++; P.streak = 0; st.bad++;
    $('pStatus').innerHTML = 'Wrong – the correct answer is <b>' + ch + '</b>';
    pShow('wrong', ch, 'Your answer: ' + key + codeHTML(MORSE[key]));
    kbMark(key, 'bad');
    kbMark(ch, 'ok');
    if (kbOn() && navigator.vibrate) navigator.vibrate(70);
    pWrongFlow(P.run);
  }
  pRenderStats();
}

// After a mistake: play the correct character once more, then move on
async function pWrongFlow(run) {
  await sleep(450);
  if (run !== P.run) return;
  await pPlay();
  if (run !== P.run) return;
  pNext(run, 1300);
}

function pRenderStats() {
  const total = P.ok + P.bad;
  $('sOk').textContent = P.ok;
  $('sBad').textContent = P.bad;
  $('sStreak').textContent = P.streak;
  $('sBest').textContent = P.best;
  $('sAcc').textContent = total ? Math.round((100 * P.ok) / total) + '%' : '–';
  $('pLetterStats').innerHTML = activeChars().map((ch) => {
    const st = P.letters[ch];
    const n = st ? st.ok + st.bad : 0;
    if (!n) return `<span class="ls" title="${ch}: no attempts yet"><b>${ch}</b><small>–</small></span>`;
    const acc = st.ok / n;
    return `<span class="ls has" style="--h:${Math.round(acc * 130)}" title="${ch}: ${st.ok} correct, ${st.bad} wrong">` +
      `<b>${ch}</b><small>${Math.round(acc * 100)}%</small></span>`;
  }).join('');
}

// ---------- Test mode ----------
const T = { run: 0, sending: false, seq: [], cfg: null };

function tPanel(name) {
  $('tSetup').hidden = name !== 'setup';
  $('tRunCard').hidden = name !== 'run';
  $('tResult').hidden = name !== 'result';
  renderKeyboard();
}

function tGenerate(n) {
  const chars = activeChars();
  const out = [];
  let bag = [];
  while (out.length < n) {
    if (!bag.length) bag = refillBag(chars, out[out.length - 1]);
    out.push(bag.pop());
  }
  return out;
}

function tStartNew() {
  if (!activeChars().length) { tPanel('setup'); return; }
  tRun(tGenerate(S.count));
}

async function tRun(seq) {
  ensureAudio();
  const run = ++T.run;
  T.seq = seq;
  T.sending = true;
  T.cfg = { wpm: S.wpm, gap: S.gap };
  tPanel('run');
  $('tInput').value = '';
  tSyncTyped();
  if (!kbOn()) $('tInput').focus();
  $('tFinish').disabled = true;
  $('tRunStatus').textContent = 'Get ready…';
  tProgress(0);

  await sleep(1200);
  if (run !== T.run) return;
  $('tRunStatus').textContent = 'Listen and write';
  for (let i = 0; i < seq.length; i++) {
    tProgress(i + 1);
    await playChar(seq[i]);
    if (run !== T.run) return;
    if (i < seq.length - 1) {
      await sleep(T.cfg.gap * 1000);
      if (run !== T.run) return;
    }
  }
  T.sending = false;
  $('tFinish').disabled = false;
  $('tRunStatus').textContent = kbOn() ? 'Sending finished – finish typing and tap “Check”'
    : 'Sending finished – finish typing and press Enter';
  renderKeyboard();
}

// Typing in the test from the on-screen keyboard (the text field is hidden then)
function tType(ch) {
  if ($('tRunCard').hidden) return;
  $('tInput').value += ch;
  tSyncTyped();
}

function tBackspace() {
  if ($('tRunCard').hidden) return;
  $('tInput').value = $('tInput').value.slice(0, -1);
  tSyncTyped();
}

function tSyncTyped() {
  const v = $('tInput').value;
  $('tTyped').textContent = v.length;
  $('tMirror').innerHTML = v ? v + '<span class="caret"></span>' : '<span class="caret"></span><span class="ph">Tap letters…</span>';
}

function tProgress(i) {
  $('tCounter').textContent = i + ' / ' + T.seq.length;
  $('tBar').style.width = (100 * i) / T.seq.length + '%';
}

function tAbort() {
  T.run++;
  T.sending = false;
  stopSound();
  tPanel('setup');
}

function tFinish() {
  if (T.sending) return;
  T.run++;
  tRenderResult(align(T.seq, [...$('tInput').value]));
  tPanel('result');
}

// Align sent and typed characters (Levenshtein distance),
// so one skipped character doesn't shift everything after it to “wrong”.
function align(sent, recv) {
  const n = sent.length, m = recv.length;
  const D = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = D[i - 1][j - 1] + (sent[i - 1] === recv[j - 1] ? 0 : 1);
      D[i][j] = Math.min(sub, D[i - 1][j] + 1, D[i][j - 1] + 1);
    }
  }
  const ops = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    const same = i > 0 && j > 0 && sent[i - 1] === recv[j - 1];
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (same ? 0 : 1)) {
      ops.push({ s: sent[i - 1], r: recv[j - 1], t: same ? 'ok' : 'bad' });
      i--; j--;
    } else if (i > 0 && D[i][j] === D[i - 1][j] + 1) {
      ops.push({ s: sent[i - 1], r: null, t: 'miss' });
      i--;
    } else {
      ops.push({ s: null, r: recv[j - 1], t: 'extra' });
      j--;
    }
  }
  return ops.reverse();
}

function tRenderResult(ops) {
  const n = T.seq.length;
  const count = (t) => ops.filter((o) => o.t === t).length;
  const ok = count('ok');
  const pct = Math.round((100 * ok) / n);

  const ring = $('tRing');
  ring.style.setProperty('--p', pct);
  ring.style.setProperty('--c', pct >= 90 ? 'var(--ok)' : pct >= 70 ? 'var(--warn)' : 'var(--bad)');
  $('tPct').textContent = pct + '%';
  $('tVerdict').textContent = pct === 100 ? 'Perfect!' : pct >= 90 ? 'Great!' : pct >= 70 ? 'Not bad' : 'Keep practising';
  $('tScore').textContent = `${ok} / ${n} correct`;
  $('tSummary').innerHTML = `Wrong: <b>${count('bad')}</b> · Missed: <b>${count('miss')}</b> · Extra: <b>${count('extra')}</b>` +
    `<br>Speed ${T.cfg.wpm} WPM, gap ${T.cfg.gap.toFixed(1)} s`;

  let idx = 0;
  $('tCmp').innerHTML = ops.map((o) => {
    if (o.t === 'extra') {
      return `<div class="cmp-col extra" title="Extra character"><small class="cmp-idx">&nbsp;</small>` +
        `<span class="cmp-sent">&nbsp;</span><span class="cmp-code"></span><span class="cmp-recv">+${o.r}</span></div>`;
    }
    idx++;
    return `<button class="cmp-col ${o.t}" data-ch="${o.s}" title="Play ${o.s}"><small class="cmp-idx">${idx}</small>` +
      `<span class="cmp-sent">${o.s}</span><span class="cmp-code">${codeHTML(MORSE[o.s])}</span>` +
      `<span class="cmp-recv">${o.r || '—'}</span></button>`;
  }).join('');

  // Mistake summary for each sent letter
  const per = {};
  for (const o of ops) {
    if (!o.s) continue;
    const p = per[o.s] || (per[o.s] = { n: 0, wrong: [] });
    p.n++;
    if (o.t !== 'ok') p.wrong.push(o.r || '—');
  }
  const rows = Object.entries(per)
    .filter(([, p]) => p.wrong.length)
    .sort((a, b) => b[1].wrong.length - a[1].wrong.length || b[1].wrong.length / b[1].n - a[1].wrong.length / a[1].n);
  $('tMistakes').innerHTML = rows.length
    ? rows.map(([ch, p]) => `<div class="mistake"><button class="chip" data-ch="${ch}" title="Play ${ch}"><b>${ch}</b>${codeHTML(MORSE[ch])}</button>` +
        `<div><b>${p.wrong.length} of ${p.n}</b> wrong<br><span class="muted small">typed: ${p.wrong.join(', ')}</span></div></div>`).join('')
    : '<p class="no-mistakes">No mistakes – great job!</p>';
}

function setCount(n) {
  S.count = clamp(Math.round(n) || DEFAULTS.count, 1, 200);
  $('tCount').value = S.count;
  document.querySelectorAll('#tPresets button').forEach((b) => b.classList.toggle('active', +b.dataset.n === S.count));
  saveSettings();
}

// ---------- Light / dark theme ----------
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const ICON_MOON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const ICON_SUN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

function isDark() {
  return S.theme === 'dark' || (S.theme === 'system' && darkQuery.matches);
}

function applyTheme() {
  const root = document.documentElement;
  if (S.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = S.theme;
  const dark = isDark();
  $('themeColor').content = dark ? '#121821' : '#ffffff';  // browser bar colour on phones
  const btn = $('themeBtn');
  btn.innerHTML = dark ? ICON_SUN : ICON_MOON;
  btn.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
  btn.setAttribute('aria-label', btn.title);
}

// Toggles light/dark; when the choice matches the system, go back to “follow system”
function toggleTheme() {
  const wantDark = !isDark();
  S.theme = wantDark === darkQuery.matches ? 'system' : wantDark ? 'dark' : 'light';
  applyTheme();
  saveSettings();
}

// ---------- On-screen keyboard (phone) ----------
const coarseQuery = window.matchMedia('(pointer: coarse)');
const QWERTY = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const ICON_BACK = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="M17 9l-6 6M11 9l6 6"/></svg>';
const ICON_SPEAKER = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';

function kbOn() {
  return S.kbMode === 'on' || (S.kbMode === 'auto' && coarseQuery.matches);
}

// Auto: big ABC keys for a few letters, QWERTY layout for many
function kbLayout() {
  if (S.kbLayout !== 'auto') return S.kbLayout;
  return activeChars().length <= 12 ? 'abc' : 'qwerty';
}

function renderKeyboard() {
  const on = kbOn();
  document.body.classList.toggle('kb-on', on);
  document.querySelectorAll('#kbModeSeg button').forEach((b) => b.classList.toggle('active', b.dataset.kb === S.kbMode));
  const kb = $('kb');
  kb.hidden = !on || (S.mode === 'test' && $('tRunCard').hidden);
  if (kb.hidden) {
    document.body.style.setProperty('--kb-h', '0px');
    return;
  }

  const chars = activeChars();
  const active = new Set(chars);
  const key = (ch) => `<button class="key" data-key="${ch}"${active.has(ch) ? '' : ' disabled'}>${ch}</button>`;
  const layout = kbLayout();
  let html;
  if (layout === 'abc') {
    html = `<div class="kb-grid">${chars.slice().sort().map(key).join('')}</div>`;
  } else {
    // middle row indented by half a key, like on a phone
    html = QWERTY.map((row, i) => {
      const gap = i === 1 ? '<span class="kb-gap"></span>' : '';
      return `<div class="kb-row">${gap}${[...row].map(key).join('')}${gap}</div>`;
    }).join('');
  }
  if (S.mode === 'practice') {
    html += `<div class="kb-row">
      <button class="key wide primary" data-act="start"${$('pStart').disabled ? ' disabled' : ''}>${$('pStart').textContent}</button>
      <button class="key wide fn" data-act="repeat"${$('pRepeat').disabled ? ' disabled' : ''}>${ICON_SPEAKER}Replay</button>
    </div>`;
  } else {
    html += `<div class="kb-row">
      <button class="key wide fn" data-act="unknown">?<small>not sure</small></button>
      <button class="key fn" data-act="back" aria-label="Delete last character">${ICON_BACK}</button>
      <button class="key wide primary" data-act="finish"${T.sending ? ' disabled' : ''}>Check</button>
    </div>`;
  }
  $('kbKeys').innerHTML = html;
  $('kbHint').textContent = S.mode === 'practice' ? 'Tap the letter you hear' : 'Write what you hear';
  document.querySelectorAll('#kbLayoutSeg button').forEach((b) => b.classList.toggle('active', b.dataset.layout === layout));
  document.body.style.setProperty('--kb-h', kb.offsetHeight + 'px');
}

function kbMark(ch, cls) {
  const b = document.querySelector(`#kbKeys [data-key="${ch}"]`);
  if (b) b.classList.add(cls);
}

function kbClearMarks() {
  document.querySelectorAll('#kbKeys .key.ok, #kbKeys .key.bad').forEach((b) => b.classList.remove('ok', 'bad'));
}

function kbPress(b) {
  if (b.dataset.key) {
    if (S.mode === 'practice') pAnswer(b.dataset.key);
    else tType(b.dataset.key);
    return;
  }
  switch (b.dataset.act) {
    case 'start': if (P.state === 'idle') pStart(); else pPause(); break;
    case 'repeat': if (P.state === 'await') pPlay(); break;
    case 'unknown': tType('?'); break;
    case 'back': tBackspace(); break;
    case 'finish': tFinish(); break;
  }
}

// ---------- Sidebar, modes, shared ----------
function renderLessons() {
  $('lessonList').innerHTML = LESSONS.map((l, i) => `
    <article class="lesson${S.groups[i] ? '' : ' off'}">
      <label class="lesson-head">
        <span class="lesson-txt"><span class="lesson-no">Lesson ${i + 1}</span><span class="lesson-title">${l.title}</span></span>
        <input type="checkbox" class="switch" data-group="${i}" ${S.groups[i] ? 'checked' : ''} aria-label="Lesson ${i + 1}">
      </label>
      <div class="chips">${[...l.chars].map((ch) =>
        `<button class="chip" data-ch="${ch}" title="Play ${ch}"><b>${ch}</b>${codeHTML(MORSE[ch])}</button>`).join('')}</div>
    </article>`).join('');
}

function onGroupsChanged() {
  saveSettings();
  const chars = activeChars();
  P.bag = [];
  $('activeInfo').innerHTML = `Letters: <b>${chars.length}</b><span class="letters">${chars.join('')}</span>`;
  if (!chars.length && P.state !== 'idle') pPause();
  pRenderStats();
  updateAvailability();
}

function setAllGroups(on) {
  S.groups = S.groups.map(() => on);
  renderLessons();
  onGroupsChanged();
}

function updateAvailability() {
  const none = !activeChars().length;
  $('tStart').disabled = none;
  $('tWarn').hidden = !none;
  if (P.state === 'idle') {
    $('pStart').disabled = none;
    $('pStatus').textContent = pIdleText();
  }
  renderKeyboard();
}

function setSidebar(open) {
  document.body.classList.toggle('sb-open', open);
  $('sbToggle').setAttribute('aria-expanded', String(open));
  S.sidebar = open;
  saveSettings();
}

function setMode(m, force) {
  if (m === S.mode && !force) return;
  if (!force && T.sending) {
    if (!confirm('Stop the running test?')) return;
    tAbort();
  }
  if (m !== 'practice' && P.state !== 'idle') pPause();
  S.mode = m;
  saveSettings();
  document.querySelectorAll('.tab').forEach((b) => {
    const on = b.dataset.mode === m;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  $('practice').hidden = m !== 'practice';
  $('test').hidden = m !== 'test';
  renderKeyboard();
}

function bindSlider(id, fmt) {
  const el = $(id), out = $(id + 'Out');
  el.value = S[id];
  out.textContent = fmt(S[id]);
  el.addEventListener('input', () => {
    S[id] = +el.value;
    out.textContent = fmt(S[id]);
    if (id === 'volume') applyVolume();
    saveSettings();
  });
  // On slider release – play a sample (if nothing else is playing)
  el.addEventListener('change', () => {
    if (P.state === 'idle' && !T.sending) playChar('K');
  });
}

function init() {
  renderLessons();

  $('lessonList').addEventListener('change', (e) => {
    const sw = e.target.closest('.switch');
    if (!sw) return;
    const i = +sw.dataset.group;
    S.groups[i] = sw.checked;
    sw.closest('.lesson').classList.toggle('off', !sw.checked);
    onGroupsChanged();
  });
  $('selAll').addEventListener('click', () => setAllGroups(true));
  $('selNone').addEventListener('click', () => setAllGroups(false));

  // Clicking a character (sidebar, test results) plays it
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-ch]');
    if (el && !T.sending) playChar(el.dataset.ch);
  });

  bindSlider('wpm', (v) => v + ' WPM');
  bindSlider('tone', (v) => v + ' Hz');
  bindSlider('volume', (v) => v + '%');

  applyTheme();
  $('themeBtn').addEventListener('click', toggleTheme);
  darkQuery.addEventListener('change', applyTheme);

  $('sbToggle').addEventListener('click', () => setSidebar(!document.body.classList.contains('sb-open')));
  $('sbClose').addEventListener('click', () => setSidebar(false));
  $('backdrop').addEventListener('click', () => setSidebar(false));
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

  // Practice
  $('pStart').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (P.state === 'idle') pStart(); else pPause();
  });
  $('pRepeat').addEventListener('click', (e) => {
    e.currentTarget.blur();
    if (P.state === 'await') pPlay();
  });
  $('sReset').addEventListener('click', () => {
    Object.assign(P, { ok: 0, bad: 0, streak: 0, best: 0, letters: {} });
    pRenderStats();
  });

  // Test
  setCount(S.count);
  $('tPresets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-n]');
    if (b) setCount(+b.dataset.n);
  });
  $('tCount').addEventListener('change', (e) => setCount(+e.target.value));
  $('tGap').value = S.gap;
  $('tGapOut').textContent = S.gap.toFixed(1) + ' s';
  $('tGap').addEventListener('input', (e) => {
    S.gap = +e.target.value;
    $('tGapOut').textContent = S.gap.toFixed(1) + ' s';
    saveSettings();
  });
  $('tStart').addEventListener('click', tStartNew);
  $('tAbort').addEventListener('click', tAbort);
  $('tFinish').addEventListener('click', tFinish);
  $('tNew').addEventListener('click', tStartNew);
  $('tRetry').addEventListener('click', () => tRun(T.seq.slice()));
  $('tBack').addEventListener('click', () => tPanel('setup'));

  // Answer field: letters A–Z only, space becomes “?”
  const clean = (s) => s.toUpperCase().replace(/ /g, '?').replace(/[^A-Z?]/g, '');
  $('tInput').addEventListener('input', (e) => {
    const el = e.target;
    const v = clean(el.value);
    if (v !== el.value) {
      const pos = clean(el.value.slice(0, el.selectionStart ?? el.value.length)).length;
      el.value = v;
      el.setSelectionRange(pos, pos);
    }
    tSyncTyped();
  });
  $('tInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      tFinish();
    }
  });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'Escape' && document.body.classList.contains('sb-open') && window.innerWidth < 1000) {
      setSidebar(false);
      return;
    }
    const t = e.target;
    const typing = t.tagName === 'INPUT' && (t.type === 'text' || t.type === 'number');

    if (S.mode === 'test') {
      if ($('tRunCard').hidden || typing) return;
      if (kbOn()) {
        // Text field hidden – the physical keyboard types like the on-screen one
        if (e.key === 'Backspace') { e.preventDefault(); tBackspace(); }
        else if (e.key === 'Enter') tFinish();
        else if (e.key === ' ') { e.preventDefault(); tType('?'); }
        else if (/^[a-z]$/i.test(e.key)) tType(e.key.toUpperCase());
      } else if (e.key.length === 1) {
        // Letter pressed outside the field – move focus there so nothing gets lost
        $('tInput').focus();
      }
      return;
    }
    if (typing) return;
    if (e.key === 'Escape') {
      if (P.state !== 'idle') pPause();
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      if (e.repeat) return;
      if (P.state === 'idle') pStart();
      else if (P.state === 'await') pPlay();
      return;
    }
    const k = e.key.length === 1 ? e.key.toUpperCase() : '';
    if (MORSE[k] && !e.repeat) {
      e.preventDefault();
      pAnswer(k);
    }
  });

  // On-screen keyboard: react on touch-down (no waiting for “click”)
  $('kbKeys').addEventListener('pointerdown', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    e.preventDefault();
    b.classList.add('down');
    setTimeout(() => b.classList.remove('down'), 120);
    kbPress(b);
  });
  $('kbLayoutSeg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-layout]');
    if (!b) return;
    S.kbLayout = b.dataset.layout;
    saveSettings();
    renderKeyboard();
  });
  $('kbModeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-kb]');
    if (!b) return;
    S.kbMode = b.dataset.kb;
    saveSettings();
    renderKeyboard();
  });
  coarseQuery.addEventListener('change', renderKeyboard);
  // Keyboard height = bottom padding of the content (changes e.g. when the phone rotates)
  new ResizeObserver(() => {
    if (!$('kb').hidden) document.body.style.setProperty('--kb-h', $('kb').offsetHeight + 'px');
  }).observe($('kb'));
  // iOS only unlocks audio in touchend/click – prepare it on the first touch
  document.addEventListener('touchend', ensureAudio, { passive: true });

  // Tab in the background – pause practice
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && P.state !== 'idle') pPause();
  });

  setSidebar(window.innerWidth >= 1000 ? S.sidebar !== false : false);
  setMode(S.mode, true);
  onGroupsChanged();
  pShow('idle');
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.remove('preload')));
}

init();
