'use strict';
/* Cont + salvare în cloud (Supabase), prin API-ul HTTP direct – fără biblioteci externe.
   - Pe telefon totul se salvează automat, la fiecare modificare (localStorage).
   - Cu cont: se sincronizează în cloud (bază de date în UE) și pe toate dispozitivele.
   - Îmbinare sigură: fiecare element are un „timestamp” de modificare; ștergerile se țin minte.
   - Zilnic se păstrează și o copie în istoric (ritm_history). */

const CLOUD_KEY = 'ritm.cloud';
const SYNC_COLS = ['tasks', 'goals', 'projects', 'journal', 'cats'];
const LOCAL_ONLY = ['timer', 'sent', 'pushed', 'changedAt', 'lastAutoPlan'];
const LOCAL_SETTINGS = ['ntfyOn', 'ntfyTopic', 'ntfyServer', 'notify'];
const CFG = window.RITM_CONFIG || {};

let cloud = (() => { try { return JSON.parse(localStorage.getItem(CLOUD_KEY)) || {}; } catch (e) { return {}; } })();
const saveCloud = () => { try { localStorage.setItem(CLOUD_KEY, JSON.stringify(cloud)); } catch (e) { /* */ } };
const sbUrl = () => (cloud.url || CFG.supabaseUrl || '').trim().replace(/\/+$/, '');
const sbKey = () => (cloud.key || CFG.supabaseKey || '').trim();
const loggedIn = () => !!(cloud.session && cloud.session.access_token && cloud.user);

// ------------------------------------------------------------
// Marcarea modificărilor (pentru îmbinare corectă între dispozitive)
// ------------------------------------------------------------
let baseline = null;
const itemHash = (it) => { const { u, ...rest } = it; return JSON.stringify(rest); };
function computeHashes() {
  const cur = {};
  for (const col of SYNC_COLS) for (const it of state[col] || []) cur[`${col}:${it.id}`] = itemHash(it);
  cur.settings = JSON.stringify(state.settings);
  return cur;
}
function resetBaseline() { baseline = computeHashes(); }
EXT.migrate.push(() => {
  if (!state.deleted) state.deleted = {};
  for (const col of SYNC_COLS) for (const it of state[col] || []) if (!it.u) it.u = it.createdAt || 1;
  resetBaseline();
});
EXT.beforeSave.push(() => {
  const now = Date.now();
  const cur = computeHashes();
  if (baseline) {
    for (const col of SYNC_COLS) for (const it of state[col] || []) {
      const k = `${col}:${it.id}`;
      if (baseline[k] !== cur[k]) it.u = now;
      if (!(k in baseline) && state.deleted[k]) delete state.deleted[k]; // readăugat (ex: „Anulează”)
    }
    for (const k of Object.keys(baseline)) if (k !== 'settings' && !(k in cur)) state.deleted[k] = now;
    if (baseline.settings !== cur.settings) state.settingsU = now;
  }
  const cutoff = now - 120 * 864e5;
  for (const [k, ts] of Object.entries(state.deleted)) if (ts < cutoff) delete state.deleted[k];
  baseline = computeHashes();
});

// ------------------------------------------------------------
// Îmbinare
// ------------------------------------------------------------
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
function forCloud(s) {
  const o = {};
  for (const [k, v] of Object.entries(s)) if (!LOCAL_ONLY.includes(k)) o[k] = v;
  o.settings = { ...s.settings };
  LOCAL_SETTINGS.forEach((k) => delete o.settings[k]);
  return o;
}
function mergeStates(L, R) {
  const out = { ...R, ...L };
  const del = { ...(R.deleted || {}) };
  for (const [k, v] of Object.entries(L.deleted || {})) del[k] = Math.max(del[k] || 0, v);
  for (const col of SYNC_COLS) {
    const map = new Map();
    for (const it of R[col] || []) map.set(it.id, it);
    for (const it of L[col] || []) { const r = map.get(it.id); if (!r || (it.u || 0) >= (r.u || 0)) map.set(it.id, it); }
    out[col] = [...map.values()].filter((it) => !((del[`${col}:${it.id}`] || 0) > (it.u || 0)));
  }
  out.journal.sort((a, b) => a.id.localeCompare(b.id));
  out.deleted = del;
  const rNewer = (R.settingsU || 0) > (L.settingsU || 0);
  out.settings = { ...(rNewer ? { ...L.settings, ...R.settings } : { ...R.settings, ...L.settings }) };
  LOCAL_SETTINGS.forEach((k) => { out.settings[k] = L.settings[k]; });
  out.settingsU = Math.max(L.settingsU || 0, R.settingsU || 0);
  out.focusLog = { ...(R.focusLog || {}) };
  for (const [d, m] of Object.entries(L.focusLog || {})) out.focusLog[d] = Math.max(out.focusLog[d] || 0, m);
  out.dismissed = { ...(R.dismissed || {}), ...(L.dismissed || {}) };
  out.snapshots = { ...(R.snapshots || {}), ...(L.snapshots || {}) };
  for (const k of LOCAL_ONLY) out[k] = L[k];
  return out;
}

// ------------------------------------------------------------
// API Supabase
// ------------------------------------------------------------
const ERR_RO = [
  [/invalid login credentials/i, 'Email sau parolă greșită.'],
  [/email not confirmed/i, 'Confirmă întâi adresa de email (verifică Inbox și Spam), apoi apasă din nou „Intră”.'],
  [/already registered|already been registered|user_already_exists/i, 'Există deja un cont cu acest email – apasă „Intră”.'],
  [/password.*(6|characters|short)/i, 'Parola trebuie să aibă minim 6 caractere.'],
  [/ritm_state|ritm_history|relation .* does not exist|PGRST205|42P01/i, 'Tabelele nu există încă. Rulează scriptul SQL din pasul 3.'],
  [/invalid api key|no api key|apikey/i, 'Cheia „anon / publishable” nu e corectă.'],
  [/rate limit|too many/i, 'Prea multe încercări. Așteaptă un minut.'],
  [/failed to fetch|networkerror|load failed/i, 'Nu am internet sau adresa proiectului e greșită.'],
];
const roErr = (m) => { for (const [re, t] of ERR_RO) if (re.test(m)) return t; return m; };
async function api(method, path, body, extra = {}) {
  const headers = { apikey: sbKey(), 'Content-Type': 'application/json', ...extra };
  if (cloud.session && cloud.session.access_token && !path.startsWith('/auth/v1/token') && !path.startsWith('/auth/v1/signup')) headers.Authorization = 'Bearer ' + cloud.session.access_token;
  const r = await fetch(sbUrl() + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
  if (!r.ok) {
    const msg = (data && (data.error_description || data.msg || data.message || data.error || data.code)) || `Eroare ${r.status}`;
    const err = new Error(roErr(String(msg) + ' ' + (data && data.code ? data.code : '')));
    err.status = r.status;
    throw err;
  }
  return data;
}
function setSession(d) {
  cloud.session = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600) };
  cloud.user = { id: d.user.id, email: d.user.email };
  saveCloud();
}
async function ensureFresh() {
  if (!cloud.session) throw new Error('Nu ești autentificat.');
  if (cloud.session.expires_at * 1000 > Date.now() + 60000) return;
  try {
    const d = await api('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: cloud.session.refresh_token });
    setSession(d);
  } catch (e) {
    if (e.status === 400 || e.status === 401) { cloud.session = null; saveCloud(); throw new Error('Sesiunea a expirat – intră din nou în cont.'); }
    throw e;
  }
}
async function signIn(email, password) {
  const d = await api('POST', '/auth/v1/token?grant_type=password', { email, password });
  setSession(d);
}
async function signUp(email, password) {
  const d = await api('POST', '/auth/v1/signup', { email, password });
  if (d && d.access_token) { setSession(d); return true; }
  return false; // trebuie confirmat emailul
}

// ------------------------------------------------------------
// Sincronizare
// ------------------------------------------------------------
let syncing = false, again = false, syncTimer;
async function syncNow(manual) {
  if (!loggedIn() || !sbUrl() || !navigator.onLine) { if (manual && !navigator.onLine) toast('Nu ai internet – salvez pe telefon și sincronizez când revine.'); return; }
  if (syncing) { again = true; return; }
  syncing = true; cloud.status = 'sync'; updateCloudUI();
  try {
    await ensureFresh();
    const uidq = encodeURIComponent(cloud.user.id);
    const rows = await api('GET', `/rest/v1/ritm_state?select=data,changed_at&user_id=eq.${uidq}`);
    const remote = rows && rows[0] ? rows[0].data : null;
    if (remote && !cloud.firstSyncDone) {
      // telefon nou: renunțăm la taskurile de bun venit, ca să nu se dubleze
      state.tasks = state.tasks.filter((t) => !t.seed);
    }
    if (remote) {
      const merged = mergeStates(state, hydrate(remote));
      const changedLocal = stable(forCloud(merged)) !== stable(forCloud(state));
      state = merged;
      runMigrations();
      persist();
      if (changedLocal && $('#sheet').hidden) render();
    }
    const payload = forCloud(state);
    if (!remote || stable(payload) !== stable(remote)) {
      await api('POST', '/rest/v1/ritm_state', { user_id: cloud.user.id, data: payload, changed_at: Date.now() }, { Prefer: 'resolution=merge-duplicates,return=minimal' });
    }
    if (cloud.lastHistory !== todayStr()) {
      await api('POST', '/rest/v1/ritm_history', { user_id: cloud.user.id, data: payload, changed_at: Date.now() }, { Prefer: 'return=minimal' });
      cloud.lastHistory = todayStr();
    }
    cloud.lastSync = Date.now(); cloud.error = null; cloud.status = 'ok'; cloud.firstSyncDone = true;
    if (manual) toast('☁️ Sincronizat');
  } catch (e) {
    cloud.error = e.message; cloud.status = 'err';
    if (manual) toast(e.message);
  }
  saveCloud();
  syncing = false;
  updateCloudUI();
  if (again) { again = false; syncNow(); }
}
EXT.afterSave.push(() => { if (!loggedIn()) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 3000); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
window.addEventListener('online', () => syncNow());
setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 5 * 60000);

// ------------------------------------------------------------
// Interfață
// ------------------------------------------------------------
function ago(ts) {
  if (!ts) return 'niciodată';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'chiar acum';
  if (s < 3600) return `acum ${Math.round(s / 60)} min`;
  if (s < 86400) return `acum ${Math.round(s / 3600)} h`;
  return `acum ${Math.round(s / 86400)} zile`;
}
function cloudStatusLine() {
  if (!sbUrl()) return '⚪️ Neconfigurat';
  if (!loggedIn()) return '⚪️ Neconectat';
  if (cloud.status === 'sync') return '🔄 Se sincronizează…';
  if (cloud.error) return '⚠️ ' + esc(cloud.error);
  return `✅ Sincronizat ${ago(cloud.lastSync)}`;
}
function cloudCard() {
  const local = `<div class="row"><span>📱 Pe telefon</span><span class="muted">salvat automat ${ago(state.changedAt)}</span></div>`;
  let body;
  if (!sbUrl()) {
    body = `${local}
      <div class="row col"><span><b>☁️ Cont și salvare în cloud</b></span><span class="muted">Ca să nu pierzi nimic dacă schimbi sau pierzi telefonul, și ca să ai aceleași date pe toate dispozitivele.</span></div>
      <button class="row" data-act="cloud-setup"><span class="link">Configurează contul (5 minute)</span><span class="link">›</span></button>`;
  } else if (!loggedIn()) {
    body = `${local}
      <div class="row col"><span><b>☁️ Intră în cont</b></span>
        <input id="c-email" type="email" autocomplete="username" placeholder="email" class="cin" value="${esc(cloud.lastEmail || '')}">
        <input id="c-pass" type="password" autocomplete="current-password" placeholder="parolă (minim 6 caractere)" class="cin">
        <div class="row-btns" style="margin-top:4px;width:100%"><button class="btn primary" data-act="cloud-login">Intră</button><button class="btn" data-act="cloud-signup">Creează cont</button></div>
        ${cloud.error ? `<span class="late" style="font-size:14px">${esc(cloud.error)}</span>` : ''}
      </div>
      <button class="row" data-act="cloud-setup"><span class="muted">Setări server</span><span class="link">›</span></button>`;
  } else {
    body = `${local}
      <div class="row col"><span>☁️ ${esc(cloud.user.email)}</span><span class="muted" id="cloud-status" style="font-size:14px">${cloudStatusLine()}</span></div>
      <button class="row" data-act="cloud-sync"><span class="link">Sincronizează acum</span></button>
      <button class="row" data-act="cloud-logout"><span class="link danger">Ieși din cont</span><span class="muted">datele rămân pe telefon</span></button>`;
  }
  return `<div class="sec"><h2>Cont & salvare</h2></div><div class="card">${body}</div>
    <div class="help">Totul se salvează automat pe telefon, la fiecare modificare. Cu cont, se salvează și în cloud, iar o copie pe zi rămâne în istoric.</div>`;
}
function updateCloudUI() {
  const el = $('#cloud-status');
  if (el) el.innerHTML = cloudStatusLine();
}
const SETUP_SQL = `-- Andrei OS: tabele pentru salvarea în cloud
create table if not exists public.ritm_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  changed_at bigint not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.ritm_history (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  changed_at bigint not null,
  created_at timestamptz not null default now()
);
alter table public.ritm_state enable row level security;
alter table public.ritm_history enable row level security;
create policy "doar datele mele" on public.ritm_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "doar istoricul meu" on public.ritm_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`;
function openCloudSetup() {
  openSheet(`<div class="sheet-head"><button class="link" data-act="close">Închide</button><b>Cont în cloud</b><button class="link strong" data-act="cloud-save-cfg">Salvează</button></div>
  <div class="sheet-body">
    <div class="card howto"><b>O singură dată, ~5 minute:</b>
      <ol>
        <li>Intră pe <b>supabase.com</b> → <b>Start your project</b> → creează cont (gratuit, merge cu GitHub).</li>
        <li><b>New project</b>: nume <i>andrei-os</i>, alege o parolă pentru baza de date (păstreaz-o), regiunea <b>Central EU (Frankfurt)</b> → <b>Create</b>.</li>
        <li>În meniul din stânga: <b>SQL Editor</b> → <b>New query</b> → lipește scriptul de mai jos → <b>Run</b>.</li>
        <li><b>Project Settings → API</b> (sau <b>Connect</b>): copiază <b>Project URL</b> și cheia <b>anon public</b> / <b>publishable</b> în câmpurile de mai jos. <u>Niciodată</u> cheia „service_role” / „secret”.</li>
        <li>Opțional: <b>Authentication → URL Configuration → Site URL</b> = adresa aplicației tale (ca linkul de confirmare din email să te ducă înapoi aici).</li>
      </ol>
    </div>
    <div class="label">Scriptul SQL (pasul 3)</div>
    <div class="card pad"><pre class="sql" id="sql">${esc(SETUP_SQL)}</pre><button class="mini" data-act="copy-sql">Copiază scriptul</button></div>
    <div class="label">Datele proiectului (pasul 4)</div>
    <div class="card group">
      <label class="row col"><span>Project URL</span><input id="c-url" class="cin" placeholder="https://xxxxxxxx.supabase.co" value="${esc(cloud.url || CFG.supabaseUrl || '')}" autocomplete="off" autocapitalize="off"></label>
      <label class="row col"><span>Cheia anon / publishable</span><input id="c-key" class="cin" placeholder="eyJhbGciOi… sau sb_publishable_…" value="${esc(cloud.key || CFG.supabaseKey || '')}" autocomplete="off" autocapitalize="off"></label>
    </div>
    <div class="help">Cheia „anon / publishable” e făcută să fie folosită în aplicații – e în siguranță aici, pentru că regulile din script lasă fiecare cont să-și vadă doar datele lui. Poți să mi le trimiți și mie, ca să le pun direct în aplicație.</div>
  </div>`);
}

Object.assign(actions, {
  'cloud-setup'() { openCloudSetup(); },
  'copy-sql'() { (navigator.clipboard ? navigator.clipboard.writeText(SETUP_SQL) : Promise.reject()).then(() => toast('Script copiat ✓')).catch(() => { const r = document.createRange(); r.selectNode($('#sql')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Selectat – apasă Copiază'); }); },
  'cloud-save-cfg'() {
    const url = $('#c-url').value.trim(), key = $('#c-key').value.trim();
    if (!/^https:\/\/.+/.test(url)) { toast('Adresa trebuie să înceapă cu https://'); return; }
    if (key.length < 20) { toast('Cheia pare incompletă'); return; }
    if (/service_role|sb_secret_/.test(key) || (() => { try { return JSON.parse(atob(key.split('.')[1])).role === 'service_role'; } catch (e) { return false; } })()) { toast('⚠️ Asta e cheia SECRETĂ. Folosește cheia anon / publishable.'); return; }
    cloud.url = url; cloud.key = key; cloud.error = null; saveCloud();
    closeSheet(); ui.tab = 'eu'; ui.meMode = 'settings'; render(); toast('Salvat. Acum creează-ți contul.');
  },
  async 'cloud-login'() {
    const email = $('#c-email').value.trim(), pass = $('#c-pass').value;
    if (!email || !pass) { toast('Scrie emailul și parola'); return; }
    cloud.lastEmail = email;
    try { await signIn(email, pass); cloud.error = null; saveCloud(); toast('Conectat ✓ Sincronizez…'); render(); await syncNow(true); render(); }
    catch (e) { cloud.error = e.message; saveCloud(); render(); }
  },
  async 'cloud-signup'() {
    const email = $('#c-email').value.trim(), pass = $('#c-pass').value;
    if (!email || pass.length < 6) { toast('Email și parolă de minim 6 caractere'); return; }
    cloud.lastEmail = email;
    try {
      const ok = await signUp(email, pass);
      cloud.error = null; saveCloud();
      if (ok) { toast('Cont creat ✓'); render(); await syncNow(true); render(); }
      else { cloud.error = 'Ți-am trimis un email de confirmare. Apasă linkul din email, apoi revino aici și apasă „Intră”.'; saveCloud(); render(); }
    } catch (e) { cloud.error = e.message; saveCloud(); render(); }
  },
  'cloud-sync'() { syncNow(true); },
  async 'cloud-logout'() {
    if (!confirm('Ieși din cont? Datele rămân pe acest telefon.')) return;
    try { await api('POST', '/auth/v1/logout'); } catch (e) { /* */ }
    cloud.session = null; cloud.user = null; cloud.status = null; cloud.firstSyncDone = false; saveCloud(); render();
  },
});

// ------------------------------------------------------------
// Pornire
// ------------------------------------------------------------
boot();
setTimeout(() => syncNow(), 800);
