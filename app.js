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
    snaps: {},
    lastAcc: null,
  };
}

const META = 'acetrack.meta', GHK = 'acetrack.gh', SNAPK = 'acetrack.snapshots';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

let state = load(KEY, null) || defaults();
// meta & token GitHub disimpan terpisah supaya tidak ikut ke file backup
let meta = load(META, {});
let gh = load(GHK, null);
store(KEY, state);
const save = () => {
  if (!store(KEY, state)) toast('Gagal menyimpan. Penyimpanan HP penuh?');
  meta.dirty = true; store(META, meta); syncSoon();
};
const validBackup = d => d && Array.isArray(d.expenses) && Array.isArray(d.categories) && Array.isArray(d.accounts) && d.settings;
function replaceState(d) { state = d; save(); applyTheme(); render(); }
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

const cat = id => state.categories.find(c => c.id === id);
const acc = id => state.accounts.find(a => a.id === id);
const totalAssets = () => state.accounts.reduce((s, a) => s + a.balance, 0);
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
  const recent = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts).slice(0, 5);
  const due = backupDue();

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

  <h2>Terakhir dicatat</h2>
  <div class="list">
    ${recent.length ? recent.map(rowExpense).join('') : '<p class="empty">Belum ada catatan. Tap kategori di atas untuk mulai.</p>'}
  </div>`;
}
function rowExpense(e, showDate = true) {
  const c = cat(e.cat) || { emoji: '❔', name: 'Tanpa kategori' };
  const a = acc(e.acc);
  const meta = [showDate ? midDate(e.date) : '', a ? a.name : '', e.note ? esc(e.note) : ''].filter(Boolean).join(' · ');
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
    id: e?.id, cat: e?.cat || catId, amount: e ? String(e.amount) : '',
    acc: e ? e.acc : (state.lastAcc && acc(state.lastAcc) ? state.lastAcc : null),
    note: e?.note || '', date: e?.date || today(),
  };
  openSheet(padHTML());
}
function padHTML() {
  const c = cat(pad.cat) || { emoji: '❔', name: 'Tanpa kategori' };
  const n = Number(pad.amount) || 0;
  const accs = [...state.accounts].sort((a, b) => (a.group === 'invest') - (b.group === 'invest'));
  return `
  <h3><span>${esc(c.emoji)}</span>${esc(c.name)}<span class="small" style="margin:0 0 0 auto">${c.type === 'reserve' ? 'Cadangan' : 'Harian'}</span></h3>
  <p class="amount num ${n ? '' : 'zero'}" id="pad-amount">${rp(n)}</p>
  <div class="chips">
    ${[2000, 5000, 10000, 20000, 50000].map(v => `<button class="chip" data-act="pad-quick" data-v="${v}">+${short(v)}</button>`).join('')}
  </div>
  <div class="chips" aria-label="Sumber dana">
    <button class="chip ${pad.acc ? '' : 'on'}" data-act="pad-acc" data-id="">Tanpa sumber</button>
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
}
function padSave() {
  const n = Number(pad.amount) || 0;
  if (!n) { toast('Masukkan nominal dulu'); return; }
  pad.note = $('#pad-note').value.trim();
  pad.date = $('#pad-date').value || today();
  if (pad.id) removeExpense(pad.id);
  addExpense({ id: pad.id || uid(), amount: n, cat: pad.cat, acc: pad.acc || null, note: pad.note, date: pad.date, ts: Date.now() });
  closeSheet();
  toast(`${rp(n)} tercatat`);
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
  <div class="list">${txList(list, mode)}</div>`;
}
function txList(list, mode) {
  if (!list.length) return '<p class="empty">Tidak ada transaksi.</p>';
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);
  if (mode === 'day') return sorted.map(e => rowExpense(e, false)).join('');
  if (mode === 'year') {
    const byM = {};
    for (const e of sorted) { const k = e.date.slice(0, 7); (byM[k] = byM[k] || []).push(e); }
    return Object.entries(byM).map(([k, es]) => `<button class="row" data-act="rep-goto" data-mode="month" data-key="${k}-01">
      <span class="grow"><p class="t">${MONTHS[Number(k.slice(5)) - 1]}</p><p class="s">${es.length} transaksi</p></span>
      <span class="v num">${rp(es.reduce((s, e) => s + e.amount, 0))}</span></button>`).join('');
  }
  let out = '', cur = '';
  for (const e of sorted) {
    if (e.date !== cur) {
      cur = e.date;
      const sum = sorted.filter(x => x.date === cur).reduce((s, x) => s + x.amount, 0);
      out += `<div class="day-head"><span>${longDate(cur)}</span><span class="num">${rp(sum)}</span></div>`;
    }
    out += rowExpense(e, false);
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

  return `
  <div class="card">
    <p class="label">Total aset</p>
    <p class="big num">${rp(total)}</p>
    ${delta}
    ${trend(keys)}
  </div>
  <div class="actions">
    <button class="btn" data-act="acc-edit">＋ Platform</button>
    <button class="btn" data-act="transfer">⇄ Transfer</button>
  </div>
  ${groups || '<p class="empty">Belum ada platform. Tambahkan BCA, Jago, Bibit, dan lainnya.</p>'}
  <p class="small" style="margin-top:12px">Tap platform untuk mengubah saldo, misalnya saat gaji masuk atau nilai investasi berubah. Pengeluaran otomatis mengurangi saldo sumber dananya.</p>`;
}
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
  <div class="actions">
    ${id ? `<button class="btn danger-btn" data-act="acc-delete" data-id="${id}">Hapus</button>` : ''}
    <button class="btn primary" data-act="acc-save" data-id="${id || ''}" style="flex:2">Simpan</button>
  </div>`);
}
function transferSheet() {
  const opts = sel => state.accounts.map(a => `<option value="${a.id}" ${sel === a.id ? 'selected' : ''}>${esc(a.name)} (${short(a.balance)})</option>`).join('');
  openSheet(`
  <h3>Transfer antar platform</h3>
  <label class="field"><span>Dari</span><select class="in" id="t-from">${opts(state.accounts[0]?.id)}</select></label>
  <label class="field"><span>Ke</span><select class="in" id="t-to">${opts(state.accounts[1]?.id)}</select></label>
  <label class="field"><span>Nominal (Rp)</span><input class="in num" id="t-amt" inputmode="numeric" placeholder="0" data-money></label>
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
    <p class="small">AceTrack v1.1 · pencatat pengeluaran dan aset pribadi</p>
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
    const n = parseNum(el.value);
    el.value = n ? n.toLocaleString('id-ID') : '';
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
    removeExpense(pad.id); closeSheet(); toast('Catatan dihapus'); render();
  },
  'rep-mode': d => { rep.mode = d.m; render(); },
  'rep-step': d => { repStep(Number(d.d)); render(); },
  'rep-goto': d => { rep.mode = d.mode; rep.anchor = d.key; render(); window.scrollTo({ top: 0 }); },
  'acc-edit': d => accSheet(d.id),
  'acc-save': d => {
    const name = $('#a-name').value.trim();
    if (!name) { toast('Isi nama platform'); return; }
    const group = $('#a-group').value, balance = parseNum($('#a-bal').value);
    if (d.id) Object.assign(acc(d.id), { name, group, balance });
    else state.accounts.push({ id: uid(), name, group, balance });
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
    const from = acc($('#t-from').value), to = acc($('#t-to').value), n = parseNum($('#t-amt').value);
    if (from === to) { toast('Pilih dua platform yang berbeda'); return; }
    if (!n) { toast('Masukkan nominal'); return; }
    from.balance -= n; to.balance += n;
    snapshot(); save(); closeSheet(); render(); toast(`${rp(n)} dipindah ke ${to.name}`);
  },
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
