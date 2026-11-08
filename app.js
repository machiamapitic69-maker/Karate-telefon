'use strict';
/* Ritm – asistent personal: calendar + taskuri + planificare automată + remindere.
   Totul e salvat local pe telefon (localStorage). */

// ============================================================
// Utilitare
// ============================================================
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
const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m} min`);
const tsOf = (ds, min) => { const d = parseYmd(ds); d.setHours(0, min, 0, 0); return d.getTime(); };
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
const q = (s) => `„${s}”`;

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
  if (ds > t && ds <= addDays(t, 6)) return ZILE[d.getDay()];
  return `${ZS[d.getDay()]}, ${d.getDate()} ${LUNI[d.getMonth()].slice(0, 3)}`;
};
const REPEAT = { none: 'Niciodată', daily: 'Zilnic', weekdays: 'Zile lucrătoare', days: 'Anumite zile', weekly: 'Săptămânal', monthly: 'Lunar' };
const PRIO = { 1: 'Scăzută', 2: 'Normală', 3: 'Importantă' };

// ============================================================
// Stare
// ============================================================
// Ariile vieții (type = cum se socotește în echilibrul săptămânii)
const DEFAULT_CATS = [
  { id: 'academii', name: 'Academii', color: '#2563eb', type: 'work' },
  { id: 'reborn', name: 'REBORN SOCIETY', color: '#b8860b', type: 'work' },
  { id: 'competitii', name: 'Competiții', color: '#ef4444', type: 'work' },
  { id: 'admin', name: 'Admin & bani', color: '#64748b', type: 'work' },
  { id: 'sport', name: 'Antrenamentul meu', color: '#ff7a45', type: 'sport' },
  { id: 'sanatate', name: 'Sănătate & minte', color: '#22c55e', type: 'health' },
  { id: 'familie', name: 'Familie & relație', color: '#ec4899', type: 'personal' },
  { id: 'personal', name: 'Personal', color: '#a259ff', type: 'personal' },
];
// puncte de extensie folosite de os.js și sync.js
const EXT = { migrate: [], beforeSave: [], afterSave: [], nudges: [], reminders: [], meta: [], editor: [], sync: [], todayTop: [] };
const runMigrations = () => EXT.migrate.forEach((f) => f());
const DEFAULT_SETTINGS = {
  name: 'Andrei', maxWork: 50, minPersonal: 10,
  reminder: 10, work: 25, brk: 5, notify: false, dayHours: 8,
  dayStart: '08:00', dayEnd: '22:00', buffer: 10, defaultDur: 30,
  autoPlan: true, autoFollow: true, prepLead: 60,
  morning: '08:00', evening: '21:00',
  ntfyOn: false, ntfyTopic: '', ntfyServer: 'https://ntfy.sh',
};
const baseTask = () => ({
  id: uid(), title: '', notes: '', date: todayStr(), time: '', duration: 0, priority: 2, cat: null,
  kind: 'task', repeat: 'none', days: [], reminder: null, deadline: null, link: null, auto: false,
  postponed: 0, subtasks: [], done: false, doneDates: [], createdAt: Date.now(),
});
const subs = (arr) => arr.map((t) => ({ t, done: false }));

function seed() {
  return {
    tasks: [
      { ...baseTask(), seed: true, title: 'Bun venit 👋 Atinge cercul ca să bifezi', duration: 5 },
      { ...baseTask(), seed: true, title: 'Deschide Proiecte și scrie-ți primele 3 obiective', priority: 3, cat: 'personal', duration: 15 },
      { ...baseTask(), seed: true, title: 'Planifică ziua de mâine', time: '21:30', duration: 10, repeat: 'daily', reminder: 0, cat: 'personal', tpl: 'evening',
        subtasks: subs(['Bifează ce ai terminat', 'Mută restul pe mâine', 'Alege cele 3 lucruri importante']) },
    ],
    cats: DEFAULT_CATS.map((c) => ({ ...c })),
    focusLog: {}, settings: { ...DEFAULT_SETTINGS }, timer: null, sent: {}, pushed: {}, dismissed: {}, lastAutoPlan: null,
  };
}
function hydrate(s) {
  const st = {
    cats: DEFAULT_CATS.map((c) => ({ ...c })), focusLog: {}, timer: null, sent: {}, pushed: {}, dismissed: {}, lastAutoPlan: null,
    ...s, settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
  };
  st.tasks = st.tasks.map((t) => ({ ...baseTask(), ...t }));
  return st;
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.tasks)) return hydrate(s);
  } catch (e) { /* stocare indisponibilă */ }
  return seed();
}
let state = load();
let pushTimer;
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignorăm */ } }
function save() {
  EXT.beforeSave.forEach((f) => f());
  state.changedAt = Date.now();
  persist();
  EXT.afterSave.forEach((f) => f());
  updateBadge();
  clearTimeout(pushTimer);
  pushTimer = setTimeout(schedulePushes, 2500);
}

const ui = { tab: 'azi', calMonth: todayStr().slice(0, 8) + '01', calSel: todayStr(), listMode: 'plan', search: '' };

// ============================================================
// Logica taskurilor
// ============================================================
const isRec = (t) => t.repeat && t.repeat !== 'none';
const isEvent = (t) => t.kind === 'event';
const cat = (id) => state.cats.find((c) => c.id === id);
const findTask = (id) => state.tasks.find((t) => t.id === id);
const durOf = (t) => t.duration || (isEvent(t) ? 60 : state.settings.defaultDur);
const endMin = (t) => tMin(t.time) + durOf(t);

function occursOn(t, ds) {
  if (!t.date || ds < t.date) return false;
  if (!isRec(t)) return ds === t.date;
  const d = parseYmd(ds), s = parseYmd(t.date);
  switch (t.repeat) {
    case 'daily': return true;
    case 'weekdays': return d.getDay() > 0 && d.getDay() < 6;
    case 'days': return (t.days || []).includes(d.getDay());
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
const plannedMinutes = (ds) => tasksOn(ds).reduce((s, t) => s + (t.time || t.duration ? durOf(t) : 0), 0);

// legături între taskuri și întâlniri („pentru ședință”, „după întâlnire”)
const linkEvent = (t) => (t.link ? findTask(t.link.id) : null);
const linkedTo = (ev, ds, type) => state.tasks.filter((t) => t.link && t.link.id === ev.id && t.link.ds === ds && t.link.type === type);
function linkLabel(t) {
  const ev = linkEvent(t);
  if (!ev) return '';
  return `${t.link.type === 'before' ? 'pentru' : 'după'} ${ev.title}${ev.time ? ' ' + ev.time : ''}${t.link.ds !== todayStr() ? ' (' + relDay(t.link.ds).toLowerCase() + ')' : ''}`;
}
function moveTo(t, ds, countPostpone = true) {
  if (isRec(t)) return;
  if (countPostpone && t.date && ds > t.date) t.postponed = (t.postponed || 0) + 1;
  t.date = ds;
  if (t.auto) t.time = '';
}

// ============================================================
// Parser pentru adăugare rapidă (limbaj natural, română)
// ============================================================
const WD = { duminica: 0, luni: 1, marti: 2, miercuri: 3, joi: 4, vineri: 5, sambata: 6 };
const WD_A = { lunea: 1, martea: 2, miercurea: 3, joia: 4, vinerea: 5, duminicile: 0, sambetele: 6 };
const EVENT_WORDS = ['intalnir', 'sedint', 'meeting', 'call', 'apel', 'programar', 'interviu', 'doctor', 'dentist', 'medic', 'consult', 'curs', 'conferint', 'zbor', 'tren', 'nunta', 'petrecer', 'botez', 'eveniment', 'webinar', 'cina cu', 'pranz cu'];
function dateWord(n) {
  const t0 = todayStr();
  if (n === 'azi' || n === 'astazi' || n === 'diseara') return t0;
  if (n === 'maine') return addDays(t0, 1);
  if (n === 'poimaine') return addDays(t0, 2);
  if (n in WD) { const cur = new Date().getDay(); return addDays(t0, (WD[n] - cur + 7) % 7 || 7); }
  const m = n.match(/^(\d{1,2})[./](\d{1,2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) {
    const y = new Date().getFullYear();
    let ds = `${y}-${pad(+m[2])}-${pad(+m[1])}`;
    if (ds < t0) ds = `${y + 1}-${pad(+m[2])}-${pad(+m[1])}`;
    return ds;
  }
  return undefined;
}
const stemOf = (word) => norm(word).replace(/[^a-z0-9]/g, '').slice(0, 5);
function findEventByWord(word, type) {
  const stem = stemOf(word);
  if (stem.length < 3) return null;
  const t = todayStr(), nm = nowMin();
  const found = [];
  for (let i = 0; i < 14; i++) {
    const ds = addDays(t, i);
    for (const e of tasksOn(ds)) if (isEvent(e) && norm(e.title).replace(/[^a-z0-9 ]/g, '').split(' ').some((w) => w.startsWith(stem))) found.push({ e, ds });
  }
  if (!found.length) return null;
  if (type === 'before') return found.find(({ e, ds }) => ds > t || !e.time || tMin(e.time) > nm) || found[0];
  return found.find(({ ds }) => ds === t) || found[0];
}

function parseQuick(text, baseDate) {
  const res = { date: baseDate === undefined ? todayStr() : baseDate, time: null, priority: 2, cat: null, repeat: 'none', days: [], duration: null, title: '', kind: 'task', deadline: null, link: null, linkEv: null };
  const toks = text.trim().split(/\s+/).filter(Boolean);
  const keep = [];
  const timeRe = /^(\d{1,2})(?:[:.](\d{2}))?$/;
  const t0 = todayStr();
  let dateSet = false;
  for (let i = 0; i < toks.length; i++) {
    const raw = toks[i], n = norm(raw).replace(/[,;]$/, '');
    const next = toks[i + 1] ? norm(toks[i + 1]).replace(/[,;]$/, '') : '';
    const next2 = toks[i + 2] ? norm(toks[i + 2]).replace(/[,;]$/, '') : '';
    let m, d;
    // termen limită: „până vineri”
    if ((n === 'pana' || n === 'termen') && (d = dateWord(next)) !== undefined) { res.deadline = d; i++; continue; }
    // legătură cu o întâlnire: „pentru ședință”, „înainte de ședință”, „după întâlnire”
    if (n === 'pentru' || n === 'inainte' || n === 'dupa') {
      const type = n === 'dupa' ? 'after' : 'before';
      let j = i + 1;
      if (n === 'inainte' && next === 'de') j++;
      const w = toks[j] ? norm(toks[j]) : '';
      const hit = w && findEventByWord(w, type);
      if (hit) { res.link = { id: hit.e.id, ds: hit.ds, type }; res.linkEv = hit.e; i = j; continue; }
    }
    if ((d = dateWord(n)) !== undefined && !(n.includes('.') && toks[i - 1] && /^(la|ora)$/.test(norm(toks[i - 1])))) { res.date = d; dateSet = true; continue; }
    if (n === 'candva') { res.date = null; dateSet = true; continue; }
    if (n === 'zilnic') { res.repeat = 'daily'; continue; }
    if (n === 'saptamanal') { res.repeat = 'weekly'; continue; }
    if (n in WD_A) { res.repeat = 'days'; res.days.push(WD_A[n]); continue; }
    if (n === 'si' && res.repeat === 'days' && next in WD_A) continue;
    if (n === 'in' && next === 'fiecare') {
      if (next2 === 'zi') { res.repeat = 'daily'; i += 2; continue; }
      if (next2 === 'luna') { res.repeat = 'monthly'; i += 2; continue; }
      if (next2 === 'saptamana') { res.repeat = 'weekly'; i += 2; continue; }
      if (next2 in WD) { res.repeat = 'days'; res.days.push(WD[next2]); i += 2; continue; }
    }
    if (n === 'in' && next === 'zilele' && next2.startsWith('lucratoare')) { res.repeat = 'weekdays'; i += 2; continue; }
    if (n === 'lucratoare' || n === 'l-v') { res.repeat = 'weekdays'; continue; }
    if (/^!+\d?$/.test(n)) { res.priority = n === '!3' ? 1 : 3; continue; }
    if (raw.startsWith('@') && raw.length > 1) { res.delegatedTo = raw.slice(1).replace(/[,;.]$/, ''); res.delegatedTo = res.delegatedTo[0].toUpperCase() + res.delegatedTo.slice(1); continue; }
    if (n === 'urgent' || n === 'important') { res.priority = 3; keep.push(raw); continue; }
    if (n.startsWith('#') && n.length > 1) {
      const c = state.cats.find((c) => norm(c.name).startsWith(n.slice(1)));
      if (c) { res.cat = c.id; continue; }
    }
    if ((m = n.match(/^(\d+)(min|m)$/))) { res.duration = +m[1]; continue; }
    if ((m = n.match(/^(\d+(?:[.,]5)?)(h|ore)$/))) { res.duration = Math.round(parseFloat(m[1].replace(',', '.')) * 60); continue; }
    if (/^\d+$/.test(n) && /^(min|minute)$/.test(next)) { res.duration = +n; i++; continue; }
    if (/^\d+$/.test(n) && /^(ora|ore)$/.test(next) && norm(toks[i - 1] || '') !== 'la') { res.duration = +n * 60; i++; continue; }
    if ((n === 'la' || n === 'ora') && (m = next.match(timeRe)) && +m[1] < 24) {
      let h = +m[1]; const mm = m[2] ? +m[2] : 0;
      i++;
      if (/^(seara|pm|dupa-amiaza)$/.test(next2) && h < 12) { h += 12; i++; }
      else if (/^(dimineata|am)$/.test(next2)) { i++; }
      else if (!m[2] && h >= 1 && h <= 6) h += 12; // „la 5” => 17:00
      res.time = `${pad(h)}:${pad(mm)}`; continue;
    }
    if ((m = n.match(/^(\d{1,2}):(\d{2})$/)) && +m[1] < 24 && +m[2] < 60) { res.time = `${pad(+m[1])}:${m[2]}`; continue; }
    keep.push(raw);
  }
  res.title = keep.join(' ').trim();
  res.title = res.title.charAt(0).toUpperCase() + res.title.slice(1);
  const nt = ' ' + norm(res.title) + ' ';
  if (!res.link && EVENT_WORDS.some((w) => nt.includes(' ' + w))) res.kind = 'event';
  if (res.link && res.link.type === 'after' && !dateSet) res.date = res.link.ds;
  if (res.link && res.link.type === 'before' && !dateSet && res.link.ds < (res.date || t0)) res.date = res.link.ds;
  if (res.deadline && !dateSet) res.date = t0;
  if (res.repeat !== 'none' && !res.date) res.date = t0;
  if (res.repeat === 'days' && !res.days.length) res.repeat = 'none';
  return res;
}

// ============================================================
// Planificator automat
// ============================================================
function planDay(ds) {
  const S = state.settings;
  const isToday = ds === todayStr();
  const dayStart = tMin(S.dayStart), dayEnd = tMin(S.dayEnd);
  const start = isToday ? Math.max(dayStart, Math.ceil((nowMin() + 5) / 5) * 5) : dayStart;
  const buf = +S.buffer || 0;
  const busy = [];
  const cands = [];
  for (const t of tasksOn(ds)) {
    const done = isDone(t, ds);
    if (t.time && (isEvent(t) || !t.auto || done)) { busy.push([tMin(t.time), endMin(t)]); continue; }
    if (done || isEvent(t) || t.delegatedTo) continue;
    cands.push(t);
  }
  if (isToday) for (const t of overdue()) if (!isEvent(t) && !t.delegatedTo && !cands.includes(t)) cands.push(t);
  const info = cands.map((t) => {
    let earliest = start, latest = dayEnd;
    const ev = linkEvent(t);
    if (ev && t.link.ds === ds && ev.time) {
      if (t.link.type === 'after') earliest = Math.max(earliest, endMin(ev) + buf);
      else latest = Math.min(latest, tMin(ev.time) - buf);
    }
    const dl = t.deadline || (ev && t.link.type === 'before' ? t.link.ds : null) || '9999';
    return { t, earliest, latest, dur: durOf(t), dl };
  });
  info.sort((a, b) => (a.latest - b.latest) || a.dl.localeCompare(b.dl) || (b.t.priority - a.t.priority) || (a.t.date || '').localeCompare(b.t.date || '') || (a.dur - b.dur));
  const placed = [], overflow = [];
  for (const it of info) {
    busy.sort((a, b) => a[0] - b[0]);
    let s = Math.ceil(it.earliest / 5) * 5;
    for (const [b0, b1] of busy) {
      if (s + it.dur + buf <= b0) break;
      if (s < b1 + buf) s = Math.ceil((b1 + buf) / 5) * 5;
    }
    if (s + it.dur <= it.latest) {
      busy.push([s, s + it.dur]);
      placed.push({ t: it.t, time: minToT(s), dur: it.dur });
    } else overflow.push(it.t);
  }
  placed.sort((a, b) => a.time.localeCompare(b.time));
  return { ds, placed, overflow };
}
function applyPlan(plan, moveOverflow) {
  for (const p of plan.placed) {
    if (!isRec(p.t)) p.t.date = plan.ds;
    p.t.time = p.time;
    p.t.auto = true;
    if (!p.t.duration) p.t.duration = p.dur;
    if (p.t.reminder == null) p.t.reminder = state.settings.reminder;
  }
  if (moveOverflow) for (const t of plan.overflow) moveTo(t, addDays(plan.ds, 1));
  save();
}
function autoPlanToday(silent) {
  if (!state.settings.autoPlan) return null;
  const plan = planDay(todayStr());
  const changed = plan.placed.filter((p) => p.t.time !== p.time || p.t.date !== plan.ds);
  if (changed.length) applyPlan({ ...plan, placed: changed }, false);
  state.lastAutoPlan = todayStr();
  persist();
  if (!silent && changed.length === 1) toast(`✨ Am pus ${q(changed[0].t.title)} la ${changed[0].time}`);
  else if (!silent && changed.length > 1) toast(`✨ Am reorganizat programul (${changed.length} taskuri)`);
  return plan;
}

// ============================================================
// Asistentul: observații și sugestii
// ============================================================
function nudges() {
  const S = state.settings;
  const t = todayStr(), nm = nowMin(), out = [];
  const today = tasksOn(t).filter((x) => !x.delegatedTo);
  const open = today.filter((x) => !isDone(x, t));
  const add = (n) => { if (!state.dismissed[n.key]) out.push(n); };

  // 1. Pregătire pentru întâlniri care urmează
  for (const ds of [t, addDays(t, 1)]) {
    for (const ev of tasksOn(ds)) {
      if (!isEvent(ev) || !ev.time) continue;
      const mins = daysBetween(t, ds) * 1440 + tMin(ev.time) - nm;
      if (mins < -5 || mins > 26 * 60) continue;
      const prep = linkedTo(ev, ds, 'before').filter((x) => !isDone(x, ds));
      if (!prep.length) continue;
      add({
        key: `prep|${ev.id}|${ds}`, icon: '📌', tone: mins < 180 ? 'warn' : '', id: prep[0].id, ds,
        title: `Nu uita: ${prep.map((x) => q(esc(x.title))).join(', ')}`,
        body: `Trebuie gata pentru ${q(esc(ev.title))} – ${relDay(ds).toLowerCase()} la ${ev.time}${mins < 180 ? ` (în ${mins >= 60 ? fmtDur(mins) : mins + ' min'})` : ''}.`,
        actions: [{ act: 'focus-on', label: '▶ Lucrez acum' }, { act: 'toggle', label: '✓ E gata' }],
      });
    }
  }
  // 2. După întâlniri: follow-up
  for (const ev of today) {
    if (!isEvent(ev) || !ev.time) continue;
    const end = endMin(ev);
    if (nm < end || nm > end + 240) continue;
    const after = linkedTo(ev, t, 'after');
    const openAfter = after.filter((x) => !isDone(x, t));
    if (openAfter.length) {
      add({ key: `after|${ev.id}|${t}`, icon: '➡️', id: openAfter[0].id, ds: t, tone: 'warn',
        title: `S-a terminat ${q(esc(ev.title))}`, body: `Acum ai de făcut: ${openAfter.map((x) => q(esc(x.title))).join(', ')}.`,
        actions: [{ act: 'focus-on', label: '▶ Încep' }, { act: 'toggle', label: '✓ Gata' }] });
    } else if (!after.length) {
      add({ key: `follow|${ev.id}|${t}`, icon: '💬', id: ev.id, ds: t,
        title: `Cum a fost ${q(esc(ev.title))}?`, body: 'Ai ceva de făcut după? Notează acum, cât e proaspăt, ca să nu uiți.',
        actions: [{ act: 'followup', label: '+ Adaugă ce urmează' }, { act: 'dismiss', v: `follow|${ev.id}|${t}`, label: 'Nimic' }] });
    }
  }
  EXT.nudges.forEach((f) => f(add));
  // 3. Termene care se apropie
  for (const x of state.tasks) {
    if (!x.deadline || x.done || isRec(x)) continue;
    const dd = daysBetween(t, x.deadline);
    if (dd > 2) continue;
    add({ key: `dl|${x.id}|${t}`, icon: '⏳', tone: dd <= 0 ? 'warn' : '', id: x.id, ds: x.date || '',
      title: dd < 0 ? `Termen depășit: ${q(esc(x.title))}` : dd === 0 ? `Termen azi: ${q(esc(x.title))}` : `Termen ${relDay(x.deadline).toLowerCase()}: ${q(esc(x.title))}`,
      body: x.subtasks.length ? `Mai ai ${x.subtasks.filter((s) => !s.done).length} pași din ${x.subtasks.length}.` : 'Rezervă-ți timp pentru el azi.',
      actions: [{ act: 'focus-on', label: '▶ Lucrez acum' }, { act: 'edit', label: 'Detalii' }] });
  }
  // 4. Restanțe
  const od = overdue();
  if (od.length) add({ key: `od|${t}|${od.length}`, icon: '🕓', title: `Ai ${od.length === 1 ? 'o restanță' : od.length + ' restanțe'}`,
    body: od.slice(0, 3).map((x) => q(esc(x.title))).join(', ') + (od.length > 3 ? '…' : ''),
    actions: [{ act: 'move-all-today', label: 'Mută pe azi' }, { act: 'plan-day', label: '✨ Mută și planifică' }] });
  // 5. Zi supraîncărcată
  const freeLeft = Math.max(0, tMin(S.dayEnd) - Math.max(nm, tMin(S.dayStart)));
  const need = open.filter((x) => !x.time || tMin(x.time) >= nm).reduce((s, x) => s + durOf(x), 0);
  if (open.length > 2 && need > freeLeft + 15 && nm < tMin(S.dayEnd)) add({ key: `over|${t}`, icon: '⚖️', tone: 'warn',
    title: 'Ai mai mult decât încape azi', body: `Ai nevoie de ~${fmtDur(need)}, dar mai ai ${fmtDur(freeLeft)} până la ${S.dayEnd}. Mut pe mâine ce e mai puțin important?`,
    actions: [{ act: 'move-low', label: 'Mută prioritățile mici' }, { act: 'plan-day', label: '✨ Vezi planul' }] });
  // 6. Taskuri fără oră (când planificarea automată e oprită)
  const untimed = open.filter((x) => !x.time && !isEvent(x));
  if (!S.autoPlan && untimed.length >= 2) add({ key: `untimed|${t}|${untimed.length}`, icon: '🧩', title: `${untimed.length} taskuri n-au oră`,
    body: 'Le pun eu în golurile din program?', actions: [{ act: 'plan-day', label: '✨ Planifică-mi ziua' }] });
  // 7. Amânat de prea multe ori
  for (const x of state.tasks) {
    if (x.done || isRec(x) || (x.postponed || 0) < 3) continue;
    add({ key: `post|${x.id}|${x.postponed}`, icon: '🔁', id: x.id, ds: x.date || '',
      title: `Ai amânat ${q(esc(x.title))} de ${x.postponed} ori`, body: 'Poate e prea mare. Împarte-l în pași mici sau hotărăște dacă mai contează.',
      actions: [{ act: 'edit', label: 'Împarte în pași' }, { act: 'del-task', v: x.id, label: 'Renunț la el' }] });
  }
  // 8. Idei vechi din „Cândva”
  const stale = state.tasks.filter((x) => !x.date && !x.done && Date.now() - (x.createdAt || 0) > 10 * 86400000);
  if (stale.length) {
    const x = stale[0];
    add({ key: `stale|${x.id}|${t.slice(0, 7)}`, icon: '💡', id: x.id, ds: '',
      title: `${q(esc(x.title))} așteaptă de ${Math.floor((Date.now() - x.createdAt) / 86400000)} zile`, body: 'Îl planificăm sau renunți la el?',
      actions: [{ act: 'move-today', label: 'Azi' }, { act: 'move-tomorrow', v: x.id, label: 'Mâine' }, { act: 'del-task', v: x.id, label: 'Șterge' }] });
  }
  // 9. Seara: recapitulare + mâine
  if (nm >= tMin(S.evening)) {
    const left = open.filter((x) => !isRec(x) && !isEvent(x));
    if (left.length) add({ key: `eve|${t}`, icon: '🌙', title: `Recapitulare: ai bifat ${today.length - open.length} din ${today.length}`,
      body: `Ce n-ai terminat (${left.length}) mut pe mâine, ca să nu se piardă?`, actions: [{ act: 'eve-move', label: 'Mută pe mâine' }] });
    if (!tasksOn(addDays(t, 1)).filter((x) => !isRec(x)).length) add({ key: `tmr|${t}`, icon: '🗓', title: 'Mâine e încă gol', body: 'Două minute acum = o zi mai liniștită mâine.',
      actions: [{ act: 'add-on', v: addDays(t, 1), label: '+ Planifică mâine' }] });
  }
  // 10. Dimineața: rezumat
  if (nm < 12 * 60 && today.length) {
    const evs = today.filter(isEvent).length;
    const firstOpen = open[0];
    add({ key: `brief|${t}`, icon: '☀️', title: greeting(),
      body: `Azi ai ${evs ? (evs === 1 ? 'o întâlnire' : evs + ' întâlniri') + ' și ' : ''}${today.length - evs} taskuri (~${fmtDur(plannedMinutes(t))}).${firstOpen ? ` Începi cu ${q(esc(firstOpen.title))}${firstOpen.time ? ' la ' + firstOpen.time : ''}.` : ''}`,
      actions: [{ act: 'plan-day', label: '✨ Planifică-mi ziua' }] });
  }
  return out;
}
function greeting() {
  const h = new Date().getHours();
  const n = state.settings.name ? ', ' + state.settings.name : '';
  return h < 5 ? `Încă treaz${n}?` : h < 12 ? `Bună dimineața${n}` : h < 18 ? `Bună ziua${n}` : `Bună seara${n}`;
}
function nudgeCard(n) {
  return `<div class="nudge ${n.tone || ''}" ${n.id ? `data-id="${n.id}" data-ds="${n.ds || ''}"` : ''}>
    <div class="ni">${n.icon}</div>
    <div class="nb"><div class="nt">${n.title}</div>${n.body ? `<div class="nm">${n.body}</div>` : ''}
      <div class="na">${n.actions.map((a) => `<button data-act="${a.act}"${a.v != null ? ` data-v="${esc(a.v)}"` : ''}>${a.label}</button>`).join('')}</div></div>
    <button class="nx" data-act="dismiss" data-v="${esc(n.key)}" aria-label="Ascunde">×</button></div>`;
}

// ============================================================
// Remindere (notificări locale + push prin ntfy)
// ============================================================
function buildReminders(fromTs, toTs) {
  const S = state.settings, out = [];
  const t = todayStr();
  const push = (at, title, body, key) => { if (at >= fromTs && at <= toTs) out.push({ at, title, body, key: `${key}|${at}|${title}` }); };
  for (let i = 0; i <= 3; i++) {
    const ds = addDays(t, i);
    const list = tasksOn(ds).filter((x) => !x.delegatedTo);
    const open = list.filter((x) => !isDone(x, ds));
    EXT.reminders.forEach((f) => f(ds, push));
    if (S.morning && list.length) {
      const lines = open.slice(0, 8).map((x) => `${x.time ? x.time + ' ' : '• '}${x.title}`);
      push(tsOf(ds, tMin(S.morning)), `Planul de ${ds === t ? 'azi' : relDay(ds).toLowerCase()} 📋`, `${open.length === 1 ? 'Un lucru' : open.length + ' lucruri'}:\n${lines.join('\n')}${open.length > 8 ? '\n…' : ''}`, `brief|${ds}`);
    }
    if (S.evening) push(tsOf(ds, tMin(S.evening)), 'Recapitularea zilei 🌙', 'Bifează ce ai terminat și mută restul pe mâine, ca să nu uiți nimic.', `eve|${ds}`);
    for (const x of open) {
      const ev = linkEvent(x);
      if (x.time && x.reminder != null) {
        const prep = isEvent(x) ? linkedTo(x, ds, 'before').filter((p) => !isDone(p, ds)) : [];
        const lead = x.reminder ? `Începe în ${x.reminder >= 60 ? fmtDur(x.reminder) : x.reminder + ' min'}` : 'Acum';
        let body = `${lead}${x.duration ? ` · ${fmtDur(x.duration)}` : ''}.`;
        if (prep.length) body += ` Nu uita: ai de terminat ${prep.map((p) => q(p.title)).join(', ')}.`;
        if (ev && x.link.type === 'before') body += ` E pentru ${q(ev.title)}${ev.time ? ' de la ' + ev.time : ''}.`;
        if (ev && x.link.type === 'after') body += ` (după ${q(ev.title)})`;
        if (x.subtasks.length) body += ` Pași: ${x.subtasks.filter((s) => !s.done).map((s) => s.t).slice(0, 4).join(', ')}.`;
        push(tsOf(ds, tMin(x.time) - x.reminder), `⏰ ${x.time} · ${x.title}`, body, `task|${x.id}|${ds}`);
      }
      if (ev && ev.time && x.link.ds && (x.link.type === 'before' || !x.time)) {
        if (x.link.type === 'before') push(tsOf(x.link.ds, tMin(ev.time) - (+S.prepLead || 60)), `Nu uita: ${x.title}`, `Trebuie gata pentru ${q(ev.title)} de la ${ev.time}.`, `prep|${x.id}`);
        else push(tsOf(x.link.ds, endMin(ev)), `După ${ev.title}: ${x.title}`, 'Fă-o acum, cât e proaspăt.', `after|${x.id}`);
      }
    }
    for (const x of state.tasks) {
      if (x.deadline === ds && !x.done && !isRec(x) && S.morning) push(tsOf(ds, tMin(S.morning) + 1), `⏳ Termen azi: ${x.title}`, 'Nu-l lăsa pe ultima sută de metri.', `dl|${x.id}`);
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
async function notify(title, body, tag) {
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    } else new Notification(title, { body, tag, icon: 'icons/icon-192.png' });
  } catch (e) { /* ignorăm */ }
}
function checkReminders() {
  if (state.settings.ntfyOn) return; // push-ul vine prin ntfy
  if (!state.settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();
  let changed = false;
  for (const r of buildReminders(now - 10 * 60000, now)) {
    if (state.sent[r.key]) continue;
    state.sent[r.key] = r.at; changed = true;
    notify(r.title, r.body, r.key);
  }
  if (changed) {
    for (const [k, at] of Object.entries(state.sent)) if (typeof at !== 'number' || at < now - 3 * 86400000) delete state.sent[k];
    persist();
  }
}
const ntfyUrl = () => (state.settings.ntfyServer || 'https://ntfy.sh').replace(/\/+$/, '');
async function ntfySend(title, message, atTs) {
  const body = { topic: state.settings.ntfyTopic, title, message, tags: ['calendar'], priority: 4, click: location.href.split('#')[0] };
  if (atTs) body.delay = String(Math.floor(atTs / 1000));
  const r = await fetch(ntfyUrl() + '/', { method: 'POST', body: JSON.stringify(body) });
  if (!r.ok) throw new Error('ntfy ' + r.status);
  return r;
}
let pushing = false;
async function schedulePushes() {
  const S = state.settings;
  if (!S.ntfyOn || !S.ntfyTopic || pushing || !navigator.onLine) return;
  pushing = true;
  const now = Date.now();
  let sent = 0;
  try {
    for (const r of buildReminders(now + 20000, now + 70 * 3600000)) {
      if (state.pushed[r.key]) continue;
      if (sent >= 40) break;
      await ntfySend(r.title, r.body, r.at);
      state.pushed[r.key] = r.at; sent++;
    }
  } catch (e) { /* încercăm data viitoare */ }
  for (const [k, at] of Object.entries(state.pushed)) if (at < now - 86400000) delete state.pushed[k];
  persist();
  pushing = false;
}
function updateBadge() {
  if (!navigator.setAppBadge) return;
  const t = todayStr();
  const n = tasksOn(t).filter((x) => !isDone(x, t)).length + overdue().length;
  (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
}

// ============================================================
// Idei / șabloane
// ============================================================
function nextMonthDay(day) { const d = new Date(); if (d.getDate() > day) d.setMonth(d.getMonth() + 1); d.setDate(day); return ymd(d); }
const TEMPLATES = [
  { id: 'evening', icon: '🌙', name: 'Plan pentru mâine', desc: '10 minute seara: nu uiți nimic a doua zi', tasks: () => [{ title: 'Planifică ziua de mâine', time: '21:30', duration: 10, repeat: 'daily', cat: 'personal', reminder: 0, subtasks: subs(['Bifează ce ai terminat', 'Mută restul pe mâine', 'Alege cele 3 lucruri importante']) }] },
  { id: 'morning', icon: '🌅', name: 'Rutina de dimineață', desc: 'Pornește ziua cu planul în față', tasks: () => [{ title: 'Rutina de dimineață', time: '07:30', duration: 15, repeat: 'daily', cat: 'sanatate', reminder: 0, subtasks: subs(['Un pahar cu apă', '5 minute de mișcare', 'Citește planul de azi în Ritm']) }] },
  { id: 'inbox', icon: '📥', name: 'Email & mesaje la ore fixe', desc: 'De 2 ori pe zi, ca să nu te întrerupă tot timpul', tasks: () => [{ title: 'Răspunde la email și mesaje', time: '09:00', duration: 20, repeat: 'weekdays', cat: 'admin', reminder: 0 }, { title: 'Răspunde la email și mesaje', time: '16:30', duration: 20, repeat: 'weekdays', cat: 'admin', reminder: 0 }] },
  { id: 'academyrep', icon: '🥋', name: 'Raport săptămânal academii', desc: 'Luni la 9: prezențe, înscrieri, probleme pe fiecare locație', tasks: () => [{ title: 'Raport săptămânal academii', time: '09:00', duration: 45, repeat: 'days', days: [1], cat: 'academii', reminder: 0, subtasks: subs(['Prezențe pe fiecare locație', 'Înscrieri noi / retrageri', 'Grupe sub 15 sau peste 22', 'Abonamente care expiră', 'Probleme raportate de antrenori', 'Ce deleg săptămâna asta']) }] },
  { id: 'family', icon: '❤️', name: 'Timp protejat cu familia', desc: 'Seara de duminică și o seară în timpul săptămânii', tasks: () => [{ title: 'Timp cu familia / relația (fără telefon)', time: '19:00', duration: 150, repeat: 'days', days: [0, 3], cat: 'familie', kind: 'event', reminder: 30 }] },
  { id: 'weekly', icon: '🗓', name: 'Recapitulare săptămânală', desc: 'Duminică seara: ce a mers, ce urmează', tasks: () => [{ title: 'Recapitulare săptămânală', time: '18:00', duration: 30, repeat: 'days', days: [0], cat: 'personal', reminder: 0, subtasks: subs(['Ce am terminat săptămâna asta?', 'Ce a rămas și de ce?', 'Ce întâlniri am săptămâna viitoare?', 'Cele 3 obiective ale săptămânii']) }] },
  { id: 'sport', icon: '💪', name: 'Antrenamentul meu de 3 ori pe săptămână', desc: 'Luni, miercuri și vineri dimineața', tasks: () => [{ title: 'Antrenamentul meu', time: '07:00', duration: 75, repeat: 'days', days: [1, 3, 5], cat: 'sport', kind: 'event', reminder: 30 }] },
  { id: 'water', icon: '💧', name: 'Pauze & apă', desc: 'Ridică-te și bea apă la 11, 15 și 17', tasks: () => [11, 15, 17].map((h) => ({ title: 'Pauză: ridică-te și bea apă', time: `${h}:00`, duration: 5, repeat: 'daily', cat: 'sanatate', reminder: 0 })) },
  { id: 'bills', icon: '🧾', name: 'Facturi lunare', desc: 'Pe 1 ale lunii, cu listă de verificare', tasks: () => [{ title: 'Plătește facturile', date: nextMonthDay(1), time: '19:00', duration: 20, repeat: 'monthly', cat: 'personal', reminder: 0, subtasks: subs(['Curent', 'Gaz', 'Internet & telefon', 'Chirie / rată']) }] },
  { id: 'home', icon: '🧹', name: 'Curățenie de weekend', desc: 'Sâmbătă la 10, împărțită în pași', tasks: () => [{ title: 'Curățenie', time: '10:00', duration: 90, repeat: 'days', days: [6], cat: 'personal', reminder: 15, subtasks: subs(['Rufe', 'Aspirat', 'Baie', 'Bucătărie', 'Cumpărături pentru săptămână']) }] },
  { id: 'learn', icon: '📚', name: '20 de minute de învățat', desc: 'În zilele lucrătoare, seara', tasks: () => [{ title: 'Învăț ceva nou (20 min)', time: '20:00', duration: 20, repeat: 'weekdays', cat: 'personal', reminder: 0 }] },
];
const tplAdded = (id) => state.tasks.some((t) => t.tpl === id);

// ============================================================
// Randare
// ============================================================
const ICON_L = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
const ICON_R = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';

function repeatLabel(t) {
  if (t.repeat === 'days') return (t.days || []).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => ZS[d]).join(', ');
  return REPEAT[t.repeat];
}
function taskRow(t, ds, opts = {}) {
  const done = isDone(t, ds || null);
  const c = cat(t.cat);
  const meta = [];
  if (opts.showDate && t.date) meta.push(`<span class="${t.date < todayStr() && !done ? 'late' : ''}">${relDay(t.date)}</span>`);
  if (t.time && !opts.timeCol) meta.push(`<span>${t.time}–${minToT(endMin(t))}</span>`);
  else if (t.time && opts.timeCol) meta.push(`<span>până la ${minToT(endMin(t))}</span>`);
  else if (t.duration && !t.time) meta.push(`<span>⏱ ${fmtDur(t.duration)}</span>`);
  if (isEvent(t)) meta.push('<span class="evt">Întâlnire</span>');
  if (t.auto && t.time && !done) meta.push('<span title="Pus automat">✨ auto</span>');
  if (t.link && linkEvent(t)) meta.push(`<span class="lnk">🔗 ${esc(linkLabel(t))}</span>`);
  if (t.deadline && !done) meta.push(`<span class="${t.deadline <= todayStr() ? 'late' : ''}">⏳ până ${relDay(t.deadline).toLowerCase()}</span>`);
  if (isRec(t)) meta.push(`<span>↻ ${repeatLabel(t)}</span>`);
  if (t.subtasks && t.subtasks.length) meta.push(`<span>☑ ${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}</span>`);
  if (t.reminder != null && t.time) meta.push('<span>🔔</span>');
  if (t.notes) meta.push('<span>📝</span>');
  if (c) meta.push(`<span class="cat" style="--cc:${c.color}">${esc(c.name)}</span>`);
  if (t.focusMin) meta.push(`<span>⏱ ${fmtDur(t.focusMin)} focus</span>`);
  EXT.meta.forEach((f) => f(t, meta));
  return `<div class="task ${done ? 'done' : ''} ${opts.timeCol ? 'has-time' : ''} ${isEvent(t) ? 'is-event' : ''}" data-id="${t.id}" data-ds="${ds || ''}" style="--c:${c ? c.color : 'var(--muted)'}">
    ${opts.timeCol ? `<div class="timecol">${t.time || ''}</div>` : ''}
    <button class="check" data-act="toggle" aria-label="Bifează"></button>
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
  const list = tasksOn(t).filter((x) => !x.delegatedTo);
  const doneN = list.filter((x) => isDone(x, t)).length;
  const pct = list.length ? doneN / list.length : 0;
  const od = overdue();
  const nm = nowMin();
  const open = list.filter((x) => !isDone(x, t));
  const timedOpen = open.filter((x) => x.time);
  const next = timedOpen.find((x) => endMin(x) > nm && tMin(x.time) <= nm)
    || open.filter((x) => !x.time && x.priority === 3)[0]
    || timedOpen.find((x) => tMin(x.time) > nm)
    || open.filter((x) => !x.time)[0]
    || timedOpen[0];

  let nextHtml = '';
  if (next) {
    let lbl = 'Următorul pas';
    if (next.time) {
      const diff = tMin(next.time) - nm;
      lbl = diff <= 0 ? (diff + durOf(next) > 0 ? 'Acum' : 'Întârziat') : `Urmează în ${diff >= 60 ? fmtDur(diff) : diff + ' min'}`;
    }
    nextHtml = `<div class="next" data-id="${next.id}" data-ds="${t}">
      <div class="lbl">${lbl}</div>
      <div class="t">${isEvent(next) ? '📍 ' : ''}${esc(next.title)}</div>
      <div class="m">${next.time ? next.time + '–' + minToT(endMin(next)) : 'fără oră fixă'}${linkEvent(next) ? ' · ' + esc(linkLabel(next)) : ''}${next.subtasks.length ? ` · ${next.subtasks.filter((s) => s.done).length}/${next.subtasks.length} pași` : ''}</div>
      <div class="acts">
        <button data-act="toggle">✓ Gata</button>
        ${isEvent(next) ? '' : '<button data-act="focus-on">▶ Focus</button>'}
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

  const ns = nudges().slice(0, 2);
  const plan = plannedMinutes(t);
  return `
  <div class="hdr"><div><h1>Azi</h1><div class="sub">${greeting()} · ${fmtLong(t)}</div></div>
    <div class="hbtns"><button data-act="tab" data-tab="focus" aria-label="Focus">⏱</button><button data-act="plan-day" class="primary">✨ Planifică</button></div></div>
  ${EXT.todayTop.map((f) => f()).join('')}
  ${ns.length ? `<div class="nudges">${ns.map(nudgeCard).join('')}</div>` : ''}
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
  <div class="sec"><h2>${timed.length ? 'Fără oră' : 'De făcut azi'}</h2><button class="link" data-act="add-on" data-v="${t}">Adaugă</button></div>
  <div class="card">${untimed.length ? untimed.map((x) => taskRow(x, t)).join('') : `<div class="empty">${state.settings.autoPlan && timed.length ? 'Tot ce ai e deja în program ✨' : 'Nimic aici. Apasă + ca să adaugi.'}</div>`}</div>
  `;
}

function viewAssistant() {
  const S = state.settings;
  const ns = nudges();
  const pushState = S.ntfyOn && S.ntfyTopic ? '✅ Pornite' : S.notify && 'Notification' in window && Notification.permission === 'granted' ? '🟡 Doar cu aplicația deschisă' : 'Configurează';
  return `<div class="hdr"><div><h1>Asistent</h1><div class="sub">${greeting()}</div></div></div>
  <div class="card hero">
    <div class="hero-t">✨ Îți fac eu programul</div>
    <div class="hero-d">Pun taskurile în golurile dintre întâlniri, după priorități și termene, și țin cont de ce trebuie terminat înainte sau după fiecare întâlnire.</div>
    <div class="row-btns"><button class="btn primary" data-act="plan-day">Planifică-mi ziua</button><button class="btn" data-act="plan-tomorrow">Mâine</button></div>
    <label class="switch-row"><span>Planifică automat când adaug ceva</span><input type="checkbox" class="sw" id="s-autoplan" ${S.autoPlan ? 'checked' : ''}></label>
    <label class="switch-row"><span>La fiecare întâlnire, adaugă „ce urmează după”</span><input type="checkbox" class="sw" id="s-autofollow" ${S.autoFollow ? 'checked' : ''}></label>
  </div>

  <div class="sec"><h2>Ce ar trebui să știi</h2></div>
  ${ns.length ? `<div class="nudges">${ns.map(nudgeCard).join('')}</div>` : '<div class="card"><div class="empty">Totul e sub control ✓<br>Îți spun aici imediat ce ceva necesită atenție.</div></div>'}

  <div class="sec"><h2>Descarcă-ți mintea</h2></div>
  <button class="card dump" data-act="dump"><span class="big-ico">🧠</span><span><b>Scrie tot ce ai în cap</b><br><span class="muted">Câte un lucru pe rând. Eu le pun în calendar și în program.</span></span></button>

  <div class="sec"><h2>Remindere pe telefon</h2></div>
  <div class="card">
    <button class="row" data-act="push-setup"><span>📲 Notificări push</span><span class="link">${pushState}</span></button>
    <label class="row"><span>☀️ Planul zilei la</span><input type="time" id="s-morning" value="${S.morning}"></label>
    <label class="row"><span>🌙 Recapitulare seara la</span><input type="time" id="s-evening" value="${S.evening}"></label>
    <label class="row"><span>📌 „Nu uita” înainte de întâlniri</span><select id="s-prep">${[15, 30, 60, 120, 180].map((v) => `<option value="${v}" ${+S.prepLead === v ? 'selected' : ''}>${fmtDur(v)}</option>`).join('')}</select></label>
  </div>
  <div class="help">Primești dimineața lista cu tot ce ai de făcut, un reminder înainte de fiecare lucru, „nu uita” înainte de ședințe, ce ai de făcut după fiecare întâlnire și recapitularea de seară.</div>

  <div class="sec"><h2>Programul tău</h2></div>
  <div class="card">
    <label class="row"><span>Încep ziua la</span><input type="time" id="s-start" value="${S.dayStart}"></label>
    <label class="row"><span>Termin ziua la</span><input type="time" id="s-end" value="${S.dayEnd}"></label>
    <label class="row"><span>Pauză între lucruri</span><select id="s-buffer">${[0, 5, 10, 15, 20, 30].map((v) => `<option value="${v}" ${+S.buffer === v ? 'selected' : ''}>${v ? v + ' min' : 'fără'}</option>`).join('')}</select></label>
    <label class="row"><span>Durată implicită task</span><select id="s-defdur">${[15, 20, 30, 45, 60].map((v) => `<option value="${v}" ${+S.defaultDur === v ? 'selected' : ''}>${v} min</option>`).join('')}</select></label>
  </div>

  <div class="sec"><h2>Idei care te pot ajuta</h2></div>
  <div class="card">${TEMPLATES.map((tp) => `<div class="tpl"><span class="big-ico">${tp.icon}</span><div class="tb"><b>${tp.name}</b><div class="muted">${tp.desc}</div></div>
    ${tplAdded(tp.id) ? '<span class="added">Adăugat ✓</span>' : `<button class="mini" data-act="tpl" data-v="${tp.id}">Adaugă</button>`}</div>`).join('')}</div>
  <div class="help">După ce le adaugi le poți modifica: ora, zilele, pașii.</div>`;
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
    cells += `<button class="day ${d.getMonth() !== m ? 'out' : ''} ${ds === t ? 'today' : ''} ${ds === ui.calSel ? 'sel' : ''}" data-act="cal-day" data-v="${ds}">
      <span class="n">${d.getDate()}</span><span class="dots">${dots}</span></button>`;
  }
  const sel = ui.calSel;
  const list = tasksOn(sel);
  const plan = plannedMinutes(sel);
  const avail = tMin(state.settings.dayEnd) - tMin(state.settings.dayStart);
  const over = plan > Math.min(avail, state.settings.dayHours * 60);
  return `
  <div class="hdr"><div><h1>${LUNI[m][0].toUpperCase() + LUNI[m].slice(1)}</h1><div class="sub">${y}</div></div>
    <div class="calnav"><button data-act="cal-prev" aria-label="Luna anterioară">${ICON_L}</button><button class="link" data-act="cal-today" style="width:auto;padding:0 6px">Azi</button><button data-act="cal-next" aria-label="Luna următoare">${ICON_R}</button></div></div>
  <div class="card"><div class="grid">${cells}</div></div>
  <div class="sec"><h2>${sel === t ? 'Azi · ' : ''}${fmtLong(sel)}</h2><span><button class="link" data-act="plan-sel" style="margin-right:14px">✨ Planifică</button><button class="link" data-act="add-on" data-v="${sel}">Adaugă</button></span></div>
  ${plan ? `<div class="load ${over ? 'over' : ''}" style="margin:0 4px 8px">${over ? '⚠️ ' : ''}${fmtDur(plan)} planificate${over ? ' – e cam mult, poate muți ceva?' : ''}</div>` : ''}
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
  const qq = norm(ui.search.trim());
  const match = (x) => !qq || norm(x.title).includes(qq) || norm(x.notes || '').includes(qq);
  const seg = [['plan', 'Planificate'], ['someday', 'Cândva'], ['rut', 'Rutine'], ['done', 'Gata']]
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
    body = `<div class="help" style="padding:12px 4px 8px">Obiceiurile și întâlnirile repetate, ultimele 7 zile.</div><div class="card">${items.length ? items.map((x) => {
      const c = cat(x.cat), occ = occursOn(x, t), d = isDone(x, t);
      return `<div class="rut ${d ? 'done' : ''}" data-id="${x.id}" data-ds="${t}" style="--c:${c ? c.color : 'var(--accent)'}">
        ${occ ? '<button class="check" data-act="toggle"></button>' : '<span style="width:26px"></span>'}
        <div class="tbody" data-act="edit"><div class="ttl">${esc(x.title)}</div>
          <div class="meta"><span>↻ ${repeatLabel(x)}${x.time ? ' · ' + x.time : ''}</span></div><div class="rdots">${routineDots(x)}</div></div>
        <span class="streak">🔥 ${routineStreak(x)}</span></div>`;
    }).join('') : '<div class="empty">Nicio rutină. Vezi ideile din tab-ul Asistent.</div>'}</div>`;
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
function last7() { const out = []; for (let i = 6; i >= 0; i--) out.push(addDays(todayStr(), -i)); return out; }

function viewFocus() {
  const T = timerObj();
  const t = todayStr();
  const opts = tasksOn(t).concat(overdue()).filter((x) => !isDone(x, t) && !isEvent(x));
  if (T.taskId && !opts.find((x) => x.id === T.taskId)) { const tk = findTask(T.taskId); if (tk) opts.unshift(tk); }
  const left = timerLeft();
  const tk = T.taskId && findTask(T.taskId);
  return `<div class="hdr"><div><h1>Focus</h1><div class="sub">${state.settings.work} min lucru · ${state.settings.brk} min pauză</div></div><div class="hbtns"><button data-act="tab" data-tab="azi">Înapoi</button></div></div>
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
    ${tk && tk.subtasks.length ? `<div class="card subs" style="margin-top:20px;text-align:left;background:var(--card-2)">${tk.subtasks.map((s, i) => `<div class="sub ${s.done ? 'done' : ''}"><button class="check" data-act="fsub" data-v="${i}"></button><span>${esc(s.t)}</span></div>`).join('')}</div>` : ''}
    ${tk ? `<div style="margin-top:14px"><button class="btn block" data-act="t-done-task">✓ Am terminat ${q(esc(tk.title))}</button></div>` : ''}
  </div>
  <div class="kpis" style="margin-top:12px">
    <div class="kpi"><div class="v">${fmtDur(state.focusLog[t] || 0)}</div><div class="l">focus azi</div></div>
    <div class="kpi"><div class="v">${fmtDur(last7().reduce((s, d) => s + (state.focusLog[d] || 0), 0))}</div><div class="l">focus în 7 zile</div></div>
  </div>
  <div class="help" style="padding:12px 4px">Cronometrul merge corect și dacă ieși din aplicație, dar sunetul de final se aude doar cu ea deschisă.</div>`;
}

function viewStats() {
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
  return `<div class="kpis">
    <div class="kpi"><div class="v">🔥 ${streak()}</div><div class="l">zile la rând cu progres</div></div>
    <div class="kpi"><div class="v">${rate}%</div><div class="l">din ce ai planificat (${did}/${planned})</div></div>
    <div class="kpi"><div class="v">${counts.reduce((a, b) => a + b, 0)}</div><div class="l">lucruri bifate</div></div>
    <div class="kpi"><div class="v">${fmtDur(days.reduce((s, d) => s + (state.focusLog[d] || 0), 0))}</div><div class="l">timp de focus</div></div>
  </div>
  <div class="sec"><h2>Bifate pe zi</h2></div>
  <div class="card"><div class="bars">${days.map((d, i) => `<div class="b ${i === 6 ? 't' : ''}"><em>${counts[i] || ''}</em><i style="height:${(counts[i] / max) * 100}%"></i><span>${ZS[parseYmd(d).getDay()]}</span></div>`).join('')}</div></div>
  ${byCat.length ? `<div class="sec"><h2>Pe categorii</h2></div><div class="card">${byCat.map((o) => `<div class="catbar"><div class="top"><span>${esc(o.c.name)}</span><b>${o.n}</b></div><div class="track"><i style="width:${(o.n / catMax) * 100}%;--c:${o.c.color}"></i></div></div>`).join('')}</div>` : ''}`;
}

function viewSettings() {
  const S = state.settings;
  const notifState = !('Notification' in window) ? 'indisponibil' : Notification.permission === 'granted' && S.notify ? 'pornite' : Notification.permission === 'denied' ? 'blocate' : 'oprite';
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const remOpts = [[null, 'Fără'], [0, 'La ora începerii'], [5, '5 min înainte'], [10, '10 min înainte'], [15, '15 min înainte'], [30, '30 min înainte'], [60, '1 oră înainte']];
  return `${standalone ? '' : `<div class="sec"><h2>Instalează pe iPhone</h2></div>
  <div class="card howto"><b>Ca să o ai ca aplicație pe ecranul principal:</b><ol>
    <li>Deschide pagina în <b>Safari</b></li><li>Apasă butonul <b>Partajează</b> (pătratul cu săgeată)</li>
    <li>Alege <b>„Adaugă pe ecranul principal”</b></li><li>Deschide <b>Ritm</b> de pe ecranul principal</li></ol></div>`}

  <div class="sec"><h2>Setări</h2></div>
  <div class="card">
    <label class="row"><span>Numele tău</span><input id="s-name" value="${esc(S.name || '')}" placeholder="ex: Andrei"></label>
    <label class="row"><span>Max. ore de muncă / săpt.</span><input id="s-maxwork" type="number" inputmode="numeric" min="10" max="100" value="${S.maxWork}"></label>
    <label class="row"><span>Min. ore personale / săpt.</span><input id="s-minpers" type="number" inputmode="numeric" min="0" max="60" value="${S.minPersonal}"></label>
    <button class="row" data-act="notif"><span>🔔 Notificări în aplicație</span><span class="link">${notifState}</span></button>
    <label class="row"><span>Reminder implicit</span><select id="s-rem">${remOpts.map(([v, l]) => `<option value="${v}" ${S.reminder === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <button class="row" data-act="ics-all"><span>📅 Trimite tot în Calendarul iPhone</span><span class="link">.ics</span></button>
    <label class="row"><span>Durata focus (min)</span><input id="s-work" type="number" inputmode="numeric" min="5" max="120" value="${S.work}"></label>
    <label class="row"><span>Durata pauză (min)</span><input id="s-brk" type="number" inputmode="numeric" min="1" max="60" value="${S.brk}"></label>
    <label class="row"><span>Ore de lucru pe zi</span><input id="s-hours" type="number" inputmode="numeric" min="1" max="18" value="${S.dayHours}"></label>
  </div>

  <div class="sec"><h2>Categorii</h2></div>
  <div class="card">
    ${state.cats.map((c) => `<div class="row"><input type="color" value="${c.color}" data-catcolor="${c.id}"><input value="${esc(c.name)}" data-catname="${c.id}" style="text-align:left;color:var(--text)"><button class="link danger" data-act="cat-del" data-v="${c.id}">Șterge</button></div>`).join('')}
    <button class="row" data-act="cat-add"><span class="link">+ Categorie nouă</span></button>
  </div>

  <div class="sec"><h2>Date</h2></div>
  <div class="card">
    <button class="row" data-act="export"><span>⬇️ Salvează o copie de siguranță</span></button>
    <label class="row" style="cursor:pointer"><span>⬆️ Restaurează din copie</span><input type="file" id="import" accept="application/json,.json" style="display:none"></label>
    <button class="row" data-act="wipe"><span class="link danger">Șterge toate datele</span></button>
  </div>
  <div class="help">Datele stau doar pe telefonul tău. Fă din când în când o copie de siguranță (o poți pune în Fișiere / iCloud Drive).</div>
  <div class="help" style="text-align:center;padding:24px 0 0">Andrei OS · v3.0</div>`;
}

function render() {
  const v = $('#view');
  v.innerHTML = (VIEWS[ui.tab] || VIEWS.azi)();
  $$('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === ui.tab));
  $('#fab').hidden = ui.tab === 'focus' || ui.tab === 'eu';
  const badge = $('#asist-badge');
  if (badge) { const n = nudges().filter((x) => x.tone === 'warn').length; badge.textContent = n; badge.hidden = !n; }
}

// ============================================================
// Sheet-uri (editor, adăugare rapidă, plan, push)
// ============================================================
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
  pendingPlan = null;
}

let draft = null;
const DURS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240];
const REMS = [[null, 'Fără'], [0, 'La ora începerii'], [5, '5 min înainte'], [10, '10 min înainte'], [15, '15 min înainte'], [30, '30 min înainte'], [60, '1 oră înainte'], [120, '2 ore înainte'], [1440, 'Cu o zi înainte']];

function upcomingEvents() {
  const t = todayStr(), out = [];
  for (let i = -1; i < 14; i++) { const ds = addDays(t, i); for (const e of tasksOn(ds)) if (isEvent(e) && e.time) out.push({ e, ds }); }
  return out;
}
function openEditor(t, ds, preset = {}) {
  draft = t ? JSON.parse(JSON.stringify(t)) : { ...baseTask(), id: null, reminder: state.settings.reminder, ...preset };
  draft._ds = ds;
  openSheet(editorHtml());
  if (!t) { const i = $('#f-title'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
function editorHtml() {
  const d = draft;
  const durs = DURS.includes(d.duration || 0) ? DURS : [...DURS, d.duration].sort((a, b) => a - b);
  const evs = upcomingEvents().filter(({ e }) => e.id !== d.id);
  const linkVal = d.link ? `${d.link.type}|${d.link.id}|${d.link.ds}` : '';
  if (d.link && !evs.find(({ e, ds }) => e.id === d.link.id && ds === d.link.ds)) { const e = findTask(d.link.id); if (e) evs.unshift({ e, ds: d.link.ds }); }
  const evDs = d._ds || d.date;
  const linkedHere = d.id && isEvent(d) && d.time ? linkedTo(d, evDs, 'before').concat(linkedTo(d, evDs, 'after')) : [];
  return `<div class="sheet-head"><button class="link" data-act="close">Anulează</button><b>${d.id ? 'Detalii' : 'Nou'}</b><button class="link strong" data-act="save">Salvează</button></div>
  <div class="sheet-body">
    <div class="seg" id="f-kind" style="margin-bottom:12px">
      <button class="${!isEvent(d) ? 'on' : ''}" data-act="kind" data-v="task">✓ De făcut</button>
      <button class="${isEvent(d) ? 'on' : ''}" data-act="kind" data-v="event">📍 Întâlnire</button>
    </div>
    <input id="f-title" class="big" placeholder="${isEvent(d) ? 'ex: Ședință cu echipa' : 'Ce ai de făcut?'}" value="${esc(d.title)}" enterkeyhint="done" autocomplete="off">
    <textarea id="f-notes" placeholder="Notițe, adresă, link-uri, detalii…">${esc(d.notes)}</textarea>
    <div class="card group">
      <label class="row"><span>📅 Data</span><input type="date" id="f-date" value="${d.date || ''}"></label>
      <div class="chips">
        <button class="chip" data-act="setdate" data-v="0">Azi</button>
        <button class="chip" data-act="setdate" data-v="1">Mâine</button>
        <button class="chip" data-act="setdate" data-v="7">Peste o săpt.</button>
        <button class="chip" data-act="setdate" data-v="">Cândva</button>
      </div>
      <label class="row"><span>⏰ Ora</span><input type="time" id="f-time" value="${d.time || ''}"></label>
      ${d.auto && d.time ? '<div class="help" style="padding:0 16px 10px">✨ Ora a fost pusă automat. Dacă o schimbi, rămâne fixă.</div>' : ''}
      ${!d.time && !isEvent(d) && state.settings.autoPlan ? '<div class="help" style="padding:0 16px 10px">Lasă ora goală și ți-o aleg eu ✨</div>' : ''}
      <label class="row"><span>⏱ Durată</span><select id="f-dur">${durs.map((m) => `<option value="${m}" ${m === (d.duration || 0) ? 'selected' : ''}>${m ? fmtDur(m) : 'automat'}</option>`).join('')}</select></label>
      <label class="row"><span>🔔 Reminder</span><select id="f-rem">${REMS.map(([v, l]) => `<option value="${v}" ${d.reminder === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="row"><span>↻ Repetă</span><select id="f-rep">${Object.entries(REPEAT).map(([k, l]) => `<option value="${k}" ${d.repeat === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="chips" id="f-days" ${d.repeat === 'days' ? '' : 'hidden'}>${[1, 2, 3, 4, 5, 6, 0].map((n) => `<button class="chip ${(d.days || []).includes(n) ? 'on' : ''}" data-act="day" data-v="${n}">${ZS[n]}</button>`).join('')}</div>
    </div>
    ${!isEvent(d) ? `<div class="card group">
      <label class="row"><span>⏳ Termen limită</span><input type="date" id="f-deadline" value="${d.deadline || ''}"></label>
      <label class="row"><span>🔗 Legat de</span><select id="f-link"><option value="">— nimic —</option>
        ${evs.map(({ e, ds }) => ['before', 'after'].map((ty) => { const v = `${ty}|${e.id}|${ds}`; return `<option value="${v}" ${v === linkVal ? 'selected' : ''}>${ty === 'before' ? 'Înainte de' : 'După'}: ${esc(e.title)} (${relDay(ds).toLowerCase()} ${e.time})</option>`; }).join('')).join('')}
      </select></label>
    </div>
    <div class="help">„Înainte de” o întâlnire = îți amintesc să-l termini până atunci. „După” = îți amintesc imediat ce se termină întâlnirea.</div>` : ''}
    ${d.id && isEvent(d) && d.time ? `<div class="label">Legat de această întâlnire</div>
      <div class="card">${linkedHere.map((x) => taskRow(x, evDs)).join('') || '<div class="empty" style="padding:14px">Nimic încă.</div>'}</div>
      <div class="row-btns"><button class="btn" data-act="ev-prep">+ De pregătit înainte</button><button class="btn" data-act="ev-after">+ De făcut după</button></div>` : ''}
    ${EXT.editor.map((f) => f(d)).join('')}
    <div class="label">Importanță</div>
    <div class="seg" id="f-prio">${[1, 2, 3].map((p) => `<button class="${d.priority === p ? 'on' : ''}" data-act="prio" data-v="${p}">${p === 3 ? '❗ ' : ''}${PRIO[p]}</button>`).join('')}</div>
    <div class="label">Categorie</div>
    <div class="chips" id="f-cats">
      <button class="chip ${!d.cat ? 'on' : ''}" data-act="pickcat" data-v="">Fără</button>
      ${state.cats.map((c) => `<button class="chip ${d.cat === c.id ? 'on' : ''}" data-act="pickcat" data-v="${c.id}" style="--c:${c.color}"><span class="sw"></span>${esc(c.name)}</button>`).join('')}
    </div>
    <div class="label">${isEvent(d) ? 'De luat / de discutat' : 'Pași mici'}</div>
    <div id="f-subs">${subsHtml()}</div>
    <div class="addsub"><input id="f-newsub" placeholder="${isEvent(d) ? 'ex: laptopul, întrebarea despre buget…' : 'Împarte taskul în pași…'}" enterkeyhint="enter" autocomplete="off"><button data-act="addsub" aria-label="Adaugă pas">+</button></div>
    ${d.id ? `<div class="actions">
      ${!isEvent(d) ? '<button class="btn primary" data-act="ed-focus">▶ Pornește o sesiune de focus</button>' : ''}
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
  return `<div class="card subs">${s.map((x, i) => `<div class="sub ${x.done ? 'done' : ''}"><button class="check" data-act="subtoggle" data-v="${i}"></button><span>${esc(x.t)}</span><button class="x" data-act="subdel" data-v="${i}" aria-label="Șterge pasul">×</button></div>`).join('')}</div>`;
}
function syncDraft() {
  if (!draft || !$('#f-title')) return;
  draft.title = $('#f-title').value.trim();
  draft.notes = $('#f-notes').value;
  draft.date = $('#f-date').value || null;
  const newTime = $('#f-time').value || '';
  if (newTime !== (draft.time || '')) draft.auto = false;
  draft.time = newTime;
  draft.duration = +$('#f-dur').value || 0;
  const r = $('#f-rem').value;
  draft.reminder = r === 'null' ? null : +r;
  draft.repeat = $('#f-rep').value;
  if ($('#f-deadline')) draft.deadline = $('#f-deadline').value || null;
  EXT.sync.forEach((f) => f(draft));
  if ($('#f-link')) {
    const v = $('#f-link').value;
    if (v) { const [type, id, ds] = v.split('|'); draft.link = { type, id, ds }; } else draft.link = null;
  }
}
function saveDraft(silent) {
  syncDraft();
  if (!draft.title) { toast('Scrie un titlu'); $('#f-title').focus(); return null; }
  if (isRec(draft) && !draft.date) draft.date = todayStr();
  if (draft.repeat === 'days' && !(draft.days || []).length) draft.repeat = 'none';
  if (isEvent(draft)) { draft.link = null; draft.deadline = null; }
  const { _ds, ...clean } = draft;
  const isNew = !clean.id;
  if (!isNew) {
    const i = state.tasks.findIndex((x) => x.id === clean.id);
    if (i >= 0) state.tasks[i] = clean;
  } else {
    clean.id = uid();
    clean.createdAt = Date.now();
    state.tasks.push(clean);
  }
  closeSheet();
  afterAdd([clean], isNew, silent);
  return clean;
}
// după ce se adaugă/modifică ceva: follow-up automat + replanificare
function afterAdd(tasks, isNew, silent) {
  const S = state.settings;
  if (isNew && S.autoFollow) {
    for (const t of tasks) {
      if (!isEvent(t) || !t.time || !t.date || isRec(t)) continue;
      if (linkedTo(t, t.date, 'after').length) continue;
      state.tasks.push({ ...baseTask(), title: `Notează ce urmează după: ${t.title}`, date: t.date, duration: 10, cat: t.cat, link: { id: t.id, ds: t.date, type: 'after' }, reminder: null,
        subtasks: subs(['Ce s-a hotărât?', 'Ce am eu de făcut și până când?', 'Trimite rezumatul / mulțumirea']) });
    }
  }
  save();
  const td = todayStr();
  if (tasks.some((t) => (t.date && t.date <= td) || (isRec(t) && occursOn(t, td)))) autoPlanToday(silent);
  render();
}

// adăugare rapidă
let quickBase, quickPreset;
function openQuick(base, preset) {
  quickBase = base; quickPreset = preset || null;
  const ev = preset && preset.link ? findTask(preset.link.id) : null;
  const title = preset && preset.title ? esc(preset.title) : ev ? `${preset.link.type === 'before' ? 'Pentru' : 'După'} ${esc(ev.title)}` : 'Adaugă rapid';
  openSheet(`<div class="sheet-head"><button class="link" data-act="close">Gata</button><b class="ellipsis">${title}</b><button class="link strong" data-act="q-add">Adaugă</button></div>
  <div class="sheet-body">
    <input id="q" class="big" placeholder="${ev ? (preset.link.type === 'before' ? 'ex: pregătesc slide-urile 1h' : 'ex: trimit oferta până vineri') : 'ex: mâine la 18 sală #sport'}" autocomplete="off" enterkeyhint="send">
    <div id="q-prev" class="chips preview"></div>
    <div class="row-btns"><button class="btn" data-act="q-more">Mai multe opțiuni</button></div>
    <div class="hint">Scrie natural, eu înțeleg:<br>
      <code>azi</code> <code>mâine</code> <code>vineri</code> <code>12.11</code> <code>cândva</code> <code>până vineri</code><br>
      <code>la 15</code> <code>la 9:30</code> <code>la 8 seara</code> <code>14:00</code> <code>45min</code> <code>2h</code><br>
      <code>ședință</code> <code>întâlnire</code> <code>doctor</code> → devine întâlnire<br>
      <code>pentru ședință</code> <code>după întâlnire</code> → îl leg de întâlnire<br>
      <code>!</code> = important · <code>#muncă</code> · <code>zilnic</code> <code>lunea și joia</code><br>
      Fără oră? Ți-o aleg eu ✨ · Enter după fiecare, ca să adaugi mai multe.</div>
    <div id="q-added"></div>
  </div>`);
  const inp = $('#q');
  inp.focus();
  inp.addEventListener('input', quickPreview);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); quickAdd(); } });
  quickPreview();
}
function quickParse(v) {
  const p = parseQuick(v, quickBase);
  if (quickPreset && quickPreset.fields) { p.fields = quickPreset.fields; if (!p.cat && quickPreset.fields.cat) p.cat = quickPreset.fields.cat; }
  if (quickPreset && quickPreset.link && !p.link) {
    p.link = quickPreset.link; p.linkEv = findTask(quickPreset.link.id); p.kind = 'task';
    if (p.link.type === 'after' && p.date === quickBase) p.date = p.link.ds;
  }
  return p;
}
function previewChips(p) {
  const c = cat(p.cat), chips = [];
  if (p.kind === 'event') chips.push('<span class="chip on">📍 Întâlnire</span>');
  chips.push(`<span class="chip">📅 ${p.date ? relDay(p.date) : 'Cândva'}</span>`);
  if (p.time) chips.push(`<span class="chip">⏰ ${p.time}</span>`);
  else if (p.date && p.date <= todayStr() && p.kind !== 'event' && state.settings.autoPlan) chips.push('<span class="chip">✨ oră automată</span>');
  if (p.duration) chips.push(`<span class="chip">⏱ ${fmtDur(p.duration)}</span>`);
  if (p.deadline) chips.push(`<span class="chip">⏳ până ${relDay(p.deadline).toLowerCase()}</span>`);
  if (p.delegatedTo) chips.push(`<span class="chip">👤 delegat: ${esc(p.delegatedTo)}</span>`);
  if (p.fields && p.fields.goal) { const g = (state.goals || []).find((x) => x.id === p.fields.goal); if (g) chips.push(`<span class="chip">🎯 ${esc(g.title)}</span>`); }
  if (p.fields && p.fields.project) { const pr = (state.projects || []).find((x) => x.id === p.fields.project); if (pr) chips.push(`<span class="chip">📁 ${esc(pr.title)}</span>`); }
  if (p.linkEv) chips.push(`<span class="chip">🔗 ${p.link.type === 'before' ? 'pentru' : 'după'} ${esc(p.linkEv.title)}</span>`);
  if (p.repeat !== 'none') chips.push(`<span class="chip">↻ ${p.repeat === 'days' ? p.days.map((d) => ZS[d]).join(', ') : REPEAT[p.repeat]}</span>`);
  if (p.priority === 3) chips.push('<span class="chip" style="color:var(--danger)">❗ Important</span>');
  if (c) chips.push(`<span class="chip" style="--c:${c.color}"><span class="sw"></span>${esc(c.name)}</span>`);
  return chips.join('');
}
function quickPreview() {
  const v = $('#q').value;
  $('#q-prev').innerHTML = v.trim() ? previewChips(quickParse(v)) : '';
}
function quickToTask(p) {
  return {
    ...baseTask(), title: p.title, date: p.date, time: p.time || '', duration: p.duration || (p.kind === 'event' ? 60 : 0),
    priority: p.priority, cat: p.cat, repeat: p.repeat, days: p.days, kind: p.kind, deadline: p.deadline, link: p.link,
    reminder: p.kind === 'event' ? Math.max(15, state.settings.reminder || 0) : state.settings.reminder,
    ...(p.delegatedTo ? { delegatedTo: p.delegatedTo, followUp: p.deadline || addDays(todayStr(), 2) } : {}),
    ...(p.fields || {}), cat: p.cat,
  };
}
function quickAdd() {
  const inp = $('#q');
  const p = quickParse(inp.value);
  if (!p.title) { inp.focus(); return; }
  const t = quickToTask(p);
  state.tasks.push(t);
  afterAdd([t], true, true);
  const fresh = findTask(t.id);
  let html = `<div class="card" style="margin-top:8px">${taskRow(fresh, fresh.date || '', { showDate: true })}</div>`;
  if (isEvent(t) && t.time && state.settings.autoFollow && !isRec(t)) html += '<div class="help" style="padding:6px 4px 0">✨ Am adăugat și „ce urmează după” – îți amintesc când se termină.</div>';
  $('#q-added').insertAdjacentHTML('afterbegin', html);
  inp.value = '';
  quickPreview();
  inp.focus();
}

// descărcare mentală (mai multe lucruri deodată)
function openDump() {
  openSheet(`<div class="sheet-head"><button class="link" data-act="close">Anulează</button><b>Descarcă-ți mintea</b><button class="link strong" data-act="dump-add">Adaugă tot</button></div>
  <div class="sheet-body">
    <textarea id="dump" style="min-height:230px;margin-top:0;font-size:17px" placeholder="Câte un lucru pe rând, de ex:
ședință cu echipa la 11
pregătesc prezentarea pentru ședință 1h !
după ședință trimit rezumatul
sun la bancă
cumpărături mâine la 7 seara
cadou pentru mama până vineri
cândva vopsit gardul"></textarea>
    <div id="dump-prev" class="dump-prev"></div>
    <div class="hint">Le leg singur: ce scrii cu „pentru ședință” îți amintesc să termini înainte, ce scrii cu „după ședință” îți amintesc după. Ce e pentru azi și n-are oră îl pun în golurile din program.</div>
  </div>`);
  $('#dump').focus();
  $('#dump').addEventListener('input', dumpPreview);
}
function dumpPreview() {
  const lines = $('#dump').value.split('\n').map((l) => l.trim()).filter(Boolean);
  $('#dump-prev').innerHTML = lines.length ? `<div class="help" style="padding:8px 4px">${lines.length} ${lines.length === 1 ? 'lucru' : 'lucruri'}</div>` : '';
}
function dumpAdd() {
  const lines = $('#dump').value.split('\n').map((l) => l.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);
  if (!lines.length) return;
  // întâi întâlnirile, ca restul să se poată lega de ele
  const evLines = lines.filter((l) => parseQuick(l).kind === 'event');
  const rest = lines.filter((l) => !evLines.includes(l));
  const added = [];
  for (const l of evLines.concat(rest)) {
    const p = parseQuick(l);
    if (!p.title) continue;
    const t = quickToTask(p);
    state.tasks.push(t); added.push(t);
  }
  closeSheet();
  ui.tab = 'azi';
  afterAdd(added, true, true);
  const linked = added.filter((t) => t.link).length;
  toast(`✓ ${added.length} lucruri adăugate${linked ? `, ${linked} legate de întâlniri` : ''}${state.settings.autoPlan ? ' · program refăcut ✨' : ''}`);
}

// previzualizare plan
let pendingPlan = null;
function openPlan(ds) {
  const plan = planDay(ds);
  pendingPlan = plan;
  const fixed = tasksOn(ds).filter((t) => t.time && (isEvent(t) || !t.auto || isDone(t, ds)));
  const rows = [...fixed.map((t) => ({ t, time: t.time, fixed: true })), ...plan.placed.map((p) => ({ ...p, fixed: false }))].sort((a, b) => a.time.localeCompare(b.time));
  openSheet(`<div class="sheet-head"><button class="link" data-act="close">Anulează</button><b>Plan · ${relDay(ds)}</b><button class="link strong" data-act="plan-apply">Aplică</button></div>
  <div class="sheet-body">
    ${plan.placed.length ? `<div class="help" style="padding:0 4px 10px">Am pus ${plan.placed.length} ${plan.placed.length === 1 ? 'lucru' : 'lucruri'} în golurile din program (✨). Întâlnirile și orele puse de tine rămân neschimbate.</div>` : '<div class="help" style="padding:0 4px 10px">Nu am ce muta – totul are deja o oră.</div>'}
    <div class="card plan">${rows.map((r) => {
      const end = minToT(tMin(r.time) + (r.dur || durOf(r.t)));
      return `<div class="prow ${r.fixed ? 'fixed' : 'new'} ${isEvent(r.t) ? 'ev' : ''}"><div class="pt">${r.time}<small>${end}</small></div><div class="pb"><div>${r.fixed ? (isEvent(r.t) ? '📍 ' : '') : '✨ '}${esc(r.t.title)}</div>
        ${linkEvent(r.t) ? `<small>🔗 ${esc(linkLabel(r.t))}</small>` : r.t.deadline ? `<small>⏳ până ${relDay(r.t.deadline).toLowerCase()}</small>` : ''}</div></div>`;
    }).join('') || '<div class="empty">Nimic de planificat.</div>'}</div>
    ${plan.overflow.length ? `<div class="label" style="color:var(--warn)">Nu mai încap (${plan.overflow.length})</div>
      <div class="card">${plan.overflow.map((t) => `<div class="prow"><div class="pb">${esc(t.title)} <small>· ${fmtDur(durOf(t))}</small></div></div>`).join('')}</div>
      <label class="switch-row card" style="margin-top:10px;padding:12px 16px"><span>Mută-le pe ${relDay(addDays(ds, 1)).toLowerCase()}</span><input type="checkbox" class="sw" id="plan-move" checked></label>` : ''}
    <div class="row-btns" style="margin-top:18px"><button class="btn primary" data-act="plan-apply">✓ Aplică planul</button></div>
    <div class="hint">Program: ${state.settings.dayStart}–${state.settings.dayEnd}, ${state.settings.buffer} min pauză între lucruri. Le poți schimba din tab-ul Asistent.</div>
  </div>`);
}

// configurare push (ntfy)
function newTopic() { return 'ritm-' + Array.from(crypto.getRandomValues(new Uint8Array(14)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join(''); }
function openPushSetup() {
  const S = state.settings;
  if (!S.ntfyTopic) { S.ntfyTopic = newTopic(); persist(); }
  openSheet(`<div class="sheet-head"><span style="width:60px"></span><b>Notificări push</b><button class="link strong" data-act="close">Gata</button></div>
  <div class="sheet-body">
    <div class="card howto">
      <b>Ca să primești remindere chiar și când Ritm e închisă</b>, folosim aplicația gratuită <b>ntfy</b> (fără cont).
      <ol>
        <li>Instalează <b>ntfy</b> din App Store.</li>
        <li>Deschide-o, apasă <b>+</b> și scrie exact acest canal:
          <div class="topic"><code id="topic">${esc(S.ntfyTopic)}</code><button class="mini" data-act="copy-topic">Copiază</button></div></li>
        <li>Lasă serverul implicit și apasă <b>Subscribe</b>. Permite notificările.</li>
        <li>Apasă butonul de mai jos.</li>
      </ol>
    </div>
    <div class="row-btns"><button class="btn primary" data-act="push-test">📨 Trimite un test</button></div>
    <label class="switch-row card" style="margin-top:14px;padding:14px 16px"><span><b>Remindere push pornite</b></span><input type="checkbox" class="sw" id="s-ntfy" ${S.ntfyOn ? 'checked' : ''}></label>
    <div class="hint">
      • Ritm programează reminderele pentru următoarele ~3 zile de fiecare dată când o deschizi. Deschide-o măcar o dată la 2 zile (oricum o faci 🙂).<br>
      • Dacă muți sau termini ceva după ce reminderul a fost programat, s-ar putea să primești totuși reminderul vechi.<br>
      • Canalul e ca o parolă: cine îl știe poate vedea reminderele (titlurile taskurilor trec prin serverul ntfy.sh). Nu-l da nimănui. <button class="link" data-act="new-topic">Generează alt canal</button><br>
      • Variantă fără altă aplicație: „Adaugă în Calendarul iPhone” din detaliile unui task – alarma vine din Calendarul iPhone.
    </div>
  </div>`);
}

// ============================================================
// Toast
// ============================================================
let toastTimer;
function toast(msg, actLabel, fn) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${actLabel ? `<button id="toast-btn">${esc(actLabel)}</button>` : ''}`;
  el.hidden = false;
  if (actLabel) $('#toast-btn').onclick = () => { el.hidden = true; fn(); };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, actLabel ? 5000 : 2800);
}

// ============================================================
// Calendar iPhone (.ics)
// ============================================================
const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDate = (ds) => ds.replace(/-/g, '');
const icsUtcStamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
function vevent(t) {
  const L = ['BEGIN:VEVENT', `UID:${t.id}@ritm`, `DTSTAMP:${icsUtcStamp()}`, `SUMMARY:${icsEsc(t.title)}`];
  if (t.time) {
    const s = tMin(t.time), e = s + durOf(t);
    const endDay = e >= 1440 ? addDays(t.date, 1) : t.date;
    L.push(`DTSTART:${icsDate(t.date)}T${t.time.replace(':', '')}00`, `DTEND:${icsDate(endDay)}T${minToT(e % 1440).replace(':', '')}00`);
  } else {
    L.push(`DTSTART;VALUE=DATE:${icsDate(t.date)}`, `DTEND;VALUE=DATE:${icsDate(addDays(t.date, 1))}`);
  }
  const rr = { daily: 'FREQ=DAILY', weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', days: `FREQ=WEEKLY;BYDAY=${(t.days || []).map((d) => BYDAY[d]).join(',')}` }[t.repeat];
  if (rr) L.push(`RRULE:${rr}`);
  const desc = [linkEvent(t) ? `Legat de: ${linkLabel(t)}` : '', t.notes, ...(t.subtasks || []).map((s) => `${s.done ? '☑' : '☐'} ${s.t}`)].filter(Boolean).join('\n');
  if (desc) L.push(`DESCRIPTION:${icsEsc(desc)}`);
  const rem = t.reminder != null ? t.reminder : state.settings.reminder;
  if (t.time && rem != null) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(t.title)}`, `TRIGGER:-PT${rem}M`, 'END:VALARM');
  else if (!t.time) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(t.title)}`, `TRIGGER:PT${tMin(state.settings.morning || '08:00')}M`, 'END:VALARM');
  L.push('END:VEVENT');
  return L;
}
function downloadIcs(tasks, name) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ritm//RO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  tasks.forEach((t) => lines.push(...vevent(t)));
  lines.push('END:VCALENDAR');
  shareFile(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }), name, 'text/calendar');
}
function shareFile(blob, name, type) {
  const file = new File([blob], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: name }).catch(() => openBlob(blob, name));
  else openBlob(blob, name);
}
function openBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ============================================================
// Cronometru focus
// ============================================================
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

// ============================================================
// Acțiuni
// ============================================================
const actions = {
  tab(el) { ui.tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
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
  'move-today'(el, id) { const t = findTask(id); if (!t) return; moveTo(t, todayStr(), false); afterAdd([t], false, false); },
  'move-tomorrow'(el) { const t = findTask(el.dataset.v); if (!t) return; moveTo(t, addDays(todayStr(), 1)); save(); render(); toast('Mutat pe mâine'); },
  'move-all-today'() { const n = overdue(); n.forEach((t) => moveTo(t, todayStr(), false)); save(); autoPlanToday(true); render(); toast(`${n.length} mutate pe azi`); },
  'move-low'() {
    const t = todayStr(), S = state.settings, nm = nowMin();
    const low = tasksOn(t).filter((x) => !isDone(x, t) && !isRec(x) && !isEvent(x) && x.priority < 3 && !x.deadline && !x.link && (!x.time || x.auto));
    let need = tasksOn(t).filter((x) => !isDone(x, t) && (!x.time || tMin(x.time) >= nm)).reduce((s, x) => s + durOf(x), 0);
    const free = tMin(S.dayEnd) - Math.max(nm, tMin(S.dayStart));
    const moved = [];
    for (const x of low.sort((a, b) => a.priority - b.priority)) { if (need <= free) break; moveTo(x, addDays(t, 1)); need -= durOf(x); moved.push(x); }
    save(); autoPlanToday(true); render();
    toast(moved.length ? `Am mutat ${moved.length} pe mâine` : 'N-am găsit ce să mut fără să afectez lucrurile importante');
  },
  'eve-move'() {
    const t = todayStr();
    const left = tasksOn(t).filter((x) => !isDone(x, t) && !isRec(x) && !isEvent(x));
    left.forEach((x) => moveTo(x, addDays(t, 1)));
    save(); render(); toast(`${left.length} mutate pe mâine. Somn ușor! 🌙`);
  },
  'del-task'(el) {
    const i = state.tasks.findIndex((x) => x.id === el.dataset.v); if (i < 0) return;
    const [removed] = state.tasks.splice(i, 1);
    save(); render();
    toast('Șters', 'Anulează', () => { state.tasks.splice(i, 0, removed); save(); render(); });
  },
  dismiss(el) {
    state.dismissed[el.dataset.v] = todayStr();
    const cutoff = addDays(todayStr(), -30);
    for (const [k, d] of Object.entries(state.dismissed)) if (d < cutoff) delete state.dismissed[k];
    save(); render();
  },
  followup(el, id, ds) { openQuick(ds || todayStr(), { link: { id, ds: ds || todayStr(), type: 'after' } }); },
  'add-on'(el) { openQuick(el.dataset.v); },
  'plan-day'() { openPlan(todayStr()); },
  'plan-tomorrow'() { openPlan(addDays(todayStr(), 1)); },
  'plan-sel'() { if (ui.calSel < todayStr()) { toast('Nu pot planifica în trecut'); return; } openPlan(ui.calSel); },
  'plan-apply'() {
    if (!pendingPlan) return;
    const mv = $('#plan-move') ? $('#plan-move').checked : false;
    const plan = pendingPlan;
    applyPlan(plan, mv);
    closeSheet(); render();
    toast(`✨ Plan aplicat${plan.placed.length ? ` – ${plan.placed.length} lucruri programate` : ''}`);
  },
  dump() { openDump(); },
  'dump-add'() { dumpAdd(); },
  tpl(el) {
    const tp = TEMPLATES.find((x) => x.id === el.dataset.v); if (!tp) return;
    state.tasks.push(...tp.tasks().map((o) => ({ ...baseTask(), ...o, tpl: tp.id })));
    save(); render(); toast(`${tp.icon} ${tp.name} – adăugat`);
  },
  'push-setup'() { openPushSetup(); },
  'copy-topic'() {
    const v = state.settings.ntfyTopic;
    (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => toast('Copiat ✓')).catch(() => {
      const r = document.createRange(); r.selectNode($('#topic')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Selectat – apasă Copiază');
    });
  },
  async 'push-test'() {
    try {
      await ntfySend('Ritm funcționează! 🎉', 'De acum primești aici reminderele tale.');
      state.settings.ntfyOn = true; state.pushed = {}; save();
      if ($('#s-ntfy')) $('#s-ntfy').checked = true;
      toast('Trimis! Verifică notificarea pe telefon');
    } catch (e) { toast('Nu am putut trimite. Verifică internetul.'); }
  },
  'new-topic'() {
    if (!confirm('Generez un canal nou? Va trebui să te abonezi din nou în ntfy.')) return;
    state.settings.ntfyTopic = newTopic(); state.pushed = {}; save(); openPushSetup();
  },
  'focus-on'(el, id) { const T = timerObj(); T.taskId = id; ui.tab = 'focus'; if (!T.running) actions['t-start'](); else { save(); render(); } },
  fsub(el) { const tk = findTask(timerObj().taskId); if (!tk) return; const s = tk.subtasks[+el.dataset.v]; s.done = !s.done; save(); render(); },
  'cal-prev'() { const d = parseYmd(ui.calMonth); d.setMonth(d.getMonth() - 1); ui.calMonth = ymd(d); render(); },
  'cal-next'() { const d = parseYmd(ui.calMonth); d.setMonth(d.getMonth() + 1); ui.calMonth = ymd(d); render(); },
  'cal-today'() { ui.calSel = todayStr(); ui.calMonth = todayStr().slice(0, 8) + '01'; render(); },
  'cal-day'(el) { ui.calSel = el.dataset.v; if (ui.calSel.slice(0, 7) !== ui.calMonth.slice(0, 7)) ui.calMonth = ui.calSel.slice(0, 8) + '01'; render(); },
  'list-mode'(el) { ui.listMode = el.dataset.v; $('#listbody').innerHTML = viewList(); },
  'clear-done'() {
    const removed = state.tasks.filter((x) => !isRec(x) && x.done);
    state.tasks = state.tasks.filter((x) => isRec(x) || !x.done);
    save(); render();
    toast(`${removed.length} șterse`, 'Anulează', () => { state.tasks.push(...removed); save(); render(); });
  },
  // cronometru
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
    T.taskId = null; save(); ui.tab = 'azi'; render(); toast('Bravo! Task terminat 🎉');
  },
  // editor
  close() { closeSheet(); },
  save() { saveDraft(); },
  kind(el) { syncDraft(); draft.kind = el.dataset.v; if (draft.kind === 'event' && !draft.duration) draft.duration = 60; $('#sheet').innerHTML = editorHtml(); },
  setdate(el) { const v = el.dataset.v; $('#f-date').value = v === '' ? '' : addDays(todayStr(), +v); },
  prio(el) { draft.priority = +el.dataset.v; $$('#f-prio button').forEach((b) => b.classList.toggle('on', b === el)); },
  pickcat(el) { draft.cat = el.dataset.v || null; $$('#f-cats .chip').forEach((b) => b.classList.toggle('on', b === el)); },
  day(el) {
    const n = +el.dataset.v; draft.days = draft.days || [];
    const i = draft.days.indexOf(n); if (i >= 0) draft.days.splice(i, 1); else draft.days.push(n);
    el.classList.toggle('on', i < 0);
  },
  addsub() {
    const inp = $('#f-newsub'); const v = inp.value.trim(); if (!v) return;
    draft.subtasks = draft.subtasks || []; draft.subtasks.push({ t: v, done: false });
    inp.value = ''; $('#f-subs').innerHTML = subsHtml(); inp.focus();
  },
  subtoggle(el) { const s = draft.subtasks[+el.dataset.v]; s.done = !s.done; $('#f-subs').innerHTML = subsHtml(); },
  subdel(el) { draft.subtasks.splice(+el.dataset.v, 1); $('#f-subs').innerHTML = subsHtml(); },
  'ev-prep'() { const ds = draft._ds; const ev = saveDraft(true); if (ev) openQuick(ds || ev.date, { link: { id: ev.id, ds: ds || ev.date, type: 'before' } }); },
  'ev-after'() { const ds = draft._ds; const ev = saveDraft(true); if (ev) openQuick(ds || ev.date, { link: { id: ev.id, ds: ds || ev.date, type: 'after' } }); },
  postpone() {
    syncDraft();
    const base = draft.date && draft.date > todayStr() ? draft.date : todayStr();
    $('#f-date').value = addDays(base, 1);
    draft.postponed = (draft.postponed || 0) + 1;
    if (draft.auto) { $('#f-time').value = ''; draft.time = ''; }
    if (saveDraft(true)) toast('Amânat pe ' + relDay(addDays(base, 1)).toLowerCase());
  },
  'ed-focus'() { const t = saveDraft(true); if (t) actions['focus-on'](null, t.id); },
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
    toast('Șters', 'Anulează', () => { state.tasks.splice(i, 0, removed); save(); render(); });
  },
  'q-add'() { quickAdd(); },
  'q-more'() {
    const p = quickParse($('#q').value);
    closeSheet();
    openEditor(null, null, { ...quickToTask(p), id: null });
  },
  // setări
  async notif() {
    if (!('Notification' in window)) { toast('Instalează întâi aplicația pe ecranul principal'); return; }
    if (Notification.permission === 'granted') { state.settings.notify = !state.settings.notify; save(); render(); toast(state.settings.notify ? 'Notificări pornite' : 'Notificări oprite'); return; }
    const p = await Notification.requestPermission();
    state.settings.notify = p === 'granted'; save(); render();
    if (p === 'granted') notify('Ritm', 'Notificările merg! 🔔', 'test'); else toast('Permisiune refuzată – o poți activa din Setări iPhone');
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
  export() { shareFile(new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' }), `ritm-backup-${todayStr()}.json`, 'application/json'); },
  wipe() {
    if (!confirm('Sigur ștergi TOATE taskurile și setările? Nu se poate anula.')) return;
    state = seed(); state.tasks = []; save(); render(); toast('Totul a fost șters');
  },
};

// ============================================================
// Evenimente
// ============================================================
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
  if (e.target.id === 'search') { ui.search = e.target.value; $('#listbody').innerHTML = viewList(); }
});
const SETTING_INPUTS = {
  's-name': (v) => ({ name: v.trim() }), 's-maxwork': (v) => ({ maxWork: Math.max(10, +v || 50) }), 's-minpers': (v) => ({ minPersonal: Math.max(0, +v || 0) }),
  's-morning': (v) => ({ morning: v || '08:00' }), 's-evening': (v) => ({ evening: v || '21:00' }),
  's-start': (v) => ({ dayStart: v || '08:00' }), 's-end': (v) => ({ dayEnd: v || '22:00' }),
  's-buffer': (v) => ({ buffer: +v }), 's-defdur': (v) => ({ defaultDur: +v }), 's-prep': (v) => ({ prepLead: +v }),
};
document.addEventListener('change', (e) => {
  const el = e.target, S = state.settings;
  if (SETTING_INPUTS[el.id]) { Object.assign(S, SETTING_INPUTS[el.id](el.value)); save(); return; }
  if (el.id === 's-autoplan') { S.autoPlan = el.checked; save(); if (S.autoPlan) { autoPlanToday(false); render(); } return; }
  if (el.id === 's-autofollow') { S.autoFollow = el.checked; save(); return; }
  if (el.id === 's-ntfy') { S.ntfyOn = el.checked; state.pushed = {}; save(); toast(S.ntfyOn ? 'Remindere push pornite' : 'Remindere push oprite'); return; }
  if (el.id === 'f-rep') { $('#f-days').hidden = el.value !== 'days'; return; }
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
        state = hydrate(s); runMigrations();
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
function onNewDayOrOpen() {
  if (todayStr() !== lastDay) { lastDay = todayStr(); ui.calSel = lastDay; }
  if (!state.settings.autoPlan) return;
  // dacă a trecut ora unui task pus automat și nu l-ai bifat, îl mut în următorul gol liber
  const t = todayStr(), nm = nowMin();
  const missed = tasksOn(t).filter((x) => x.auto && x.time && !isDone(x, t) && endMin(x) <= nm);
  if (state.lastAutoPlan !== t || missed.length) {
    autoPlanToday(true);
    if (missed.length) toast(`✨ Am mutat mai încolo ${missed.length === 1 ? q(missed[0].title) : missed.length + ' lucruri'} pe care nu le-ai apucat`);
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    onNewDayOrOpen();
    tick(); checkReminders(); schedulePushes();
    if ($('#sheet').hidden) render();
  }
});
window.addEventListener('online', schedulePushes);

setInterval(tick, 1000);
setInterval(() => {
  checkReminders();
  const newDay = todayStr() !== lastDay;
  if (newDay) onNewDayOrOpen();
  if ($('#sheet').hidden && (newDay || ui.tab === 'azi' || ui.tab === 'asist')) render();
}, 30000);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

const VIEWS = { azi: viewToday, cal: viewCal, asist: viewAssistant, list: viewListPage, focus: viewFocus };
function boot() {
  runMigrations();
  onNewDayOrOpen();
  render();
  tick();
  checkReminders();
  updateBadge();
  setTimeout(schedulePushes, 1500);
}
