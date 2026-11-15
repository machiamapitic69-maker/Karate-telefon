// Dr. IonDeli — aplicație de pregătire pentru examenul de rezidențiat.
// Totul rulează local în browser; progresul se salvează în localStorage.

const STORE_KEY = 'iondeli:v1';
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm';
const AI_MODEL = 'claude-opus-5-5';
const SRS_DAYS = [0, 1, 3, 7, 16, 35]; // intervalele (zile) pentru fiecare „cutie” Leitner
const SEC_PER_Q = 72; // 200 de grile în 4 ore
const LETTERS = ['A', 'B', 'C', 'D', 'E'];

const DISC = window.DISCIPLINES || {};
const $view = document.getElementById('view');

// ───────────────────────── Stare ─────────────────────────
function defaultState() {
  return {
    progress: {},
    days: {},
    custom: [],
    exams: [],
    settings: { examDate: '', dailyGoal: 50, theme: 'auto', apiKey: '' },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    const d = defaultState();
    return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) } };
  } catch {
    return defaultState();
  }
}

let state = loadState();
let saveFailed = false;
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    if (!saveFailed) toast('Progresul nu poate fi salvat în acest browser (stocare blocată).');
    saveFailed = true;
  }
}

function allQuestions() {
  const map = new Map();
  for (const q of window.QUESTIONS || []) map.set(q.id, q);
  for (const q of state.custom) map.set(q.id, q);
  return [...map.values()];
}
let QMAP = new Map();
function refreshBank() { QMAP = new Map(allQuestions().map((q) => [q.id, q])); }
refreshBank();

function discName(k) { return DISC[k] || k || 'Altele'; }
function disciplinesInBank() {
  const keys = new Set(Object.keys(DISC));
  for (const q of QMAP.values()) keys.add(q.disc);
  return [...keys];
}

// ───────────────────────── Utilitare ─────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const DAY = 86400000;
function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function fmtTime(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(s).padStart(2, '0')}`;
}
function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
let toastTimer;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2600);
}

// ───────────────────────── Punctaj oficial ─────────────────────────
// CS: 4 puncte dacă e marcat exact răspunsul corect.
// CM: 1 punct pentru fiecare variantă tratată corect (marcată dacă e corectă / nemarcată dacă e greșită),
//     dar 0 puncte dacă s-au marcat mai puțin de 2 sau mai mult de 4 variante. Maxim 5.
function maxPoints(q) { return q.type === 'CS' ? 4 : 5; }
function scoreQ(q, sel) {
  sel = sel || [];
  if (q.type === 'CS') return sel.length === 1 && q.correct.includes(sel[0]) ? 4 : 0;
  if (sel.length < 2 || sel.length > 4) return 0;
  let p = 0;
  for (let i = 0; i < 5; i++) if (sel.includes(i) === q.correct.includes(i)) p++;
  return p;
}

// ───────────────────────── Progres & repetiție spațiată ─────────────────────────
function prog(id) { return state.progress[id] || (state.progress[id] = { box: 0, due: 0, seen: 0, right: 0, wrong: 0, last: null, fav: false }); }

function recordAnswer(q, sel, { srs = true } = {}) {
  const pts = scoreQ(q, sel), full = pts === maxPoints(q);
  const p = prog(q.id);
  p.seen++; full ? p.right++ : p.wrong++;
  p.last = full ? 'ok' : 'ko';
  p.lastAt = Date.now();
  if (srs) {
    if (full) { p.box = Math.min(p.box + 1, SRS_DAYS.length - 1); p.due = Date.now() + SRS_DAYS[p.box] * DAY; }
    else { p.box = 0; p.due = Date.now(); }
  }
  const k = todayKey();
  const d = state.days[k] || (state.days[k] = { answered: 0, correct: 0, points: 0, max: 0 });
  d.answered++; if (full) d.correct++; d.points += pts; d.max += maxPoints(q);
  save();
  return pts;
}

function dueIds() {
  const now = Date.now();
  return [...QMAP.keys()].filter((id) => { const p = state.progress[id]; return p && p.seen > 0 && p.due <= now; });
}

function streak() {
  let n = 0; const d = new Date();
  if (!state.days[todayKey(d)]) d.setDate(d.getDate() - 1); // ziua de azi nu rupe seria dacă încă nu s-a învățat
  while (state.days[todayKey(d)]?.answered) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ───────────────────────── Navigare ─────────────────────────
let session = null;
let examTimer = null;

const routes = { home: viewHome, practice: viewPracticeSetup, review: viewReview, exam: viewExamSetup, more: viewMore, list: viewList, ai: viewAIGenerate };

function go(name, arg) {
  if (session?.mode === 'exam' && !session.finished && name !== 'session') {
    if (!confirm('Ieși din simulare? Răspunsurile date până acum se pierd.')) return;
    stopExamTimer();
  }
  session = null;
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.go === name));
  (routes[name] || viewHome)(arg);
  $view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  updateStreak();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) { e.preventDefault(); go(b.dataset.go, b.dataset.arg); }
});

function updateStreak() { document.getElementById('streakBadge').textContent = `🔥 ${streak()}`; }

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

// ───────────────────────── Acasă ─────────────────────────
function viewHome() {
  const total = QMAP.size;
  const ids = [...QMAP.keys()];
  const seen = ids.filter((id) => state.progress[id]?.seen).length;
  let right = 0, answered = 0;
  for (const id of ids) { const p = state.progress[id]; if (p) { right += p.right; answered += p.right + p.wrong; } }
  const today = state.days[todayKey()] || { answered: 0, correct: 0 };
  const goal = Number(state.settings.dailyGoal) || 50;
  const due = dueIds().length;
  const mastered = ids.filter((id) => (state.progress[id]?.box || 0) >= 3).length;

  let countdown = '';
  if (state.settings.examDate) {
    const days = Math.ceil((new Date(state.settings.examDate + 'T09:00') - new Date()) / DAY);
    countdown = days >= 0
      ? `<div class="card"><div class="row"><div><div class="muted small">Până la examen</div><div class="big-score">${days} zile</div></div><div class="spacer"></div><div class="muted small" style="text-align:right">Ritm recomandat:<br><b>${Math.max(1, Math.ceil((total - mastered) / Math.max(days, 1)))}</b> grile noi stăpânite / zi</div></div></div>`
      : '';
  } else {
    countdown = `<div class="card"><p class="muted small" style="margin:0">Setează data examenului în <a href="#" data-go="more">Mai mult</a> ca să vezi numărătoarea inversă și ritmul recomandat.</p></div>`;
  }

  const perDisc = disciplinesInBank().map((k) => {
    const qs = ids.filter((id) => QMAP.get(id).disc === k);
    if (!qs.length) return '';
    let r = 0, a = 0, s = 0;
    for (const id of qs) { const p = state.progress[id]; if (p?.seen) { s++; r += p.right; a += p.right + p.wrong; } }
    return `<div class="list-item"><div class="row"><b>${esc(discName(k))}</b><div class="spacer"></div><span class="muted small">${s}/${qs.length} văzute · ${a ? pct(r, a) + '% corect' : '—'}</span></div><div class="progress" style="margin-top:6px"><i style="width:${pct(s, qs.length)}%"></i></div></div>`;
  }).join('');

  $view.innerHTML = `
    <h1>Bună! Hai să luăm punctaj maxim 💪</h1>
    ${countdown}
    <div class="card">
      <div class="row"><b>Obiectivul de azi</b><div class="spacer"></div><span class="muted small">${today.answered}/${goal} grile</span></div>
      <div class="progress" style="margin:8px 0 4px"><i style="width:${Math.min(100, pct(today.answered, goal))}%"></i></div>
      <div class="muted small">${today.answered >= goal ? 'Obiectiv atins azi! 🎉' : `Mai ai ${goal - today.answered} grile.`}</div>
    </div>
    <div class="grid three">
      <div class="card stat"><b>${seen}/${total}</b><span>grile văzute</span></div>
      <div class="card stat"><b>${answered ? pct(right, answered) : 0}%</b><span>răspunsuri perfecte</span></div>
      <div class="card stat"><b>${mastered}</b><span>stăpânite</span></div>
    </div>
    <div class="grid two" style="margin-bottom:14px">
      <button class="btn primary block" data-go="review">🔁 Recapitulare${due ? ` (${due})` : ''}</button>
      <button class="btn block" id="quick10">⚡ 10 grile rapide</button>
    </div>
    <div class="card"><h2>Progres pe discipline</h2>${perDisc || '<p class="muted">Nicio grilă în bancă.</p>'}</div>
    <div class="card"><h2>Ultimele 7 zile</h2>${weekChart()}</div>
  `;
  document.getElementById('quick10').onclick = () => startQuiz('practice', pickQuestions({ count: 10, filter: 'smart' }));
}

function weekChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ k: todayKey(d), label: d.toLocaleDateString('ro-RO', { weekday: 'short' }) }); }
  const max = Math.max(1, ...days.map((d) => state.days[d.k]?.answered || 0));
  return `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;align-items:end;height:110px">${days.map((d) => {
    const v = state.days[d.k]?.answered || 0;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end"><span class="small muted">${v || ''}</span><div style="width:70%;max-width:28px;height:${Math.max(3, (v / max) * 70)}px;background:${v ? 'var(--accent)' : 'var(--line)'};border-radius:4px"></div><span class="small muted">${esc(d.label)}</span></div>`;
  }).join('')}</div>`;
}

// ───────────────────────── Alegere grile ─────────────────────────
function pickQuestions({ discs = null, chapters = null, type = 'all', filter = 'all', count = 20 }) {
  let qs = [...QMAP.values()];
  if (discs?.length) qs = qs.filter((q) => discs.includes(q.disc));
  if (chapters?.length) qs = qs.filter((q) => chapters.includes(q.chapter));
  if (type !== 'all') qs = qs.filter((q) => q.type === type);
  const P = (q) => state.progress[q.id];
  if (filter === 'new') qs = qs.filter((q) => !P(q)?.seen);
  if (filter === 'wrong') qs = qs.filter((q) => P(q)?.wrong > 0 && (P(q)?.box || 0) < 3);
  if (filter === 'fav') qs = qs.filter((q) => P(q)?.fav);
  if (filter === 'smart') {
    // întâi cele scadente, apoi cele nevăzute, apoi restul (cele mai slabe primele)
    const now = Date.now();
    const w = (q) => { const p = P(q); if (!p?.seen) return 1; if (p.due <= now) return 0; return 2 + p.box; };
    qs = shuffle(qs).sort((a, b) => w(a) - w(b));
    return qs.slice(0, count).map((q) => q.id);
  }
  return shuffle(qs).slice(0, count).map((q) => q.id);
}

// ───────────────────────── Învață (setări) ─────────────────────────
function viewPracticeSetup() {
  const discs = disciplinesInBank().filter((k) => [...QMAP.values()].some((q) => q.disc === k));
  const sel = new Set(discs);
  $view.innerHTML = `
    <h1>Învață</h1>
    <div class="card">
      <h3>Discipline</h3>
      <div class="chips" id="discChips">${discs.map((k) => `<button class="chip on" data-k="${esc(k)}">${esc(discName(k))}</button>`).join('')}</div>
      <label class="field">Capitol
        <select id="chapter"></select>
      </label>
      <div class="grid two">
        <label class="field">Tip grilă
          <select id="type"><option value="all">Toate</option><option value="CS">Complement simplu (CS)</option><option value="CM">Complement multiplu (CM)</option></select>
        </label>
        <label class="field">Număr de grile
          <select id="count"><option>10</option><option selected>20</option><option>50</option><option>100</option></select>
        </label>
      </div>
      <label class="field">Ce grile
        <select id="filter">
          <option value="smart">Inteligent (scadente → noi → slabe)</option>
          <option value="all">Toate, aleator</option>
          <option value="new">Doar nevăzute</option>
          <option value="wrong">Doar cele greșite</option>
          <option value="fav">Doar favorite ⭐</option>
        </select>
      </label>
      <p class="muted small" id="avail"></p>
      <button class="btn primary block" id="start">Începe</button>
    </div>`;
  const chapSel = document.getElementById('chapter');
  const refresh = () => {
    const chaps = [...new Set([...QMAP.values()].filter((q) => sel.has(q.disc)).map((q) => q.chapter))].sort((a, b) => a.localeCompare(b, 'ro'));
    const cur = chapSel.value;
    chapSel.innerHTML = `<option value="">Toate capitolele</option>` + chaps.map((c) => `<option ${c === cur ? 'selected' : ''}>${esc(c)}</option>`).join('');
    document.getElementById('avail').textContent = `${opts().length} grile disponibile cu aceste filtre.`;
  };
  const opts = () => pickQuestions({
    discs: [...sel], chapters: chapSel.value ? [chapSel.value] : null,
    type: document.getElementById('type').value, filter: document.getElementById('filter').value, count: 1e9,
  });
  document.getElementById('discChips').onclick = (e) => {
    const c = e.target.closest('.chip'); if (!c) return;
    sel.has(c.dataset.k) ? sel.delete(c.dataset.k) : sel.add(c.dataset.k);
    c.classList.toggle('on'); refresh();
  };
  ['chapter', 'type', 'filter'].forEach((id) => document.getElementById(id).onchange = refresh);
  refresh();
  document.getElementById('start').onclick = () => {
    const ids = opts().slice(0, Number(document.getElementById('count').value));
    if (!ids.length) return toast('Nicio grilă nu corespunde filtrelor.');
    startQuiz('practice', ids);
  };
}

function viewReview() {
  const ids = shuffle(dueIds());
  if (!ids.length) {
    $view.innerHTML = `<h1>Recapitulare</h1><div class="card empty"><p style="font-size:2rem;margin:0">✅</p><p>Nu ai nicio grilă scadentă acum.</p><p class="small">Grilele greșite revin imediat; cele corecte revin după 1, 3, 7, 16 și 35 de zile.</p><button class="btn primary" data-go="practice">Învață grile noi</button></div>`;
    return;
  }
  startQuiz('review', ids);
}

// ───────────────────────── Sesiune de grile (Învață / Recapitulare) ─────────────────────────
function startQuiz(mode, ids) {
  if (!ids.length) return toast('Nicio grilă disponibilă.');
  session = { mode, ids, idx: 0, answers: {}, checked: {}, points: 0, max: 0, start: Date.now() };
  renderQuiz();
}

function optionClass(q, i, sel, checked) {
  const c = [];
  const isSel = sel.includes(i), isCor = q.correct.includes(i);
  if (!checked) { if (isSel) c.push('sel'); return c.join(' '); }
  if (isSel && isCor) c.push('right');
  else if (isSel && !isCor) c.push('wrong');
  else if (!isSel && isCor) c.push('missed');
  return c.join(' ');
}

function questionHTML(q, sel, checked, pos) {
  return `
    <div class="qhead"><span>${pos}</span><span><span class="tag ${q.type === 'CM' ? 'cm' : ''}">${q.type}</span> ${esc(discName(q.disc))}${q.chapter ? ' · ' + esc(q.chapter) : ''}</span></div>
    <div class="qtext">${esc(q.q)}</div>
    <div id="opts">${q.options.map((o, i) => `<button class="opt ${optionClass(q, i, sel, checked)}" data-i="${i}" ${checked ? 'disabled' : ''}><span class="L">${LETTERS[i]}</span><span>${esc(o)}</span></button>`).join('')}</div>
    <div class="kbd">${q.type === 'CS' ? 'Un singur răspuns corect.' : 'Între 2 și 4 răspunsuri corecte.'} Taste: A–E, Enter.</div>`;
}

function renderQuiz() {
  const s = session, id = s.ids[s.idx], q = QMAP.get(id);
  if (!q) { s.idx++; return s.idx < s.ids.length ? renderQuiz() : renderQuizEnd(); }
  const sel = s.answers[id] || [], checked = !!s.checked[id];
  const p = prog(q.id);
  let fb = '';
  if (checked) {
    const pts = scoreQ(q, sel), max = maxPoints(q);
    const cls = pts === max ? 'good' : pts > 0 ? 'mid' : 'badf';
    const corectStr = q.correct.map((i) => LETTERS[i]).join(', ');
    fb = `<div class="feedback ${cls}"><b>${pts === max ? 'Perfect!' : pts > 0 ? 'Parțial corect' : 'Greșit'}</b> — ${pts}/${max} puncte. Corect: <b>${corectStr}</b>.
      ${q.type === 'CM' && (sel.length < 2 || sel.length > 4) ? '<br><span class="small">La CM, sub 2 sau peste 4 variante marcate = 0 puncte.</span>' : ''}</div>
      ${q.expl ? `<div class="expl">${esc(q.expl)}</div>` : ''}
      <div class="row" style="margin-bottom:8px">
        <button class="btn" id="aiExplain">🤖 Explică-mi mai pe larg</button>
        <button class="btn ghost" id="aiAsk">💬 Întreabă tutorul</button>
      </div>
      <div id="aiOut"></div>`;
  }
  $view.innerHTML = `
    <div class="row" style="margin-bottom:10px">
      <button class="btn ghost" id="quit">✕</button>
      <div class="spacer"><div class="progress"><i style="width:${pct(s.idx, s.ids.length)}%"></i></div></div>
      <span class="small muted">${s.mode === 'review' ? 'Recapitulare' : 'Învață'}</span>
    </div>
    <div class="card">
      ${questionHTML(q, sel, checked, `${s.idx + 1} / ${s.ids.length}`)}
      ${fb}
      <div class="row end" style="margin-top:12px">
        <button class="btn ghost" id="fav" title="Favorite">${p.fav ? '⭐' : '☆'}</button>
        <div class="spacer"></div>
        ${checked ? `<button class="btn primary" id="next">${s.idx + 1 < s.ids.length ? 'Următoarea →' : 'Rezultat'}</button>` : `<button class="btn primary" id="check" ${sel.length ? '' : 'disabled'}>Verifică</button>`}
      </div>
    </div>`;

  document.getElementById('quit').onclick = () => renderQuizEnd();
  document.getElementById('fav').onclick = () => { p.fav = !p.fav; save(); renderQuiz(); };
  if (!checked) {
    document.getElementById('opts').onclick = (e) => { const b = e.target.closest('.opt'); if (b) toggleOpt(q, Number(b.dataset.i)); };
    document.getElementById('check').onclick = checkCurrent;
  } else {
    document.getElementById('next').onclick = nextQ;
    document.getElementById('aiExplain').onclick = () => aiExplain(q, sel);
    document.getElementById('aiAsk').onclick = () => aiAskBox(q, sel);
  }
}

function toggleOpt(q, i) {
  const s = session, id = q.id;
  let sel = s.answers[id] || [];
  if (q.type === 'CS') sel = [i];
  else sel = sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i].sort();
  s.answers[id] = sel;
  if (s.mode === 'exam') renderExam(); else renderQuiz();
}

function checkCurrent() {
  const s = session, id = s.ids[s.idx], q = QMAP.get(id);
  const sel = s.answers[id] || [];
  if (!sel.length) return;
  s.checked[id] = true;
  const pts = recordAnswer(q, sel);
  s.points += pts; s.max += maxPoints(q);
  renderQuiz();
}

function nextQ() {
  session.idx++;
  if (session.idx >= session.ids.length) renderQuizEnd(); else renderQuiz();
}

function renderQuizEnd() {
  const s = session;
  const done = Object.keys(s.checked).length;
  const wrongIds = s.ids.filter((id) => s.checked[id] && scoreQ(QMAP.get(id), s.answers[id]) < maxPoints(QMAP.get(id)));
  $view.innerHTML = `
    <h1>Sesiune încheiată</h1>
    <div class="card" style="text-align:center">
      <div class="big-score">${pct(s.points, s.max)}%</div>
      <p class="muted">${s.points} / ${s.max} puncte · ${done} grile · ${fmtTime((Date.now() - s.start) / 1000)}</p>
      ${wrongIds.length ? `<p>${wrongIds.length} grile greșite au fost puse la recapitulare.</p>` : done ? '<p>Toate perfecte! 🎉</p>' : ''}
    </div>
    <div class="grid two">
      ${wrongIds.length ? '<button class="btn primary block" id="redo">Refă greșelile acum</button>' : ''}
      <button class="btn block" data-go="home">Acasă</button>
    </div>`;
  const r = document.getElementById('redo');
  if (r) r.onclick = () => startQuiz('practice', shuffle(wrongIds));
  session = null;
}

// ───────────────────────── Simulare examen ─────────────────────────
function viewExamSetup() {
  const total = QMAP.size;
  const last = state.exams.slice(-5).reverse();
  $view.innerHTML = `
    <h1>Simulare examen</h1>
    <div class="card">
      <p class="small muted">Ca la examen: fără feedback până la final, cronometru (72 s / grilă — 200 de grile în 4 ore), punctaj oficial CS 4 p / CM 5 p.</p>
      <label class="field">Număr de grile
        <select id="n">
          <option value="200">200 (examen complet)</option>
          <option value="100">100 (2 ore)</option>
          <option value="50" selected>50 (1 oră)</option>
          <option value="20">20 (24 min)</option>
        </select>
      </label>
      <label class="check"><input type="checkbox" id="ratio" checked> Proporție CS/CM ca la examen (1:3)</label>
      <p class="small muted">Banca are acum ${total} grile; dacă ceri mai multe, simularea le folosește pe toate.</p>
      <button class="btn primary block" id="go">Pornește simularea</button>
    </div>
    ${last.length ? `<div class="card"><h2>Ultimele simulări</h2>${last.map((e) => `<div class="list-item row"><span>${new Date(e.date).toLocaleDateString('ro-RO')}</span><span class="muted small">${e.n} grile · ${fmtTime(e.duration)}</span><div class="spacer"></div><b>${e.score}/${e.max}</b><span class="muted small">(${pct(e.score, e.max)}%)</span></div>`).join('')}</div>` : ''}`;
  document.getElementById('go').onclick = () => {
    const n = Number(document.getElementById('n').value);
    let ids;
    if (document.getElementById('ratio').checked) {
      const cs = shuffle([...QMAP.values()].filter((q) => q.type === 'CS')).map((q) => q.id);
      const cm = shuffle([...QMAP.values()].filter((q) => q.type === 'CM')).map((q) => q.id);
      const nCS = Math.min(cs.length, Math.round(n / 4));
      const nCM = Math.min(cm.length, n - nCS);
      ids = [...cs.slice(0, nCS), ...cm.slice(0, nCM)]; // la examen CS sunt primele
    } else ids = shuffle([...QMAP.keys()]).slice(0, n);
    if (!ids.length) return toast('Banca de grile e goală.');
    session = { mode: 'exam', ids, idx: 0, answers: {}, start: Date.now(), limit: ids.length * SEC_PER_Q, finished: false };
    startExamTimer(); renderExam();
  };
}

function startExamTimer() {
  stopExamTimer();
  examTimer = setInterval(() => {
    if (!session || session.mode !== 'exam' || session.finished) return stopExamTimer();
    const left = session.limit - (Date.now() - session.start) / 1000;
    const el = document.getElementById('timer');
    if (el) { el.textContent = fmtTime(left); el.classList.toggle('low', left < 300); }
    if (left <= 0) { toast('Timpul a expirat!'); finishExam(); }
  }, 1000);
}
function stopExamTimer() { clearInterval(examTimer); examTimer = null; }

function renderExam() {
  const s = session, id = s.ids[s.idx], q = QMAP.get(id);
  const sel = s.answers[id] || [];
  const left = s.limit - (Date.now() - s.start) / 1000;
  const answered = Object.values(s.answers).filter((a) => a.length).length;
  $view.innerHTML = `
    <div class="row" style="margin-bottom:10px">
      <span class="timer ${left < 300 ? 'low' : ''}" id="timer">${fmtTime(left)}</span>
      <span class="muted small">${answered}/${s.ids.length} răspunse</span>
      <div class="spacer"></div>
      <button class="btn" id="finish">Predă lucrarea</button>
    </div>
    <div class="card">
      ${questionHTML(q, sel, false, `Grila ${s.idx + 1} / ${s.ids.length}`)}
      <div class="row" style="margin-top:12px">
        <button class="btn" id="prev" ${s.idx ? '' : 'disabled'}>← Înapoi</button>
        <div class="spacer"></div>
        <button class="btn primary" id="next" ${s.idx + 1 < s.ids.length ? '' : 'disabled'}>Înainte →</button>
      </div>
    </div>
    <details class="card"><summary><b>Navigare grile</b></summary><div class="navgrid" style="margin-top:10px">${s.ids.map((x, i) => `<button data-j="${i}" class="${(s.answers[x] || []).length ? 'done' : ''} ${i === s.idx ? 'cur' : ''}">${i + 1}</button>`).join('')}</div></details>`;
  document.getElementById('opts').onclick = (e) => { const b = e.target.closest('.opt'); if (b) toggleOpt(q, Number(b.dataset.i)); };
  document.getElementById('prev').onclick = () => { s.idx--; renderExam(); };
  document.getElementById('next').onclick = () => { s.idx++; renderExam(); };
  document.getElementById('finish').onclick = () => {
    const un = s.ids.length - answered;
    if (confirm(un ? `Ai ${un} grile fără răspuns. Predai lucrarea?` : 'Predai lucrarea?')) finishExam();
  };
  document.querySelector('.navgrid').onclick = (e) => { const b = e.target.closest('[data-j]'); if (b) { s.idx = Number(b.dataset.j); renderExam(); } };
}

function finishExam() {
  const s = session; if (!s || s.finished) return;
  s.finished = true; stopExamTimer();
  let score = 0, max = 0;
  const byDisc = {};
  for (const id of s.ids) {
    const q = QMAP.get(id), sel = s.answers[id] || [];
    const pts = recordAnswer(q, sel);
    score += pts; max += maxPoints(q);
    const d = byDisc[q.disc] || (byDisc[q.disc] = { s: 0, m: 0 }); d.s += pts; d.m += maxPoints(q);
  }
  const duration = Math.min(s.limit, (Date.now() - s.start) / 1000);
  state.exams.push({ date: Date.now(), n: s.ids.length, score, max, duration });
  save();
  session = null;
  const scaled = Math.round((score / max) * 950);
  $view.innerHTML = `
    <h1>Rezultat simulare</h1>
    <div class="card" style="text-align:center">
      <div class="big-score">${score} / ${max}</div>
      <p class="muted">${pct(score, max)}% · echivalent ≈ <b>${scaled} / 950</b> puncte la examen · ${fmtTime(duration)}</p>
    </div>
    <div class="card"><h2>Pe discipline</h2>${Object.entries(byDisc).map(([k, v]) => `<div class="list-item"><div class="row"><b>${esc(discName(k))}</b><div class="spacer"></div><span>${v.s}/${v.m} (${pct(v.s, v.m)}%)</span></div><div class="progress" style="margin-top:6px"><i style="width:${pct(v.s, v.m)}%"></i></div></div>`).join('')}</div>
    <div class="card"><h2>Revizuiește grilele</h2><p class="small muted">Verde = punctaj maxim, roșu = puncte pierdute. Atinge o grilă pentru explicație.</p>
      <div class="navgrid">${s.ids.map((id, i) => { const q = QMAP.get(id); const ok = scoreQ(q, s.answers[id]) === maxPoints(q); return `<button data-j="${i}" class="${ok ? 'ok' : 'ko'}">${i + 1}</button>`; }).join('')}</div>
      <div id="rev" style="margin-top:14px"></div>
    </div>
    <button class="btn block" data-go="home">Acasă</button>`;
  document.querySelector('.navgrid').onclick = (e) => {
    const b = e.target.closest('[data-j]'); if (!b) return;
    const id = s.ids[Number(b.dataset.j)], q = QMAP.get(id), sel = s.answers[id] || [];
    const box = document.getElementById('rev');
    box.innerHTML = questionHTML(q, sel, true, `Grila ${Number(b.dataset.j) + 1} · ${scoreQ(q, sel)}/${maxPoints(q)} p`) +
      (q.expl ? `<div class="expl">${esc(q.expl)}</div>` : '') +
      `<button class="btn" id="aiExplain">🤖 Explică-mi mai pe larg</button><div id="aiOut"></div>`;
    document.getElementById('aiExplain').onclick = () => aiExplain(q, sel);
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
}

// ───────────────────────── Tastatură ─────────────────────────
document.addEventListener('keydown', (e) => {
  if (!session || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  const k = e.key.toUpperCase();
  const i = LETTERS.indexOf(k);
  const id = session.ids?.[session.idx], q = QMAP.get(id);
  if (!q) return;
  if (i >= 0 && !(session.checked && session.checked[id])) { toggleOpt(q, i); return; }
  if (e.key === 'Enter') {
    if (session.mode === 'exam') { if (session.idx + 1 < session.ids.length) { session.idx++; renderExam(); } }
    else if (session.checked[id]) nextQ(); else checkCurrent();
  }
  if (session.mode === 'exam' && e.key === 'ArrowRight' && session.idx + 1 < session.ids.length) { session.idx++; renderExam(); }
  if (session.mode === 'exam' && e.key === 'ArrowLeft' && session.idx > 0) { session.idx--; renderExam(); }
});

// ───────────────────────── Tutor AI (Claude) ─────────────────────────
const AI_SYSTEM = `Ești „Dr. IonDeli”, tutorele unei studente la Medicină (UMF Craiova) care se pregătește pentru examenul național de rezidențiat din România.
Răspunzi mereu în limba română, cu terminologia medicală folosită în România.
Stil: clar, structurat, la obiect, ca un rezident bun care explică unui coleg. Folosește titluri scurte și liste.
Când explici o grilă: spune de ce fiecare variantă (A–E) este corectă sau greșită, care e conceptul-cheie, capcana tipică de examen și, dacă ajută, o mnemotehnică.
Dacă există o nepotrivire între cheia grilei și ce știi tu, spune-o deschis și recomandă verificarea în bibliografia oficială de rezidențiat. Nu inventa valori sau citate.`;

let sdkPromise = null;
function loadSDK() {
  if (!sdkPromise) sdkPromise = import(SDK_URL).catch((e) => { sdkPromise = null; throw e; });
  return sdkPromise;
}

async function aiClient() {
  const key = state.settings.apiKey?.trim();
  if (!key) {
    toast('Adaugă cheia API Claude în „Mai mult → Tutor AI”.');
    throw new Error('no-key');
  }
  const mod = await loadSDK();
  const Anthropic = mod.default || mod.Anthropic;
  return { client: new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }), Anthropic };
}

function aiErrorText(err, Anthropic) {
  if (err?.message === 'no-key') return '';
  if (Anthropic) {
    if (err instanceof Anthropic.AuthenticationError) return 'Cheia API nu este validă. Verific-o în „Mai mult”.';
    if (err instanceof Anthropic.RateLimitError) return 'Prea multe cereri deodată. Încearcă din nou peste un minut.';
    if (err instanceof Anthropic.APIConnectionError) return 'Nu mă pot conecta la serviciul AI. Verifică internetul.';
    if (err instanceof Anthropic.APIError) return `Eroare de la serviciul AI (${err.status ?? '?'}): ${err.message}`;
  }
  return `Nu am putut contacta tutorul AI: ${err?.message || err}`;
}

// Trimite o cerere în flux (streaming) și afișează textul pe măsură ce sosește.
async function aiStream(userText, outEl) {
  let Anthropic;
  outEl.innerHTML = '<div class="ai-box">Se gândește…</div>';
  const box = outEl.firstChild;
  try {
    const c = await aiClient(); Anthropic = c.Anthropic;
    const stream = c.client.beta.messages.stream({
      model: AI_MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: AI_SYSTEM,
      messages: [{ role: 'user', content: userText }],
    });
    let started = false;
    stream.on('text', (t) => { if (!started) { box.textContent = ''; started = true; } box.textContent += t; });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') box.textContent = 'Tutorul nu a putut răspunde la această întrebare. Reformulează, te rog.';
    else if (msg.stop_reason === 'max_tokens') box.textContent += '\n\n[Răspuns trunchiat]';
    box.insertAdjacentHTML('beforeend', '<div class="small muted" style="margin-top:8px">⚠️ Generat de AI — verifică în bibliografia oficială.</div>');
  } catch (err) {
    const t = aiErrorText(err, Anthropic);
    if (t) box.textContent = t; else outEl.innerHTML = '';
  }
}

function describeQ(q, sel) {
  return `Disciplina: ${discName(q.disc)}${q.chapter ? ' — ' + q.chapter : ''}
Tip: ${q.type === 'CS' ? 'complement simplu (un singur răspuns corect)' : 'complement multiplu (2–4 răspunsuri corecte)'}
Enunț: ${q.q}
${q.options.map((o, i) => `${LETTERS[i]}. ${o}`).join('\n')}
Răspuns corect (cheie): ${q.correct.map((i) => LETTERS[i]).join(', ')}
Răspunsul meu: ${sel.length ? sel.map((i) => LETTERS[i]).join(', ') : '(nemarcat)'}
${q.expl ? 'Explicația din bancă: ' + q.expl : ''}`;
}

function aiExplain(q, sel) {
  aiStream(`${describeQ(q, sel)}\n\nExplică-mi grila pe larg: de ce e corectă/greșită fiecare variantă, conceptul-cheie, capcana și o mnemotehnică dacă există. Unde am greșit, explică-mi raționamentul corect.`, document.getElementById('aiOut'));
}

function aiAskBox(q, sel) {
  const out = document.getElementById('aiOut');
  out.innerHTML = `<label class="field">Întrebarea ta despre această grilă<textarea id="aiQ" style="min-height:70px;font-family:inherit" placeholder="Ex: care e diferența față de sindromul nefritic?"></textarea></label><button class="btn primary" id="aiSend">Trimite</button><div id="aiAns"></div>`;
  document.getElementById('aiQ').focus();
  document.getElementById('aiSend').onclick = () => {
    const text = document.getElementById('aiQ').value.trim();
    if (text) aiStream(`Context — grila la care lucrez:\n${describeQ(q, sel)}\n\nÎntrebarea mea: ${text}`, document.getElementById('aiAns'));
  };
}

// Generare de grile noi din notițe / text din carte, cu ieșire JSON structurată.
const GEN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['chapter', 'type', 'q', 'options', 'correct', 'expl'],
        properties: {
          chapter: { type: 'string' },
          type: { type: 'string', enum: ['CS', 'CM'] },
          q: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          correct: { type: 'array', items: { type: 'integer' } },
          expl: { type: 'string' },
        },
      },
    },
  },
};

function validQ(q) {
  return q && typeof q.q === 'string' && q.q.trim() && Array.isArray(q.options) && q.options.length === 5 &&
    q.options.every((o) => typeof o === 'string' && o.trim()) && Array.isArray(q.correct) &&
    q.correct.every((i) => Number.isInteger(i) && i >= 0 && i < 5) && new Set(q.correct).size === q.correct.length &&
    ((q.type === 'CS' && q.correct.length === 1) || (q.type === 'CM' && q.correct.length >= 2 && q.correct.length <= 4));
}

function viewAIGenerate() {
  const discs = disciplinesInBank();
  $view.innerHTML = `
    <h1>🤖 Generează grile din materie</h1>
    <div class="card">
      <p class="small muted">Lipește un fragment din carte sau din notițele tale (de ex. un subcapitol). Tutorul AI creează grile în stilul examenului (CS + CM), cu explicații, și le adaugă în banca ta.</p>
      <div class="grid two">
        <label class="field">Disciplina<select id="gDisc">${discs.map((k) => `<option value="${esc(k)}">${esc(discName(k))}</option>`).join('')}</select></label>
        <label class="field">Câte grile<select id="gN"><option>5</option><option selected>10</option><option>20</option></select></label>
      </div>
      <label class="field">Capitol<input id="gChap" placeholder="ex. Insuficiența cardiacă"></label>
      <label class="field">Textul sursă<textarea id="gText" style="min-height:200px;font-family:inherit" placeholder="Lipește aici textul…"></textarea></label>
      <button class="btn primary block" id="gGo">Generează grile</button>
      <div id="gOut" style="margin-top:12px"></div>
    </div>`;
  document.getElementById('gGo').onclick = async () => {
    const text = document.getElementById('gText').value.trim();
    const chapter = document.getElementById('gChap').value.trim() || 'Generat AI';
    const disc = document.getElementById('gDisc').value;
    const n = Number(document.getElementById('gN').value);
    const out = document.getElementById('gOut');
    if (text.length < 200) return toast('Lipește un text mai lung (minim câteva paragrafe).');
    const btn = document.getElementById('gGo'); btn.disabled = true;
    out.innerHTML = '<div class="ai-box">Se generează grilele… poate dura un minut.</div>';
    let Anthropic;
    try {
      const c = await aiClient(); Anthropic = c.Anthropic;
      const stream = c.client.beta.messages.stream({
        model: AI_MODEL,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'high', format: { type: 'json_schema', schema: GEN_SCHEMA } },
        system: AI_SYSTEM,
        messages: [{ role: 'user', content: `Creează ${n} grile de rezidențiat STRICT pe baza textului de mai jos (capitolul „${chapter}”).
Reguli:
- aproximativ 1/4 CS (un singur răspuns corect) și 3/4 CM (între 2 și 4 răspunsuri corecte);
- exact 5 variante pe grilă, fără litere în fața variantelor; "correct" conține indicii 0–4 ai variantelor corecte;
- distractori plauzibili, formulări ca la examen, fără „toate cele de mai sus”;
- "expl": explicație scurtă, care justifică fiecare variantă;
- "chapter": „${chapter}”.

TEXT:
"""
${text}
"""` }],
      });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') throw new Error('Cererea a fost refuzată. Încearcă alt fragment.');
      if (msg.stop_reason === 'max_tokens') throw new Error('Răspunsul a fost prea lung. Cere mai puține grile.');
      const raw = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      const data = JSON.parse(raw);
      const stamp = Date.now().toString(36);
      const good = (data.questions || []).filter(validQ).map((q, i) => ({ ...q, id: `ai-${stamp}-${i}`, disc, source: 'ai' }));
      if (!good.length) throw new Error('Nu am primit grile valide. Încearcă din nou.');
      state.custom.push(...good); save(); refreshBank();
      out.innerHTML = `<div class="feedback good"><b>${good.length} grile adăugate</b> în „${esc(discName(disc))} · ${esc(chapter)}”. Verifică-le cu bibliografia — sunt generate de AI.</div><button class="btn primary block" id="gTry">Rezolvă-le acum</button>`;
      document.getElementById('gTry').onclick = () => startQuiz('practice', good.map((q) => q.id));
    } catch (err) {
      const t = aiErrorText(err, Anthropic);
      out.innerHTML = t ? `<div class="feedback badf">${esc(t)}</div>` : '';
    } finally { btn.disabled = false; }
  };
}

// ───────────────────────── Mai mult: setări, import/export, liste ─────────────────────────
function viewMore() {
  const st = state.settings;
  const nCustom = state.custom.length;
  $view.innerHTML = `
    <h1>Mai mult</h1>
    <div class="card">
      <h2>Liste</h2>
      <div class="grid two">
        <button class="btn block" data-go="list" data-arg="wrong">❌ Greșelile mele</button>
        <button class="btn block" data-go="list" data-arg="fav">⭐ Favorite</button>
      </div>
    </div>
    <div class="card">
      <h2>Setări</h2>
      <div class="grid two">
        <label class="field">Data examenului<input type="date" id="sDate" value="${esc(st.examDate)}"></label>
        <label class="field">Obiectiv zilnic (grile)<input type="number" min="5" max="1000" id="sGoal" value="${esc(st.dailyGoal)}"></label>
      </div>
      <label class="field">Temă
        <select id="sTheme"><option value="auto">Automată</option><option value="light">Luminoasă</option><option value="dark">Întunecată</option></select>
      </label>
    </div>
    <div class="card">
      <h2>🤖 Tutor AI (opțional)</h2>
      <p class="small muted">Explicații detaliate pentru orice grilă, întrebări libere și generare de grile din notițe. Necesită o cheie API Claude (console.anthropic.com). Cheia rămâne doar pe acest dispozitiv și se trimite doar către API-ul Anthropic.</p>
      <label class="field">Cheie API<input type="password" id="sKey" autocomplete="off" placeholder="sk-ant-…" value="${esc(st.apiKey)}"></label>
      <button class="btn block" data-go="ai">Generează grile din materie</button>
    </div>
    <div class="card">
      <h2>Import grile</h2>
      <p class="small muted">Lipește JSON (listă de grile în formatul din <code>data/questions.js</code>) sau CSV cu coloanele:<br><code>disciplina;capitol;tip;enunt;A;B;C;D;E;corecte;explicatie</code> — ex. corecte = <code>ACD</code>.</p>
      <label class="field">Disciplina implicită (pentru CSV fără disciplină)
        <select id="iDisc">${disciplinesInBank().map((k) => `<option value="${esc(k)}">${esc(discName(k))}</option>`).join('')}</select>
      </label>
      <textarea id="iText" placeholder='[{"disc":"mi","chapter":"…","type":"CS","q":"…","options":["…","…","…","…","…"],"correct":[1],"expl":"…"}]'></textarea>
      <div class="row" style="margin-top:8px">
        <button class="btn primary" id="iGo">Importă</button>
        <label class="btn">Din fișier<input type="file" id="iFile" accept=".json,.csv,.txt" hidden></label>
        <div class="spacer"></div><span class="small muted">${nCustom} grile proprii</span>
      </div>
    </div>
    <div class="card">
      <h2>Backup</h2>
      <p class="small muted">Salvează progresul și grilele proprii într-un fișier (ca să le muți pe alt telefon / laptop).</p>
      <div class="row">
        <button class="btn" id="bExport">⬇️ Exportă backup</button>
        <label class="btn">⬆️ Restaurează<input type="file" id="bImport" accept=".json" hidden></label>
        <div class="spacer"></div>
        <button class="btn" id="bReset" style="color:var(--bad)">Resetează progresul</button>
      </div>
    </div>
    <p class="small muted" style="text-align:center">Dr. IonDeli · Grilele incluse sunt exemple originale; verifică întotdeauna cu bibliografia oficială de rezidențiat.</p>`;

  document.getElementById('sTheme').value = st.theme;
  document.getElementById('sDate').onchange = (e) => { st.examDate = e.target.value; save(); toast('Data examenului salvată.'); };
  document.getElementById('sGoal').onchange = (e) => { st.dailyGoal = Math.max(5, Number(e.target.value) || 50); save(); };
  document.getElementById('sTheme').onchange = (e) => { st.theme = e.target.value; save(); applyTheme(); };
  document.getElementById('sKey').onchange = (e) => { st.apiKey = e.target.value.trim(); save(); toast(st.apiKey ? 'Cheie salvată.' : 'Cheie ștearsă.'); };

  document.getElementById('iGo').onclick = () => doImport(document.getElementById('iText').value);
  document.getElementById('iFile').onchange = async (e) => { const f = e.target.files[0]; if (f) doImport(await f.text()); };
  document.getElementById('bExport').onclick = exportBackup;
  document.getElementById('bImport').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || typeof data !== 'object' || !data.progress) throw new Error();
      if (!confirm('Restaurarea înlocuiește progresul actual. Continui?')) return;
      const d = defaultState();
      state = { ...d, ...data, settings: { ...d.settings, ...(data.settings || {}), apiKey: st.apiKey } };
      save(); refreshBank(); applyTheme(); toast('Backup restaurat.'); go('home');
    } catch { toast('Fișier de backup invalid.'); }
  };
  document.getElementById('bReset').onclick = () => {
    if (!confirm('Ștergi tot progresul (răspunsuri, statistici, simulări)? Grilele proprii și setările rămân.')) return;
    state.progress = {}; state.days = {}; state.exams = []; save(); toast('Progres resetat.'); go('home');
  };
}

function parseCSV(text, defDisc) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sep = lines[0]?.includes(';') ? ';' : ',';
  const split = (line) => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === sep && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur); return out.map((s) => s.trim());
  };
  const rows = lines.map(split);
  if (/enun|intreb|întreb/i.test(rows[0].join(' '))) rows.shift(); // antet
  const keyOf = (name) => {
    if (!name) return defDisc;
    const found = Object.entries(DISC).find(([k, v]) => k === name.toLowerCase() || v.toLowerCase() === name.toLowerCase());
    return found ? found[0] : name;
  };
  return rows.filter((r) => r.length >= 10).map((r) => {
    const corr = [...r[9].toUpperCase()].map((c) => LETTERS.indexOf(c)).filter((i) => i >= 0);
    const type = /CS|CM/i.test(r[2]) ? r[2].toUpperCase() : corr.length === 1 ? 'CS' : 'CM';
    return { disc: keyOf(r[0]), chapter: r[1] || 'Import', type, q: r[3], options: r.slice(4, 9), correct: corr, expl: r[10] || '' };
  });
}

function doImport(text) {
  text = (text || '').trim();
  if (!text) return toast('Nu ai lipit nimic.');
  let items;
  try {
    if (text.startsWith('[') || text.startsWith('{')) {
      const j = JSON.parse(text);
      items = Array.isArray(j) ? j : j.questions || [];
    } else items = parseCSV(text, document.getElementById('iDisc')?.value || 'mi');
  } catch { return toast('Format invalid — verifică JSON-ul/CSV-ul.'); }
  const stamp = Date.now().toString(36);
  const good = [], bad = [];
  items.forEach((q, i) => {
    const qq = { ...q, type: String(q.type || '').toUpperCase(), id: q.id || `imp-${stamp}-${i}`, disc: q.disc || document.getElementById('iDisc')?.value || 'mi' };
    (validQ(qq) ? good : bad).push(qq);
  });
  const ids = new Set(good.map((q) => q.id));
  state.custom = state.custom.filter((q) => !ids.has(q.id)).concat(good);
  save(); refreshBank();
  toast(`${good.length} grile importate${bad.length ? `, ${bad.length} ignorate (format greșit)` : ''}.`);
  if (good.length) viewMore();
}

function exportBackup() {
  const data = { ...state, settings: { ...state.settings, apiKey: '' }, exportedAt: new Date().toISOString(), app: 'Dr. IonDeli' };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `iondeli-backup-${todayKey()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function viewList(kind = 'wrong') {
  const items = [...QMAP.values()].filter((q) => {
    const p = state.progress[q.id];
    return kind === 'fav' ? p?.fav : p?.wrong > 0;
  }).sort((a, b) => (state.progress[b.id]?.wrong || 0) - (state.progress[a.id]?.wrong || 0));
  $view.innerHTML = `
    <div class="row" style="margin-bottom:8px"><button class="btn ghost" data-go="more">←</button><h1 style="margin:0">${kind === 'fav' ? '⭐ Favorite' : '❌ Greșelile mele'}</h1></div>
    ${items.length ? `<button class="btn primary block" id="drill" style="margin-bottom:14px">Exersează-le (${items.length})</button>` : ''}
    <div class="card">${items.length ? items.map((q) => {
      const p = state.progress[q.id];
      return `<div class="list-item"><div class="small muted">${esc(discName(q.disc))} · ${esc(q.chapter || '')} · greșită de ${p.wrong}× · corectă de ${p.right}×</div><div>${esc(q.q)}</div><div class="small" style="color:var(--ok)">✓ ${q.correct.map((i) => LETTERS[i] + '. ' + esc(q.options[i])).join(' · ')}</div></div>`;
    }).join('') : '<div class="empty">Nimic aici încă.</div>'}</div>`;
  const d = document.getElementById('drill');
  if (d) d.onclick = () => startQuiz('practice', shuffle(items.map((q) => q.id)));
}

// ───────────────────────── Pornire ─────────────────────────
applyTheme();
go('home');
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
