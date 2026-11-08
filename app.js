'use strict';
/* Ritm – calendar + taskuri, totul local pe telefon (localStorage). */

// ---------- utilitare ----------
const KEY = 'ritm.v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const todayStr = () => ymd(new Date());
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const tMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const minToT = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m} min`);

const ZILE = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
const ZS = ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm'];
const LUNI = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const fmtLong = (ds) => { const d = parseYmd(ds); return `${ZILE[d.getDay()]}, ${d.getDate()} ${LUNI[d.getMonth()]}`; };
const relDay = (ds) => {
  const t = todayStr();
  if (ds === t) return 'Azi';
  if (ds === addDays(t, 1)) return 'Mâine';
  if (ds === addDays(t, -1)) return 'Ieri';
  const d = parseYmd(ds);
  return `${ZS[d.getDay()]}, ${d.getDate()} ${LUNI[d.getMonth()].slice(0, 3)}`;
};
const REPEAT = { none: 'Niciodată', daily: 'Zilnic', weekdays: 'Zile lucrătoare', weekly: 'Săptămânal', monthly: 'Lunar' };
const PRIO = { 1: 'Scăzută', 2: 'Normală', 3: 'Importantă' };

// ---------- date / stare ----------
const DEFAULT_CATS = [
  { id: 'munca', name: 'Muncă', color: '#4f7cff' },
  { id: 'personal', name: 'Personal', color: '#a259ff' },
  { id: 'sport', name: 'Sport', color: '#ff7a45' },
  { id: 'sanatate', name: 'Sănătate', color: '#22c55e' },
  { id: 'casa', name: 'Casă', color: '#f5b700' },
  { id: 'studiu', name: 'Studiu', color: '#06b6d4' },
];
const DEFAULT_SETTINGS = { reminder: 10, work: 25, brk: 5, notify: false, dayHours: 8 };

function seed() {
  const t = todayStr();
  const base = { notes: '', duration: 0, priority: 2, cat: null, repeat: 'none', reminder: null, subtasks: [], done: false, doneDates: [], createdAt: Date.now() };
  return {
    tasks: [
      { ...base, id: uid(), title: 'Bun venit în Ritm 👋 Atinge cercul ca să bifezi', date: t },
      { ...base, id: uid(), title: 'Apasă + și scrie: „mâine la 18 sală #sport”', date: t, priority: 3, cat: 'personal' },
      { ...base, id: uid(), title: 'Planifică ziua de mâine (2 minute)', date: t, time: '21:30', duration: 10, repeat: 'daily', reminder: 0, cat: 'personal',
        subtasks: [{ t: 'Mută ce n-am terminat azi', done: false }, { t: 'Alege cele 3 lucruri importante', done: false }, { t: 'Pune-le o oră', done: false }] },
    ],
    cats: DEFAULT_CATS.map((c) => ({ ...c })),
    focusLog: {},
    settings: { ...DEFAULT_SETTINGS },
    timer: null,
    sent: {},
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.tasks)) {
      return { cats: DEFAULT_CATS.map((c) => ({ ...c })), focusLog: {}, timer: null, sent: {}, ...s, settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) } };
    }
  } catch (e) { /* stocare indisponibilă */ }
  return seed();
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignorăm */ }
  updateBadge();
}

const ui = { tab: 'azi', calMonth: todayStr().slice(0, 8) + '01', calSel: todayStr(), listMode: 'plan', search: '' };

// ---------- logica taskurilor ----------
const isRec = (t) => t.repeat && t.repeat !== 'none';
const cat = (id) => state.cats.find((c) => c.id === id);
const findTask = (id) => state.tasks.find((t) => t.id === id);

function occursOn(t, ds) {
  if (!t.date || ds < t.date) return false;
  if (!isRec(t)) return ds === t.date;
  const d = parseYmd(ds), s = parseYmd(t.date);
  switch (t.repeat) {
    case 'daily': return true;
    case 'weekdays': return d.getDay() > 0 && d.getDay() < 6;
    case 'weekly': return d.getDay() === s.getDay();
    case 'monthly': return d.getDate() === s.getDate();
  }
  return false;
}
const isDone = (t, ds) => (isRec(t) ? (t.doneDates || []).includes(ds) : !!t.done);
function toggleDone(t, ds) {
  if (isRec(t)) {
    ds = ds || todayStr();
    t.doneDates = t.doneDates || [];
    const i = t.doneDates.indexOf(ds);
    if (i >= 0) t.doneDates.splice(i, 1); else t.doneDates.push(ds);
  } else {
    t.done = !t.done;
    t.completedOn = t.done ? todayStr() : null;
  }
}
const sortTasks = (a, b) => {
  if (a.time && b.time) return a.time.localeCompare(b.time) || b.priority - a.priority;
  if (a.time) return -1;
  if (b.time) return 1;
  return b.priority - a.priority || (a.createdAt || 0) - (b.createdAt || 0);
};
const tasksOn = (ds) => state.tasks.filter((t) => occursOn(t, ds)).sort(sortTasks);
const overdue = () => { const t = todayStr(); return state.tasks.filter((x) => !isRec(x) && x.date && x.date < t && !x.done).sort((a, b) => a.date.localeCompare(b.date)); };
function completionsOn(ds) {
  let n = 0;
  for (const t of state.tasks) {
    if (isRec(t)) { if ((t.doneDates || []).includes(ds)) n++; }
    else if (t.done && t.completedOn === ds) n++;
  }
  return n;
}
function streak() {
  let d = todayStr(), n = 0;
  if (!completionsOn(d)) d = addDays(d, -1);
  while (completionsOn(d) > 0) { n++; d = addDays(d, -1); }
  return n;
}
function plannedMinutes(ds) { return tasksOn(ds).reduce((s, t) => s + (t.duration || 0), 0); }

// ---------- parser pentru adăugare rapidă ----------
const WD = { duminica: 0, luni: 1, marti: 2, miercuri: 3, joi: 4, vineri: 5, sambata: 6 };
function parseQuick(text, baseDate) {
  const res = { date: baseDate === undefined ? todayStr() : baseDate, time: null, priority: 2, cat: null, repeat: 'none', duration: null, title: '' };
  const toks = text.trim().split(/\s+/).filter(Boolean);
  const keep = [];
  const timeRe = /^(\d{1,2})(?:[:.](\d{2}))?$/;
  const t0 = todayStr();
  for (let i = 0; i < toks.length; i++) {
    const raw = toks[i], n = norm(raw).replace(/[,;]$/, '');
    const next = toks[i + 1] ? norm(toks[i + 1]) : '';
    if (n === 'azi' || n === 'astazi') { res.date = t0; continue; }
    if (n === 'maine') { res.date = addDays(t0, 1); continue; }
    if (n === 'poimaine') { res.date = addDays(t0, 2); continue; }
    if (n === 'candva') { res.date = null; continue; }
    if (n in WD) { const cur = new Date().getDay(); res.date = addDays(t0, (WD[n] - cur + 7) % 7 || 7); continue; }
    if (n === 'zilnic') { res.repeat = 'daily'; continue; }
    if (n === 'saptamanal') { res.repeat = 'weekly'; continue; }
    if (n === 'in' && next === 'fiecare' && toks[i + 2] && norm(toks[i + 2]) === 'luna') { res.repeat = 'monthly'; i += 2; continue; }
    if (n === 'in' && next === 'fiecare' && toks[i + 2] && norm(toks[i + 2]) === 'zi') { res.repeat = 'daily'; i += 2; continue; }
    if (n === 'in' && next === 'zilele' && toks[i + 2] && norm(toks[i + 2]).startsWith('lucratoare')) { res.repeat = 'weekdays'; i += 2; continue; }
    if (n === 'lucratoare' || n === 'l-v') { res.repeat = 'weekdays'; continue; }
    if (/^!+\d?$/.test(n)) { res.priority = n === '!3' ? 1 : 3; continue; }
    if (n.startsWith('#') && n.length > 1) {
      const q = n.slice(1);
      const c = state.cats.find((c) => norm(c.name).startsWith(q));
      if (c) { res.cat = c.id; continue; }
    }
    let m;
    if ((m = n.match(/^(\d+)(min|m)$/))) { res.duration = +m[1]; continue; }
    if ((m = n.match(/^(\d+(?:[.,]5)?)(h|ore)$/))) { res.duration = Math.round(parseFloat(m[1].replace(',', '.')) * 60); continue; }
    if (/^\d+$/.test(n) && /^(min|minute)$/.test(next)) { res.duration = +n; i++; continue; }
    if ((m = n.match(/^(\d{1,2})[./](\d{1,2})$/)) && +m[2] <= 12 && +m[1] <= 31 && !(toks[i - 1] && /^(la|ora)$/.test(norm(toks[i - 1])))) {
      const y = new Date().getFullYear();
      let ds = `${y}-${pad(+m[2])}-${pad(+m[1])}`;
      if (ds < t0) ds = `${y + 1}-${pad(+m[2])}-${pad(+m[1])}`;
      res.date = ds; continue;
    }
    if ((n === 'la' || n === 'ora') && (m = next.match(timeRe)) && +m[1] < 24) {
      let h = +m[1]; const mm = m[2] ? +m[2] : 0;
      i++;
      const after = toks[i + 1] ? norm(toks[i + 1]) : '';
      if (/^(seara|pm|dupa-amiaza)$/.test(after) && h < 12) { h += 12; i++; }
      else if (/^(dimineata|am)$/.test(after)) { i++; }
      else if (!m[2] && h >= 1 && h <= 6) h += 12; // „la 5” => 17:00
      res.time = `${pad(h)}:${pad(mm)}`; continue;
    }
    if ((m = n.match(/^(\d{1,2}):(\d{2})$/)) && +m[1] < 24 && +m[2] < 60) { res.time = `${pad(+m[1])}:${m[2]}`; continue; }
    keep.push(raw);
  }
  res.title = keep.join(' ').trim();
  if (res.repeat !== 'none' && !res.date) res.date = t0;
  return res;
}

// ---------- randare ----------
const ICON_L = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
const ICON_R = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';

function taskRow(t, ds, opts = {}) {
  const done = isDone(t, ds || null);
  const c = cat(t.cat);
  const meta = [];
  if (opts.showDate && t.date) meta.push(`<span class="${t.date < todayStr() && !done ? 'late' : ''}">${relDay(t.date)}</span>`);
  if (t.time && !opts.timeCol) meta.push(`<span>${t.time}${t.duration ? '–' + minToT(tMin(t.time) + t.duration) : ''}</span>`);
  else if (t.duration && !t.time) meta.push(`<span>⏱ ${fmtDur(t.duration)}</span>`);
  if (isRec(t)) meta.push(`<span>↻ ${REPEAT[t.repeat]}</span>`);
  if (t.subtasks && t.subtasks.length) meta.push(`<span>☑ ${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}</span>`);
  if (t.reminder != null && t.time) meta.push('<span>🔔</span>');
  if (t.notes) meta.push('<span>📝</span>');
  if (c) meta.push(`<span class="cat" style="--cc:${c.color}">${esc(c.name)}</span>`);
  if (t.focusMin) meta.push(`<span>🎯 ${fmtDur(t.focusMin)}</span>`);
  return `<div class="task ${done ? 'done' : ''} ${opts.timeCol ? 'has-time' : ''}" data-id="${t.id}" data-ds="${ds || ''}">
    ${opts.timeCol ? `<div class="timecol">${t.time || ''}</div>` : ''}
    <button class="check" data-act="toggle" style="--c:${c ? c.color : 'var(--muted)'}" aria-label="Bifează"></button>
    <div class="tbody" data-act="edit">
      <div class="ttl">${esc(t.title)}</div>
      ${meta.length ? `<div class="meta">${meta.join('')}</div>` : ''}
    </div>
    ${t.priority === 3 && !done ? '<span class="flag">!</span>' : ''}
    ${opts.extra || ''}
  </div>`;
}

function ring(pct, size = 76, stroke = 8, cls = '') {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r;
  return `<svg viewBox="0 0 ${size} ${size}" class="${cls}"><circle class="bg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
  <circle class="fg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>`;
}

function viewToday() {
  const t = todayStr();
  const list = tasksOn(t);
  const doneN = list.filter((x) => isDone(x, t)).length;
  const pct = list.length ? doneN / list.length : 0;
  const od = overdue();
  const nm = nowMin();
  const open = list.filter((x) => !isDone(x, t));
  const timedOpen = open.filter((x) => x.time);
  let next = timedOpen.find((x) => tMin(x.time) + (x.duration || 0) > nm && tMin(x.time) <= nm)
    || open.filter((x) => !x.time && x.priority === 3)[0]
    || timedOpen.find((x) => tMin(x.time) > nm)
    || open.filter((x) => !x.time)[0]
    || timedOpen[0];

  let nextHtml = '';
  if (next) {
    let lbl = 'Următorul pas';
    if (next.time) {
      const diff = tMin(next.time) - nm;
      lbl = diff <= 0 ? (diff + (next.duration || 0) > 0 ? 'Acum' : 'Întârziat') : `Urmează în ${diff >= 60 ? fmtDur(diff) : diff + ' min'}`;
    }
    nextHtml = `<div class="next" data-id="${next.id}" data-ds="${t}">
      <div class="lbl">${lbl}</div>
      <div class="t">${esc(next.title)}</div>
      <div class="m">${next.time ? next.time + (next.duration ? ' · ' + fmtDur(next.duration) : '') : 'fără oră fixă'}${next.subtasks && next.subtasks.length ? ` · ${next.subtasks.filter((s) => s.done).length}/${next.subtasks.length} pași` : ''}</div>
      <div class="acts">
        <button data-act="toggle">✓ Gata</button>
        <button data-act="focus-on">▶ Focus</button>
        <button data-act="edit">Detalii</button>
      </div>
    </div>`;
  } else if (list.length) {
    nextHtml = `<div class="next done-all"><div class="lbl">Bravo!</div><div class="t">Ai terminat tot ce ți-ai propus azi 🎉</div><div class="m">Odihnește-te sau planifică mâine.</div></div>`;
  }

  const timed = list.filter((x) => x.time);
  const untimed = list.filter((x) => !x.time);
  let timeline = '', nowPlaced = false;
  for (const x of timed) {
    if (!nowPlaced && tMin(x.time) > nm) { timeline += `<div class="nowline">${minToT(nm)}</div>`; nowPlaced = true; }
    timeline += taskRow(x, t, { timeCol: true });
  }
  if (timed.length && !nowPlaced) timeline += `<div class="nowline">${minToT(nm)}</div>`;

  const plan = plannedMinutes(t);
  return `
  <div class="hdr"><div><h1>Azi</h1><div class="sub">${fmtLong(t)}</div></div></div>
  <div class="card progress">
    <div class="ring">${ring(pct)}<b>${Math.round(pct * 100)}%</b></div>
    <div class="pstats">
      <div><strong>${doneN}/${list.length}</strong>bifate</div>
      <div><strong>🔥 ${streak()}</strong>zile la rând</div>
      <div><strong>${fmtDur(state.focusLog[t] || 0)}</strong>focus azi</div>
      <div><strong>${plan ? fmtDur(plan) : '—'}</strong>planificat</div>
    </div>
  </div>
  ${nextHtml}
  ${od.length ? `<div class="sec"><h2>Restanțe (${od.length})</h2><button class="link" data-act="move-all-today">Mută-le pe azi</button></div>
    <div class="card">${od.map((x) => taskRow(x, '', { showDate: true, extra: `<button class="mini" data-act="move-today">Azi</button>` })).join('')}</div>` : ''}
  ${timed.length ? `<div class="sec"><h2>Program</h2></div><div class="card">${timeline}</div>` : ''}
  <div class="sec"><h2>Oricând azi</h2><button class="link" data-act="add-on" data-d="${t}">Adaugă</button></div>
  <div class="card">${untimed.length ? untimed.map((x) => taskRow(x, t)).join('') : '<div class="empty">Nimic fără oră. Apasă + ca să adaugi.</div>'}</div>
  `;
}

function viewCal() {
  const first = parseYmd(ui.calMonth);
  const y = first.getFullYear(), m = first.getMonth();
  const off = (first.getDay() + 6) % 7;
  const start = new Date(y, m, 1 - off);
  const t = todayStr();
  let cells = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<div class="wd">${d}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const ds = ymd(d);
    if (i >= 35 && d.getMonth() !== m) break;
    const tl = tasksOn(ds);
    const allDone = tl.length && tl.every((x) => isDone(x, ds));
    const dots = allDone ? '<i class="ok"></i>' : tl.slice(0, 3).map((x) => `<i style="--c:${(cat(x.cat) || {}).color || 'var(--muted)'}"></i>`).join('');
    cells += `<button class="day ${d.getMonth() !== m ? 'out' : ''} ${ds === t ? 'today' : ''} ${ds === ui.calSel ? 'sel' : ''}" data-act="cal-day" data-d="${ds}">
      <span class="n">${d.getDate()}</span><span class="dots">${dots}</span></button>`;
  }
  const sel = ui.calSel;
  const list = tasksOn(sel);
  const plan = plannedMinutes(sel);
  const over = plan > state.settings.dayHours * 60;
  return `
  <div class="hdr"><div><h1>${LUNI[m][0].toUpperCase() + LUNI[m].slice(1)}</h1><div class="sub">${y}</div></div>
    <div class="calnav"><button data-act="cal-prev" aria-label="Luna anterioară">${ICON_L}</button><button class="link" data-act="cal-today" style="width:auto;padding:0 6px">Azi</button><button data-act="cal-next" aria-label="Luna următoare">${ICON_R}</button></div></div>
  <div class="card"><div class="grid">${cells}</div></div>
  <div class="sec"><h2>${sel === t ? 'Azi · ' : ''}${fmtLong(sel)}</h2><button class="link" data-act="add-on" data-d="${sel}">Adaugă</button></div>
  ${plan ? `<div class="load ${over ? 'over' : ''}" style="margin:0 4px 8px">${over ? '⚠️ ' : ''}${fmtDur(plan)} planificate${over ? ` – peste ${state.settings.dayHours}h, poate muți ceva?` : ''}</div>` : ''}
  <div class="card">${list.length ? list.map((x) => taskRow(x, sel, { timeCol: true })).join('') : '<div class="empty">Zi liberă. Atinge „Adaugă” ca să planifici ceva.</div>'}</div>`;
}

function routineDots(t) {
  let out = '', d = addDays(todayStr(), -6);
  for (let i = 0; i < 7; i++, d = addDays(d, 1)) {
    const occ = occursOn(t, d);
    const cls = !occ ? 'x' : isDone(t, d) ? 'y' : d < todayStr() ? 'n' : '';
    out += `<i class="${cls}">${ZS[parseYmd(d).getDay()][0]}</i>`;
  }
  return out;
}
function routineStreak(t) {
  let d = todayStr(), n = 0, guard = 0;
  if (occursOn(t, d) && !isDone(t, d)) d = addDays(d, -1);
  while (guard++ < 800 && d >= t.date) {
    if (occursOn(t, d)) { if (isDone(t, d)) n++; else break; }
    d = addDays(d, -1);
  }
  return n;
}

function viewList() {
  const t = todayStr();
  const q = norm(ui.search.trim());
  const match = (x) => !q || norm(x.title).includes(q) || norm(x.notes || '').includes(q);
  const seg = [['plan', 'Planificate'], ['someday', 'Cândva'], ['rut', 'Rutine'], ['done', 'Finalizate']]
    .map(([k, l]) => `<button class="${ui.listMode === k ? 'on' : ''}" data-act="list-mode" data-v="${k}">${l}</button>`).join('');
  let body = '';
  if (ui.listMode === 'plan') {
    const items = state.tasks.filter((x) => !isRec(x) && x.date && !x.done && match(x)).sort((a, b) => a.date.localeCompare(b.date) || sortTasks(a, b));
    const groups = {};
    for (const x of items) { const k = x.date < t ? 'late' : x.date; (groups[k] = groups[k] || []).push(x); }
    body = Object.keys(groups).sort().map((k) => k === 'late'
      ? `<div class="sec"><h2 style="color:var(--danger)">Restanțe</h2></div><div class="card">${groups[k].map((x) => taskRow(x, '', { showDate: true })).join('')}</div>`
      : `<div class="sec"><h2>${relDay(k)}</h2></div><div class="card">${groups[k].map((x) => taskRow(x, k)).join('')}</div>`).join('')
      || '<div class="card" style="margin-top:12px"><div class="empty">Niciun task planificat.</div></div>';
  } else if (ui.listMode === 'someday') {
    const items = state.tasks.filter((x) => !x.date && !x.done && match(x)).sort(sortTasks);
    body = `<div class="help" style="padding:12px 4px 8px">Idei și lucruri fără termen. Când ești gata, apasă „Azi”.</div>
      <div class="card">${items.length ? items.map((x) => taskRow(x, '', { extra: '<button class="mini" data-act="move-today">Azi</button>' })).join('') : '<div class="empty">Gol. Scrie „cândva” în adăugarea rapidă.</div>'}</div>`;
  } else if (ui.listMode === 'rut') {
    const items = state.tasks.filter((x) => isRec(x) && match(x));
    body = `<div class="help" style="padding:12px 4px 8px">Obiceiurile tale din ultimele 7 zile.</div><div class="card">${items.length ? items.map((x) => {
      const c = cat(x.cat), occ = occursOn(x, t), d = isDone(x, t);
      return `<div class="rut ${d ? 'done' : ''}" data-id="${x.id}" data-ds="${t}">
        ${occ ? `<button class="check" data-act="toggle" style="--c:${c ? c.color : 'var(--accent)'}"></button>` : '<span style="width:26px"></span>'}
        <div class="tbody" data-act="edit"><div class="ttl">${esc(x.title)}</div>
          <div class="meta"><span>↻ ${REPEAT[x.repeat]}${x.time ? ' · ' + x.time : ''}</span></div><div class="rdots">${routineDots(x)}</div></div>
        <span class="streak">🔥 ${routineStreak(x)}</span></div>`;
    }).join('') : '<div class="empty">Nicio rutină. Scrie de ex. „zilnic la 7 sport 20min”.</div>'}</div>`;
  } else {
    const items = state.tasks.filter((x) => !isRec(x) && x.done && match(x)).sort((a, b) => (b.completedOn || '').localeCompare(a.completedOn || '')).slice(0, 150);
    body = `<div class="card" style="margin-top:12px">${items.length ? items.map((x) => taskRow(x, '', { showDate: true })).join('') : '<div class="empty">Încă nimic bifat.</div>'}</div>
      ${items.length ? '<div style="text-align:center;margin-top:14px"><button class="link danger" data-act="clear-done">Șterge finalizatele</button></div>' : ''}`;
  }
  return `<div class="seg">${seg}</div>${body}`;
}
function viewListPage() {
  return `<div class="hdr"><div><h1>Liste</h1></div></div>
    <input class="search" id="search" type="search" placeholder="Caută în toate taskurile…" value="${esc(ui.search)}">
    <div id="listbody">${viewList()}</div>`;
}

function timerObj() {
  if (!state.timer) state.timer = { mode: 'work', running: false, endAt: 0, left: state.settings.work * 60, taskId: null, cycles: 0 };
  return state.timer;
}
const timerLeft = () => { const T = timerObj(); return T.running ? Math.max(0, Math.round((T.endAt - Date.now()) / 1000)) : T.left; };
const timerTotal = () => (timerObj().mode === 'work' ? state.settings.work : state.settings.brk) * 60;

function viewFocus() {
  const T = timerObj();
  const t = todayStr();
  const opts = tasksOn(t).concat(overdue()).filter((x) => !isDone(x, t));
  if (T.taskId && !opts.find((x) => x.id === T.taskId)) { const tk = findTask(T.taskId); if (tk) opts.unshift(tk); }
  const left = timerLeft();
  const tk = T.taskId && findTask(T.taskId);
  return `<div class="hdr"><div><h1>Focus</h1><div class="sub">Pomodoro: ${state.settings.work} min lucru · ${state.settings.brk} min pauză</div></div></div>
  <div class="card focus">
    <select class="sel" id="focus-task">
      <option value="">— Lucrez la… (alege un task) —</option>
      ${opts.map((x) => `<option value="${x.id}" ${x.id === T.taskId ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}
    </select>
    <div class="bigring ${T.mode === 'brk' ? 'brk' : ''}">${ring(left / timerTotal(), 200, 10, 'fr')}
      <div class="in"><div class="tm" id="tm">${pad(Math.floor(left / 60))}:${pad(left % 60)}</div><div class="md">${T.mode === 'work' ? 'Concentrare' : 'Pauză'} · sesiunea ${T.cycles + 1}</div></div></div>
    <div class="fbtns">
      <button class="btn round" data-act="t-reset">Reset</button>
      <button class="btn round primary" data-act="${T.running ? 't-pause' : 't-start'}" style="width:90px;height:90px;font-size:17px">${T.running ? 'Pauză' : 'Start'}</button>
      <button class="btn round" data-act="t-skip">${T.mode === 'work' ? 'Sari' : 'Lucru'}</button>
    </div>
    ${tk ? `<div style="margin-top:20px"><button class="btn block" data-act="t-done-task">✓ Am terminat „${esc(tk.title)}”</button></div>` : ''}
  </div>
  <div class="kpis" style="margin-top:12px">
    <div class="kpi"><div class="v">${fmtDur(state.focusLog[t] || 0)}</div><div class="l">focus azi</div></div>
    <div class="kpi"><div class="v">${fmtDur(last7().reduce((s, d) => s + (state.focusLog[d] || 0), 0))}</div><div class="l">focus în 7 zile</div></div>
  </div>
  <div class="help" style="padding:12px 4px">Sfat: ține aplicația deschisă pe ecran în timpul sesiunii. Cronometrul continuă corect și dacă ieși, dar alerta sonoră se aude doar cu aplicația deschisă.</div>`;
}

function last7() { const out = []; for (let i = 6; i >= 0; i--) out.push(addDays(todayStr(), -i)); return out; }

function viewMore() {
  const days = last7();
  const counts = days.map(completionsOn);
  const max = Math.max(1, ...counts);
  let planned = 0, did = 0;
  for (const d of days) for (const x of tasksOn(d)) { planned++; if (isDone(x, d)) did++; }
  const rate = planned ? Math.round((did / planned) * 100) : 0;
  const byCat = state.cats.map((c) => ({ c, n: state.tasks.reduce((s, x) => s + (x.cat !== c.id ? 0 : isRec(x) ? (x.doneDates || []).filter((d) => d >= days[0]).length : (x.done && x.completedOn >= days[0] ? 1 : 0)), 0) })).filter((o) => o.n);
  const catMax = Math.max(1, ...byCat.map((o) => o.n));
  const S = state.settings;
  const notifState = !('Notification' in window) ? 'indisponibil' : Notification.permission === 'granted' && S.notify ? 'pornite' : Notification.permission === 'denied' ? 'blocate' : 'oprite';
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const remOpts = [[null, 'Fără'], [0, 'La ora începerii'], [5, '5 min înainte'], [10, '10 min înainte'], [15, '15 min înainte'], [30, '30 min înainte'], [60, '1 oră înainte']];
  return `<div class="hdr"><div><h1>Progres</h1><div class="sub">Ultimele 7 zile</div></div></div>
  <div class="kpis">
    <div class="kpi"><div class="v">🔥 ${streak()}</div><div class="l">zile la rând cu progres</div></div>
    <div class="kpi"><div class="v">${rate}%</div><div class="l">din ce ai planificat (${did}/${planned})</div></div>
    <div class="kpi"><div class="v">${counts.reduce((a, b) => a + b, 0)}</div><div class="l">taskuri bifate</div></div>
    <div class="kpi"><div class="v">${fmtDur(days.reduce((s, d) => s + (state.focusLog[d] || 0), 0))}</div><div class="l">timp de focus</div></div>
  </div>
  <div class="sec"><h2>Bifate pe zi</h2></div>
  <div class="card"><div class="bars">${days.map((d, i) => `<div class="b ${i === 6 ? 't' : ''}"><em>${counts[i] || ''}</em><i style="height:${(counts[i] / max) * 100}%"></i><span>${ZS[parseYmd(d).getDay()]}</span></div>`).join('')}</div></div>
  ${byCat.length ? `<div class="sec"><h2>Pe categorii</h2></div><div class="card">${byCat.map((o) => `<div class="catbar"><div class="top"><span>${esc(o.c.name)}</span><b>${o.n}</b></div><div class="track"><i style="width:${(o.n / catMax) * 100}%;--c:${o.c.color}"></i></div></div>`).join('')}</div>` : ''}

  ${standalone ? '' : `<div class="sec"><h2>Instalează pe iPhone</h2></div>
  <div class="card howto"><b>Ca să o ai ca aplicație pe ecranul principal:</b><ol>
    <li>Deschide pagina în <b>Safari</b></li><li>Apasă butonul <b>Partajează</b> (pătratul cu săgeată)</li>
    <li>Alege <b>„Adaugă pe ecranul principal”</b></li><li>Deschide <b>Ritm</b> de pe ecranul principal</li></ol></div>`}

  <div class="sec"><h2>Mementouri</h2></div>
  <div class="card">
    <button class="row" data-act="notif"><span>🔔 Notificări</span><span class="link">${notifState}</span></button>
    <label class="row"><span>Memento implicit</span><select id="s-rem">${remOpts.map(([v, l]) => `<option value="${v}" ${S.reminder === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <button class="row" data-act="ics-all"><span>📅 Trimite tot în Calendarul iPhone</span><span class="link">.ics</span></button>
  </div>
  <div class="help">Pe iPhone, notificările web merg doar cu aplicația instalată pe ecranul principal (iOS 16.4+). Pentru alarme garantate, folosește „Adaugă în Calendarul iPhone” la fiecare task: alarma vine de la Calendarul iPhone, chiar dacă Ritm e închisă.</div>

  <div class="sec"><h2>Setări</h2></div>
  <div class="card">
    <label class="row"><span>Durata focus (min)</span><input id="s-work" type="number" inputmode="numeric" min="5" max="120" value="${S.work}"></label>
    <label class="row"><span>Durata pauză (min)</span><input id="s-brk" type="number" inputmode="numeric" min="1" max="60" value="${S.brk}"></label>
    <label class="row"><span>Ore disponibile pe zi</span><input id="s-hours" type="number" inputmode="numeric" min="1" max="18" value="${S.dayHours}"></label>
  </div>

  <div class="sec"><h2>Categorii</h2></div>
  <div class="card">
    ${state.cats.map((c) => `<div class="row" data-cat="${c.id}"><input type="color" value="${c.color}" data-catcolor="${c.id}"><input value="${esc(c.name)}" data-catname="${c.id}" style="text-align:left;color:var(--text)"><button class="link danger" data-act="cat-del" data-v="${c.id}">Șterge</button></div>`).join('')}
    <button class="row" data-act="cat-add"><span class="link">+ Categorie nouă</span></button>
  </div>

  <div class="sec"><h2>Date</h2></div>
  <div class="card">
    <button class="row" data-act="export"><span>⬇️ Salvează o copie de siguranță</span></button>
    <label class="row" style="cursor:pointer"><span>⬆️ Restaurează din copie</span><input type="file" id="import" accept="application/json,.json" style="display:none"></label>
    <button class="row" data-act="wipe"><span class="link danger">Șterge toate datele</span></button>
  </div>
  <div class="help">Datele stau doar pe telefonul tău, în aplicație. Fă din când în când o copie de siguranță (o poți pune în Fișiere / iCloud Drive).</div>
  <div class="help" style="text-align:center;padding:24px 0 0">Ritm · v1.0</div>`;
}

function render() {
  const v = $('#view');
  const views = { azi: viewToday, cal: viewCal, list: viewListPage, focus: viewFocus, more: viewMore };
  v.innerHTML = views[ui.tab]();
  $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  $('#fab').hidden = ui.tab === 'focus' || ui.tab === 'more';
}

// ---------- sheet (editor / adăugare rapidă) ----------
function openSheet(html) {
  const sh = $('#sheet');
  sh.innerHTML = html;
  sh.hidden = false;
  $('#backdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  $('#sheet').hidden = true;
  $('#backdrop').hidden = true;
  $('#sheet').innerHTML = '';
  document.body.style.overflow = '';
  draft = null;
}

let draft = null;
const DURS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240];
const REMS = [[null, 'Fără'], [0, 'La ora începerii'], [5, '5 min înainte'], [10, '10 min înainte'], [15, '15 min înainte'], [30, '30 min înainte'], [60, '1 oră înainte'], [1440, 'Cu o zi înainte']];

function openEditor(t, ds, preset = {}) {
  draft = t ? JSON.parse(JSON.stringify(t)) : {
    id: null, title: '', notes: '', date: todayStr(), time: '', duration: 0, priority: 2, cat: null, repeat: 'none',
    reminder: state.settings.reminder, subtasks: [], done: false, doneDates: [], ...preset,
  };
  draft._ds = ds;
  openSheet(editorHtml());
  if (!t) $('#f-title').focus();
}
function editorHtml() {
  const d = draft;
  const durs = DURS.includes(d.duration || 0) ? DURS : [...DURS, d.duration].sort((a, b) => a - b);
  return `<div class="sheet-head"><button class="link" data-act="close">Anulează</button><b>${d.id ? 'Detalii' : 'Task nou'}</b><button class="link strong" data-act="save">Salvează</button></div>
  <div class="sheet-body">
    <input id="f-title" class="big" placeholder="Ce ai de făcut?" value="${esc(d.title)}" enterkeyhint="done" autocomplete="off">
    <textarea id="f-notes" placeholder="Notițe, link-uri, detalii…">${esc(d.notes)}</textarea>
    <div class="card group">
      <label class="row"><span>📅 Data</span><input type="date" id="f-date" value="${d.date || ''}"></label>
      <div class="chips">
        <button class="chip" data-act="setdate" data-v="0">Azi</button>
        <button class="chip" data-act="setdate" data-v="1">Mâine</button>
        <button class="chip" data-act="setdate" data-v="7">Peste o săpt.</button>
        <button class="chip" data-act="setdate" data-v="">Cândva</button>
      </div>
      <label class="row"><span>⏰ Ora</span><input type="time" id="f-time" value="${d.time || ''}"></label>
      <label class="row"><span>⏱ Durată</span><select id="f-dur">${durs.map((m) => `<option value="${m}" ${m === (d.duration || 0) ? 'selected' : ''}>${m ? fmtDur(m) : '—'}</option>`).join('')}</select></label>
      <label class="row"><span>🔔 Memento</span><select id="f-rem">${REMS.map(([v, l]) => `<option value="${v}" ${d.reminder === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="row"><span>↻ Repetă</span><select id="f-rep">${Object.entries(REPEAT).map(([k, l]) => `<option value="${k}" ${d.repeat === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <div class="label">Prioritate</div>
    <div class="seg" id="f-prio">${[1, 2, 3].map((p) => `<button class="${d.priority === p ? 'on' : ''}" data-act="prio" data-v="${p}">${p === 3 ? '❗ ' : ''}${PRIO[p]}</button>`).join('')}</div>
    <div class="label">Categorie</div>
    <div class="chips" id="f-cats">
      <button class="chip ${!d.cat ? 'on' : ''}" data-act="pickcat" data-v="">Fără</button>
      ${state.cats.map((c) => `<button class="chip ${d.cat === c.id ? 'on' : ''}" data-act="pickcat" data-v="${c.id}" style="--c:${c.color}"><span class="sw"></span>${esc(c.name)}</button>`).join('')}
    </div>
    <div class="label">Pași mici</div>
    <div id="f-subs">${subsHtml()}</div>
    <div class="addsub"><input id="f-newsub" placeholder="Împarte taskul în pași…" enterkeyhint="enter" autocomplete="off"><button data-act="addsub" aria-label="Adaugă pas">+</button></div>
    ${d.id ? `<div class="actions">
      <button class="btn primary" data-act="ed-focus">▶ Pornește o sesiune de focus</button>
      ${!isRec(d) ? '<button class="btn" data-act="postpone">Amână pe mâine</button>' : ''}
      <button class="btn" data-act="ics-one">📅 Adaugă în Calendarul iPhone</button>
      <button class="btn" data-act="duplicate">Duplică</button>
      <button class="btn danger" data-act="delete">Șterge</button>
    </div>` : ''}
  </div>`;
}
function subsHtml() {
  const s = draft.subtasks || [];
  if (!s.length) return '';
  return `<div class="card subs">${s.map((x, i) => `<div class="sub ${x.done ? 'done' : ''}"><button class="check" data-act="subtoggle" data-i="${i}"></button><span>${esc(x.t)}</span><button class="x" data-act="subdel" data-i="${i}" aria-label="Șterge pasul">×</button></div>`).join('')}</div>`;
}
function syncDraft() {
  if (!draft || !$('#f-title')) return;
  draft.title = $('#f-title').value.trim();
  draft.notes = $('#f-notes').value;
  draft.date = $('#f-date').value || null;
  draft.time = $('#f-time').value || '';
  draft.duration = +$('#f-dur').value || 0;
  const r = $('#f-rem').value;
  draft.reminder = r === 'null' ? null : +r;
  draft.repeat = $('#f-rep').value;
}
function saveDraft() {
  syncDraft();
  if (!draft.title) { toast('Scrie un titlu'); $('#f-title').focus(); return; }
  if (isRec(draft) && !draft.date) draft.date = todayStr();
  const { _ds, ...clean } = draft;
  if (clean.id) {
    const i = state.tasks.findIndex((x) => x.id === clean.id);
    if (i >= 0) state.tasks[i] = clean;
  } else {
    clean.id = uid();
    clean.createdAt = Date.now();
    state.tasks.push(clean);
  }
  save();
  closeSheet();
  render();
}

let quickBase;
function openQuick(base) {
  quickBase = base;
  openSheet(`<div class="sheet-head"><button class="link" data-act="close">Gata</button><b>Adaugă rapid</b><button class="link strong" data-act="q-add">Adaugă</button></div>
  <div class="sheet-body">
    <input id="q" class="big" placeholder="ex: mâine la 18 sală #sport" autocomplete="off" enterkeyhint="send">
    <div id="q-prev" class="chips preview"></div>
    <div class="row-btns"><button class="btn" data-act="q-more">Mai multe opțiuni</button></div>
    <div class="hint">Scrie natural, eu înțeleg:<br>
      <code>azi</code> <code>mâine</code> <code>poimâine</code> <code>vineri</code> <code>12.11</code> <code>cândva</code><br>
      <code>la 15</code> <code>la 9:30</code> <code>la 8 seara</code> <code>14:00</code><br>
      <code>45min</code> <code>2h</code> · <code>!</code> = important · <code>#muncă</code><br>
      <code>zilnic</code> <code>săptămânal</code> <code>în fiecare lună</code> <code>în zilele lucrătoare</code><br>
      Poți adăuga mai multe unul după altul – apasă Enter după fiecare.</div>
    <div id="q-added"></div>
  </div>`);
  const inp = $('#q');
  inp.focus();
  inp.addEventListener('input', quickPreview);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); quickAdd(); } });
  quickPreview();
}
function quickPreview() {
  const v = $('#q').value;
  const p = parseQuick(v, quickBase);
  const c = cat(p.cat);
  const chips = [];
  chips.push(`<span class="chip">📅 ${p.date ? relDay(p.date) : 'Cândva'}</span>`);
  if (p.time) chips.push(`<span class="chip">⏰ ${p.time}</span>`);
  if (p.duration) chips.push(`<span class="chip">⏱ ${fmtDur(p.duration)}</span>`);
  if (p.repeat !== 'none') chips.push(`<span class="chip">↻ ${REPEAT[p.repeat]}</span>`);
  if (p.priority === 3) chips.push('<span class="chip" style="color:var(--danger)">❗ Important</span>');
  if (c) chips.push(`<span class="chip" style="--c:${c.color}"><span class="sw"></span>${esc(c.name)}</span>`);
  $('#q-prev').innerHTML = v.trim() ? chips.join('') : '';
}
function quickToTask(p) {
  return {
    id: uid(), title: p.title, notes: '', date: p.date, time: p.time || '', duration: p.duration || (p.time ? 30 : 0),
    priority: p.priority, cat: p.cat, repeat: p.repeat, reminder: p.time ? state.settings.reminder : null,
    subtasks: [], done: false, doneDates: [], createdAt: Date.now(),
  };
}
function quickAdd() {
  const inp = $('#q');
  const p = parseQuick(inp.value, quickBase);
  if (!p.title) { inp.focus(); return; }
  const t = quickToTask(p);
  state.tasks.push(t);
  save();
  $('#q-added').insertAdjacentHTML('afterbegin', `<div class="card" style="margin-top:8px">${taskRow(t, t.date || '', { showDate: true })}</div>`);
  inp.value = '';
  quickPreview();
  inp.focus();
  render();
}

// ---------- toast ----------
let toastTimer;
function toast(msg, actLabel, fn) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${actLabel ? `<button id="toast-btn">${esc(actLabel)}</button>` : ''}`;
  el.hidden = false;
  if (actLabel) $('#toast-btn').onclick = () => { el.hidden = true; fn(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, actLabel ? 5000 : 2200);
}

// ---------- calendar iPhone (.ics) ----------
const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDate = (ds) => ds.replace(/-/g, '');
function icsUtcStamp() { return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''); }
function vevent(t) {
  const L = ['BEGIN:VEVENT', `UID:${t.id}@ritm`, `DTSTAMP:${icsUtcStamp()}`, `SUMMARY:${icsEsc(t.title)}`];
  if (t.time) {
    const s = tMin(t.time), e = s + (t.duration || 30);
    const endDay = e >= 1440 ? addDays(t.date, 1) : t.date;
    L.push(`DTSTART:${icsDate(t.date)}T${t.time.replace(':', '')}00`, `DTEND:${icsDate(endDay)}T${minToT(e % 1440).replace(':', '')}00`);
  } else {
    L.push(`DTSTART;VALUE=DATE:${icsDate(t.date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(t.date, 1))}`);
  }
  const rr = { daily: 'FREQ=DAILY', weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY' }[t.repeat];
  if (rr) L.push(`RRULE:${rr}`);
  const desc = [t.notes, ...(t.subtasks || []).map((s) => `${s.done ? '☑' : '☐'} ${s.t}`)].filter(Boolean).join('\n');
  if (desc) L.push(`DESCRIPTION:${icsEsc(desc)}`);
  const rem = t.reminder != null ? t.reminder : (t.time ? state.settings.reminder : null);
  if (rem != null) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(t.title)}`, `TRIGGER:-PT${rem}M`, 'END:VALARM');
  else if (!t.time) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(t.title)}`, 'TRIGGER:PT9H', 'END:VALARM');
  L.push('END:VEVENT');
  return L;
}
function downloadIcs(tasks, name) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ritm//RO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  tasks.forEach((t) => lines.push(...vevent(t)));
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const file = new File([blob], name, { type: 'text/calendar' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: name }).catch(() => openBlob(blob, name));
  } else openBlob(blob, name);
}
function openBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ---------- notificări ----------
async function notify(title, body, tag) {
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    } else new Notification(title, { body, tag, icon: 'icons/icon-192.png' });
  } catch (e) { /* ignorăm */ }
}
function checkReminders() {
  if (!state.settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();
  const t = todayStr();
  let changed = false;
  for (const ds of [t, addDays(t, 1)]) {
    for (const x of tasksOn(ds)) {
      if (!x.time || x.reminder == null || isDone(x, ds)) continue;
      const start = parseYmd(ds); start.setHours(0, tMin(x.time), 0, 0);
      const at = start.getTime() - x.reminder * 60000;
      const key = `${x.id}|${ds}`;
      if (now >= at && now < start.getTime() + 10 * 60000 && !state.sent[key]) {
        state.sent[key] = 1; changed = true;
        notify(x.title, x.reminder ? `Începe la ${x.time}${x.reminder >= 60 ? '' : ` (în ${x.reminder} min)`}` : `Acum, la ${x.time}`, key);
      }
    }
  }
  if (changed) {
    const cutoff = addDays(t, -2);
    for (const k of Object.keys(state.sent)) if (k.split('|')[1] < cutoff) delete state.sent[k];
    save();
  }
}
function updateBadge() {
  if (!navigator.setAppBadge) return;
  const t = todayStr();
  const n = tasksOn(t).filter((x) => !isDone(x, t)).length + overdue().length;
  (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}

// ---------- cronometru focus ----------
let audioCtx;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((d) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d + 0.2);
      o.start(audioCtx.currentTime + d); o.stop(audioCtx.currentTime + d + 0.22);
    });
  } catch (e) { /* ignorăm */ }
}
function finishPhase() {
  const T = timerObj();
  if (T.mode === 'work') {
    const ds = todayStr(), mins = state.settings.work;
    state.focusLog[ds] = (state.focusLog[ds] || 0) + mins;
    const tk = T.taskId && findTask(T.taskId);
    if (tk) tk.focusMin = (tk.focusMin || 0) + mins;
    T.cycles++;
    T.mode = 'brk';
    T.left = state.settings.brk * 60;
    notify('Sesiune terminată 🎉', `Ia o pauză de ${state.settings.brk} minute.`, 'focus');
  } else {
    T.mode = 'work';
    T.left = state.settings.work * 60;
    notify('Pauza s-a terminat', 'Înapoi la treabă 💪', 'focus');
  }
  T.running = false;
  beep();
  save();
  if (ui.tab === 'focus' || ui.tab === 'azi') render();
}
function tick() {
  const T = state.timer;
  if (T && T.running) {
    if (Date.now() >= T.endAt) finishPhase();
    else if (ui.tab === 'focus') {
      const left = timerLeft();
      const el = $('#tm');
      if (el) el.textContent = `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
      const fg = $('.bigring .fg');
      if (fg) { const C = +fg.getAttribute('stroke-dasharray'); fg.setAttribute('stroke-dashoffset', C * (1 - left / timerTotal())); }
    }
  }
}

// ---------- evenimente ----------
const actions = {
  tab(el) { ui.tab = el.dataset.tab; if (ui.tab === 'cal') ui.calSel = ui.calSel || todayStr(); render(); window.scrollTo(0, 0); },
  fab() { openQuick(ui.tab === 'cal' ? ui.calSel : undefined); },
  toggle(el, id, ds) {
    const t = findTask(id); if (!t) return;
    toggleDone(t, ds || null);
    save(); render();
    const td = todayStr();
    if (isDone(t, ds || td)) {
      const list = tasksOn(td);
      if (list.length && list.every((x) => isDone(x, td)) && (ds === td || !ds)) toast('Ai terminat tot pe azi! 🎉');
      else toast('Bravo! ✓', 'Anulează', () => { toggleDone(t, ds || null); save(); render(); });
    }
  },
  edit(el, id, ds) { const t = findTask(id); if (t) openEditor(t, ds); },
  'move-today'(el, id) { const t = findTask(id); if (!t) return; t.date = todayStr(); save(); render(); toast('Mutat pe azi'); },
  'move-all-today'() { const n = overdue(); n.forEach((t) => { t.date = todayStr(); }); save(); render(); toast(`${n.length} mutate pe azi`); },
  'add-on'(el) { openQuick(el.dataset.d); },
  'focus-on'(el, id) { const T = timerObj(); T.taskId = id; ui.tab = 'focus'; if (!T.running) actions['t-start'](); else { save(); render(); } },
  'cal-prev'() { const d = parseYmd(ui.calMonth); d.setMonth(d.getMonth() - 1); ui.calMonth = ymd(d); render(); },
  'cal-next'() { const d = parseYmd(ui.calMonth); d.setMonth(d.getMonth() + 1); ui.calMonth = ymd(d); render(); },
  'cal-today'() { ui.calSel = todayStr(); ui.calMonth = todayStr().slice(0, 8) + '01'; render(); },
  'cal-day'(el) { ui.calSel = el.dataset.d; if (ui.calSel.slice(0, 7) !== ui.calMonth.slice(0, 7)) ui.calMonth = ui.calSel.slice(0, 8) + '01'; render(); },
  'list-mode'(el) { ui.listMode = el.dataset.v; render(); },
  'clear-done'() {
    const removed = state.tasks.filter((x) => !isRec(x) && x.done);
    state.tasks = state.tasks.filter((x) => isRec(x) || !x.done);
    save(); render();
    toast(`${removed.length} șterse`, 'Anulează', () => { state.tasks.push(...removed); save(); render(); });
  },
  // timer
  't-start'() {
    const T = timerObj();
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { /* */ }
    if (T.left <= 0) T.left = timerTotal();
    T.endAt = Date.now() + T.left * 1000; T.running = true; save(); render();
  },
  't-pause'() { const T = timerObj(); T.left = timerLeft(); T.running = false; save(); render(); },
  't-reset'() { const T = timerObj(); T.running = false; T.mode = 'work'; T.left = state.settings.work * 60; save(); render(); },
  't-skip'() {
    const T = timerObj();
    T.running = false;
    if (T.mode === 'work') { T.mode = 'brk'; T.left = state.settings.brk * 60; } else { T.mode = 'work'; T.left = state.settings.work * 60; }
    save(); render();
  },
  't-done-task'() {
    const T = timerObj(); const t = findTask(T.taskId); if (!t) return;
    if (T.running && T.mode === 'work') {
      const mins = Math.round((state.settings.work * 60 - timerLeft()) / 60);
      if (mins > 0) { state.focusLog[todayStr()] = (state.focusLog[todayStr()] || 0) + mins; t.focusMin = (t.focusMin || 0) + mins; }
      T.running = false; T.left = state.settings.work * 60;
    }
    if (!isDone(t, todayStr())) toggleDone(t, isRec(t) ? todayStr() : null);
    T.taskId = null; save(); render(); toast('Bravo! Task terminat 🎉');
  },
  // sheet
  close() { closeSheet(); },
  save() { saveDraft(); },
  setdate(el) { const v = el.dataset.v; $('#f-date').value = v === '' ? '' : addDays(todayStr(), +v); },
  prio(el) { draft.priority = +el.dataset.v; $$('#f-prio button').forEach((b) => b.classList.toggle('on', b === el)); },
  pickcat(el) { draft.cat = el.dataset.v || null; $$('#f-cats .chip').forEach((b) => b.classList.toggle('on', b === el)); },
  addsub() {
    const inp = $('#f-newsub'); const v = inp.value.trim(); if (!v) return;
    draft.subtasks = draft.subtasks || []; draft.subtasks.push({ t: v, done: false });
    inp.value = ''; $('#f-subs').innerHTML = subsHtml(); inp.focus();
  },
  subtoggle(el) { const s = draft.subtasks[+el.dataset.i]; s.done = !s.done; $('#f-subs').innerHTML = subsHtml(); },
  subdel(el) { draft.subtasks.splice(+el.dataset.i, 1); $('#f-subs').innerHTML = subsHtml(); },
  postpone() { syncDraft(); const base = draft.date && draft.date > todayStr() ? draft.date : todayStr(); $('#f-date').value = addDays(base, 1); saveDraft(); toast('Amânat pe ' + relDay(addDays(base, 1)).toLowerCase()); },
  'ed-focus'() { const id = draft.id; saveDraft(); actions['focus-on'](null, id); },
  'ics-one'() {
    syncDraft();
    if (!draft.date) { toast('Alege întâi o dată'); return; }
    const { _ds, ...t } = draft;
    downloadIcs([t], `${t.title.slice(0, 40).replace(/[^\p{L}\p{N} _-]/gu, '') || 'task'}.ics`);
  },
  duplicate() { syncDraft(); const { _ds, ...t } = draft; state.tasks.push({ ...JSON.parse(JSON.stringify(t)), id: uid(), done: false, doneDates: [], createdAt: Date.now(), focusMin: 0 }); save(); closeSheet(); render(); toast('Duplicat'); },
  delete() {
    const id = draft.id; const i = state.tasks.findIndex((x) => x.id === id); if (i < 0) return;
    const [removed] = state.tasks.splice(i, 1);
    save(); closeSheet(); render();
    toast('Task șters', 'Anulează', () => { state.tasks.splice(i, 0, removed); save(); render(); });
  },
  'q-add'() { quickAdd(); },
  'q-more'() {
    const v = $('#q').value;
    const p = parseQuick(v, quickBase);
    closeSheet();
    const t = quickToTask(p);
    openEditor(null, null, { ...t, id: null });
  },
  // setări
  async notif() {
    if (!('Notification' in window)) { toast('Instalează întâi aplicația pe ecranul principal'); return; }
    if (Notification.permission === 'granted') { state.settings.notify = !state.settings.notify; save(); render(); toast(state.settings.notify ? 'Notificări pornite' : 'Notificări oprite'); return; }
    const p = await Notification.requestPermission();
    state.settings.notify = p === 'granted'; save(); render();
    if (p === 'granted') { notify('Ritm', 'Notificările merg! 🔔', 'test'); } else toast('Permisiune refuzată – o poți activa din Setări iPhone');
  },
  'ics-all'() {
    const t = todayStr();
    const list = state.tasks.filter((x) => x.date && (isRec(x) || (!x.done && x.date >= t)));
    if (!list.length) { toast('Nimic de exportat'); return; }
    downloadIcs(list, 'ritm-taskuri.ics');
  },
  'cat-add'() { state.cats.push({ id: uid(), name: 'Categorie nouă', color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0') }); save(); render(); },
  'cat-del'(el) {
    const id = el.dataset.v;
    if (!confirm('Ștergi categoria? Taskurile rămân, dar fără categorie.')) return;
    state.cats = state.cats.filter((c) => c.id !== id);
    state.tasks.forEach((t) => { if (t.cat === id) t.cat = null; });
    save(); render();
  },
  export() {
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    const name = `ritm-backup-${todayStr()}.json`;
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file] }).catch(() => openBlob(blob, name));
    else openBlob(blob, name);
  },
  wipe() {
    if (!confirm('Sigur ștergi TOATE taskurile și setările? Nu se poate anula.')) return;
    state = seed(); state.tasks = []; save(); render(); toast('Totul a fost șters');
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const row = el.closest('[data-id]');
  e.preventDefault();
  const fn = actions[el.dataset.act];
  if (fn) fn(el, row ? row.dataset.id : null, row ? row.dataset.ds : null, e);
});
$('#backdrop').addEventListener('click', closeSheet);

document.addEventListener('input', (e) => {
  if (e.target.id === 'search') {
    ui.search = e.target.value;
    $('#listbody').innerHTML = viewList();
  }
});
document.addEventListener('change', (e) => {
  const el = e.target, S = state.settings;
  if (el.id === 'focus-task') { timerObj().taskId = el.value || null; save(); render(); return; }
  if (el.id === 's-rem') { S.reminder = el.value === 'null' ? null : +el.value; save(); return; }
  if (el.id === 's-work') { S.work = Math.min(120, Math.max(5, +el.value || 25)); const T = timerObj(); if (!T.running && T.mode === 'work') T.left = S.work * 60; save(); return; }
  if (el.id === 's-brk') { S.brk = Math.min(60, Math.max(1, +el.value || 5)); const T = timerObj(); if (!T.running && T.mode === 'brk') T.left = S.brk * 60; save(); return; }
  if (el.id === 's-hours') { S.dayHours = Math.min(18, Math.max(1, +el.value || 8)); save(); return; }
  if (el.dataset.catname) { const c = cat(el.dataset.catname); if (c) { c.name = el.value.trim() || c.name; save(); } return; }
  if (el.dataset.catcolor) { const c = cat(el.dataset.catcolor); if (c) { c.color = el.value; save(); } return; }
  if (el.id === 'import' && el.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const s = JSON.parse(r.result);
        if (!Array.isArray(s.tasks)) throw new Error('format');
        if (!confirm(`Restaurezi copia cu ${s.tasks.length} taskuri? Datele actuale vor fi înlocuite.`)) return;
        state = { cats: DEFAULT_CATS, focusLog: {}, timer: null, sent: {}, ...s, settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) } };
        save(); render(); toast('Copie restaurată ✓');
      } catch (err) { toast('Fișier invalid'); }
    };
    r.readAsText(el.files[0]);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'f-newsub') { e.preventDefault(); actions.addsub(); }
  if (e.key === 'Enter' && e.target.id === 'f-title') { e.preventDefault(); e.target.blur(); }
  if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();
});

let lastDay = todayStr();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (todayStr() !== lastDay) { lastDay = todayStr(); ui.calSel = lastDay; }
    tick(); checkReminders();
    if ($('#sheet').hidden) render();
  }
});

setInterval(tick, 1000);
setInterval(() => {
  checkReminders();
  if (todayStr() !== lastDay) { lastDay = todayStr(); ui.calSel = lastDay; if ($('#sheet').hidden) render(); }
  else if (ui.tab === 'azi' && $('#sheet').hidden) render();
}, 30000);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
tick();
checkReminders();
updateBadge();
