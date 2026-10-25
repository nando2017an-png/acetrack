'use strict';

/* ---------- Utilitas ---------- */
const KEY = 'acetrack.v1';
const $ = (s, r = document) => r.querySelector(s);
const pad2 = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = n => (n < 0 ? '-' : '') + 'Rp ' + Math.round(Math.abs(n)).toLocaleString('id-ID');
const dec = x => (Math.round(x * 100) / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 });
function short(n) {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return s + dec(a / 1e9) + 'M';
  if (a >= 1e6) return s + dec(a / 1e6) + 'jt';
  if (a >= 1e3) return s + dec(a / 1e3) + 'rb';
  return s + Math.round(a);
}
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAYS_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const longDate = s => { const d = parse(s); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const midDate = s => { const d = parse(s); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };
const daysIn = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const parseNum = v => Number(String(v).replace(/[^\d]/g, '')) || 0;

const GROUPS = { bank: 'Bank', invest: 'Investasi', cash: 'Tunai / e-wallet' };
const ICON = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M9 5h11v14H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>',
};

/* ---------- Data ---------- */
function defaults() {
  const acc = (name, group) => ({ id: uid(), name, group, balance: 0 });
  return {
    v: 1,
    start: today(),
    settings: { daily: 50000, reserve: 1500000, theme: 'system' },
    categories: [
      { id: 'makan', name: 'Makan & Minum', emoji: '🍛', type: 'daily' },
      { id: 'parkir', name: 'Parkir', emoji: '🅿️', type: 'daily' },
      { id: 'transport', name: 'Transport', emoji: '🚌', type: 'daily' },
      { id: 'jajan', name: 'Jajan', emoji: '🍩', type: 'daily' },
      { id: 'bensin', name: 'Bensin', emoji: '⛽', type: 'reserve' },
      { id: 'belanja', name: 'Belanja', emoji: '🛒', type: 'reserve' },
      { id: 'pulsa', name: 'Pulsa & Internet', emoji: '📶', type: 'reserve' },
    ],
    accounts: [acc('BCA', 'bank'), acc('BNI', 'bank'), acc('Jago', 'bank'), acc('Bibit', 'invest'), acc('Tunai', 'cash')],
    expenses: [],
    incomes: [],
    snaps: {},
    lastAcc: null,
  };
}

const META = 'acetrack.meta', GHK = 'acetrack.gh', SNAPK = 'acetrack.snapshots';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

let state = migrate(load(KEY, null) || defaults());
// Data versi lama belum punya sebagian daftar ini.
function migrate(d) { for (const k of ['incomes', 'loans', 'adjusts', 'transfers']) d[k] = d[k] || []; return d; }
// meta & token GitHub disimpan terpisah supaya tidak ikut ke file backup
let meta = load(META, {});
let gh = load(GHK, null);
store(KEY, state);
const save = () => {
  if (!store(KEY, state)) toast('Gagal menyimpan. Penyimpanan HP penuh?');
  meta.dirty = true; store(META, meta); syncSoon();
};
const validBackup = d => d && Array.isArray(d.expenses) && Array.isArray(d.categories) && Array.isArray(d.accounts) && d.settings;
function replaceState(d) { state = migrate(d); save(); applyTheme(); render(); }
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

const cat = id => state.categories.find(c => c.id === id);
const acc = id => state.accounts.find(a => a.id === id);
// Uang yang dipinjam orang tetap dihitung sebagai aset sampai dikembalikan.
const loanOut = () => state.loans.filter(l => !l.back).reduce((s, l) => s + l.amount, 0);
const totalAssets = () => state.accounts.reduce((s, a) => s + a.balance, 0) + loanOut();
const snapshot = () => { state.snaps[today()] = totalAssets(); };
const isReserve = e => cat(e.cat)?.type === 'reserve';

function addExpense(e) {
  state.expenses.push(e);
  const a = acc(e.acc); if (a) a.balance -= e.amount;
  if (e.acc) state.lastAcc = e.acc;
  snapshot(); save();
}
function removeExpense(id) {
  const i = state.expenses.findIndex(e => e.id === id); if (i < 0) return;
  const [e] = state.expenses.splice(i, 1);
  const a = acc(e.acc); if (a) a.balance += e.amount;
  snapshot(); save();
}

// Pemasukan menambah saldo platform tujuan; tidak memengaruhi budget.
const INCOME_SRC = [['Gaji', '💼'], ['Bonus', '🎁'], ['Jualan', '🏷️'], ['Lainnya', '💰']];
const srcEmoji = s => (INCOME_SRC.find(x => x[0] === s) || INCOME_SRC[3])[1];
function addIncome(i) {
  state.incomes.push(i);
  const a = acc(i.acc); if (a) a.balance += i.amount;
  snapshot(); save();
}
function removeIncome(id) {
  const k = state.incomes.findIndex(i => i.id === id); if (k < 0) return;
  const [i] = state.incomes.splice(k, 1);
  const a = acc(i.acc); if (a) a.balance -= i.amount;
  snapshot(); save();
}
// Biaya admin transfer dicatat sebagai pengeluaran cadangan.
function adminCat() {
  let c = cat('admin');
  if (!c) { c = { id: 'admin', name: 'Biaya admin', emoji: '🏦', type: 'reserve' }; state.categories.push(c); }
  return c;
}

/* ---------- Model budget ----------
   Kategori harian memakai jatah harian; kelebihannya dipotong dari cadangan.
   Kategori cadangan langsung memotong cadangan.
   Sisa jatah hari yang sudah lewat masuk ke cadangan. Cadangan reset tiap bulan. */
function monthBudget(ym) {
  const t = today(), D = state.settings.daily, dim = daysIn(ym);
  const byDay = {};
  let reserveSpent = 0;
  for (const e of state.expenses) {
    if (!e.date.startsWith(ym) || e.date > t) continue;
    if (isReserve(e)) reserveSpent += e.amount;
    else byDay[e.date] = (byDay[e.date] || 0) + e.amount;
  }
  let added = 0, overflow = 0;
  for (let d = 1; d <= dim; d++) {
    const ds = `${ym}-${pad2(d)}`;
    if (ds > t) break;
    const sp = byDay[ds] || 0;
    if (sp > D) overflow += sp - D;
    else if (ds < t && ds >= state.start) added += D - sp;
  }
  const base = state.settings.reserve;
  return { base, added, overflow, reserveSpent, left: base + added - overflow - reserveSpent };
}
function dailySpent(ds) {
  return state.expenses.filter(e => e.date === ds && !isReserve(e)).reduce((s, e) => s + e.amount, 0);
}

/* ---------- Insight ----------
   Muncul setelah 3 hari mencatat di bulan ini. Proyeksi = sisa cadangan sekarang
   + sisa jatah hari ini + (jatah − rata-rata harian) × sisa hari − laju pemakaian cadangan × sisa hari. */
function insights() {
  const t = today(), ym = t.slice(0, 7), D = state.settings.daily;
  if (state.start > t) return null;
  const first = state.start > `${ym}-01` ? state.start : `${ym}-01`;
  const elapsed = Math.round((parse(t) - parse(first)) / DAY_MS) + 1;
  if (elapsed < 3) return null;
  const byDay = {};
  for (const e of state.expenses) if (!isReserve(e)) byDay[e.date] = (byDay[e.date] || 0) + e.amount;
  const spent = ds => byDay[ds] || 0;

  let sum = 0;
  for (let ds = first; ds <= t; ds = addDays(ds, 1)) sum += spent(ds);
  const avg = sum / elapsed;
  const mb = monthBudget(ym);
  const rest = daysIn(ym) - parse(t).getDate();
  const proj = mb.left + Math.max(0, D - spent(t)) + rest * (D - avg) - rest * (mb.reserveSpent / elapsed);

  let streak = 0;
  for (let ds = addDays(t, -1), n = 0; ds >= state.start && n < 400; ds = addDays(ds, -1), n++) {
    if (spent(ds) > D) break;
    streak++;
  }

  // Hari paling boros: rata-rata semua pengeluaran per hari-dalam-minggu, 8 minggu terakhir.
  const from = [addDays(t, -55), state.start].sort()[1];
  const dowSum = Array(7).fill(0), dowCnt = Array(7).fill(0), all = {};
  for (const e of state.expenses) if (e.date >= from && e.date <= t) all[e.date] = (all[e.date] || 0) + e.amount;
  for (let ds = from; ds <= t; ds = addDays(ds, 1)) { const w = parse(ds).getDay(); dowSum[w] += all[ds] || 0; dowCnt[w]++; }
  const dowAvg = dowSum.map((s, i) => dowCnt[i] ? s / dowCnt[i] : 0);
  const dow = dowAvg.indexOf(Math.max(...dowAvg));

  const byCat = {};
  let monthTotal = 0;
  for (const e of state.expenses) if (e.date.startsWith(ym) && e.date <= t) { byCat[e.cat] = (byCat[e.cat] || 0) + e.amount; monthTotal += e.amount; }
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  return { proj, avg, streak, rest, dow, dowAvg: dowAvg[dow], top, monthTotal, D };
}
function insightSheet() {
  const i = insights(); if (!i) return;
  const c = i.top && (cat(i.top[0]) || { emoji: '❔', name: 'Tanpa kategori' });
  const item = (t, v, s) => `<div class="row"><span class="grow"><p class="t">${t}</p>${s ? `<p class="s">${s}</p>` : ''}</span><span class="v num">${v}</span></div>`;
  openSheet(`
  <h3>Ringkasan ${MONTHS[parse(today()).getMonth()]}</h3>
  <div class="list" style="margin-top:12px">
    ${item('Proyeksi sisa cadangan', `<span class="${i.proj < 0 ? 'danger' : ''}">±${rp(i.proj)}</span>`, `Akhir bulan, kalau pola belanja tetap · ${i.rest} hari lagi`)}
    ${item('Rata-rata harian', rp(i.avg), `Jatah ${rp(i.D)} per hari`)}
    ${item('Hemat berturut-turut', `${i.streak} hari`, 'Hari di bawah jatah harian, sampai kemarin')}
    ${i.dowAvg ? item('Hari paling boros', DAYS_FULL[i.dow], `Rata-rata ${rp(i.dowAvg)} · 8 minggu terakhir`) : ''}
    ${c ? item('Kategori terbesar', `${esc(c.emoji)} ${short(i.top[1])}`, `${esc(c.name)} · ${Math.round(i.top[1] / i.monthTotal * 100)}% pengeluaran bulan ini`) : ''}
  </div>`);
}

/* ---------- Router ---------- */
const TABS = ['beranda', 'laporan', 'aset', 'atur'];
let tab = 'beranda';
const rep = { mode: 'month', anchor: today() };

function route() {
  const h = location.hash.slice(1);
  tab = TABS.includes(h) ? h : 'beranda';
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  render();
}
function render() {
  const sub = { beranda: longDate(today()), laporan: 'Laporan pengeluaran', aset: 'Nilai aset', atur: 'Pengaturan' };
  $('#subtitle').textContent = sub[tab];
  $('#view').innerHTML = { beranda: viewHome, laporan: viewReport, aset: viewAssets, atur: viewSettings }[tab]();
}
window.addEventListener('hashchange', () => { closeSheet(true); route(); });

/* ---------- Beranda ---------- */
function viewHome() {
  const t = today(), D = state.settings.daily;
  const spent = dailySpent(t), left = D - spent;
  const mb = monthBudget(t.slice(0, 7));
  const pct = Math.min(100, D ? spent / D * 100 : 0);
  const recent = merged(state.expenses, state.incomes).slice(0, 5);
  const due = backupDue();
  const ins = insights();

  return `
  ${due ? `<div class="card notice">
    <p class="label" style="color:inherit">Sudah ${due} hari belum backup</p>
    <div class="actions">
      <button class="btn" data-act="snooze">Nanti</button>
      <button class="btn primary" data-act="${gh ? 'gh-push' : 'export'}" style="flex:2">Backup sekarang</button>
    </div>
  </div>` : ''}
  <div class="card">
    <p class="label">Sisa jatah hari ini</p>
    <p class="big num ${left < 0 ? 'danger' : ''}">${rp(Math.max(0, left))}</p>
    <div class="bar"><i class="${left < 0 ? 'over' : ''}" style="width:${pct}%"></i></div>
    <p class="small num">${left < 0
      ? `<span class="danger">Lebih ${rp(-left)}, dipotong dari cadangan</span>`
      : `Terpakai ${rp(spent)} dari ${rp(D)}`}</p>
  </div>
  <div class="card">
    <p class="label">Sisa cadangan ${MONTHS[parse(t).getMonth()]}</p>
    <p class="mid num ${mb.left < 0 ? 'danger' : ''}">${rp(mb.left)}</p>
    <div class="bar"><i class="${mb.left < 0 ? 'over' : ''}" style="width:${Math.max(0, Math.min(100, (mb.base + mb.added - mb.left) / Math.max(1, mb.base + mb.added) * 100))}%"></i></div>
    <p class="small num">Awal ${short(mb.base)} · sisa harian +${short(mb.added)} · terpakai ${short(mb.reserveSpent + mb.overflow)}</p>
    ${ins ? `<button class="insight num" data-act="insight"><span>Proyeksi akhir bulan <b class="${ins.proj < 0 ? 'danger' : ''}">±${rp(ins.proj)}</b></span><span aria-hidden="true">›</span></button>` : ''}
  </div>

  <h2>Catat pengeluaran</h2>
  <div class="cats">
    ${state.categories.map(c => `
      <button class="cat" data-act="add" data-cat="${c.id}">
        ${c.type === 'reserve' ? '<span class="tag" aria-label="cadangan"></span>' : ''}
        <span class="emo">${esc(c.emoji)}</span><span>${esc(c.name)}</span>
      </button>`).join('')}
    <button class="cat add" data-act="cat-edit"><span class="emo">＋</span><span>Kategori</span></button>
  </div>
  <p class="legend"><span class="r dot">Titik abu = dari cadangan</span></p>
  <button class="btn block" data-act="income" style="margin-top:12px">＋ Catat pemasukan</button>

  <h2>Terakhir dicatat</h2>
  <div class="list">
    ${recent.length ? recent.map(x => row(x)).join('') : '<p class="empty">Belum ada catatan. Tap kategori di atas untuk mulai.</p>'}
  </div>`;
}
// Gabungkan pengeluaran & pemasukan, terbaru di atas. _k: 'e' pengeluaran, 'i' pemasukan.
function merged(exps, incs = []) {
  return [...exps.map(e => ({ ...e, _k: 'e' })), ...incs.map(i => ({ ...i, _k: 'i' }))]
    .sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
}
const row = (x, showDate = true) => x._k === 'i' ? rowIncome(x, showDate) : rowExpense(x, showDate);
function rowIncome(i, showDate = true) {
  const a = acc(i.acc);
  const meta = [showDate ? midDate(i.date) : '', a ? 'ke ' + esc(a.name) : '', i.note ? esc(i.note) : ''].filter(Boolean).join(' · ');
  return `<button class="row" data-act="edit-income" data-id="${i.id}">
    <span class="emo">${srcEmoji(i.src)}</span>
    <span class="grow"><p class="t">${esc(i.src || 'Pemasukan')}</p>${meta ? `<p class="s">${meta}</p>` : ''}</span>
    <span class="v num good">+${rp(i.amount)}</span></button>`;
}
function rowExpense(e, showDate = true) {
  const c = cat(e.cat) || { emoji: '❔', name: 'Tanpa kategori' };
  const a = acc(e.acc);
  const meta = [showDate ? midDate(e.date) : '', a ? esc(a.name) : '', e.note ? esc(e.note) : ''].filter(Boolean).join(' · ');
  return `<button class="row" data-act="edit" data-id="${e.id}">
    <span class="emo">${esc(c.emoji)}</span>
    <span class="grow"><p class="t">${esc(c.name)}</p>${meta ? `<p class="s">${meta}</p>` : ''}</span>
    <span class="v num">${rp(e.amount)}</span></button>`;
}

/* ---------- Numpad ---------- */
let pad;
function openPad(catId, existing) {
  const e = existing;
  pad = {
    kind: 'e', id: e?.id, cat: e?.cat || catId, amount: e ? String(e.amount) : '',
    acc: e ? e.acc : (state.lastAcc && acc(state.lastAcc) ? state.lastAcc : null),
    note: e?.note || '', date: e?.date || today(),
  };
  openSheet(padHTML());
}
function openIncome(existing) {
  const i = existing;
  if (!state.accounts.length) { toast('Tambahkan platform dulu di tab Aset'); return; }
  const def = acc(state.lastIncAcc) ? state.lastIncAcc : state.accounts[0].id;
  pad = {
    kind: 'i', id: i?.id, src: i?.src || 'Gaji', amount: i ? String(i.amount) : '',
    acc: i ? i.acc : def, note: i?.note || '', date: i?.date || today(),
  };
  openSheet(padHTML());
}
function padHTML() {
  const inc = pad.kind === 'i';
  const c = cat(pad.cat) || { emoji: '❔', name: 'Tanpa kategori' };
  const n = Number(pad.amount) || 0;
  const order = inc ? { bank: 0, cash: 1, invest: 2 } : { bank: 0, cash: 0, invest: 1 };
  const accs = [...state.accounts].sort((a, b) => order[a.group] - order[b.group]);
  const quick = inc ? [10000, 50000, 100000, 500000, 1000000] : [2000, 5000, 10000, 20000, 50000];
  return `
  ${inc
    ? `<h3><span>${srcEmoji(pad.src)}</span>Pemasukan<span class="small good" style="margin:0 0 0 auto">Menambah saldo</span></h3>`
    : `<h3><span>${esc(c.emoji)}</span>${esc(c.name)}<span class="small" style="margin:0 0 0 auto">${c.type === 'reserve' ? 'Cadangan' : 'Harian'}</span></h3>`}
  <p class="amount num ${n ? '' : 'zero'} ${inc && n ? 'good' : ''}" id="pad-amount">${rp(n)}</p>
  <div class="chips">
    ${quick.map(v => `<button class="chip" data-act="pad-quick" data-v="${v}">+${short(v)}</button>`).join('')}
  </div>
  ${inc ? `<div class="chips" aria-label="Jenis pemasukan">
    ${INCOME_SRC.map(([s, emo]) => `<button class="chip ${pad.src === s ? 'on' : ''}" data-act="pad-src" data-s="${s}">${emo} ${s}</button>`).join('')}
  </div>` : ''}
  <p class="small" style="margin:2px 0 4px">${inc ? 'Masuk ke' : 'Sumber dana'}</p>
  <div class="chips" aria-label="${inc ? 'Masuk ke' : 'Sumber dana'}">
    ${inc ? '' : `<button class="chip ${pad.acc ? '' : 'on'}" data-act="pad-acc" data-id="">Tanpa sumber</button>`}
    ${accs.map(a => `<button class="chip ${pad.acc === a.id ? 'on' : ''}" data-act="pad-acc" data-id="${a.id}">${esc(a.name)}<span class="bal num">${short(a.balance)}</span></button>`).join('')}
  </div>
  <div class="pad">
    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<button data-act="pad-key" data-k="${k}">${k}</button>`).join('')}
    <button data-act="pad-key" data-k="000">000</button>
    <button data-act="pad-key" data-k="0">0</button>
    <button data-act="pad-key" data-k="del" aria-label="Hapus angka">${ICON.del}</button>
  </div>
  <div class="meta">
    <input class="in" id="pad-note" placeholder="Catatan (opsional)" value="${esc(pad.note)}" maxlength="60">
    <input class="in" id="pad-date" type="date" value="${pad.date}" style="flex:0 0 150px">
  </div>
  <div class="actions">
    ${pad.id ? '<button class="btn danger-btn" data-act="pad-delete">Hapus</button>' : ''}
    <button class="btn primary" data-act="pad-save" style="flex:2">Simpan</button>
  </div>`;
}
function padRefresh() {
  const el = $('#pad-amount'); const n = Number(pad.amount) || 0;
  el.textContent = rp(n); el.classList.toggle('zero', !n);
  el.classList.toggle('good', pad.kind === 'i' && !!n);
}
function padSave() {
  const n = Number(pad.amount) || 0;
  if (!n) { toast('Masukkan nominal dulu'); return; }
  pad.note = $('#pad-note').value.trim();
  pad.date = $('#pad-date').value || today();
  if (pad.kind === 'i') {
    if (!acc(pad.acc)) { toast('Pilih platform tujuan'); return; }
    if (pad.id) removeIncome(pad.id);
    state.lastIncAcc = pad.acc;
    addIncome({ id: pad.id || uid(), amount: n, src: pad.src, acc: pad.acc, note: pad.note, date: pad.date, ts: Date.now() });
    toast(`+${rp(n)} masuk ke ${acc(pad.acc).name}`);
  } else {
    if (pad.id) removeExpense(pad.id);
    addExpense({ id: pad.id || uid(), amount: n, cat: pad.cat, acc: pad.acc || null, note: pad.note, date: pad.date, ts: Date.now() });
    toast(`${rp(n)} tercatat`);
  }
  closeSheet();
  render();
}

/* ---------- Laporan ---------- */
function weekStart(s) { const d = parse(s); const off = (d.getDay() + 6) % 7; return addDays(s, -off); }
function sumBy(list) {
  const r = { daily: 0, reserve: 0 };
  for (const e of list) r[isReserve(e) ? 'reserve' : 'daily'] += e.amount;
  return r;
}
function inRange(a, b) { return state.expenses.filter(e => e.date >= a && e.date <= b); }

function viewReport() {
  const { mode, anchor } = rep;
  const D = state.settings.daily;
  let title, from, to, bars = [], limit = null, budget, tapMode = null;

  if (mode === 'day') {
    from = to = anchor; title = longDate(anchor);
    budget = D;
  } else if (mode === 'week') {
    from = weekStart(anchor); to = addDays(from, 6);
    title = `${midDate(from)} – ${midDate(to)}`;
    for (let i = 0; i < 7; i++) { const ds = addDays(from, i); bars.push({ key: ds, label: DAYS[parse(ds).getDay()], ...sumBy(inRange(ds, ds)) }); }
    limit = D; budget = D * 7; tapMode = 'day';
  } else if (mode === 'month') {
    const ym = anchor.slice(0, 7), dim = daysIn(ym);
    from = `${ym}-01`; to = `${ym}-${pad2(dim)}`;
    title = `${MONTHS[parse(from).getMonth()]} ${ym.slice(0, 4)}`;
    for (let d = 1; d <= dim; d++) { const ds = `${ym}-${pad2(d)}`; bars.push({ key: ds, label: d === 1 || d % 5 === 0 ? String(d) : '', ...sumBy(inRange(ds, ds)) }); }
    limit = D; budget = D * dim + state.settings.reserve; tapMode = 'day';
  } else {
    const y = anchor.slice(0, 4);
    from = `${y}-01-01`; to = `${y}-12-31`; title = y;
    budget = 0;
    for (let m = 1; m <= 12; m++) {
      const ym = `${y}-${pad2(m)}`;
      bars.push({ key: `${ym}-01`, label: MONTHS[m - 1].slice(0, 1), ...sumBy(inRange(`${ym}-01`, `${ym}-31`)) });
      budget += D * daysIn(ym) + state.settings.reserve;
    }
    limit = D * 30 + state.settings.reserve; tapMode = 'month';
  }

  const list = inRange(from, to);
  const incs = state.incomes.filter(i => i.date >= from && i.date <= to);
  const incTotal = incs.reduce((s, i) => s + i.amount, 0);
  const adjTotal = state.adjusts.filter(a => a.kind === 'adj' && a.date >= from && a.date <= to).reduce((s, a) => s + a.amount, 0);
  const tot = sumBy(list), total = tot.daily + tot.reserve;
  const byCat = {};
  for (const e of list) byCat[e.cat] = (byCat[e.cat] || 0) + e.amount;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  let extra = '';
  if (mode === 'day') {
    const left = D - tot.daily;
    extra = `<p class="small num">Harian ${rp(tot.daily)} dari ${rp(D)} · cadangan ${rp(tot.reserve)}${left < 0 ? ` · <span class="danger">lebih ${rp(-left)}</span>` : ''}</p>`;
  } else if (mode === 'month') {
    const mb = monthBudget(anchor.slice(0, 7));
    extra = `<p class="small num">Sisa cadangan ${rp(mb.left)}</p>`;
  }

  return `
  <div class="seg" role="tablist">
    ${[['day', 'Hari'], ['week', 'Minggu'], ['month', 'Bulan'], ['year', 'Tahun']].map(([k, l]) =>
      `<button class="${mode === k ? 'on' : ''}" data-act="rep-mode" data-m="${k}">${l}</button>`).join('')}
  </div>
  <div class="period">
    <button class="icon-btn" data-act="rep-step" data-d="-1" aria-label="Sebelumnya">${ICON.back}</button>
    <strong>${title}</strong>
    <button class="icon-btn" data-act="rep-step" data-d="1" aria-label="Berikutnya">${ICON.next}</button>
  </div>
  <div class="card">
    <p class="label">Total keluar</p>
    <p class="big num ${total > budget ? 'danger' : ''}">${rp(total)}</p>
    <p class="small num">dari budget ${rp(budget)}</p>
    ${extra}
    ${incTotal ? `<p class="small num">Pemasukan <span class="good">+${rp(incTotal)}</span> · selisih ${rp(incTotal - total)}</p>` : ''}
    ${adjTotal ? `<p class="small num">Penyesuaian saldo ${adjTotal > 0 ? '+' : ''}${rp(adjTotal)} <span style="color:var(--faint)">(di luar catatan)</span></p>` : ''}
    ${bars.length ? chart(bars, limit, tapMode) + `<p class="legend"><span>Harian</span><span class="r">Cadangan</span><span style="color:var(--danger)">- - ${mode === 'year' ? 'budget bulanan (±30 hari)' : 'jatah harian'}</span></p>` : ''}
  </div>

  <h2>Per kategori</h2>
  <div class="list">
    ${cats.length ? cats.map(([id, v]) => {
      const c = cat(id) || { emoji: '❔', name: 'Tanpa kategori' };
      return `<div class="row"><span class="emo">${esc(c.emoji)}</span>
        <span class="grow"><p class="t">${esc(c.name)}</p><div class="hbar"><i class="${c.type === 'reserve' ? 'r' : ''}" style="width:${v / total * 100}%"></i></div></span>
        <span class="v num" style="text-align:right">${short(v)}<br><span class="small" style="margin:0">${Math.round(v / total * 100)}%</span></span></div>`;
    }).join('') : '<p class="empty">Tidak ada pengeluaran di periode ini.</p>'}
  </div>

  <h2>Transaksi</h2>
  <div class="list">${txList(list, incs, mode)}</div>`;
}
function txList(list, incs, mode) {
  const sorted = merged(list, incs);
  if (!sorted.length) return '<p class="empty">Tidak ada transaksi.</p>';
  const out$ = xs => xs.filter(x => x._k === 'e').reduce((s, x) => s + x.amount, 0);
  const in$ = xs => xs.filter(x => x._k === 'i').reduce((s, x) => s + x.amount, 0);
  const sums = xs => `${in$(xs) ? `<span class="good">+${short(in$(xs))}</span> · ` : ''}-${short(out$(xs))}`;
  if (mode === 'day') return sorted.map(x => row(x, false)).join('');
  if (mode === 'year') {
    const byM = {};
    for (const x of sorted) { const k = x.date.slice(0, 7); (byM[k] = byM[k] || []).push(x); }
    return Object.entries(byM).map(([k, xs]) => `<button class="row" data-act="rep-goto" data-mode="month" data-key="${k}-01">
      <span class="grow"><p class="t">${MONTHS[Number(k.slice(5)) - 1]}</p><p class="s">${xs.length} transaksi</p></span>
      <span class="v num">${sums(xs)}</span></button>`).join('');
  }
  let out = '', cur = '';
  for (const x of sorted) {
    if (x.date !== cur) {
      cur = x.date;
      out += `<div class="day-head"><span>${longDate(cur)}</span><span class="num">${sums(sorted.filter(y => y.date === cur))}</span></div>`;
    }
    out += row(x, false);
  }
  return out;
}
function chart(bars, limit, tapMode) {
  const W = 320, H = 140, top = 8, bottom = 18, ch = H - top - bottom;
  const max = Math.max(limit || 0, ...bars.map(b => b.daily + b.reserve), 1) * 1.08;
  const step = W / bars.length, bw = Math.max(2, Math.min(28, step * .62));
  const y = v => top + ch - v / max * ch;
  const t = today();
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik pengeluaran">`;
  bars.forEach((b, i) => {
    const x = i * step + (step - bw) / 2;
    const hd = b.daily / max * ch, hr = b.reserve / max * ch;
    const isToday = tapMode === 'day' ? b.key === t : b.key.slice(0, 7) === t.slice(0, 7);
    if (isToday) s += `<rect class="sel" x="${i * step}" y="${top}" width="${step}" height="${ch}" rx="3"/>`;
    if (hd) s += `<rect class="b-d" x="${x}" y="${top + ch - hd}" width="${bw}" height="${hd}" rx="1.5"/>`;
    if (hr) s += `<rect class="b-r" x="${x}" y="${top + ch - hd - hr}" width="${bw}" height="${hr}" rx="1.5"/>`;
    if (b.label) s += `<text x="${i * step + step / 2}" y="${H - 4}" text-anchor="middle">${b.label}</text>`;
    s += `<rect class="hit" x="${i * step}" y="0" width="${step}" height="${H}" data-act="rep-goto" data-mode="${tapMode}" data-key="${b.key}"><title>${rp(b.daily + b.reserve)}</title></rect>`;
  });
  if (limit) s += `<line class="lim" x1="0" x2="${W}" y1="${y(limit)}" y2="${y(limit)}"/>`;
  return s + '</svg>';
}
function repStep(d) {
  const { mode, anchor } = rep;
  if (mode === 'day') rep.anchor = addDays(anchor, d);
  else if (mode === 'week') rep.anchor = addDays(anchor, 7 * d);
  else if (mode === 'month') { const x = parse(anchor); rep.anchor = ymd(new Date(x.getFullYear(), x.getMonth() + d, 1)); }
  else rep.anchor = `${Number(anchor.slice(0, 4)) + d}-01-01`;
}

/* ---------- Aset ---------- */
function viewAssets() {
  const total = totalAssets();
  const keys = Object.keys(state.snaps).sort();
  const monthStart = today().slice(0, 7) + '-01';
  const prevKey = keys.filter(k => k < monthStart).pop();
  let delta = '';
  if (prevKey !== undefined) {
    const d = total - state.snaps[prevKey];
    delta = `<p class="small num ${d >= 0 ? 'good' : 'danger'}">${d >= 0 ? '+' : ''}${rp(d)} dari bulan lalu</p>`;
  } else if (keys.length) {
    delta = `<p class="small">Tercatat sejak ${midDate(keys[0])}</p>`;
  }
  const groups = Object.keys(GROUPS).map(g => {
    const list = state.accounts.filter(a => a.group === g);
    if (!list.length) return '';
    const sum = list.reduce((s, a) => s + a.balance, 0);
    return `<h2 style="display:flex;justify-content:space-between"><span>${GROUPS[g]}</span><span class="num">${rp(sum)}</span></h2>
    <div class="list">${list.map(a => `<button class="row" data-act="acc-edit" data-id="${a.id}">
      <span class="badge">${esc(a.name.slice(0, 2).toUpperCase())}</span>
      <span class="grow"><p class="t">${esc(a.name)}</p></span>
      <span class="v num ${a.balance < 0 ? 'danger' : ''}">${rp(a.balance)}</span></button>`).join('')}</div>`;
  }).join('');

  const open = state.loans.filter(l => !l.back).sort((a, b) => b.date.localeCompare(a.date));
  const done = state.loans.length - open.length;
  const gain = state.adjusts.filter(a => a.kind === 'gain' && a.date >= monthStart).reduce((s, a) => s + a.amount, 0);
  const loans = open.length || done ? `
  <h2 style="display:flex;justify-content:space-between"><span>Piutang</span><span class="num">${rp(loanOut())}</span></h2>
  <div class="list">
    ${open.map(l => `<button class="row" data-act="loan-view" data-id="${l.id}">
      <span class="badge">${esc(l.who.slice(0, 2).toUpperCase())}</span>
      <span class="grow"><p class="t">${esc(l.who)}</p><p class="s">${midDate(l.date)} · dari ${esc(acc(l.from)?.name || '?')}${l.note ? ' · ' + esc(l.note) : ''}</p></span>
      <span class="v num">${rp(l.amount)}</span></button>`).join('') || '<p class="empty">Semua piutang sudah kembali.</p>'}
  </div>
  ${done ? `<button class="link" data-act="loan-history" style="margin-top:8px">Sudah kembali (${done})</button>` : ''}` : '';

  return `
  <div class="card">
    <p class="label">Total aset</p>
    <p class="big num">${rp(total)}</p>
    ${delta}
    ${loanOut() ? `<p class="small num">Termasuk piutang ${rp(loanOut())}</p>` : ''}
    ${gain ? `<p class="small num">Investasi bulan ini <span class="${gain >= 0 ? 'good' : 'danger'}">${gain >= 0 ? '+' : ''}${rp(gain)}</span></p>` : ''}
    ${trend(keys)}
  </div>
  <div class="actions">
    <button class="btn" data-act="acc-edit">＋ Platform</button>
    <button class="btn" data-act="transfer">⇄ Transfer</button>
    <button class="btn" data-act="loan-new">↗ Pinjamkan</button>
  </div>
  ${groups || '<p class="empty">Belum ada platform. Tambahkan BCA, Jago, Bibit, dan lainnya.</p>'}
  ${loans}
  <p class="small" style="margin-top:12px">Tap platform untuk melihat riwayat atau menyesuaikan saldo. Selisihnya dicatat sebagai penyesuaian (untuk investasi: naik/turun nilai).</p>`;
}

/* ---------- Riwayat platform ---------- */
function accHistory(id) {
  const h = [], name = x => esc(acc(x)?.name || '?');
  for (const e of state.expenses) if (e.acc === id) h.push({ d: e.date, ts: e.ts, t: esc(cat(e.cat)?.name || 'Pengeluaran'), v: -e.amount });
  for (const i of state.incomes) if (i.acc === id) h.push({ d: i.date, ts: i.ts, t: esc(i.src || 'Pemasukan'), v: i.amount });
  for (const x of state.transfers) {
    if (x.from === id) h.push({ d: x.date, ts: x.ts, t: `Transfer ke ${name(x.to)}`, v: -x.amount });
    if (x.to === id) h.push({ d: x.date, ts: x.ts, t: `Transfer dari ${name(x.from)}`, v: x.amount });
  }
  for (const l of state.loans) {
    if (l.from === id) h.push({ d: l.date, ts: l.ts, t: `Dipinjam ${esc(l.who)}`, v: -l.amount });
    if (l.back?.to === id) h.push({ d: l.back.date, ts: l.back.ts, t: `Kembali dari ${esc(l.who)}`, v: l.amount });
  }
  const ADJ = { adj: 'Penyesuaian', init: 'Saldo awal' };
  for (const a of state.adjusts) if (a.acc === id) {
    const t = a.kind === 'gain' ? (a.amount >= 0 ? 'Nilai naik' : 'Nilai turun') : ADJ[a.kind];
    h.push({ d: a.date, ts: a.ts, t: t + (a.note ? ' · ' + esc(a.note) : ''), v: a.amount });
  }
  return h.sort((a, b) => b.d.localeCompare(a.d) || b.ts - a.ts).slice(0, 10);
}

/* ---------- Piutang ---------- */
function loanNewSheet() {
  if (!state.accounts.length) { toast('Tambahkan platform dulu'); return; }
  openSheet(`
  <h3>Pinjamkan uang</h3>
  <label class="field"><span>Dipinjam oleh</span><input class="in" id="l-who" placeholder="Rafi" maxlength="24"></label>
  <label class="field"><span>Nominal (Rp)</span><input class="in num" id="l-amt" inputmode="numeric" placeholder="0" data-money></label>
  <label class="field"><span>Diambil dari</span><select class="in" id="l-from">${accOpts(state.lastAcc)}</select></label>
  <div class="meta">
    <input class="in" id="l-note" placeholder="Catatan (opsional)" maxlength="60">
    <input class="in" id="l-date" type="date" value="${today()}" style="flex:0 0 150px">
  </div>
  <p class="small">Saldo platform berkurang, tapi total aset tetap karena uangnya masih milikmu. Tidak dihitung sebagai pengeluaran.</p>
  <div class="actions"><button class="btn primary" data-act="loan-save">Simpan</button></div>`);
}
function loanViewSheet(id) {
  const l = state.loans.find(x => x.id === id); if (!l) return;
  openSheet(`
  <h3>${esc(l.who)}<span class="small" style="margin:0 0 0 auto">${l.back ? 'Sudah kembali' : 'Belum kembali'}</span></h3>
  <p class="amount num">${rp(l.amount)}</p>
  <p class="small">Dipinjam ${longDate(l.date)} dari ${esc(acc(l.from)?.name || '?')}${l.note ? ` · ${esc(l.note)}` : ''}</p>
  ${l.back
    ? `<p class="small">Dikembalikan ${longDate(l.back.date)} ke ${esc(acc(l.back.to)?.name || '?')}</p>
       <div class="actions"><button class="btn danger-btn" data-act="loan-delete" data-id="${id}">Hapus catatan</button></div>`
    : `<label class="field"><span>Dikembalikan ke</span><select class="in" id="l-to">${accOpts(l.from)}</select></label>
       <div class="actions">
         <button class="btn danger-btn" data-act="loan-delete" data-id="${id}">Hapus</button>
         <button class="btn primary" data-act="loan-back" data-id="${id}" style="flex:2">Sudah dikembalikan</button>
       </div>`}`);
}
function loanHistorySheet() {
  const done = state.loans.filter(l => l.back).sort((a, b) => b.back.date.localeCompare(a.back.date));
  openSheet(`
  <h3>Piutang yang sudah kembali</h3>
  <div class="list" style="margin-top:12px">${done.map(l => `<button class="row" data-act="loan-view" data-id="${l.id}">
    <span class="badge">${esc(l.who.slice(0, 2).toUpperCase())}</span>
    <span class="grow"><p class="t">${esc(l.who)}</p><p class="s">${midDate(l.date)} → ${midDate(l.back.date)} · ke ${esc(acc(l.back.to)?.name || '?')}</p></span>
    <span class="v num">${rp(l.amount)}</span></button>`).join('')}</div>`);
}
const accOpts = sel => state.accounts.map(a => `<option value="${a.id}" ${sel === a.id ? 'selected' : ''}>${esc(a.name)} (${short(a.balance)})</option>`).join('');
function trend(keys) {
  const pts = keys.slice(-90).map(k => state.snaps[k]);
  if (pts.length < 2) return '';
  const W = 320, H = 56, min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  const p = pts.map((v, i) => `${(i / (pts.length - 1) * W).toFixed(1)},${(H - 4 - (v - min) / span * (H - 8)).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tren total aset"><polyline class="trend" points="${p}"/></svg>`;
}
function accSheet(id) {
  const a = id ? acc(id) : { name: '', group: 'bank', balance: 0 };
  openSheet(`
  <h3>${id ? 'Ubah platform' : 'Tambah platform'}</h3>
  <label class="field"><span>Nama</span><input class="in" id="a-name" value="${esc(a.name)}" placeholder="BCA" maxlength="24"></label>
  <label class="field"><span>Jenis</span><select class="in" id="a-group">
    ${Object.entries(GROUPS).map(([k, l]) => `<option value="${k}" ${a.group === k ? 'selected' : ''}>${l}</option>`).join('')}
  </select></label>
  <label class="field"><span>Saldo / nilai sekarang (Rp)</span><input class="in num" id="a-bal" inputmode="numeric" value="${a.balance ? Math.round(a.balance).toLocaleString('id-ID') : ''}" placeholder="0" data-money></label>
  ${id ? `<label class="field"><span>Keterangan kalau saldo berubah (opsional)</span><input class="in" id="a-note" placeholder="${a.group === 'invest' ? 'update nilai Bibit' : 'lupa dicatat'}" maxlength="40"></label>` : ''}
  <div class="actions">
    ${id ? `<button class="btn danger-btn" data-act="acc-delete" data-id="${id}">Hapus</button>` : ''}
    <button class="btn primary" data-act="acc-save" data-id="${id || ''}" style="flex:2">Simpan</button>
  </div>
  ${id ? (h => `<h2>Riwayat</h2><div class="list">${h.length ? h.map(x => `<div class="row">
    <span class="grow"><p class="t">${x.t}</p><p class="s">${midDate(x.d)}</p></span>
    <span class="v num ${x.v > 0 ? 'good' : ''}">${x.v > 0 ? '+' : ''}${rp(x.v)}</span></div>`).join('') : '<p class="empty">Belum ada riwayat.</p>'}</div>`)(accHistory(id)) : ''}`);
}
function transferSheet() {
  openSheet(`
  <h3>Transfer antar platform</h3>
  <label class="field"><span>Dari</span><select class="in" id="t-from">${accOpts(state.accounts[0]?.id)}</select></label>
  <label class="field"><span>Ke</span><select class="in" id="t-to">${accOpts(state.accounts[1]?.id)}</select></label>
  <label class="field"><span>Nominal (Rp)</span><input class="in num" id="t-amt" inputmode="numeric" placeholder="0" data-money></label>
  <label class="field"><span>Biaya admin (Rp)</span><input class="in num" id="t-fee" inputmode="numeric" placeholder="0" data-money></label>
  <div class="chips">
    ${[0, 1000, 2500, 6500].map(v => `<button class="chip" data-act="fee-quick" data-v="${v}">${v ? rp(v) : 'Gratis'}</button>`).join('')}
  </div>
  <p class="small">Biaya admin dipotong dari platform asal dan dicatat sebagai pengeluaran "Biaya admin" (cadangan).</p>
  <div class="actions"><button class="btn primary" data-act="transfer-save">Transfer</button></div>`);
}

/* ---------- Atur ---------- */
function viewSettings() {
  const s = state.settings;
  return `
  <h2>Budget</h2>
  <div class="card" style="margin-top:0">
    <label class="field" style="margin-top:0"><span>Jatah harian (Rp)</span><input class="in num" inputmode="numeric" data-money data-set="daily" value="${s.daily.toLocaleString('id-ID')}"></label>
    <label class="field"><span>Cadangan bulanan (Rp)</span><input class="in num" inputmode="numeric" data-money data-set="reserve" value="${s.reserve.toLocaleString('id-ID')}"></label>
    <p class="small">Sisa jatah harian masuk ke cadangan. Kalau jatah harian terlewati, kelebihannya dipotong dari cadangan. Perubahan berlaku juga untuk perhitungan bulan berjalan.</p>
  </div>

  <h2>Kategori</h2>
  <div class="list">
    ${state.categories.map(c => `<button class="row" data-act="cat-edit" data-id="${c.id}">
      <span class="emo">${esc(c.emoji)}</span><span class="grow"><p class="t">${esc(c.name)}</p></span>
      <span class="s">${c.type === 'reserve' ? 'Cadangan' : 'Harian'}</span></button>`).join('')}
    <button class="row" data-act="cat-edit"><span class="emo">＋</span><span class="grow"><p class="t">Tambah kategori</p></span></button>
  </div>

  <h2>Tampilan</h2>
  <div class="seg">
    ${[['system', 'Ikuti sistem'], ['light', 'Terang'], ['dark', 'Gelap']].map(([k, l]) =>
      `<button class="${s.theme === k ? 'on' : ''}" data-act="theme" data-t="${k}">${l}</button>`).join('')}
  </div>

  <h2>Backup otomatis (GitHub)</h2>
  <div class="card" style="margin-top:0">
    ${gh ? `
    <p class="label">Tersambung ke <b>${esc(gh.repo)}</b></p>
    <p class="small" id="gh-status">${ghStatus()}</p>
    <div class="actions">
      <button class="btn" data-act="gh-push">Backup</button>
      <button class="btn" data-act="gh-restore">Pulihkan</button>
    </div>
    <button class="link" data-act="gh-off" style="margin-top:12px">Putuskan sambungan</button>` : `
    <p class="small" style="margin-top:0">Kirim data otomatis ke repo GitHub private, supaya aman kalau HP rusak, ganti HP, atau data Chrome terhapus.</p>
    <div class="actions"><button class="btn" data-act="gh-setup">Hubungkan GitHub</button></div>`}
  </div>

  <h2>Backup file</h2>
  <div class="card" style="margin-top:0">
    <p class="small" style="margin-top:0">${meta.lastAt ? `Backup terakhir ${ago(meta.lastAt)}.` : 'Belum pernah backup.'} Backup membuka menu Bagikan, jadi file bisa langsung dikirim ke Drive atau WhatsApp.</p>
    <div class="actions">
      <button class="btn" data-act="export">Backup</button>
      <button class="btn" data-act="import">Restore</button>
    </div>
    <input type="file" id="import-file" accept="application/json,.json,text/plain,.txt" hidden>
  </div>

  <h2>Salinan harian di HP</h2>
  <div class="list">
    ${Object.entries(load(SNAPK, {})).sort((a, b) => b[0].localeCompare(a[0])).map(([d, s]) => `
      <button class="row" data-act="snap-restore" data-d="${d}">
        <span class="grow"><p class="t">${longDate(d)}</p><p class="s">${s.expenses.length} catatan · kondisi awal hari</p></span>
        <span class="s">Pulihkan</span></button>`).join('') || '<p class="empty">Belum ada salinan.</p>'}
  </div>
  <p class="small">Untuk membatalkan salah hapus. Disimpan di HP yang sama, jadi bukan pengganti backup.</p>
  <button class="link" data-act="reset" style="margin-top:12px">Hapus semua data</button>

  <h2>Tentang</h2>
  <div class="card" style="margin-top:0">
    <svg class="wordmark" viewBox="130 62 655.5 284" role="img" aria-label="AceCore Nexus">
      <g transform="translate(-85,-68) scale(0.85)">
        <path fill-rule="evenodd" d="M400 160 540 240V400L400 480 260 400V240ZM400 210 300 268V372L400 430 500 372V268Z"/>
        <path fill-rule="evenodd" d="M400 278a42 42 0 1 0 0.001 0ZM400 304a16 16 0 1 1-0.001 0Z"/>
      </g>
      <text x="430" y="205" style="font:700 88px 'Space Grotesk',sans-serif">AceCore</text>
      <text x="434" y="268" style="font:500 34px 'JetBrains Mono',monospace;letter-spacing:16px">NEXUS</text>
    </svg>
    <p class="small">AceTrack v1.3 · pencatat pengeluaran dan aset pribadi</p>
  </div>`;
}
function catSheet(id) {
  const c = id ? cat(id) : { name: '', emoji: '🏷️', type: 'daily' };
  openSheet(`
  <h3>${id ? 'Ubah kategori' : 'Tambah kategori'}</h3>
  <div class="inline">
    <label class="field" style="flex:0"><span>Ikon</span><input class="in emo-in" id="c-emoji" value="${esc(c.emoji)}" maxlength="4"></label>
    <label class="field"><span>Nama</span><input class="in" id="c-name" value="${esc(c.name)}" placeholder="Kopi" maxlength="20"></label>
  </div>
  <label class="field"><span>Dipotong dari</span><select class="in" id="c-type">
    <option value="daily" ${c.type === 'daily' ? 'selected' : ''}>Jatah harian</option>
    <option value="reserve" ${c.type === 'reserve' ? 'selected' : ''}>Cadangan bulanan</option>
  </select></label>
  <p class="small">Pakai "Cadangan" untuk pengeluaran yang tidak tiap hari, seperti bensin atau belanja bulanan.</p>
  <div class="actions">
    ${id ? `<button class="btn danger-btn" data-act="cat-delete" data-id="${id}">Hapus</button>` : ''}
    <button class="btn primary" data-act="cat-save" data-id="${id || ''}" style="flex:2">Simpan</button>
  </div>`);
}
function applyTheme() {
  const t = state.settings.theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

/* ---------- Backup ---------- */
const DAY_MS = 864e5;
const hhmm = (ts = Date.now()) => { const d = new Date(ts); return `${pad2(d.getHours())}.${pad2(d.getMinutes())}`; };
function ago(ts) {
  const m = Math.floor((Date.now() - ts) / 6e4);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  if (m < 1440) return `${Math.floor(m / 60)} jam lalu`;
  return `${Math.floor(m / 1440)} hari lalu`;
}

// Salinan harian di HP: diambil saat aplikasi pertama dibuka tiap hari, simpan 7 terakhir.
function dailySnapshot() {
  const snaps = load(SNAPK, {}), t = today();
  if (snaps[t]) return;
  snaps[t] = state;
  const keys = Object.keys(snaps).sort();
  while (keys.length > 7) delete snaps[keys.shift()];
  while (!store(SNAPK, snaps) && keys.length > 1) delete snaps[keys.shift()];
}

// Peringatan muncul kalau sudah 3 hari belum backup; "Nanti" menunda 2 hari.
function backupDue() {
  if (!state.expenses.length || Date.now() < (meta.snooze || 0)) return 0;
  const ref = meta.lastAt || parse(state.start).getTime();
  const days = Math.floor((Date.now() - ref) / DAY_MS);
  return days >= 3 ? days : 0;
}
function backupDone() { meta.lastAt = Date.now(); meta.snooze = 0; store(META, meta); }

function download(text, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// Chrome Android hanya mau membagikan tipe file tertentu, jadi backup dibagikan sebagai .txt
async function exportBackup() {
  const json = JSON.stringify(state, null, 1), name = `acetrack-backup-${today()}`;
  const file = new File([json], name + '.txt', { type: 'text/plain' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Backup AceTrack' }); }
    catch (e) { if (e.name === 'AbortError') return; download(json, name + '.json'); }
  } else download(json, name + '.json');
  backupDone(); render(); toast('Backup dibuat');
}

// Sinkron ke file acetrack-backup.json di repo GitHub private.
const GH_FILE = 'acetrack-backup.json';
const b64enc = s => {
  const b = new TextEncoder().encode(s); let bin = '';
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(bin);
};
const ghReq = (path, opts = {}) => fetch(`https://api.github.com/repos/${gh.repo}${path}`, {
  method: opts.method || 'GET', body: opts.body, cache: 'no-store',
  headers: { Authorization: `Bearer ${gh.token}`, Accept: opts.accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
});
const ghErr = s => ({
  401: 'Token tidak valid atau sudah kedaluwarsa',
  403: 'Token tidak punya izin tulis ke repo ini',
  404: 'Repo tidak ditemukan atau token tidak punya akses',
}[s] || `GitHub menolak (kode ${s})`);

let syncing = false, syncTimer;
// Paling sering sekali tiap 30 menit, supaya riwayat commit tidak kebanjiran.
function syncSoon(delay) {
  if (!gh) return;
  clearTimeout(syncTimer);
  const wait = delay ?? Math.max(15000, (meta.lastGh || 0) + 30 * 6e4 - Date.now());
  syncTimer = setTimeout(() => pushGh(false), wait);
}
async function pushGh(manual) {
  if (!gh || syncing) return;
  syncing = true;
  try {
    const put = sha => ghReq(`/contents/${GH_FILE}`, {
      method: 'PUT',
      body: JSON.stringify({ message: `Backup ${today()} ${hhmm()}`, content: b64enc(JSON.stringify(state, null, 1)), ...(sha ? { sha } : {}) }),
    });
    let r = await put(meta.ghSha);
    if (r.status === 409 || r.status === 422) {
      const g = await ghReq(`/contents/${GH_FILE}`);
      r = await put(g.ok ? (await g.json()).sha : undefined);
    }
    if (!r.ok) throw new Error(ghErr(r.status));
    meta.ghSha = (await r.json()).content.sha;
    meta.lastGh = meta.lastAt = Date.now(); meta.dirty = false; meta.ghError = ''; meta.snooze = 0;
    if (manual) toast('Tersimpan ke GitHub');
  } catch (e) {
    meta.ghError = e instanceof TypeError ? 'Tidak ada internet, dicoba lagi nanti' : e.message;
    if (manual) toast(meta.ghError);
  } finally {
    syncing = false; store(META, meta);
    const el = $('#gh-status'); if (el) el.innerHTML = ghStatus();
  }
}
function ghStatus() {
  if (meta.ghError) return `<span class="danger">${esc(meta.ghError)}</span>`;
  return meta.lastGh ? `Backup terakhir ke GitHub ${ago(meta.lastGh)}` : 'Belum pernah backup ke GitHub';
}
function ghSheet() {
  openSheet(`
  <h3>Backup otomatis ke GitHub</h3>
  <p class="small">Data dikirim ke repo <b>private</b> milikmu setiap aplikasi dibuka dan setelah ada perubahan (paling sering 30 menit sekali). Token hanya disimpan di HP ini dan tidak ikut ke file backup.</p>
  <label class="field"><span>Repo (username/nama-repo)</span><input class="in" id="g-repo" placeholder="username/acetrack-data" value="${esc(gh?.repo || '')}" autocapitalize="off" autocomplete="off" spellcheck="false"></label>
  <label class="field"><span>Fine-grained token</span><input class="in" id="g-token" type="password" placeholder="github_pat_…" autocomplete="off"></label>
  <div class="actions"><button class="btn primary" data-act="gh-connect">Hubungkan</button></div>`);
}

/* ---------- Sheet & toast ---------- */
let sheetOpen = false;
function openSheet(html) {
  $('#sheet .sheet').innerHTML = html;
  $('#sheet').hidden = false;
  if (!sheetOpen) { history.pushState({ sheet: 1 }, ''); sheetOpen = true; }
}
function closeSheet(fromNav) {
  if (!sheetOpen) return;
  $('#sheet').hidden = true; sheetOpen = false;
  if (!fromNav && history.state?.sheet) history.back();
}
window.addEventListener('popstate', () => { if (sheetOpen) { $('#sheet').hidden = true; sheetOpen = false; } });
let toastTimer;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------- Event ---------- */
document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.matches('[data-money]')) {
    // Tanda minus di depan dipertahankan (saldo bisa minus); parseNum sendiri mengabaikannya.
    const n = parseNum(el.value), neg = /^\s*-/.test(el.value);
    el.value = (neg ? '-' : '') + (n ? n.toLocaleString('id-ID') : '');
  }
});
document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.matches('[data-set]')) {
    state.settings[el.dataset.set] = parseNum(el.value); save(); toast('Budget disimpan');
  }
  if (el.id === 'import-file' && el.files[0]) {
    el.files[0].text().then(txt => {
      const d = JSON.parse(txt);
      if (!validBackup(d)) throw new Error();
      if (!confirm('Restore akan mengganti semua data di HP ini dengan isi backup. Lanjut?')) return;
      replaceState(d); toast('Data dipulihkan');
    }).catch(() => toast('File backup tidak valid'));
    el.value = '';
  }
});

const actions = {
  'add': d => openPad(d.cat),
  'edit': d => { const e = state.expenses.find(x => x.id === d.id); if (e) openPad(null, e); },
  'close-sheet': () => closeSheet(),
  'pad-key': d => {
    if (d.k === 'del') pad.amount = pad.amount.slice(0, -1);
    else if (d.k === '000') { if (pad.amount) pad.amount += '000'; }
    else pad.amount = (pad.amount === '0' ? '' : pad.amount) + d.k;
    pad.amount = pad.amount.slice(0, 12); padRefresh();
  },
  'pad-quick': d => { pad.amount = String((Number(pad.amount) || 0) + Number(d.v)); padRefresh(); },
  'pad-acc': (d, el) => {
    pad.acc = d.id || null;
    el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === el));
  },
  'pad-save': () => padSave(),
  'pad-delete': () => {
    if (!confirm('Hapus catatan ini?')) return;
    if (pad.kind === 'i') removeIncome(pad.id); else removeExpense(pad.id);
    closeSheet(); toast('Catatan dihapus'); render();
  },
  'income': () => openIncome(),
  'edit-income': d => { const i = state.incomes.find(x => x.id === d.id); if (i) openIncome(i); },
  'pad-src': (d, el) => {
    pad.src = d.s;
    el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === el));
    $('#sheet h3 span').textContent = srcEmoji(d.s);
  },
  'rep-mode': d => { rep.mode = d.m; render(); },
  'rep-step': d => { repStep(Number(d.d)); render(); },
  'rep-goto': d => { rep.mode = d.mode; rep.anchor = d.key; render(); window.scrollTo({ top: 0 }); },
  'acc-edit': d => accSheet(d.id),
  'acc-save': d => {
    const name = $('#a-name').value.trim();
    if (!name) { toast('Isi nama platform'); return; }
    const raw = $('#a-bal').value, group = $('#a-group').value;
    const balance = (/^\s*-/.test(raw) ? -1 : 1) * parseNum(raw);
    let a = acc(d.id);
    if (!a) { a = { id: uid(), name, group, balance: 0 }; state.accounts.push(a); }
    const delta = balance - a.balance;
    if (delta) {
      // Platform yang belum punya riwayat dianggap mengisi saldo awal.
      const fresh = !a.balance && !accHistory(a.id).length;
      const kind = fresh ? 'init' : group === 'invest' ? 'gain' : 'adj';
      state.adjusts.push({ id: uid(), acc: a.id, amount: delta, kind, note: $('#a-note')?.value.trim() || '', date: today(), ts: Date.now() });
    }
    Object.assign(a, { name, group, balance });
    snapshot(); save(); closeSheet(); render();
  },
  'acc-delete': d => {
    const a = acc(d.id);
    if (!confirm(`Hapus ${a.name}? Catatan pengeluaran lama tetap ada, tapi tanpa sumber dana.`)) return;
    state.accounts = state.accounts.filter(x => x.id !== d.id);
    if (state.lastAcc === d.id) state.lastAcc = null;
    snapshot(); save(); closeSheet(); render();
  },
  'transfer': () => {
    if (state.accounts.length < 2) { toast('Butuh minimal dua platform'); return; }
    transferSheet();
  },
  'transfer-save': () => {
    const from = acc($('#t-from').value), to = acc($('#t-to').value);
    const n = parseNum($('#t-amt').value), fee = parseNum($('#t-fee').value);
    if (from === to) { toast('Pilih dua platform yang berbeda'); return; }
    if (!n) { toast('Masukkan nominal'); return; }
    from.balance -= n; to.balance += n;
    state.transfers.push({ id: uid(), from: from.id, to: to.id, amount: n, fee, date: today(), ts: Date.now() });
    if (fee) addExpense({ id: uid(), amount: fee, cat: adminCat().id, acc: from.id, note: `Transfer ke ${to.name}`, date: today(), ts: Date.now() });
    else { snapshot(); save(); }
    closeSheet(); render();
    toast(`${rp(n)} dipindah ke ${to.name}${fee ? ` · admin ${rp(fee)}` : ''}`);
  },
  'insight': () => insightSheet(),
  'loan-new': () => loanNewSheet(),
  'loan-view': d => loanViewSheet(d.id),
  'loan-history': () => loanHistorySheet(),
  'loan-save': () => {
    const who = $('#l-who').value.trim(), amount = parseNum($('#l-amt').value), from = acc($('#l-from').value);
    if (!who) { toast('Isi siapa yang meminjam'); return; }
    if (!amount) { toast('Masukkan nominal'); return; }
    from.balance -= amount;
    state.loans.push({ id: uid(), who, amount, from: from.id, note: $('#l-note').value.trim(), date: $('#l-date').value || today(), ts: Date.now(), back: null });
    snapshot(); save(); closeSheet(); render(); toast(`${who} pinjam ${rp(amount)}`);
  },
  'loan-back': d => {
    const l = state.loans.find(x => x.id === d.id), to = acc($('#l-to').value);
    if (!l || !to) return;
    to.balance += l.amount;
    l.back = { to: to.id, date: today(), ts: Date.now() };
    snapshot(); save(); closeSheet(); render(); toast(`${rp(l.amount)} kembali ke ${to.name}`);
  },
  'loan-delete': d => {
    const l = state.loans.find(x => x.id === d.id); if (!l) return;
    if (!confirm('Hapus catatan piutang ini? Saldo platform dikembalikan seperti sebelum dicatat.')) return;
    const f = acc(l.from); if (f) f.balance += l.amount;
    if (l.back) { const t = acc(l.back.to); if (t) t.balance -= l.amount; }
    state.loans = state.loans.filter(x => x !== l);
    snapshot(); save(); closeSheet(); render();
  },
  'fee-quick': d => { const v = Number(d.v); $('#t-fee').value = v ? v.toLocaleString('id-ID') : ''; },
  'cat-edit': d => catSheet(d.id),
  'cat-save': d => {
    const name = $('#c-name').value.trim();
    if (!name) { toast('Isi nama kategori'); return; }
    const v = { name, emoji: $('#c-emoji').value.trim() || '🏷️', type: $('#c-type').value };
    if (d.id) Object.assign(cat(d.id), v); else state.categories.push({ id: uid(), ...v });
    save(); closeSheet(); render();
  },
  'cat-delete': d => {
    if (state.expenses.some(e => e.cat === d.id)) { toast('Kategori ini sudah dipakai. Ubah namanya saja.'); return; }
    if (!confirm('Hapus kategori ini?')) return;
    state.categories = state.categories.filter(c => c.id !== d.id);
    save(); closeSheet(); render();
  },
  'theme': d => { state.settings.theme = d.t; save(); applyTheme(); render(); },
  'export': () => exportBackup(),
  'import': () => $('#import-file').click(),
  'snooze': () => { meta.snooze = Date.now() + 2 * DAY_MS; store(META, meta); render(); },
  'snap-restore': d => {
    const s = load(SNAPK, {})[d.d];
    if (!validBackup(s)) { toast('Salinan rusak'); return; }
    if (!confirm(`Kembalikan data ke kondisi awal ${longDate(d.d)}? Catatan setelahnya akan hilang.`)) return;
    replaceState(s); toast('Data dipulihkan');
  },
  'gh-setup': () => ghSheet(),
  'gh-connect': async () => {
    const repo = $('#g-repo').value.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
    const token = $('#g-token').value.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { toast('Tulis repo sebagai username/nama-repo'); return; }
    if (!token) { toast('Tempel token dulu'); return; }
    const prev = gh; gh = { repo, token };
    try {
      const r = await ghReq('');
      if (!r.ok) throw new Error(ghErr(r.status));
      if (!(await r.json()).private) throw new Error('Repo ini public. Pakai repo private supaya datamu tidak terbuka.');
    } catch (e) {
      gh = prev; toast(e instanceof TypeError ? 'Tidak ada internet' : e.message); return;
    }
    store(GHK, gh); meta.ghSha = undefined; meta.ghError = ''; store(META, meta);
    closeSheet(); render();
    await pushGh(true);
  },
  'gh-push': () => pushGh(true).then(() => { if (tab === 'beranda') render(); }),
  'gh-restore': async () => {
    try {
      const r = await ghReq(`/contents/${GH_FILE}`, { accept: 'application/vnd.github.raw+json' });
      if (!r.ok) throw new Error(r.status === 404 ? 'Belum ada backup di repo ini' : ghErr(r.status));
      const d = await r.json();
      if (!validBackup(d)) throw new Error('Isi backup di GitHub tidak valid');
      if (!confirm(`Ganti data di HP ini dengan backup GitHub (${d.expenses.length} catatan)?`)) return;
      replaceState(d); toast('Data dipulihkan dari GitHub');
    } catch (e) { toast(e instanceof TypeError ? 'Tidak ada internet' : e.message); }
  },
  'gh-off': () => {
    if (!confirm('Putuskan backup otomatis? Data di GitHub tetap ada.')) return;
    gh = null; localStorage.removeItem(GHK); clearTimeout(syncTimer); render();
  },
  'reset': () => {
    if (!confirm('Hapus SEMUA catatan, aset, dan pengaturan? Tidak bisa dibatalkan.')) return;
    if (!confirm('Yakin? Sebaiknya backup dulu.')) return;
    replaceState(defaults()); toast('Data direset');
  },
};
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) { ev.preventDefault(); fn(el.dataset, el); }
});

/* ---------- Mulai ---------- */
applyTheme();
dailySnapshot();
route();
if (gh && (meta.dirty || !meta.lastGh || ymd(new Date(meta.lastGh)) !== today())) syncSoon(3000);
window.addEventListener('online', () => { if (meta.dirty) syncSoon(3000); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
