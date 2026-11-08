'use strict';
/* Andrei OS – arii de viață, cele 5 întrebări, obiective → proiecte → acțiuni,
   delegare, jurnal (corp + minte), echilibru, analiza de duminică, comparații în timp. */

const AREA_TYPES = { work: 'Muncă', sport: 'Antrenament', personal: 'Viață personală', health: 'Sănătate & odihnă', other: 'Altele' };
const TYPE_COLORS = { work: '#2563eb', sport: '#ff7a45', personal: '#ec4899', health: '#22c55e', other: '#94a3b8' };
const HORIZON = { short: 'Termen scurt (≤3 luni)', mid: 'Termen mediu (≤1 an)', long: 'Termen lung (1–5 ani)' };
const OLD_TYPES = { munca: 'work', casa: 'personal', studiu: 'personal' };

// ============================================================
// Migrare / structuri noi
// ============================================================
EXT.migrate.push(() => {
  for (const k of ['goals', 'projects', 'journal']) if (!Array.isArray(state[k])) state[k] = [];
  if (!state.snapshots) state.snapshots = {};
  if (!state.deleted) state.deleted = {};
  if (!state.osV) {
    for (const c of DEFAULT_CATS) {
      const ex = state.cats.find((x) => x.id === c.id);
      if (!ex) state.cats.push({ ...c }); else if (!ex.type) ex.type = c.type;
    }
    state.cats = state.cats.filter((c) => !['munca', 'casa', 'studiu'].includes(c.id) || state.tasks.some((t) => t.cat === c.id));
    state.osV = 1;
  }
  state.cats.forEach((c) => { if (!c.type) c.type = OLD_TYPES[c.id] || 'work'; });
});

const goalById = (id) => state.goals.find((g) => g.id === id);
const projById = (id) => state.projects.find((p) => p.id === id);
const typeOf = (t) => (cat(t.cat) || {}).type || 'other';
const mine = (t) => !t.delegatedTo;

// ============================================================
// Etichete pe taskuri + câmpuri noi în editor
// ============================================================
EXT.meta.push((t, meta) => {
  if (t.delegatedTo) meta.unshift(`<span class="dlg">👤 ${esc(t.delegatedTo)}${t.followUp && !t.done ? ' · verifici ' + relDay(t.followUp).toLowerCase() : ''}</span>`);
  const pr = t.project && projById(t.project);
  const g = t.goal ? goalById(t.goal) : pr && pr.goalId ? goalById(pr.goalId) : null;
  if (pr) meta.push(`<span>📁 ${esc(pr.title)}</span>`);
  else if (g) meta.push(`<span>🎯 ${esc(g.title)}</span>`);
});
EXT.editor.push((d) => {
  if (isEvent(d)) return '';
  const goals = state.goals.filter((g) => g.status !== 'done' || g.id === d.goal);
  const projs = state.projects.filter((p) => p.status !== 'done' || p.id === d.project);
  return `<div class="card group">
    <label class="row"><span>🎯 Obiectiv</span><select id="f-goal"><option value="">— niciunul —</option>${goals.map((g) => `<option value="${g.id}" ${d.goal === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select></label>
    <label class="row"><span>📁 Proiect</span><select id="f-proj"><option value="">— niciunul —</option>${projs.map((p) => `<option value="${p.id}" ${d.project === p.id ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></label>
    <label class="row"><span>👤 Delegat lui</span><input id="f-dlg" value="${esc(d.delegatedTo || '')}" placeholder="nimeni (fac eu)" list="people" autocomplete="off"></label>
    <label class="row"><span>🔎 Verific pe</span><input type="date" id="f-fu" value="${d.followUp || ''}"></label>
    <datalist id="people">${people().map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
  </div>
  <div class="help">Ce delegi nu-ți mai ocupă programul. Îți amintesc în ziua „Verific pe” să întrebi dacă e gata.</div>`;
});
EXT.sync.push((d) => {
  if (!$('#f-goal')) return;
  d.goal = $('#f-goal').value || null;
  d.project = $('#f-proj').value || null;
  if (d.project && !d.goal) { const p = projById(d.project); if (p && p.goalId) d.goal = p.goalId; }
  const who = $('#f-dlg').value.trim();
  d.delegatedTo = who || null;
  d.followUp = who ? ($('#f-fu').value || d.followUp || addDays(todayStr(), 2)) : null;
});
function people() {
  const set = new Set();
  state.tasks.forEach((t) => { if (t.delegatedTo) set.add(t.delegatedTo); });
  return [...set].sort();
}

// ============================================================
// Cele 5 întrebări
// ============================================================
function fiveQuestions() {
  const t = todayStr(), tm = addDays(t, 1), wk = addDays(t, 7);
  const today = tasksOn(t).filter(mine);
  const open = today.filter((x) => !isDone(x, t));
  const notDone = (x) => !x.done && !isRec(x);
  const urgent = [];
  const push = (x) => { if (!urgent.includes(x)) urgent.push(x); };
  overdue().filter(mine).forEach(push);
  open.filter((x) => x.priority === 3 && !isEvent(x)).forEach(push);
  state.tasks.filter((x) => notDone(x) && mine(x) && x.deadline && x.deadline <= tm).forEach(push);
  state.tasks.filter((x) => notDone(x) && x.delegatedTo && x.followUp && x.followUp <= t).forEach(push);

  const delegable = state.tasks.filter((x) => notDone(x) && mine(x) && !isEvent(x) && x.date && x.date >= t && x.date <= wk
    && ['work', 'other'].includes(typeOf(x)) && x.priority < 3 && !x.goal && !x.project && !x.link).slice(0, 8);
  const waiting = state.tasks.filter((x) => notDone(x) && x.delegatedTo);

  const goalTasks = open.filter((x) => x.goal || x.project);
  const neglected = state.goals.filter((g) => g.status === 'active' && goalStale(g));

  const elim = [];
  state.tasks.forEach((x) => {
    if (!notDone(x) || !mine(x)) return;
    if ((x.postponed || 0) >= 2) elim.push({ t: x, why: `amânat de ${x.postponed} ori` });
    else if (x.priority === 1 && Date.now() - x.createdAt > 14 * 864e5) elim.push({ t: x, why: 'importanță mică, stă de peste 2 săptămâni' });
    else if (!x.date && Date.now() - x.createdAt > 30 * 864e5) elim.push({ t: x, why: 'în „Cândva” de peste o lună' });
  });
  return { open, urgent, delegable, waiting, goalTasks, neglected, elim };
}
EXT.todayTop.push(() => {
  const f = fiveQuestions();
  const row = (k, ico, q, n, sub, tone) => `<button class="fq ${tone || ''}" data-act="five" data-v="${k}"><span class="fi">${ico}</span><span class="fb"><b>${q}</b><small>${sub}</small></span><span class="fn">${n}</span></button>`;
  const first = f.open[0];
  return `<div class="card five">
    ${row('todo', '📋', 'Ce am de făcut?', f.open.length, first ? esc((first.time ? first.time + ' · ' : '') + first.title) : 'nimic deschis azi')}
    ${row('urgent', '🔥', 'Ce e urgent?', f.urgent.length, f.urgent.length ? esc(f.urgent.slice(0, 2).map((x) => x.title).join(' · ')) : 'nimic urgent', f.urgent.length ? 'hot' : '')}
    ${row('delegate', '🤝', 'Ce pot delega?', f.delegable.length, `${f.waiting.length} delegate în lucru`)}
    ${row('goals', '🎯', 'Ce mă apropie de obiective?', f.goalTasks.length, f.neglected.length ? `${f.neglected.length} obiective fără progres de 7 zile` : state.goals.length ? 'toate obiectivele avansează' : 'setează-ți obiectivele')}
    ${row('elim', '✂️', 'Ce pot elimina?', f.elim.length, f.elim.length ? esc(f.elim[0].t.title) : 'program curat')}
  </div>`;
});
function openFive(k) {
  const f = fiveQuestions();
  const t = todayStr();
  const titles = { todo: '📋 Ce am de făcut azi', urgent: '🔥 Urgent', delegate: '🤝 Ce pot delega', goals: '🎯 Ce mă apropie de obiective', elim: '✂️ Ce pot elimina' };
  let body = '';
  const list = (arr, ds, extra) => `<div class="card">${arr.map((x) => taskRow(x, ds === undefined ? (x.date || '') : ds, { showDate: true, extra: extra ? extra(x) : '' })).join('')}</div>`;
  if (k === 'todo') body = f.open.length ? list(f.open, t) : '<div class="empty">Nimic deschis azi.</div>';
  if (k === 'urgent') body = f.urgent.length ? `<div class="help pad0">Restanțe, lucruri importante de azi, termene până mâine și delegări de verificat.</div>${list(f.urgent)}` : '<div class="empty">Nimic urgent 👌</div>';
  if (k === 'delegate') {
    body = `<div class="help pad0">Taskuri de muncă din următoarele 7 zile, de importanță normală, care nu țin de obiectivele tale. Le poate face și altcineva.</div>
      ${f.delegable.length ? list(f.delegable, undefined, (x) => `<button class="mini" data-act="dlg-open" data-v="${x.id}">Deleg</button>`) : '<div class="card"><div class="empty">Nimic evident de delegat.</div></div>'}
      <div class="label">Delegate, în lucru (${f.waiting.length})</div>
      ${f.waiting.length ? list(f.waiting) : '<div class="card"><div class="empty">Nimic delegat încă.</div></div>'}`;
  }
  if (k === 'goals') {
    body = `${f.goalTasks.length ? `<div class="label">Azi, pentru obiectivele tale</div>${list(f.goalTasks, t)}` : '<div class="help pad0">Azi n-ai niciun pas legat de obiective.</div>'}
      ${f.neglected.length ? `<div class="label" style="color:var(--warn)">Fără progres de 7 zile</div><div class="card">${f.neglected.map((g) => `<div class="tpl"><span class="big-ico">🎯</span><div class="tb"><b>${esc(g.title)}</b><div class="muted">${esc(areaName(g.area))}</div></div><button class="mini" data-act="goal-step" data-v="${g.id}">+ Un pas mic</button></div>`).join('')}</div>` : ''}
      <div class="row-btns"><button class="btn" data-act="tab" data-tab="proj">Vezi toate obiectivele</button></div>`;
  }
  if (k === 'elim') body = f.elim.length ? `<div class="help pad0">Lucruri care îți ocupă mintea dar nu avansează. Hotărăște: le faci, le delegi sau renunți.</div>
      <div class="card">${f.elim.map(({ t: x, why }) => taskRow(x, x.date || '', { showDate: true, extra: `<button class="mini danger" data-act="del-task" data-v="${x.id}">Renunț</button>` }).replace('<div class="meta">', `<div class="meta"><span class="late">${why}</span>`)).join('')}</div>` : '<div class="empty">Nimic de eliminat ✂️</div>';
  openSheet(`<div class="sheet-head"><span style="width:60px"></span><b>${titles[k]}</b><button class="link strong" data-act="close">Gata</button></div><div class="sheet-body">${body}</div>`);
}
function openDelegate(id) {
  const x = findTask(id); if (!x) return;
  openSheet(`<div class="sheet-head"><button class="link" data-act="five" data-v="delegate">Înapoi</button><b>Deleg</b><button class="link strong" data-act="dlg-save" data-v="${id}">Salvează</button></div>
  <div class="sheet-body">
    <div class="card pad"><b>${esc(x.title)}</b></div>
    <div class="card group">
      <label class="row"><span>👤 Cui?</span><input id="dlg-who" list="people" placeholder="ex: Mihai" autocomplete="off"></label>
      <label class="row"><span>🔎 Verific pe</span><input type="date" id="dlg-fu" value="${x.deadline || addDays(todayStr(), 2)}"></label>
      <datalist id="people">${people().map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
    </div>
    <div class="help">Taskul iese din programul tău. În ziua aleasă îți amintesc să verifici dacă e gata.</div>
  </div>`);
  $('#dlg-who').focus();
}

// ============================================================
// Obiective și proiecte
// ============================================================
function goalTasks(g) {
  const pids = state.projects.filter((p) => p.goalId === g.id).map((p) => p.id);
  return state.tasks.filter((t) => t.goal === g.id || (t.project && pids.includes(t.project)));
}
function goalProgress(g) {
  const m = g.metric;
  if (m && m.target !== '' && m.target != null && +m.target !== +m.start) {
    const pct = Math.max(0, Math.min(1, ((+m.current || 0) - (+m.start || 0)) / (+m.target - (+m.start || 0))));
    return { pct, label: `${fmtNum(m.current)} / ${fmtNum(m.target)} ${esc(m.unit || '')}` };
  }
  const ts = goalTasks(g).filter((t) => !isRec(t));
  if (!ts.length) return { pct: 0, label: 'fără pași încă' };
  const d = ts.filter((t) => t.done).length;
  return { pct: d / ts.length, label: `${d}/${ts.length} pași` };
}
function goalStale(g) {
  const since = addDays(todayStr(), -7);
  if (g.createdAt && Date.now() - g.createdAt < 7 * 864e5) return false;
  const ts = goalTasks(g);
  const recent = ts.some((t) => (t.done && t.completedOn >= since) || (isRec(t) && (t.doneDates || []).some((d) => d >= since)));
  const metricMoved = (g.history || []).some((h) => h.d >= since);
  return !recent && !metricMoved;
}
function projProgress(p) {
  const ts = state.tasks.filter((t) => t.project === p.id && !isRec(t));
  const d = ts.filter((t) => t.done).length;
  return { pct: ts.length ? d / ts.length : 0, done: d, total: ts.length, next: ts.filter((t) => !t.done).sort((a, b) => (a.date || '9').localeCompare(b.date || '9'))[0] };
}
const fmtNum = (v) => (v === '' || v == null ? '—' : (+v).toLocaleString('ro-RO'));
const areaName = (id) => (cat(id) || {}).name || 'Fără arie';
const bar = (pct, color) => `<div class="pbar"><i style="width:${Math.round(pct * 100)}%;${color ? 'background:' + color : ''}"></i></div>`;

const PROJECT_TEMPLATES = [
  { id: 'comp', icon: '🏆', name: 'Competiție / gală', area: 'competitii', dateLabel: 'Data evenimentului', steps: [
    [-90, 'Fixează data și sala', 60], [-80, 'Buget estimat: venituri (taxe, sponsori, bilete) și cheltuieli', 90], [-75, 'Regulament și categorii (vârstă, greutate, grad)', 60],
    [-70, 'Listă sponsori + dosar de sponsorizare', 90], [-60, 'Contract sală semnat', 30], [-60, 'Comandă medalii, trofee, centuri', 45], [-45, 'Arbitri și oficiali confirmați', 45],
    [-45, 'Deschide înscrierile (formular + taxă)', 45], [-40, 'Materiale promo: afiș, video, postări', 90], [-30, 'Campanie de promovare pornită', 30],
    [-21, 'Cântar, tatami, protecții, cronometre – verificare', 45], [-14, 'Confirmă: medic/ambulanță, sonorizare, fotograf', 45], [-10, 'Închide înscrierile', 20],
    [-7, 'Tablouri / tragere la sorți', 90], [-5, 'Diplome și acreditări tipărite', 30], [-3, 'Program minut cu minut + echipa de organizare', 60], [-1, 'Verificare finală materiale', 60],
    [0, 'ZIUA EVENIMENTULUI', 480, 'event'], [2, 'Plăți finale + încasări reconciliate', 60], [5, 'Raport final: venituri, cheltuieli, participare, lecții pentru ediția următoare', 60],
  ] },
  { id: 'product', icon: '👕', name: 'Produs REBORN SOCIETY', area: 'reborn', dateLabel: 'Data lansării', steps: [
    [-100, 'Concept & moodboard', 60], [-90, 'Design final + fișă tehnică (mărimi, materiale)', 120], [-85, 'Cere oferte de la minim 3 furnizori', 45],
    [-75, 'Negociere: preț, MOQ, termen, plată', 60], [-70, 'Comandă mostră', 20], [-55, 'Mostră primită – control calitate', 45],
    [-50, 'Cost complet & marjă (achiziție + transport + vamă + TVA + ambalare)', 60], [-45, 'Comandă producție + plată avans', 30], [-25, 'Verifică stadiul producției (poze)', 20],
    [-15, 'Transport + vămuire', 30], [-5, 'Recepție marfă + control calitate + stoc', 60], [-3, 'Poze produs + listare în magazin', 120],
    [0, 'LANSARE PRODUS', 60, 'event'], [7, 'Analiză vânzări prima săptămână', 30],
  ] },
  { id: 'location', icon: '🏢', name: 'Locație nouă de academie', area: 'academii', dateLabel: 'Data deschiderii', steps: [
    [-90, 'Analiză zonă: școli, concurență, cerere', 90], [-80, 'Calcul: chirie, antrenori, prag de sportivi pentru profit', 90], [-70, 'Spațiu ales + contract', 60],
    [-60, 'Amenajare + echipamente (tatami, saci, oglinzi)', 120], [-45, 'Antrenori recrutați + program', 60], [-40, 'Orar grupe pe vârste și discipline', 45],
    [-35, 'Campanie de preînscrieri', 60], [-21, 'Ședințe gratuite de probă', 120], [-7, 'Verificare finală: acte, siguranță, materiale', 60],
    [0, 'DESCHIDERE', 180, 'event'], [30, 'Analiză prima lună: înscrieri, prezență, costuri', 60],
  ] },
  { id: 'campaign', icon: '📣', name: 'Campanie de înscrieri', area: 'academii', dateLabel: 'Final campanie', steps: [
    [-21, 'Ofertă + mesaj principal', 45], [-18, 'Buget reclame + public țintă', 30], [-14, 'Video + materiale vizuale', 120], [-10, 'Pornește reclamele', 30],
    [-7, 'Verifică cost pe lead după 3 zile', 20], [-3, 'Sună/scrie leadurile care nu s-au înscris', 60], [0, 'Final campanie', 15],
    [3, 'Raport: leaduri, înscrieri, cost pe înscriere – continui sau schimb?', 45],
  ] },
  { id: 'blank', icon: '📁', name: 'Proiect gol', area: null, dateLabel: 'Termen', steps: [] },
];
function createProject(tplId, title, date, goalId, area) {
  const tp = PROJECT_TEMPLATES.find((x) => x.id === tplId);
  const t0 = todayStr();
  const p = { id: uid(), title, goalId: goalId || null, area: area || tp.area, deadline: date || null, status: 'active', tpl: tplId, createdAt: Date.now() };
  state.projects.push(p);
  for (const [off, name, dur, kind] of tp.steps) {
    let ds = date ? addDays(date, off) : t0;
    if (ds < t0 && off < 0) ds = t0;
    state.tasks.push({ ...baseTask(), title: name, date: ds, duration: dur, cat: p.area, project: p.id, goal: p.goalId, kind: kind || 'task',
      time: kind === 'event' ? '10:00' : '', priority: off === 0 ? 3 : 2, reminder: kind === 'event' ? 60 : state.settings.reminder });
  }
  save();
  return p;
}

function viewProjects() {
  const mode = ui.projMode || 'goals';
  const seg = [['goals', 'Obiective'], ['projects', 'Proiecte'], ['delegated', 'Delegate'], ['lists', 'Liste']]
    .map(([k, l]) => `<button class="${mode === k ? 'on' : ''}" data-act="proj-mode" data-v="${k}">${l}</button>`).join('');
  let body = '';
  if (mode === 'goals') {
    const act = state.goals.filter((g) => g.status !== 'done');
    const groups = ['short', 'mid', 'long'].map((h) => ({ h, gs: act.filter((g) => g.horizon === h) })).filter((x) => x.gs.length);
    body = `<div class="row-btns"><button class="btn primary" data-act="goal-new">+ Obiectiv nou</button></div>
      ${groups.map(({ h, gs }) => `<div class="sec"><h2>${HORIZON[h]}</h2></div><div class="card">${gs.map(goalCard).join('')}</div>`).join('')
      || `<div class="card pad" style="margin-top:12px"><b>Începe cu 3–5 obiective mari.</b><div class="muted" style="margin-top:6px">Exemple: „Locația a 4-a deschisă până în septembrie”, „300 de sportivi activi”, „Prima colecție REBORN lansată”, „Fighting Reign – ediția 2”, „Greutate de concurs 80 kg”, „2 seri pe săptămână doar pentru familie”.</div></div>`}
      ${state.goals.some((g) => g.status === 'done') ? `<div class="sec"><h2>Atinse 🏆</h2></div><div class="card">${state.goals.filter((g) => g.status === 'done').map(goalCard).join('')}</div>` : ''}`;
  } else if (mode === 'projects') {
    const act = state.projects.filter((p) => p.status !== 'done');
    body = `<div class="row-btns"><button class="btn primary" data-act="proj-new">+ Proiect nou</button></div>
      ${act.length ? `<div class="card" style="margin-top:12px">${act.map(projCard).join('')}</div>` : '<div class="card pad" style="margin-top:12px"><div class="muted">Proiectele sunt pașii mari spre obiective. Ai șabloane gata făcute pentru competiții, produse REBORN, locații noi și campanii de înscriere – cu toate sarcinile și termenele calculate de la data evenimentului.</div></div>'}
      ${state.projects.some((p) => p.status === 'done') ? `<div class="sec"><h2>Finalizate</h2></div><div class="card">${state.projects.filter((p) => p.status === 'done').map(projCard).join('')}</div>` : ''}`;
  } else if (mode === 'delegated') {
    const w = state.tasks.filter((x) => x.delegatedTo && !x.done);
    const by = {};
    w.forEach((x) => (by[x.delegatedTo] = by[x.delegatedTo] || []).push(x));
    body = Object.keys(by).sort().map((p) => `<div class="sec"><h2>👤 ${esc(p)} (${by[p].length})</h2></div><div class="card">${by[p].sort((a, b) => (a.followUp || '').localeCompare(b.followUp || '')).map((x) => taskRow(x, x.date || '', { showDate: true })).join('')}</div>`).join('')
      || '<div class="card pad" style="margin-top:12px"><div class="muted">Nimic delegat. Scrie <code>@Mihai</code> în adăugarea rapidă (ex: „comandă tatami @Mihai până vineri”) sau folosește „Ce pot delega?” din ecranul Azi.</div></div>';
  } else {
    return `<div class="hdr"><div><h1>Proiecte</h1></div></div><div class="seg">${seg}</div>
      <input class="search" id="search" type="search" placeholder="Caută în toate taskurile…" value="${esc(ui.search)}" style="margin-top:12px">
      <div id="listbody">${viewList()}</div>`;
  }
  return `<div class="hdr"><div><h1>Proiecte</h1><div class="sub">Obiective → proiecte → acțiuni → pași</div></div></div><div class="seg">${seg}</div>${body}`;
}
function goalCard(g) {
  const pr = goalProgress(g), c = cat(g.area);
  const dl = g.deadline ? daysBetween(todayStr(), g.deadline) : null;
  return `<button class="gcard" data-act="goal-open" data-v="${g.id}">
    <div class="gtop"><b>${g.status === 'done' ? '🏆 ' : ''}${esc(g.title)}</b><span>${Math.round(pr.pct * 100)}%</span></div>
    ${bar(pr.pct, c && c.color)}
    <div class="meta"><span class="cat" style="--cc:${c ? c.color : 'var(--muted)'}">${esc(areaName(g.area))}</span><span>${pr.label}</span>${dl != null ? `<span class="${dl < 14 && g.status !== 'done' ? 'late' : ''}">${dl >= 0 ? 'mai sunt ' + dl + ' zile' : 'termen depășit'}</span>` : ''}${g.priority === 3 ? '<span class="late">❗ prioritar</span>' : ''}${g.status === 'active' && goalStale(g) ? '<span class="lnk">fără progres 7 zile</span>' : ''}</div>
  </button>`;
}
function projCard(p) {
  const pr = projProgress(p), c = cat(p.area), g = p.goalId && goalById(p.goalId);
  return `<button class="gcard" data-act="proj-open" data-v="${p.id}">
    <div class="gtop"><b>${esc(p.title)}</b><span>${pr.done}/${pr.total}</span></div>
    ${bar(pr.pct, c && c.color)}
    <div class="meta">${g ? `<span>🎯 ${esc(g.title)}</span>` : ''}${p.deadline ? `<span>📅 ${relDay(p.deadline)}</span>` : ''}${pr.next ? `<span>următorul: ${esc(pr.next.title)}${pr.next.date && pr.next.date < todayStr() ? ' <b class="late">(restant)</b>' : ''}</span>` : ''}</div>
  </button>`;
}
let gdraft = null;
function openGoal(id) {
  const g = id ? goalById(id) : null;
  gdraft = g ? JSON.parse(JSON.stringify(g)) : { id: null, title: '', area: 'academii', horizon: 'short', deadline: '', priority: 2, why: '', metric: { name: '', unit: '', start: '', target: '', current: '' }, history: [], status: 'active' };
  const d = gdraft, m = d.metric || {};
  const projs = g ? state.projects.filter((p) => p.goalId === g.id) : [];
  const direct = g ? state.tasks.filter((t) => t.goal === g.id && !t.project && (!t.done || isRec(t))) : [];
  const pr = g ? goalProgress(g) : null;
  openSheet(`<div class="sheet-head"><button class="link" data-act="close">Anulează</button><b>${g ? 'Obiectiv' : 'Obiectiv nou'}</b><button class="link strong" data-act="goal-save">Salvează</button></div>
  <div class="sheet-body">
    <input id="g-title" class="big" placeholder="ex: 300 de sportivi activi până în iunie" value="${esc(d.title)}" autocomplete="off">
    ${g ? `<div class="card pad" style="margin-top:10px"><div class="gtop"><b>Progres</b><span>${Math.round(pr.pct * 100)}% · ${pr.label}</span></div>${bar(pr.pct)}</div>` : ''}
    <textarea id="g-why" placeholder="De ce contează pentru mine? (te ajută în zilele grele)">${esc(d.why || '')}</textarea>
    <div class="card group">
      <label class="row"><span>Arie</span><select id="g-area">${state.cats.map((c) => `<option value="${c.id}" ${d.area === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="row"><span>Orizont</span><select id="g-hor">${Object.entries(HORIZON).map(([k, l]) => `<option value="${k}" ${d.horizon === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="row"><span>Termen</span><input type="date" id="g-dl" value="${d.deadline || ''}"></label>
      <label class="row"><span>Prioritate</span><select id="g-prio">${[1, 2, 3].map((p) => `<option value="${p}" ${d.priority === p ? 'selected' : ''}>${PRIO[p]}</option>`).join('')}</select></label>
    </div>
    <div class="label">Indicator de progres (opțional)</div>
    <div class="card group">
      <label class="row"><span>Ce măsor</span><input id="g-mname" value="${esc(m.name || '')}" placeholder="ex: sportivi activi"></label>
      <label class="row"><span>Unitate</span><input id="g-unit" value="${esc(m.unit || '')}" placeholder="ex: copii, lei, kg"></label>
      <label class="row"><span>Pornesc de la</span><input id="g-start" type="number" inputmode="decimal" value="${m.start ?? ''}"></label>
      <label class="row"><span>Țintă</span><input id="g-target" type="number" inputmode="decimal" value="${m.target ?? ''}"></label>
      <label class="row"><span>Acum</span><input id="g-cur" type="number" inputmode="decimal" value="${m.current ?? ''}"></label>
    </div>
    ${(d.history || []).length ? `<div class="help">Istoric: ${(d.history || []).slice(-6).map((h) => `${relDay(h.d).toLowerCase()} ${fmtNum(h.v)}`).join(' → ')}</div>` : ''}
    ${g ? `<div class="label">Proiecte (${projs.length})</div>
      <div class="card">${projs.map(projCard).join('') || '<div class="empty" style="padding:14px">Niciun proiect încă.</div>'}</div>
      <div class="label">Acțiuni directe</div>
      <div class="card">${direct.map((t) => taskRow(t, t.date || '', { showDate: true })).join('') || '<div class="empty" style="padding:14px">Nicio acțiune încă.</div>'}</div>
      <div class="row-btns"><button class="btn" data-act="goal-step" data-v="${g.id}">+ Acțiune</button><button class="btn" data-act="proj-new" data-v="${g.id}">+ Proiect</button></div>
      <div class="actions">
        <button class="btn" data-act="goal-status" data-v="${g.status === 'done' ? 'active' : 'done'}">${g.status === 'done' ? 'Redeschide' : '🏆 Marchează ca atins'}</button>
        <button class="btn danger" data-act="goal-del">Șterge obiectivul</button>
      </div>` : '<div class="help">După ce îl salvezi, îl împarți în proiecte și acțiuni.</div>'}
  </div>`);
  if (!g) $('#g-title').focus();
}
function saveGoal() {
  const d = gdraft;
  d.title = $('#g-title').value.trim();
  if (!d.title) { toast('Scrie obiectivul'); return null; }
  d.why = $('#g-why').value; d.area = $('#g-area').value; d.horizon = $('#g-hor').value; d.deadline = $('#g-dl').value || null; d.priority = +$('#g-prio').value;
  const prev = d.metric ? d.metric.current : '';
  d.metric = { name: $('#g-mname').value.trim(), unit: $('#g-unit').value.trim(), start: $('#g-start').value, target: $('#g-target').value, current: $('#g-cur').value };
  if (d.metric.current !== '' && String(d.metric.current) !== String(prev)) { d.history = (d.history || []).filter((h) => h.d !== todayStr()); d.history.push({ d: todayStr(), v: +d.metric.current }); }
  if (d.id) { const i = state.goals.findIndex((x) => x.id === d.id); state.goals[i] = d; } else { d.id = uid(); d.createdAt = Date.now(); state.goals.push(d); }
  save();
  return d;
}
let newProjGoal = null;
function openNewProject(goalId) {
  newProjGoal = goalId || null;
  openSheet(`<div class="sheet-head"><button class="link" data-act="close">Anulează</button><b>Proiect nou</b><span style="width:60px"></span></div>
  <div class="sheet-body">
    <div class="help pad0">Alege un șablon: îți creez toate sarcinile cu termenele calculate de la data evenimentului.</div>
    <div class="card">${PROJECT_TEMPLATES.map((tp) => `<button class="tpl" data-act="proj-tpl" data-v="${tp.id}" style="width:100%;text-align:left"><span class="big-ico">${tp.icon}</span><div class="tb"><b>${tp.name}</b><div class="muted">${tp.steps.length ? tp.steps.length + ' sarcini cu termene' : 'adaugi tu sarcinile'}</div></div><span class="link">›</span></button>`).join('')}</div>
  </div>`);
}
function openProjForm(tplId) {
  const tp = PROJECT_TEMPLATES.find((x) => x.id === tplId);
  openSheet(`<div class="sheet-head"><button class="link" data-act="proj-new" data-v="${newProjGoal || ''}">Înapoi</button><b>${tp.icon} ${tp.name}</b><button class="link strong" data-act="proj-create" data-v="${tplId}">Creează</button></div>
  <div class="sheet-body">
    <input id="p-title" class="big" placeholder="${tplId === 'comp' ? 'ex: Fighting Reign Championship 2027' : tplId === 'product' ? 'ex: Kimono REBORN Kyokushin' : tplId === 'location' ? 'ex: Academia – locația 4' : tplId === 'campaign' ? 'ex: Înscrieri ianuarie' : 'Numele proiectului'}" autocomplete="off">
    <div class="card group">
      <label class="row"><span>${tp.dateLabel}</span><input type="date" id="p-date"></label>
      <label class="row"><span>Arie</span><select id="p-area">${state.cats.map((c) => `<option value="${c.id}" ${(tp.area || 'academii') === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="row"><span>🎯 Obiectiv</span><select id="p-goal"><option value="">— niciunul —</option>${state.goals.filter((g) => g.status !== 'done').map((g) => `<option value="${g.id}" ${newProjGoal === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select></label>
    </div>
    ${tp.steps.length ? `<div class="label">Ce creez (${tp.steps.length} sarcini)</div><div class="card">${tp.steps.map(([off, n]) => `<div class="prow"><div class="pt">${off === 0 ? 'Ziua 0' : (off > 0 ? '+' : '') + off + 'z'}</div><div class="pb">${esc(n)}</div></div>`).join('')}</div>
    <div class="help">Termenele trecute deja ajung pe azi, iar planificatorul le pune în program. Le poți modifica oricând.</div>` : ''}
  </div>`);
  $('#p-title').focus();
}
function openProject(id) {
  const p = projById(id); if (!p) return;
  const pr = projProgress(p);
  const ts = state.tasks.filter((t) => t.project === p.id).sort((a, b) => (a.done - b.done) || (a.date || '9').localeCompare(b.date || '9'));
  openSheet(`<div class="sheet-head"><button class="link" data-act="close">Închide</button><b class="ellipsis">${esc(p.title)}</b><button class="link strong" data-act="proj-save" data-v="${p.id}">Salvează</button></div>
  <div class="sheet-body">
    <input id="p-title" class="big" value="${esc(p.title)}">
    <div class="card pad" style="margin-top:10px"><div class="gtop"><b>Progres</b><span>${pr.done}/${pr.total} sarcini</span></div>${bar(pr.pct, (cat(p.area) || {}).color)}</div>
    <div class="card group">
      <label class="row"><span>Termen</span><input type="date" id="p-date" value="${p.deadline || ''}"></label>
      <label class="row"><span>Arie</span><select id="p-area">${state.cats.map((c) => `<option value="${c.id}" ${p.area === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label class="row"><span>🎯 Obiectiv</span><select id="p-goal"><option value="">— niciunul —</option>${state.goals.map((g) => `<option value="${g.id}" ${p.goalId === g.id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select></label>
    </div>
    <div class="label">Sarcini</div>
    <div class="card">${ts.map((t) => taskRow(t, t.date || '', { showDate: true })).join('') || '<div class="empty" style="padding:14px">Nicio sarcină.</div>'}</div>
    <div class="row-btns"><button class="btn primary" data-act="proj-add" data-v="${p.id}">+ Sarcină</button></div>
    <div class="actions">
      <button class="btn" data-act="proj-status" data-v="${p.id}">${p.status === 'done' ? 'Redeschide proiectul' : '✓ Proiect finalizat'}</button>
      <button class="btn danger" data-act="proj-del" data-v="${p.id}">Șterge proiectul și sarcinile lui</button>
    </div>
  </div>`);
}

// ============================================================
// Echilibru săptămânal
// ============================================================
const weekStart = (ds) => { const d = parseYmd(ds); return addDays(ds, -((d.getDay() + 6) % 7)); };
function weekHours(ws) {
  const h = { work: 0, sport: 0, personal: 0, health: 0, other: 0 };
  for (let i = 0; i < 7; i++) {
    const ds = addDays(ws, i);
    for (const t of tasksOn(ds)) {
      if (!mine(t) || (!t.time && !t.duration)) continue;
      h[typeOf(t)] = (h[typeOf(t)] || 0) + durOf(t);
    }
  }
  return h;
}
function balanceCard(ws) {
  const h = weekHours(ws), S = state.settings;
  const max = Math.max(60, ...Object.values(h));
  const j = weekJournal(ws);
  const warnWork = h.work > S.maxWork * 60, warnPers = h.personal < S.minPersonal * 60;
  return `<div class="card pad">
    ${Object.entries(AREA_TYPES).filter(([k]) => k !== 'other' || h.other).map(([k, l]) => `<div class="bal"><span>${l}</span><div class="pbar"><i style="width:${(h[k] / max) * 100}%;background:${TYPE_COLORS[k]}"></i></div><b>${fmtDur(h[k] || 0)}</b></div>`).join('')}
    ${j.sleep ? `<div class="bal"><span>Somn (mediu/noapte)</span><div class="pbar"><i style="width:${Math.min(100, (j.sleep / 9) * 100)}%;background:#6366f1"></i></div><b>${j.sleep.toFixed(1)}h</b></div>` : ''}
    ${warnWork ? `<div class="warnbox">⚠️ Ai ${fmtDur(h.work)} de muncă programate, peste limita ta de ${S.maxWork}h. Ce poți delega sau muta?</div>` : ''}
    ${warnPers ? `<div class="warnbox soft">❤️ Doar ${fmtDur(h.personal)} pentru viața personală (ținta ta: ${S.minPersonal}h). Rezervă-ți o seară – și pune-o ca întâlnire, ca s-o protejez.</div>` : ''}
    ${!warnWork && !warnPers ? '<div class="okbox">✓ Săptămână echilibrată.</div>' : ''}
  </div>`;
}

// ============================================================
// Jurnal: corp + minte
// ============================================================
const jEntry = (ds) => state.journal.find((e) => e.id === ds);
function weekJournal(ws) {
  const es = state.journal.filter((e) => e.id >= ws && e.id <= addDays(ws, 6));
  const avg = (k) => { const v = es.map((e) => +e[k]).filter((x) => x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
  return { n: es.length, sleep: avg('sleep'), energy: avg('energy'), mood: avg('mood'), focus: avg('focus'), weight: avg('weight'), trainings: es.filter((e) => +e.trainMin > 0).length, trainMin: es.reduce((s, e) => s + (+e.trainMin || 0), 0), es };
}
function spark(vals, color) {
  const pts = vals.map((v, i) => [i, v]).filter(([, v]) => v > 0);
  if (pts.length < 2) return '<div class="muted" style="font-size:13px">Încă puține date.</div>';
  const w = 300, h = 54, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const X = (x) => ((x - x0) / Math.max(1, x1 - x0)) * (w - 8) + 4, Y = (y) => h - 6 - ((y - y0) / Math.max(0.0001, y1 - y0)) * (h - 14);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}" class="spark"><path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(lx)}" cy="${Y(ly)}" r="4" fill="${color}"/></svg>`;
}
function scale(key, val, max, labels) {
  return `<div class="scale" data-key="${key}">${Array.from({ length: max }, (_, i) => i + 1).map((n) => `<button class="${+val === n ? 'on' : ''}" data-act="j-scale" data-k="${key}" data-v="${n}">${labels ? labels[n - 1] : n}</button>`).join('')}</div>`;
}
function viewJournal() {
  const ds = ui.jDate || todayStr();
  const e = jEntry(ds) || {};
  const last30 = Array.from({ length: 30 }, (_, i) => addDays(todayStr(), i - 29));
  const series = (k) => last30.map((d) => +((jEntry(d) || {})[k] || 0));
  const filled = last30.filter((d) => jEntry(d)).length;
  const wj = weekJournal(weekStart(todayStr()));
  let msg = '';
  if (+e.energy && +e.energy <= 2) msg = 'Zi grea. E în regulă – odihna face parte din antrenament. Alege un singur lucru important și atât.';
  else if (+e.energy >= 4 && +e.focus >= 4) msg = 'Energie și concentrare bune azi – profită pentru lucrurile grele.';
  return `<div class="jnav"><button data-act="j-day" data-v="-1">‹</button><b>${ds === todayStr() ? 'Azi' : relDay(ds)} · ${fmtLong(ds).split(', ')[1]}</b><button data-act="j-day" data-v="1" ${ds >= todayStr() ? 'disabled' : ''}>›</button></div>
  ${msg ? `<div class="okbox" style="margin:0 0 10px">${msg}</div>` : ''}
  <div class="label">Corp</div>
  <div class="card group">
    <label class="row"><span>😴 Somn (ore)</span><input data-j="sleep" type="number" inputmode="decimal" step="0.5" value="${e.sleep ?? ''}" placeholder="—"></label>
    <label class="row"><span>⚖️ Greutate (kg)</span><input data-j="weight" type="number" inputmode="decimal" step="0.1" value="${e.weight ?? ''}" placeholder="—"></label>
    <label class="row"><span>🥋 Antrenament (min)</span><input data-j="trainMin" type="number" inputmode="numeric" value="${e.trainMin ?? ''}" placeholder="0"></label>
    <label class="row"><span>Tip</span><input data-j="trainType" value="${esc(e.trainType || '')}" placeholder="ex: Kyokushin, forță, cardio"></label>
    <div class="row col"><span>Intensitate (RPE)</span>${scale('rpe', e.rpe, 10)}</div>
    <div class="row col"><span>🍽 Alimentație</span>${scale('food', e.food, 5, ['😣', '😕', '😐', '🙂', '💪'])}</div>
    <div class="row col"><span>🧊 Recuperare / dureri</span>${scale('recovery', e.recovery, 5, ['😣', '😕', '😐', '🙂', '💪'])}</div>
  </div>
  <div class="label">Minte</div>
  <div class="card group">
    <div class="row col"><span>⚡ Energie</span>${scale('energy', e.energy, 5)}</div>
    <div class="row col"><span>🙂 Stare</span>${scale('mood', e.mood, 5, ['😞', '😕', '😐', '🙂', '😄'])}</div>
    <div class="row col"><span>🎯 Concentrare</span>${scale('focus', e.focus, 5)}</div>
  </div>
  <textarea data-j="wins" placeholder="🏆 Ce a mers bine azi / realizări">${esc(e.wins || '')}</textarea>
  <textarea data-j="lessons" placeholder="📘 Ce am învățat">${esc(e.lessons || '')}</textarea>
  <textarea data-j="worries" placeholder="🌀 Ce mă preocupă (scrie-l ca să-l scoți din cap)">${esc(e.worries || '')}</textarea>
  <textarea data-j="grateful" placeholder="🙏 Pentru ce sunt recunoscător">${esc(e.grateful || '')}</textarea>
  <div class="help">Se salvează automat.</div>

  <div class="sec"><h2>Ultimele 30 de zile</h2><span class="muted">${filled}/30 zile notate</span></div>
  <div class="card pad trends">
    <div><span>⚖️ Greutate</span>${spark(series('weight'), '#ff7a45')}</div>
    <div><span>😴 Somn</span>${spark(series('sleep'), '#6366f1')}</div>
    <div><span>⚡ Energie</span>${spark(series('energy'), '#22c55e')}</div>
    <div><span>🎯 Concentrare</span>${spark(series('focus'), '#2563eb')}</div>
  </div>
  <div class="kpis" style="margin-top:10px">
    <div class="kpi"><div class="v">${wj.trainings}</div><div class="l">antrenamente săptămâna asta (${fmtDur(wj.trainMin)})</div></div>
    <div class="kpi"><div class="v">${wj.energy ? wj.energy.toFixed(1) : '—'}</div><div class="l">energie medie săptămâna asta</div></div>
  </div>`;
}

// ============================================================
// Analiza săptămânii + comparații în timp
// ============================================================
function weekStats(ws) {
  const we = addDays(ws, 6);
  let planned = 0, done = 0;
  const byArea = {};
  for (let i = 0; i < 7; i++) {
    const ds = addDays(ws, i);
    for (const t of tasksOn(ds)) { if (!mine(t) || isEvent(t)) continue; planned++; if (isDone(t, ds)) { done++; byArea[t.cat || '—'] = (byArea[t.cat || '—'] || 0) + 1; } }
  }
  const missed = state.tasks.filter((t) => !isRec(t) && !t.done && mine(t) && t.date && t.date >= ws && t.date <= we && t.date < todayStr());
  const j = weekJournal(ws);
  const goals = {};
  state.goals.forEach((g) => { goals[g.id] = Math.round(goalProgress(g).pct * 100); });
  return { ws, planned, done, byArea, missed, hours: weekHours(ws), j, goals, focus: Array.from({ length: 7 }, (_, i) => state.focusLog[addDays(ws, i)] || 0).reduce((a, b) => a + b, 0) };
}
function snapshot(ws) {
  const s = weekStats(ws);
  state.snapshots[ws] = { done: s.done, planned: s.planned, byArea: s.byArea, hours: s.hours, energy: +s.j.energy.toFixed(2), sleep: +s.j.sleep.toFixed(2), weight: +s.j.weight.toFixed(1), trainings: s.j.trainings, focus: s.focus, goals: s.goals };
}
EXT.migrate.push(() => {
  // salvează automat „poza” săptămânii trecute (pentru comparații peste 3/6/12 luni)
  const prev = addDays(weekStart(todayStr()), -7);
  if (state.tasks.length && !state.snapshots[prev]) { snapshot(prev); persist(); }
});
function openReview(ws) {
  ws = ws || (new Date().getDay() === 0 ? weekStart(todayStr()) : addDays(weekStart(todayStr()), -7));
  const s = weekStats(ws), prev = state.snapshots[addDays(ws, -7)];
  const rate = s.planned ? Math.round((s.done / s.planned) * 100) : 0;
  const delta = (a, b, unit = '') => (b == null ? '' : a > b ? ` <span class="up">▲ ${+(a - b).toFixed(1)}${unit}</span>` : a < b ? ` <span class="down">▼ ${+(b - a).toFixed(1)}${unit}</span>` : '');
  const areas = Object.entries(s.byArea).sort((a, b) => b[1] - a[1]);
  const S = state.settings;
  const tips = [];
  if (s.hours.work > S.maxWork * 60) tips.push(`Ai lucrat ~${fmtDur(s.hours.work)}, peste limita ta de ${S.maxWork}h. Alege 2–3 lucruri de delegat săptămâna viitoare.`);
  if (s.hours.personal < S.minPersonal * 60) tips.push('Prea puțin timp personal. Pune acum în calendar o seară pentru familie/relație – ca întâlnire fixă.');
  if (s.missed.length > 3) tips.push(`${s.missed.length} lucruri au rămas nefăcute. Poate planifici prea mult – lasă 20% din zi liber pentru neprevăzut.`);
  if (s.j.sleep && s.j.sleep < 6.5) tips.push(`Somn mediu ${s.j.sleep.toFixed(1)}h. Sub 7h scade performanța în sală și la birou – țintește o oră de culcare fixă.`);
  if (s.j.trainings < 3) tips.push(`Doar ${s.j.trainings} antrenamente notate. Programează-le ca întâlniri fixe, nu „dacă rămâne timp”.`);
  const neglected = state.goals.filter((g) => g.status === 'active' && goalStale(g));
  if (neglected.length) tips.push(`Obiective fără progres: ${neglected.map((g) => q(esc(g.title))).join(', ')}. Pune câte un pas mic pentru fiecare.`);
  if (!tips.length) tips.push('Săptămână solidă. Păstrează ritmul și alege de acum cele 3 priorități pentru săptămâna următoare.');
  const wins = s.j.es.map((e) => e.wins).filter(Boolean), lessons = s.j.es.map((e) => e.lessons).filter(Boolean), worries = s.j.es.map((e) => e.worries).filter(Boolean);
  snapshot(ws); persist();
  openSheet(`<div class="sheet-head"><span style="width:60px"></span><b>Analiza săptămânii</b><button class="link strong" data-act="close">Gata</button></div>
  <div class="sheet-body">
    <div class="help pad0">${relDay(ws)} – ${relDay(addDays(ws, 6))} · comparat cu săptămâna anterioară</div>
    <div class="kpis">
      <div class="kpi"><div class="v">${s.done}${delta(s.done, prev && prev.done)}</div><div class="l">lucruri terminate (${rate}% din plan)</div></div>
      <div class="kpi"><div class="v">${fmtDur(s.hours.work)}</div><div class="l">muncă programată</div></div>
      <div class="kpi"><div class="v">${s.j.trainings}${delta(s.j.trainings, prev && prev.trainings)}</div><div class="l">antrenamente</div></div>
      <div class="kpi"><div class="v">${s.j.energy ? s.j.energy.toFixed(1) : '—'}${s.j.energy ? delta(+s.j.energy.toFixed(1), prev && prev.energy || null) : ''}</div><div class="l">energie medie</div></div>
    </div>
    ${areas.length ? `<div class="label">Unde s-a dus efortul</div><div class="card">${areas.map(([id, n]) => `<div class="catbar"><div class="top"><span>${esc(areaName(id))}</span><b>${n}</b></div><div class="track"><i style="width:${(n / areas[0][1]) * 100}%;--c:${(cat(id) || {}).color || '#94a3b8'}"></i></div></div>`).join('')}</div>` : ''}
    <div class="label">Echilibru</div>${balanceCard(ws)}
    ${state.goals.length ? `<div class="label">Obiective</div><div class="card">${state.goals.filter((g) => g.status !== 'done').map((g) => `<div class="catbar"><div class="top"><span>${esc(g.title)}</span><b>${s.goals[g.id]}%${prev && prev.goals && prev.goals[g.id] != null ? delta(s.goals[g.id], prev.goals[g.id], '%') : ''}</b></div>${bar(s.goals[g.id] / 100, (cat(g.area) || {}).color)}</div>`).join('')}</div>` : ''}
    ${s.missed.length ? `<div class="label">N-au fost făcute (${s.missed.length})</div><div class="card">${s.missed.slice(0, 10).map((t) => taskRow(t, '', { showDate: true })).join('')}</div>` : ''}
    ${wins.length ? `<div class="label">🏆 Realizări</div><div class="card pad notes">${wins.map((w) => `<p>${esc(w)}</p>`).join('')}</div>` : ''}
    ${lessons.length ? `<div class="label">📘 Lecții</div><div class="card pad notes">${lessons.map((w) => `<p>${esc(w)}</p>`).join('')}</div>` : ''}
    ${worries.length ? `<div class="label">🌀 Ce te-a preocupat</div><div class="card pad notes">${worries.map((w) => `<p>${esc(w)}</p>`).join('')}</div>` : ''}
    <div class="label">Ce să schimbi săptămâna viitoare</div>
    <div class="card pad notes">${tips.map((t) => `<p>• ${t}</p>`).join('')}</div>
    <div class="row-btns"><button class="btn primary" data-act="plan-week">Planifică săptămâna viitoare</button></div>
  </div>`);
}
function compareCard() {
  const now = weekStart(todayStr());
  const cur = weekStats(addDays(now, -7));
  const rows = [3, 6, 12].map((mo) => {
    const target = addDays(now, -Math.round(mo * 4.345) * 7);
    const keys = Object.keys(state.snapshots).sort();
    const k = keys.filter((x) => x <= addDays(target, 14)).pop();
    if (!k || daysBetween(k, target) > 21) return `<div class="cmp"><b>Acum ${mo} luni</b><span class="muted">încă nu am date – revino după ${relDay(addDays(keys[0] || now, Math.round(mo * 30.4))).toLowerCase()}</span></div>`;
    const o = state.snapshots[k];
    const d = (a, b, u = '', inv) => { if (!b && b !== 0) return '—'; const diff = +(a - b).toFixed(1); const good = inv ? diff < 0 : diff > 0; return `${fmtNum(+(+a).toFixed(1))}${u} <span class="${diff === 0 ? '' : good ? 'up' : 'down'}">(${diff > 0 ? '+' : ''}${diff}${u})</span>`; };
    return `<div class="cmp"><b>Față de acum ${mo} luni</b>
      <span>Terminate/săpt.: ${d(cur.done, o.done)}</span>
      <span>Muncă/săpt.: ${d(+(cur.hours.work / 60).toFixed(1), +(o.hours.work / 60).toFixed(1), 'h', true)}</span>
      <span>Antrenamente: ${d(cur.j.trainings, o.trainings)}</span>
      <span>Energie: ${d(+cur.j.energy.toFixed(1), o.energy)}</span>
      ${o.weight && cur.j.weight ? `<span>Greutate: ${d(+cur.j.weight.toFixed(1), o.weight, ' kg', true)}</span>` : ''}</div>`;
  });
  return `<div class="card pad">${rows.join('')}</div>`;
}

// ============================================================
// Tab „Eu”
// ============================================================
function viewMe() {
  const mode = ui.meMode || 'journal';
  const seg = [['journal', 'Jurnal'], ['progress', 'Progres'], ['settings', 'Setări']].map(([k, l]) => `<button class="${mode === k ? 'on' : ''}" data-act="me-mode" data-v="${k}">${l}</button>`).join('');
  let body = '';
  if (mode === 'journal') body = viewJournal();
  else if (mode === 'progress') {
    body = `<div class="row-btns"><button class="btn primary" data-act="review">📊 Analiza săptămânii</button></div>
      <div class="sec"><h2>Echilibrul săptămânii</h2></div>${balanceCard(weekStart(todayStr()))}
      <div class="sec"><h2>Unde eram</h2></div>${compareCard()}
      <div class="sec"><h2>Ultimele 7 zile</h2></div>${viewStats()}`;
  } else body = (typeof cloudCard === 'function' ? cloudCard() : '') + viewSettings();
  return `<div class="hdr"><div><h1>Eu</h1><div class="sub">Corp, minte, progres</div></div></div><div class="seg" style="margin-bottom:12px">${seg}</div>${body}`;
}
Object.assign(VIEWS, { proj: viewProjects, eu: viewMe });

// ============================================================
// Observații noi pentru asistent
// ============================================================
EXT.nudges.push((add) => {
  const t = todayStr(), nm = nowMin(), S = state.settings, dow = new Date().getDay();
  // delegări de verificat
  for (const x of state.tasks) {
    if (!x.delegatedTo || x.done || !x.followUp || x.followUp > t) continue;
    add({ key: `fu|${x.id}|${x.followUp}`, icon: '🔎', id: x.id, ds: x.date || '', tone: 'warn',
      title: `Verifică cu ${esc(x.delegatedTo)}: ${q(esc(x.title))}`, body: x.deadline ? `Termen: ${relDay(x.deadline).toLowerCase()}.` : 'E gata?',
      actions: [{ act: 'toggle', label: '✓ E gata' }, { act: 'fu-later', v: x.id, label: 'Mai verific în 2 zile' }, { act: 'fu-mine', v: x.id, label: 'Îl preiau eu' }] });
  }
  // analiza de duminică
  if ((dow === 0 && nm >= 17 * 60) || (dow === 1 && nm < 12 * 60)) add({ key: `review|${weekStart(dow === 0 ? t : addDays(t, -1))}`, icon: '📊', title: 'Analiza săptămânii e gata',
    body: 'Ce ai realizat, ce a rămas, cum a fost echilibrul și ce să schimbi.', actions: [{ act: 'review', label: 'Deschide analiza' }] });
  // prea multă muncă
  const ws = weekStart(t), h = weekHours(ws);
  if (h.work > S.maxWork * 60) add({ key: `overwork|${ws}`, icon: '🧯', tone: 'warn', title: `${fmtDur(h.work)} de muncă săptămâna asta`,
    body: `E peste limita ta de ${S.maxWork}h. Succesul se măsoară și în libertate – ce poți delega?`, actions: [{ act: 'five', v: 'delegate', label: '🤝 Ce pot delega' }] });
  if (dow >= 3 && h.personal < S.minPersonal * 60 * 0.5) add({ key: `pers|${ws}`, icon: '❤️', title: 'Puțin timp pentru tine săptămâna asta',
    body: `Doar ${fmtDur(h.personal)} planificate pentru familie, relație și prieteni.`, actions: [{ act: 'add-personal', label: '+ Rezervă o seară' }] });
  // obiective neglijate
  const ng = state.goals.find((g) => g.status === 'active' && goalStale(g));
  if (ng) add({ key: `goal|${ng.id}|${ws}`, icon: '🎯', title: `${q(esc(ng.title))} n-a avansat de 7 zile`, body: 'Un pas mic azi contează mai mult decât un plan mare mâine.',
    actions: [{ act: 'goal-step', v: ng.id, label: '+ Un pas mic' }] });
  // proiecte cu termen apropiat și sarcini restante
  for (const p of state.projects) {
    if (p.status === 'done' || !p.deadline) continue;
    const dd = daysBetween(t, p.deadline);
    const late = state.tasks.filter((x) => x.project === p.id && !x.done && x.date && x.date < t);
    if (dd >= 0 && dd <= 30 && late.length) add({ key: `proj|${p.id}|${t}`, icon: '📁', tone: 'warn', title: `${q(esc(p.title))} – ${late.length} sarcini restante`,
      body: `Mai sunt ${dd} zile până la termen.`, actions: [{ act: 'proj-open', v: p.id, label: 'Deschide proiectul' }] });
  }
  // check-in seara
  if (nm >= tMin(S.evening) - 60 && !jEntry(t)) add({ key: `jrn|${t}`, icon: '📝', title: 'Check-in de 1 minut', body: 'Somn, energie, antrenament și un gând despre ziua de azi.',
    actions: [{ act: 'journal', label: 'Completează' }] });
});
EXT.reminders.push((ds, push) => {
  for (const x of state.tasks) {
    if (x.delegatedTo && !x.done && x.followUp === ds) push(tsOf(ds, tMin(state.settings.morning) + 30), `🔎 Verifică cu ${x.delegatedTo}`, `${x.title}${x.deadline ? ' – termen ' + relDay(x.deadline).toLowerCase() : ''}`, `fu|${x.id}`);
  }
  if (parseYmd(ds).getDay() === 0) push(tsOf(ds, 18 * 60), 'Analiza săptămânii 📊', 'Ce ai realizat, ce a rămas și ce schimbi săptămâna viitoare. Durează 5 minute.', `review|${ds}`);
});

// ============================================================
// Acțiuni
// ============================================================
Object.assign(actions, {
  five(el) { openFive(el.dataset.v); },
  'dlg-open'(el) { openDelegate(el.dataset.v); },
  'dlg-save'(el) {
    const x = findTask(el.dataset.v); const who = $('#dlg-who').value.trim();
    if (!who) { toast('Scrie numele'); return; }
    x.delegatedTo = who; x.followUp = $('#dlg-fu').value || addDays(todayStr(), 2); if (x.auto) x.time = '';
    save(); autoPlanToday(true); openFive('delegate'); toast(`Delegat lui ${who} ✓`);
  },
  'fu-later'(el) { const x = findTask(el.dataset.v); x.followUp = addDays(todayStr(), 2); save(); render(); toast('Îți amintesc peste 2 zile'); },
  'fu-mine'(el) { const x = findTask(el.dataset.v); x.delegatedTo = null; x.followUp = null; x.date = todayStr(); save(); autoPlanToday(true); render(); toast('Preluat – e în programul tău de azi'); },
  'proj-mode'(el) { ui.projMode = el.dataset.v; render(); },
  'me-mode'(el) { ui.meMode = el.dataset.v; render(); },
  journal() { ui.tab = 'eu'; ui.meMode = 'journal'; ui.jDate = todayStr(); closeSheet(); render(); window.scrollTo(0, 0); },
  review() { openReview(); },
  'plan-week'() { closeSheet(); ui.tab = 'cal'; ui.calSel = addDays(weekStart(todayStr()), new Date().getDay() === 0 ? 1 : 7); render(); toast('Alege o zi și apasă ✨ Planifică'); },
  'add-personal'() { openQuick(undefined, { title: 'Timp personal', fields: { cat: 'familie' } }); $('#q').value = 'Seară cu familia vineri la 19 3h'; quickPreview(); },
  'goal-new'() { openGoal(null); },
  'goal-open'(el) { openGoal(el.dataset.v); },
  'goal-save'() { if (saveGoal()) { closeSheet(); render(); } },
  'goal-status'(el) { const d = saveGoal(); if (!d) return; d.status = el.dataset.v; save(); closeSheet(); render(); if (d.status === 'done') toast('🏆 Felicitări! Obiectiv atins'); },
  'goal-del'() {
    const g = gdraft; if (!g.id || !confirm('Ștergi obiectivul? Proiectele și taskurile rămân, dar fără obiectiv.')) return;
    state.goals = state.goals.filter((x) => x.id !== g.id);
    state.projects.forEach((p) => { if (p.goalId === g.id) p.goalId = null; });
    state.tasks.forEach((t) => { if (t.goal === g.id) t.goal = null; });
    save(); closeSheet(); render();
  },
  'goal-step'(el) { const g = goalById(el.dataset.v); if (!g) return; if ($('#g-title') && gdraft && gdraft.id === g.id) saveGoal(); openQuick(undefined, { title: '🎯 ' + g.title, fields: { goal: g.id, cat: g.area } }); },
  'proj-new'(el) { if ($('#g-title') && gdraft && gdraft.id) saveGoal(); openNewProject(el.dataset.v || null); },
  'proj-tpl'(el) { openProjForm(el.dataset.v); },
  'proj-create'(el) {
    const title = $('#p-title').value.trim(); if (!title) { toast('Dă-i un nume'); return; }
    const tp = PROJECT_TEMPLATES.find((x) => x.id === el.dataset.v);
    const date = $('#p-date').value || null;
    if (tp.steps.length && !date) { toast(`Alege ${tp.dateLabel.toLowerCase()}`); return; }
    const p = createProject(el.dataset.v, title, date, $('#p-goal').value || null, $('#p-area').value);
    autoPlanToday(true);
    ui.tab = 'proj'; ui.projMode = 'projects'; render(); openProject(p.id);
    toast(`📁 Proiect creat${tp.steps.length ? ` cu ${tp.steps.length} sarcini` : ''}`);
  },
  'proj-open'(el) { openProject(el.dataset.v); },
  'proj-save'(el) {
    const p = projById(el.dataset.v);
    p.title = $('#p-title').value.trim() || p.title; p.deadline = $('#p-date').value || null; p.area = $('#p-area').value; p.goalId = $('#p-goal').value || null;
    state.tasks.forEach((t) => { if (t.project === p.id) t.goal = p.goalId; });
    save(); closeSheet(); render();
  },
  'proj-add'(el) { const p = projById(el.dataset.v); openQuick(undefined, { title: '📁 ' + p.title, fields: { project: p.id, goal: p.goalId, cat: p.area } }); },
  'proj-status'(el) { const p = projById(el.dataset.v); p.status = p.status === 'done' ? 'active' : 'done'; save(); closeSheet(); render(); },
  'proj-del'(el) {
    const id = el.dataset.v; if (!confirm('Ștergi proiectul și toate sarcinile lui?')) return;
    state.projects = state.projects.filter((p) => p.id !== id);
    state.tasks = state.tasks.filter((t) => t.project !== id);
    save(); closeSheet(); render();
  },
  'j-day'(el) { const d = addDays(ui.jDate || todayStr(), +el.dataset.v); if (d > todayStr()) return; ui.jDate = d; render(); },
  'j-scale'(el) {
    const e = jEnsure(); const k = el.dataset.k, v = +el.dataset.v;
    e[k] = e[k] === v ? null : v; save();
    $$(`.scale[data-key="${k}"] button`).forEach((b) => b.classList.toggle('on', +b.dataset.v === e[k]));
  },
});
function jEnsure() {
  const ds = ui.jDate || todayStr();
  let e = jEntry(ds);
  if (!e) { e = { id: ds }; state.journal.push(e); state.journal.sort((a, b) => a.id.localeCompare(b.id)); }
  return e;
}
document.addEventListener('change', (ev) => {
  const k = ev.target.dataset && ev.target.dataset.j;
  if (!k) return;
  const e = jEnsure();
  e[k] = ev.target.type === 'number' ? (ev.target.value === '' ? null : +ev.target.value) : ev.target.value;
  save();
});
