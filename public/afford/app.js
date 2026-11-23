
/*CALC-START*/
function annuity(P, i, n){
  if (n <= 0) return 0;
  if (i === 0) return P / n;
  return P * i / (1 - Math.pow(1 + i, -n));
}
function solveEIR(P, pay, n){
  if (P <= 0 || n <= 0 || pay * n <= P) return 0;
  let lo = 0, hi = 2;
  for (let k = 0; k < 100; k++){
    const mid = (lo + hi) / 2;
    if (annuity(P, mid / 12, n) > pay) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}
function monthlyOf(row){
  const a = Math.max(0, +row.amount || 0);
  return row.period === 'year' ? a / 12 : a;
}
function calc(s){
  const price = Math.max(0, +s.price || 0);
  const down = Math.min(price, Math.max(0, +s.down || 0));
  const principal = price - down;
  const n = principal > 0 ? Math.max(1, Math.round((+s.tenure || 0) * 12)) : 0;
  const r = Math.max(0, +s.rate || 0) / 100;
  let pay = 0, interest = 0, eir = 0;
  if (principal > 0){
    if (s.rateType === 'flat'){
      interest = principal * r * n / 12;
      pay = (principal + interest) / n;
      eir = solveEIR(principal, pay, n);
    } else {
      pay = annuity(principal, r / 12, n);
      interest = pay * n - principal;
      eir = r;
    }
  }
  const running = (s.rows || []).reduce((t, row) => t + monthlyOf(row), 0);
  const keepMonths = Math.max(0, Math.round((+s.keep || 0) * 12));
  const runningTotal = running * keepMonths;
  const resale = Math.max(0, +s.resale || 0);
  const gross = price + interest + runningTotal;
  const total = gross - resale;
  const monthly = pay + running;

  const income = Math.max(0, +s.income || 0);
  const commit = Math.max(0, +s.commit || 0);
  const savings = Math.max(0, +s.savings || 0);
  const ef = Math.max(0, +s.emergency || 0);

  const share = income > 0 ? monthly / income : Infinity;
  const leftover = income - commit - monthly;
  const afterDown = savings - down;
  const need = ef * (commit + monthly);

  const checks = [
    { key: 'share', level: share <= 0.10 ? 'good' : share <= 0.20 ? 'warn' : 'bad' },
    { key: 'left', level: (income > 0 && leftover >= 0.10 * income) ? 'good' : leftover >= 0 ? 'warn' : 'bad' },
    { key: 'cushion', level: afterDown < 0 ? 'bad' : afterDown >= need ? 'good' : afterDown >= need / 2 ? 'warn' : 'bad' }
  ];
  const rank = { good: 0, warn: 1, bad: 2 };
  const worst = checks.reduce((w, c) => rank[c.level] > rank[w.level] ? c : w, checks[0]);

  return { price, down, principal, n, pay, interest, eir, running, keepMonths, runningTotal,
    resale, gross, total, monthly, income, commit, savings, ef, share, leftover, afterDown, need,
    checks, verdict: worst.level, worst: worst.key };
}
/* What would make it OK: each answer changes one thing and keeps the rest. */
/* target: 'good' (Comfortable) or 'warn' (at least A stretch) */
const RANK = { good: 0, warn: 1, bad: 2 };
function withP(s, patch){ return Object.assign({}, s, patch); }
function solve(s, target){
  const c = calc(s);
  const isOK = x => { const r = calc(x); return r.income > 0 && RANK[r.verdict] <= RANK[target]; };
  const out = { ok: isOK(s), maxPrice: null };
  if (c.income <= 0) return out;
  const price = c.price;
  const dr = price > 0 ? c.down / price : 0, rr = price > 0 ? c.resale / price : 0;
  const atPrice = p => isOK(withP(s, { price: p })); // down payment and resale stay as entered
  if (atPrice(0)){
    let lo = 0, hi = Math.max(price, 1);
    while (atPrice(hi) && hi < 1e10){ lo = hi; hi *= 2; }
    for (let k = 0; k < 60; k++){ const m = (lo + hi) / 2; if (atPrice(m)) lo = m; else hi = m; }
    out.maxPrice = lo;
  }
  if (!out.ok){
    if (price > 0 && c.down < price){
      const step = Math.max(1, (price - c.down) / 200);
      for (let d = c.down + step; d <= price + 0.01; d += step){
        if (isOK(withP(s, { down: Math.min(d, price) }))){ out.down = Math.min(d, price); break; }
      }
    }
    if (c.principal > 0){
      for (let t = (+s.tenure || 0) + 0.5; t <= 10.001; t += 0.5){
        const s2 = withP(s, { tenure: t });
        if (isOK(s2)){ out.tenure = t; out.tenureExtra = calc(s2).interest - c.interest; break; }
      }
    }
    if (isOK(withP(s, { income: c.income * 20 }))){
      let lo = c.income, hi = c.income * 20;
      for (let k = 0; k < 60; k++){ const m = (lo + hi) / 2; if (isOK(withP(s, { income: m }))) hi = m; else lo = m; }
      out.income = hi;
    }
  }
  return out;
}
/*CALC-END*/

const PRESETS = {
  car: { label: 'Car', thing: 'car',
    price: 165000, down: 66000, rate: 2.78, rateType: 'flat', tenure: 7, keep: 10, resale: 10000,
    rows: [
      { name: 'Insurance', amount: 1800, period: 'year' },
      { name: 'Road tax', amount: 800, period: 'year' },
      { name: 'Petrol', amount: 300, period: 'month' },
      { name: 'Season parking', amount: 120, period: 'month' },
      { name: 'Servicing and repairs', amount: 900, period: 'year' }
    ] },
  bike: { label: 'Motorbike', thing: 'motorbike',
    price: 14000, down: 3000, rate: 3.5, rateType: 'flat', tenure: 5, keep: 10, resale: 1500,
    rows: [
      { name: 'Insurance', amount: 600, period: 'year' },
      { name: 'Road tax', amount: 150, period: 'year' },
      { name: 'Petrol', amount: 80, period: 'month' },
      { name: 'Season parking', amount: 15, period: 'month' },
      { name: 'Servicing and gear', amount: 450, period: 'year' }
    ] },
  wedding: { label: 'Wedding', thing: 'wedding',
    price: 40000, down: 15000, rate: 3.5, rateType: 'flat', tenure: 3, keep: 3, resale: 0, rows: [] },
  reno: { label: 'Renovation', thing: 'renovation',
    price: 55000, down: 25000, rate: 3.8, rateType: 'flat', tenure: 5, keep: 5, resale: 0, rows: [] },
  phone: { label: 'New phone', thing: 'phone',
    price: 1999, down: 0, rate: 0, rateType: 'eff', tenure: 1, keep: 3, resale: 300,
    rows: [ { name: 'Device protection plan', amount: 12, period: 'month' } ] }
};
const MONEY_DEFAULTS = { income: 7500, commit: 2800, savings: 90000, emergency: 6 };
const STORE_KEY = 'can-i-afford-this-v1';
const SAVED_KEY = 'can-i-afford-this-saved-v1';
const MAX_SAVED = 3;
const WORD = { good: 'Comfortable', warn: 'A stretch', bad: 'Not right now', none: 'Add your pay' };
const ZONE = { good: 'var(--z-good)', warn: 'var(--z-warn)', bad: 'var(--z-bad)', none: 'var(--z-none)' };

const SL = [
  { id: 'price',   label: 'Price',                    kind: 'money', main: true },
  { id: 'down',    label: 'Down payment',             kind: 'money', main: true },
  { id: 'rate',    label: 'Interest rate',            kind: 'pct',   main: true },
  { id: 'income',  label: 'Take-home pay',            kind: 'money', per: '/mo', main: true },
  { id: 'savings', label: 'Savings you can use',      kind: 'money', main: true },
  { id: 'tenure',  label: 'Loan length',              kind: 'years' },
  { id: 'keep',    label: 'How long you keep it',     kind: 'years' },
  { id: 'resale',  label: 'Value when you sell',      kind: 'money' },
  { id: 'commit',  label: 'Existing monthly spending', kind: 'money', per: '/mo' },
  { id: 'emergency', label: 'Safety net to keep',     kind: 'months' }
];
const SLD = Object.fromEntries(SL.map(s => [s.id, s]));

let state, R = {}, tapes = [], lastRemoved = null, undoState = null, msgTimer = null, cmpTimer = null;
const $ = id => document.getElementById(id);

/* ---------- helpers ---------- */
const n0 = v => Math.round(Math.abs(v)).toLocaleString('en-US');
const money = v => (v < 0 ? '−' : '') + state.currency + n0(v);
const moneyIn = (cur, v) => (v < 0 ? '−' : '') + cur + n0(v);
const niceDown = v => v >= 10000 ? Math.floor(v / 500) * 500 : v >= 1000 ? Math.floor(v / 50) * 50 : Math.floor(v);
const niceUp = v => v >= 10000 ? Math.ceil(v / 500) * 500 : v >= 1000 ? Math.ceil(v / 50) * 50 : Math.ceil(v);
function niceMax(v){
  if (v <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}
function parseNum(t){ const v = parseFloat(String(t).replace(/[,\s]/g, '')); return isNaN(v) ? 0 : v; }
function esc(t){ return String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function durWords(months){
  if (months <= 0) return '0 months';
  if (months < 12) return months + (months === 1 ? ' month' : ' months');
  if (months % 12 === 0){ const y = months / 12; return y + (y === 1 ? ' year' : ' years'); }
  return (months / 12).toFixed(1) + ' years';
}
function short(v){
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'm';
  if (a >= 1000) return Math.round(v / 1000) + 'k';
  return String(Math.round(v));
}
function fromPreset(key, m){
  const p = PRESETS[key];
  m = m || MONEY_DEFAULTS;
  return { preset: key, currency: (state && state.currency) || 'S$',
    price: p.price, down: p.down, rate: p.rate, rateType: p.rateType, tenure: p.tenure, keep: p.keep, resale: p.resale,
    rows: p.rows.map(r => ({ ...r })), income: m.income, commit: m.commit, savings: m.savings, emergency: m.emergency };
}
function setRanges(){
  R.price = niceMax(Math.max((+state.price || 0) * 2, 1000));
  R.income = niceMax(Math.max((+state.income || 0) * 2.5, 5000));
  R.savings = niceMax(Math.max((+state.savings || 0) * 2, 10000));
  R.commit = niceMax(Math.max((+state.commit || 0) * 2, +state.income || 0, 2000));
}
function rangeOf(id){
  switch (id){
    case 'price': return [0, R.price];
    case 'down': case 'resale': return [0, Math.max(1, +state.price || 0)];
    case 'rate': return [0, 10];
    case 'income': return [0, R.income];
    case 'savings': return [0, R.savings];
    case 'commit': return [0, R.commit];
    case 'tenure': return [0.5, 10];
    case 'keep': return [0.5, 20];
    case 'emergency': return [0, 12];
  }
  return [0, 100];
}
function stepOf(id, max){
  if (id === 'rate') return 0.01;
  if (id === 'tenure' || id === 'keep') return 0.5;
  if (id === 'emergency') return 1;
  return max <= 5000 ? 10 : max <= 50000 ? 100 : max <= 500000 ? 500 : 1000;
}
function inputText(id, v){
  const k = SLD[id].kind;
  if (k === 'money') return n0(v);
  if (k === 'pct') return String(Math.round(v * 100) / 100);
  return String(v);
}
function unitBefore(id){ return SLD[id].kind === 'money' ? state.currency : ''; }
function unitAfter(id){
  const s = SLD[id];
  if (s.kind === 'pct') return '%';
  if (s.kind === 'years') return 'yrs';
  if (s.kind === 'months') return 'mo';
  return s.per || '';
}
function fmtBoundary(id, b, dir){
  const k = SLD[id].kind;
  if (k === 'money') return money(dir === 'below' ? niceDown(b) : niceUp(b));
  if (k === 'pct') return (dir === 'below' ? Math.floor(b * 100) / 100 : Math.ceil(b * 100) / 100).toFixed(2) + '%';
  if (k === 'years'){ const v = dir === 'below' ? Math.floor(b * 2) / 2 : Math.ceil(b * 2) / 2; return v + ' years'; }
  const v = dir === 'below' ? Math.floor(b) : Math.ceil(b);
  return v + ' months';
}

/* ---------- verdict along a slider ---------- */
function levelAt(id, v){
  const c = calc(withP(state, { [id]: v }));
  return c.income > 0 ? c.verdict : 'none';
}
function sampleSlider(id){
  const [lo, hi] = rangeOf(id);
  const N = 60, xs = [], ls = [];
  for (let i = 0; i <= N; i++){ const v = lo + (hi - lo) * i / N; xs.push(v); ls.push(levelAt(id, v)); }
  return { lo, hi, N, xs, ls };
}
function zoneGradient(S){
  const parts = [];
  let start = 0, cur = S.ls[0];
  for (let i = 1; i <= S.N + 1; i++){
    const l = i <= S.N ? S.ls[i] : null;
    if (l !== cur){
      const end = i > S.N ? 100 : ((i - 0.5) / S.N) * 100;
      parts.push(ZONE[cur] + ' ' + start.toFixed(2) + '% ' + end.toFixed(2) + '%');
      start = end; cur = l;
    }
  }
  return 'linear-gradient(90deg,' + parts.join(',') + ')';
}
function noteFor(id, S){
  const v = +state[id] || 0;
  const curL = levelAt(id, v);
  if (curL === 'none') return '';
  const nearest = pred => {
    let best = -1, bd = Infinity;
    S.xs.forEach((x, i) => { if (pred(S.ls[i])){ const d = Math.abs(x - v); if (d < bd){ bd = d; best = i; } } });
    return best;
  };
  const refine = (j, want) => {
    let a = S.xs[j];            // side with the wanted level
    let b = v;                  // current side
    for (let k = 0; k < 40; k++){
      const m = (a + b) / 2;
      if (want(levelAt(id, m))) a = m; else b = m;
    }
    return a;
  };
  const better = l => RANK[l] < RANK[curL];
  const j = nearest(better);
  if (j >= 0){
    const b = refine(j, better);
    const dir = b < v ? 'below' : 'above';
    return WORD[S.ls[j]] + ' ' + dir + ' ' + fmtBoundary(id, b, dir) + '.';
  }
  if (curL === 'good'){
    const worse = l => l !== 'good';
    const w = nearest(worse);
    if (w < 0) return 'Comfortable across this whole range.';
    const b = refine(w, l => l === 'good') ;
    const dir = S.xs[w] > v ? 'above' : 'below';
    return 'Stays comfortable ' + (dir === 'above' ? 'up to ' + fmtBoundary(id, b, 'below') : 'down to ' + fmtBoundary(id, b, 'above')) + '.';
  }
  return 'Moving this alone won’t improve the verdict.';
}

/* ---------- chart ---------- */
function chartSVG(c){
  const W = Math.max(300, Math.round($('chart').clientWidth || 600)), H = W < 480 ? 230 : 250, L = 46, Rp = 14, T = 22, B = 30;
  const months = Math.max(c.keepMonths, c.n, 1);
  const cum = m => c.down + c.pay * Math.min(m, c.n) + c.running * Math.min(m, c.keepMonths);
  const endBefore = cum(months);
  const top = Math.max(endBefore, c.price, 1);
  let step = 1;
  const steps = [1, 2, 2.5, 5];
  outer: for (let e = Math.floor(Math.log10(top)) - 1; e < 12; e++){
    for (const s of steps){ const st = s * Math.pow(10, e); if (Math.ceil(top / st) <= 5){ step = st; break outer; } }
  }
  const ymax = Math.ceil(top * 1.04 / step) * step;
  const x = m => L + (W - L - Rp) * m / months;
  const y = v => T + (H - T - B) * (1 - v / ymax);
  const bps = [...new Set([0, Math.min(c.n, months), Math.min(c.keepMonths, months), months])].sort((a, b) => a - b);
  const pts = bps.map(m => [x(m), y(cum(m))]);
  let s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(chartLabel(c, months, cum)) + '">';
  for (let g = 0; g <= ymax + 1e-9; g += step){
    s += '<line x1="' + L + '" x2="' + (W - Rp) + '" y1="' + y(g).toFixed(1) + '" y2="' + y(g).toFixed(1) + '" stroke="' + (g === 0 ? '#CFCFCB' : '#EDEDEA') + '"/>';
    s += '<text x="' + (L - 8) + '" y="' + (y(g) + 4).toFixed(1) + '" text-anchor="end" font-size="12" fill="#5C5C5C">' + short(g) + '</text>';
  }
  const area = 'M' + x(0) + ' ' + y(0) + ' ' + pts.map(p => 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + ' L' + x(months) + ' ' + y(0) + ' Z';
  s += '<path d="' + area + '" fill="#121212" fill-opacity="0.06"/>';
  if (c.price > 0){
    const py = y(c.price).toFixed(1);
    s += '<line x1="' + L + '" x2="' + (W - Rp) + '" y1="' + py + '" y2="' + py + '" stroke="#121212" stroke-dasharray="5 5"/>';
    s += '<text x="' + (W - Rp) + '" y="' + (y(c.price) + 16).toFixed(1) + '" text-anchor="end" font-size="12" fill="#121212">price tag ' + esc(money(c.price)) + '</text>';
  }
  s += '<path d="M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + '" fill="none" stroke="#121212" stroke-width="2.5" stroke-linejoin="round"/>';
  if (c.resale > 0){
    s += '<line x1="' + x(months) + '" x2="' + x(months) + '" y1="' + y(endBefore).toFixed(1) + '" y2="' + y(endBefore - c.resale).toFixed(1) + '" stroke="#121212" stroke-width="2.5" stroke-dasharray="3 3"/>';
  }
  s += '<circle cx="' + x(months) + '" cy="' + y(c.total).toFixed(1) + '" r="5" fill="#121212"/>';
  s += '<text x="' + (x(months) - 10) + '" y="' + (y(Math.max(c.total, endBefore)) - 10).toFixed(1) + '" text-anchor="end" font-size="13" font-weight="700" fill="#121212">' + esc(money(c.total)) + '</text>';
  // where the running total passes the price tag
  let cross = null;
  if (c.price > 0){
    if (c.down >= c.price) cross = 0;
    else for (let i = 1; i < bps.length; i++){
      const a = cum(bps[i - 1]), b = cum(bps[i]);
      if (b >= c.price && a < c.price){ cross = bps[i - 1] + (c.price - a) / (b - a) * (bps[i] - bps[i - 1]); break; }
    }
  }
  if (cross !== null && c.total > c.price){
    const cx = x(cross), cy = y(c.price);
    const label = cross <= 0.5 ? 'Paid on day one' : 'Passes the price tag in year ' + Math.max(1, Math.ceil(cross / 12));
    const right = cx < W * 0.55;
    s += '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="6" fill="#C0392B" stroke="#FFFFFF" stroke-width="2"/>';
    s += '<text x="' + (right ? cx + 12 : cx - 12).toFixed(1) + '" y="' + (right ? cy + 24 : cy - 12).toFixed(1) + '" text-anchor="' + (right ? 'start' : 'end') + '" font-size="13" font-weight="700" fill="#9B2318">' + label + '</text>';
  }
  const yrs = months / 12;
  const mid = Math.round(yrs / 2);
  s += '<text x="' + L + '" y="' + (H - 8) + '" font-size="12" fill="#5C5C5C">today</text>';
  if (mid > 0 && mid < yrs) s += '<text x="' + x(mid * 12).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="12" fill="#5C5C5C">yr ' + mid + '</text>';
  s += '<text x="' + (W - Rp) + '" y="' + (H - 8) + '" text-anchor="end" font-size="12" fill="#5C5C5C">' + (yrs >= 1 ? 'yr ' + (Math.round(yrs * 10) / 10) : months + ' mo') + '</text>';
  return s + '</svg>';
}
function chartLabel(c, months, cum){
  return 'Running total starts at ' + money(c.down) + ' today and reaches ' + money(c.total) + ' after ' + durWords(months) + ', against a price tag of ' + money(c.price) + '.';
}

/* ---------- text ---------- */
function whyText(c){
  if (c.income <= 0) return 'Add your take-home pay to get a verdict.';
  const pct = Math.round(c.share * 100);
  if (c.verdict === 'good') return 'It takes ' + pct + '% of your pay, leaves ' + money(c.leftover) + ' spare each month, and your safety net stays whole.';
  switch (c.worst){
    case 'share': return c.verdict === 'bad' ? 'Above 20% of pay is heavy for one purchase.' : 'Between 10% and 20% of pay. Doable, but it squeezes other goals.';
    case 'left': return c.verdict === 'bad' ? 'You would be ' + money(-c.leftover) + ' short every month.' : 'Only ' + money(c.leftover) + ' left each month after everything.';
    case 'cushion':
      if (c.afterDown < 0) return 'You need ' + money(-c.afterDown) + ' more savings ' + (c.principal <= 0 ? 'to pay in full.' : 'for the down payment.');
      return 'Your ' + c.ef + '-month safety net would be ' + money(c.need - c.afterDown) + ' short.';
  }
  return '';
}
function thing(){ const p = PRESETS[state.preset]; return p ? p.thing : 'purchase'; }

/* ---------- build sliders once ---------- */
function buildSliders(){
  SL.forEach(s => {
    const el = document.createElement('div');
    el.className = 'sl';
    const wide = s.kind === 'money' ? ' wide' : '';
    el.innerHTML =
      '<div class="sl-head"><label for="r-' + s.id + '">' + s.label + '</label>' +
      '<span class="val"><span id="ub-' + s.id + '"></span><input id="t-' + s.id + '" class="' + wide.trim() + '" type="text" inputmode="decimal" autocomplete="off" aria-label="' + s.label + ', exact value"><span id="ua-' + s.id + '"></span></span></div>' +
      '<div class="trk"><div class="zone" id="z-' + s.id + '" aria-hidden="true"></div><input type="range" id="r-' + s.id + '" aria-describedby="n-' + s.id + '"></div>' +
      '<div class="note" id="n-' + s.id + '"></div>';
    $(s.main ? 'mainSliders' : 'moreSliders').appendChild(el);

    const r = $('r-' + s.id), t = $('t-' + s.id);
    r.addEventListener('input', () => {
      state[s.id] = parseFloat(r.value);
      t.value = inputText(s.id, state[s.id]);
      update(s.id);
    });
    t.addEventListener('input', () => {
      const v = parseNum(t.value);
      state[s.id] = v;
      if (R[s.id] !== undefined && v > R[s.id]) R[s.id] = niceMax(v * 1.25);
      update(null, s.id);
    });
    t.addEventListener('blur', () => { t.value = inputText(s.id, +state[s.id] || 0); });
    t.addEventListener('keydown', e => { if (e.key === 'Enter') t.blur(); });
  });
}

function syncSliders(skipRange, skipText){
  SL.forEach(s => {
    const [lo, hi] = rangeOf(s.id);
    const r = $('r-' + s.id), t = $('t-' + s.id);
    r.min = lo; r.max = hi; r.step = stepOf(s.id, hi);
    if (s.id !== skipRange) r.value = Math.min(hi, Math.max(lo, +state[s.id] || 0));
    if (s.id !== skipText && document.activeElement !== t) t.value = inputText(s.id, +state[s.id] || 0);
    $('ub-' + s.id).textContent = unitBefore(s.id);
    $('ua-' + s.id).textContent = unitAfter(s.id);
  });
}

/* ---------- running costs ---------- */
function renderRows(){
  let h = '';
  if (lastRemoved) h += '<div class="undo-line"><span>Removed ' + esc(lastRemoved.row.name || 'a cost') + '</span><button type="button" id="undoRow">Undo</button></div>';
  if (!state.rows.length) h += '<p class="empty">No running costs yet. Add insurance, fuel, upkeep or subscriptions.</p>';
  state.rows.forEach((row, i) => {
    h += '<div class="run-row">' +
      '<input class="nm" type="text" id="rname-' + i + '" aria-label="Cost name" placeholder="e.g. Insurance" value="' + esc(row.name) + '">' +
      '<input class="num" type="text" inputmode="decimal" id="ramt-' + i + '" aria-label="Amount for ' + esc(row.name || 'this cost') + '" value="' + n0(row.amount) + '">' +
      '<select id="rper-' + i + '" aria-label="How often"><option value="month"' + (row.period === 'month' ? ' selected' : '') + '>/mo</option><option value="year"' + (row.period === 'year' ? ' selected' : '') + '>/yr</option></select>' +
      '<button type="button" class="del" id="rdel-' + i + '" aria-label="Remove ' + esc(row.name || 'this cost') + '">×</button></div>';
  });
  $('runRows').innerHTML = h;
}
function readRows(){
  state.rows = state.rows.map((row, i) => ({
    name: $('rname-' + i) ? $('rname-' + i).value : row.name,
    amount: $('ramt-' + i) ? parseNum($('ramt-' + i).value) : row.amount,
    period: $('rper-' + i) ? $('rper-' + i).value : row.period
  }));
}

/* ---------- main update ---------- */
function update(skipRange, skipText){
  const c = calc(state);
  const noPay = c.income <= 0;
  const months = Math.max(c.keepMonths, c.n, 1);
  syncSliders(skipRange, skipText);

  // answer
  let h = 'Over ' + durWords(months) + ', this ' + thing() + ' really costs <b>' + esc(money(c.total)) + '</b>. ';
  h += 'That’s <b>' + esc(money(c.monthly)) + '</b> a month' + (noPay ? '.' : ', or <b>' + Math.round(c.share * 100) + '% of your pay</b>.');
  $('headline').innerHTML = h;
  const subs = [];
  if (!noPay && c.total > 0) subs.push('All in, that’s ' + Math.round(c.total / c.income) + ' months of your take-home pay.');
  if (c.n > 0 && c.keepMonths > c.n && c.running > 0) subs.push('Drops to ' + money(c.running) + ' a month once the loan ends.');
  $('sub').textContent = subs.join(' ');
  const lvl = noPay ? 'none' : c.verdict;
  const icon = lvl === 'good'
    ? '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    : lvl === 'warn'
    ? '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 2 L13 12 H1 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
    : lvl === 'bad'
    ? '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' : '';
  $('chip').dataset.level = lvl;
  $('chip').innerHTML = icon + WORD[lvl];
  $('why').textContent = whyText(c);

  // chart
  $('chart').innerHTML = chartSVG(c);

  // sliders: zones + notes
  SL.forEach(s => {
    const S = sampleSlider(s.id);
    $('z-' + s.id).style.background = zoneGradient(S);
    $('n-' + s.id).textContent = noteFor(s.id, S);
  });
  $('rtFlat').setAttribute('aria-pressed', String(state.rateType === 'flat'));
  $('rtEff').setAttribute('aria-pressed', String(state.rateType !== 'flat'));
  $('rtNote').textContent = c.principal <= 0 ? 'No loan needed.'
    : state.rateType === 'flat' && c.interest > 0.5 ? 'A ' + (+state.rate || 0) + '% flat rate works out to about ' + (c.eir * 100).toFixed(1) + '% a year effective.'
    : c.n > 0 ? c.n + ' monthly payments of ' + money(c.pay) + '.' : '';

  // fixes
  renderFixes(c);
  renderCashVsLoan(c);

  // phone bar
  $('mbMonthly').textContent = money(c.monthly);
  $('mbShare').textContent = noPay ? '' : Math.round(c.share * 100) + '% of pay';
  $('mbChip').dataset.level = lvl;
  $('mbChip').textContent = WORD[lvl];

  document.querySelectorAll('#presets button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.key === state.preset)));
  save();
}

function renderFixes(c){
  const list = $('fixList');
  if (c.income <= 0){ $('fixTitle').textContent = 'Fixes'; list.innerHTML = '<div class="fix plain"><span>Add your take-home pay to see what would make this work.</span></div>'; return; }
  const target = c.verdict === 'bad' ? 'warn' : 'good';
  const fx = solve(state, target);
  let h = '';
  if (fx.ok){
    $('fixTitle').textContent = 'You have room';
    if (fx.maxPrice != null) h += '<div class="fix plain"><span>You could pay up to <b>' + esc(money(niceDown(fx.maxPrice))) + '</b> and stay comfortable.</span></div>';
  } else {
    $('fixTitle').textContent = target === 'warn' ? 'To make it a stretch, change one thing' : 'To make it comfortable, change one thing';
    const price = +state.price || 0;
    const dr = price > 0 ? c.down / price : 0, rr = price > 0 ? c.resale / price : 0;
    const rows = [];
    if (fx.maxPrice != null && fx.maxPrice < c.price){
      const p = niceDown(fx.maxPrice);
      rows.push({ text: 'Pick one under', val: money(p), patch: { price: p }, done: 'Price set to ' + money(p) + '. Down payment unchanged.' });
    }
    if (fx.down != null){ const d = niceUp(fx.down); rows.push({ text: 'Or put down', val: money(d), patch: { down: Math.min(d, price) }, done: 'Down payment set to ' + money(d) + '.' }); }
    if (fx.tenure != null) rows.push({ text: 'Or borrow over', val: fx.tenure + ' years', extra: '+' + money(fx.tenureExtra) + ' interest', patch: { tenure: fx.tenure }, done: 'Loan length set to ' + fx.tenure + ' years.' });
    if (fx.income != null){ const p = niceUp(fx.income); rows.push({ text: 'Or take home at least', val: money(p) + '/mo', patch: { income: p }, done: 'Take-home pay set to ' + money(p) + '.' }); }
    if (!rows.length) h += '<div class="fix plain"><span>No single change gets there. Try a cheaper option, or save up first.</span></div>';
    rows.forEach((r, i) => {
      h += '<div class="fix"><span>' + r.text + (r.extra ? ' <span class="small">(' + esc(r.extra) + ')</span>' : '') + '</span><b>' + esc(r.val) + '</b><button type="button" data-fix="' + i + '">Try it</button></div>';
    });
    list._rows = rows;
  }
  if (c.principal > 0 && c.pay > 0 && c.interest > 0.5){
    h += '<div class="fix plain"><span>Or save up: ' + esc(money(c.pay)) + ' a month gets you the other ' + esc(money(c.principal)) + ' in about ' + durWords(Math.ceil(c.principal / c.pay)) + ', and you keep ' + esc(money(c.interest)) + ' of interest.</span></div>';
  }
  list.innerHTML = h;
}

function fixMsg(text, withUndo){
  const m = $('fixMsg');
  m.innerHTML = '<span>' + esc(text) + '</span>' + (withUndo ? '<button type="button" id="undoFix">Undo</button>' : '');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => { m.innerHTML = ''; undoState = null; }, 8000);
}

/* ---------- borrow vs pay cash ---------- */
function cashState(){ return withP(state, { down: +state.price || 0 }); }
function optCard(title, tag, c, isCur, afterRow){
  const lv = c.income > 0 ? c.verdict : 'none';
  const after = !afterRow ? '' : '<div class="row"><span>After the loan ends</span><b>' + (c.n > 0 ? esc(money(c.running)) + '/mo' : 'no loan') + '</b></div>';
  return '<article class="opt' + (isCur ? ' cur' : '') + '"><h3>' + title + '<span>' + tag + '</span></h3>' +
    '<div class="row"><span>Cash today</span><b>' + esc(money(c.down)) + '</b></div>' +
    '<div class="row"><span>Every month</span><b>' + esc(money(c.monthly)) + '/mo</b></div>' + after +
    '<div class="row"><span>Interest</span><b>' + esc(money(c.interest)) + '</b></div>' +
    '<div class="row big"><span>Real cost</span><b>' + esc(money(c.total)) + '</b></div>' +
    '<div class="row"><span>Savings left after paying</span><b>' + esc(money(c.afterDown)) + '</b></div>' +
    '<span class="chip" data-level="' + lv + '" >' + WORD[lv] + '</span>' +
    '<span class="reason">' + esc(whyText(c)) + '</span></article>';
}
function renderCashVsLoan(c){
  const grid = $('cvcGrid'), lede = $('cvcLede');
  if (c.price <= 0){ lede.textContent = 'Enter a price to compare.'; grid.innerHTML = ''; $('cvcActions').hidden = true; return; }
  if (c.principal <= 0){
    lede.textContent = 'You are already paying in full: no loan and no interest. Lower the down payment to see how a loan would compare.';
    grid.innerHTML = optCard('Pay cash', 'YOUR PLAN', c, true);
    $('cvcActions').hidden = true; return;
  }
  $('cvcActions').hidden = false;
  const k = calc(cashState());
  const extraUp = k.down - c.down;
  let t = 'Paying cash skips ' + money(c.interest) + ' of interest and the monthly cost falls to ' + money(k.monthly) + ', but you need ' + money(extraUp) + ' more up front.';
  if (k.afterDown < 0) t += ' Your savings are ' + money(-k.afterDown) + ' short of that.';
  else if (k.income > 0 && k.checks[2].level !== 'good') t += ' It would leave your safety net ' + money(k.need - k.afterDown) + ' short.';
  lede.textContent = t;
  const afterRow = c.n > 0 && c.keepMonths > c.n && c.running > 0;
  grid.innerHTML = optCard('Borrow', 'YOUR PLAN', c, true, afterRow) + optCard('Pay cash', 'NO LOAN', k, false, afterRow);
}
function cvcMsg(text, withUndo){
  const m = $('cvcMsg');
  m.innerHTML = '<span>' + esc(text) + '</span>' + (withUndo ? '<button type="button" id="undoCash">Undo</button>' : '');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => { m.innerHTML = ''; }, 8000);
}

/* ---------- saved options ---------- */
function loadTapes(snap){
  if (snap && Array.isArray(snap.tapes)) { tapes = snap.tapes.slice(0, MAX_SAVED); return; }
  try { const v = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); if (Array.isArray(v)) tapes = v.slice(0, MAX_SAVED); } catch (e) {}
}
function storeTapes(){ try { localStorage.setItem(SAVED_KEY, JSON.stringify(tapes)); } catch (e) {} }
function cmpMsg(t){
  $('cmpMsg').textContent = t;
  clearTimeout(cmpTimer);
  cmpTimer = setTimeout(() => { $('cmpMsg').textContent = ''; }, 5000);
}
function renderTapes(){
  const res = tapes.map(t => calc(t.state));
  let best = -1;
  if (tapes.length > 1){ best = 0; res.forEach((c, i) => { if (c.total < res[best].total) best = i; }); }
  let h = '';
  tapes.forEach((t, i) => {
    const c = res[i], cur = t.state.currency || 'S$', lv = c.income > 0 ? c.verdict : 'none';
    h += '<article class="card' + (i === best ? ' best' : '') + '">' +
      '<label class="sr-only" for="tname-' + i + '">Name of saved option ' + (i + 1) + '</label>' +
      '<input id="tname-' + i + '" type="text" value="' + esc(t.name) + '">' +
      (i === best ? '<span class="mark">LOWEST REAL COST</span>' : '') +
      '<div class="row"><span>Real cost</span><b>' + esc(moneyIn(cur, c.total)) + '</b></div>' +
      '<div class="row"><span>Every month</span><b>' + esc(moneyIn(cur, c.monthly)) + '</b></div>' +
      '<div class="row"><span>Share of pay</span><b>' + (c.income > 0 ? Math.round(c.share * 100) + '%' : '–') + '</b></div>' +
      '<span class="chip" data-level="' + lv + '">' + WORD[lv] + '</span>' +
      '<div class="acts"><button type="button" class="btn-dark" id="tload-' + i + '">Load</button><button type="button" class="btn-line" id="tdel-' + i + '">Remove</button></div>' +
      '</article>';
  });
  if (tapes.length < MAX_SAVED) h += '<div class="cmp-empty">' + (tapes.length ? 'Room for ' + (MAX_SAVED - tapes.length) + ' more. ' : '') + 'Set up an option, then press Save this option to compare it here.</div>';
  $('cmpGrid').innerHTML = h;
  $('saveBtn').disabled = tapes.length >= MAX_SAVED;
  $('cmpNote').textContent = tapes.length >= MAX_SAVED ? 'Three saved. Remove one to save another.' : 'Up to three options.';
}
function summaryText(){
  const c = calc(state);
  const months = Math.max(c.keepMonths, c.n, 1);
  const p = PRESETS[state.preset];
  const lines = ['Can I afford this? ' + (p ? p.label : 'My purchase'),
    'Price tag: ' + money(c.price),
    'Real cost over ' + durWords(months) + ': ' + money(c.total),
    'Every month: ' + money(c.monthly) + (c.income > 0 ? ' (' + Math.round(c.share * 100) + '% of take-home pay)' : ''),
    'Verdict: ' + WORD[c.income > 0 ? c.verdict : 'none']];
  if (c.income > 0 && c.verdict !== 'good'){
    const target = c.verdict === 'bad' ? 'warn' : 'good';
    const fx = solve(state, target);
    const opts = [];
    if (fx.maxPrice != null && fx.maxPrice < c.price) opts.push('price under ' + money(niceDown(fx.maxPrice)));
    if (fx.down != null) opts.push('down payment of ' + money(niceUp(fx.down)));
    if (fx.tenure != null) opts.push(fx.tenure + '-year loan');
    if (fx.income != null) opts.push('take-home pay of ' + money(niceUp(fx.income)) + '+');
    if (opts.length) lines.push('To make it ' + (target === 'warn' ? 'a stretch' : 'comfortable') + ': ' + opts.join(', or '));
  }
  if (c.principal > 0){
    const k = calc(cashState());
    lines.push('Paying cash instead: ' + money(k.down) + ' today, ' + money(k.monthly) + ' a month, real cost ' + money(k.total) + ', verdict ' + WORD[k.income > 0 ? k.verdict : 'none'] + (k.afterDown < 0 ? ' (savings ' + money(-k.afterDown) + ' short)' : ''));
  }
  return lines.join('\n');
}

function save(){ try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }

/* ---------- start ---------- */
function start(snap){
  let saved = null;
  if (snap && snap.state) saved = snap.state;
  else { try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) {} }
  state = (saved && Array.isArray(saved.rows)) ? saved : fromPreset('car');
  if (!state.currency) state.currency = 'S$';
  loadTapes(snap);
  setRanges();

  Object.entries(PRESETS).forEach(([k, p]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = p.label; b.dataset.key = k;
    b.addEventListener('click', () => {
      const m = { income: state.income, commit: state.commit, savings: state.savings, emergency: state.emergency };
      state = fromPreset(k, m);
      lastRemoved = null; undoState = null; $('fixMsg').innerHTML = '';
      setRanges(); renderRows(); update();
    });
    $('presets').appendChild(b);
  });
  buildSliders();
  renderRows();
  $('currency').value = state.currency;
  update();
  renderTapes();

  $('moreBtn').addEventListener('click', () => {
    const open = $('moreBtn').getAttribute('aria-expanded') !== 'true';
    $('moreBtn').setAttribute('aria-expanded', String(open));
    $('more').hidden = !open;
  });
  $('rtFlat').addEventListener('click', () => { state.rateType = 'flat'; update(); });
  $('rtEff').addEventListener('click', () => { state.rateType = 'eff'; update(); });
  $('currency').addEventListener('change', e => { state.currency = e.target.value; renderRows(); update(); renderTapes(); });

  const runRows = $('runRows');
  runRows.addEventListener('input', () => { readRows(); update(); });
  runRows.addEventListener('change', e => {
    readRows();
    if (e.target.id && e.target.id.startsWith('ramt-')) e.target.value = n0(state.rows[+e.target.id.split('-')[1]].amount);
    update();
  });
  runRows.addEventListener('click', e => {
    if (e.target.id === 'undoRow' && lastRemoved){
      state.rows.splice(lastRemoved.index, 0, lastRemoved.row); lastRemoved = null;
      renderRows(); update(); return;
    }
    const b = e.target.closest('.del'); if (!b) return;
    readRows();
    const i = +b.id.split('-')[1];
    lastRemoved = { row: state.rows[i], index: i };
    state.rows.splice(i, 1);
    renderRows(); update();
    const u = $('undoRow'); if (u) u.focus();
  });
  $('addRow').addEventListener('click', () => {
    readRows(); state.rows.push({ name: '', amount: 0, period: 'month' }); lastRemoved = null;
    renderRows(); update();
    const el = $('rname-' + (state.rows.length - 1)); if (el) el.focus();
  });

  $('fixList').addEventListener('click', e => {
    const b = e.target.closest('button[data-fix]'); if (!b) return;
    const r = $('fixList')._rows[+b.dataset.fix]; if (!r) return;
    undoState = JSON.stringify(state);
    Object.assign(state, r.patch);
    Object.keys(r.patch).forEach(k => { if (R[k] !== undefined && r.patch[k] > R[k]) R[k] = niceMax(r.patch[k] * 1.25); });
    update();
    fixMsg(r.done, true);
  });
  $('fixMsg').addEventListener('click', e => {
    if (e.target.id !== 'undoFix' || !undoState) return;
    state = JSON.parse(undoState); undoState = null;
    renderRows(); update();
    fixMsg('Undone.', false);
  });

  $('useCash').addEventListener('click', () => {
    undoState = JSON.stringify(state);
    state.down = +state.price || 0;
    update();
    cvcMsg('Switched to paying ' + money(state.down) + ' in cash.', true);
  });
  $('cvcMsg').addEventListener('click', e => {
    if (e.target.id !== 'undoCash' || !undoState) return;
    state = JSON.parse(undoState); undoState = null;
    renderRows(); update();
    cvcMsg('Back to borrowing.', false);
  });
  $('saveBoth').addEventListener('click', () => {
    if (tapes.length > MAX_SAVED - 2){ cvcMsg('Saving both needs two free slots. Remove a saved option first.', false); return; }
    const p = PRESETS[state.preset], base = p ? p.label : 'My option';
    tapes.push({ name: base + ' · with a loan', state: JSON.parse(JSON.stringify(state)) });
    tapes.push({ name: base + ' · paid in cash', state: JSON.parse(JSON.stringify(cashState())) });
    storeTapes(); renderTapes();
    cvcMsg('Saved both. They are side by side under Saved to compare.', false);
  });

  $('saveBtn').addEventListener('click', () => {
    if (tapes.length >= MAX_SAVED){ cmpMsg('Three saved already. Remove one to save another.'); return; }
    const p = PRESETS[state.preset];
    tapes.push({ name: (p ? p.label : 'My option') + ' · ' + money(+state.price || 0), state: JSON.parse(JSON.stringify(state)) });
    storeTapes(); renderTapes();
    cmpMsg('Saved. Change the numbers or pick another example, then save again to compare.');
  });
  $('copyBtn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(summaryText()); cmpMsg('Summary copied. Paste it into a chat or note.'); }
    catch (e) { cmpMsg('Copying is blocked here. Select the headline and copy it instead.'); }
  });
  $('cmpGrid').addEventListener('input', e => {
    if (!e.target.id.startsWith('tname-')) return;
    tapes[+e.target.id.split('-')[1]].name = e.target.value; storeTapes();
  });
  $('cmpGrid').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const i = +b.id.split('-')[1];
    if (b.id.startsWith('tload-')){
      state = JSON.parse(JSON.stringify(tapes[i].state));
      if (!state.currency) state.currency = 'S$';
      $('currency').value = state.currency;
      lastRemoved = null; setRanges(); renderRows(); update();
      cmpMsg('Loaded "' + tapes[i].name + '".');
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      $('answer').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    } else if (b.id.startsWith('tdel-')){
      const name = tapes[i].name; tapes.splice(i, 1); storeTapes(); renderTapes(); cmpMsg('Removed "' + name + '".');
    }
  });

  let rz = null;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { $('chart').innerHTML = chartSVG(calc(state)); }, 120); });

  if ('IntersectionObserver' in window){
    new IntersectionObserver(es => { $('mbar').classList.toggle('show', !es[0].isIntersecting); }).observe($('answer'));
  }

  window.claude?.hot?.snapshot?.(() => ({ state, tapes }));
}

window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
