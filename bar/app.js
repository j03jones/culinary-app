(() => {
'use strict';
const D = window.CUSTOM_DATA || (window.localStorage && JSON.parse(localStorage.getItem("CULINARY_CUSTOM_DATA_bar") || "null")) || window.DATA;
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const view = $('#view');
const EYEBROW = 'ASU–Newport · Bar and Beverage';

/* ---------- in-session state (no browser storage) ---------- */
const mem = {};
const store = { get(k, d) { return k in mem ? mem[k] : d; }, set(k, v) { mem[k] = v; } };

/* ---------- dates (America/Chicago; ?date=YYYY-MM-DD to simulate) ---------- */
let params;
try { params = new URLSearchParams(window.COURSE_SEARCH || location.search); } catch { params = new URLSearchParams(''); }
function todayISO() {
  const p = params.get('date') || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
}
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DOWL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const short = iso => { const d = parseISO(iso); return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`; };
const inDays = n => n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n + ' days';

const C = D.course;
const sessionByN = n => D.sessions.find(s => s.n === n);
const recipeById = id => D.recipes.find(r => r.id === id);
const famName = k => (D.families.find(f => f[0] === k) || [k, k])[1];
const quizOn = date => D.quizzes.find(q => q.date === date);

/* ---------- units & scaling ---------- */
const FR = [[0, ''], [0.125, '1/8'], [0.25, '1/4'], [1 / 3, '1/3'], [0.5, '1/2'], [2 / 3, '2/3'], [0.75, '3/4'], [1, '']];
function frac(x) {
  if (x >= 10) return String(Math.round(x));
  let w = Math.floor(x), r = x - w, best = FR[0];
  for (const f of FR) if (Math.abs(r - f[0]) < Math.abs(r - best[0])) best = f;
  if (best[0] === 1) { w += 1; best = FR[0]; }
  if (!w && !best[1]) return x > 0 ? '1/8' : '0';
  return [w || '', best[1]].filter(Boolean).join(' ');
}
function parseQty(s) {
  s = s.trim(); let m;
  if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)/))) return [ +m[1] + m[2] / m[3], m[0].length ];
  if ((m = s.match(/^(\d+)\/(\d+)/))) return [ m[1] / m[2], m[0].length ];
  if ((m = s.match(/^(\d+(?:\.\d+)?)/))) return [ +m[1], m[0].length ];
  return null;
}
function usWeight(g) {
  const oz = g / 28.3495;
  if (oz < 16) return (oz < 2 ? Math.round(oz * 4) / 4 : Math.round(oz * 2) / 2).toString().replace(/\.0$/, '') + ' oz';
  const lb = Math.floor(oz / 16), r = Math.round(oz - lb * 16);
  return r === 16 ? `${lb + 1} lb` : r ? `${lb} lb ${r} oz` : `${lb} lb`;
}
function usVolumeTsp(tsp) {
  if (tsp < 3) return frac(tsp) + ' tsp';
  const floz = tsp / 6;
  if (floz < 0.5) return frac(tsp / 3) + ' Tbsp';
  if (floz < 32) return frac(floz) + ' fl oz';
  const qt = floz / 32;
  return frac(qt) + ' qt';
}
const PLURAL = { sprig: 'sprigs', clove: 'cloves', bunch: 'bunches', pinch: 'pinches', dash: 'dashes', leaf: 'leaves', slice: 'slices', wedge: 'wedges', wheel: 'wheels', each: '' };
function fmtMetric(amount, unit, f) {
  if (unit === 'to taste') return 'to taste';
  let a = amount * f, u = unit;
  if (u === 'g' && a >= 1000) { a /= 1000; u = 'kg'; }
  if (u === 'mL' && a >= 1000) { a /= 1000; u = 'L'; }
  let s;
  if (u === 'kg' || u === 'L') s = (Math.round(a * 100) / 100).toString();
  else if (u === 'g' || u === 'mL') s = a >= 100 ? String(Math.round(a / 5) * 5) : a >= 10 ? String(Math.round(a)) : String(Math.round(a * 10) / 10);
  else s = frac(a);
  if (u === 'each') return s;
  if (PLURAL[u] && a > 1) u = PLURAL[u];
  return `${s} ${u}`;
}
function fmtUS(ing, f) {
  if (ing.unit === 'to taste') return '';
  if (f === 1) return ing.us;
  let s = ing.us.trim(), about = '';
  if (/^about\s+/i.test(s)) { about = 'about '; s = s.replace(/^about\s+/i, ''); }
  const pq = parseQty(s);
  if (pq) {
    const rest = s.slice(pq[1]).trim();
    const um = rest.match(/^(tsp|Tbsp|cups?|fl oz|qt)\b/);
    if (um) {
      const per = { tsp: 1, Tbsp: 3, cup: 48, cups: 48, 'fl oz': 6, qt: 192 }[um[1]];
      return about + usVolumeTsp(pq[0] * per * f);
    }
    const cm = rest.match(/^([a-z]+)\b/i);
    if (['g', 'mL', 'L', 'kg'].indexOf(ing.unit) < 0 && cm && !/^(oz|lb)$/.test(cm[1])) {
      const n = pq[0] * f; let w = cm[1];
      if (/^(sprig|clove|pinch|bunch)/i.test(w)) return '';
      if (n > 1 && !/s$/.test(w)) w += /(ch|sh)$/.test(w) ? 'es' : 's';
      if (n <= 1 && /s$/.test(w) && pq[0] > 1) w = w.replace(/s$/, '');
      return `${about}${frac(n)} ${w}`;
    }
  }
  const a = ing.amount * f;
  if (ing.unit === 'g') return '≈ ' + usWeight(a);
  if (ing.unit === 'kg') return '≈ ' + usWeight(a * 1000);
  if (ing.unit === 'mL') return '≈ ' + usVolumeTsp(a / 4.929);
  if (ing.unit === 'L') return '≈ ' + usVolumeTsp(a * 1000 / 4.929);
  return '';
}
function firstMinutes(text) {
  const m = String(text || '').match(/(\d+(?:\.\d+)?)(?:\s*(?:–|-|to)\s*(\d+(?:\.\d+)?))?\s*(min(?:ute)?s?|hr|hrs|hours?)\b/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return /^h/i.test(m[3]) ? Math.round(v * 60) : Math.round(v);
}

/* ---------- navigation (in-memory stack) ---------- */
let tab = 'today';
const stack = { today: [], schedule: [], recipes: [], tools: [], study: [] };
const ui = { rq: '', rWeek: 0, rFam: '', toolSeg: 'pours', studySeg: 'exams', cardIdx: 0, cardOrder: null, flipped: false, cardCh: 0, plate: null };

function setTop(title, eyebrow) {
  $('#topTitle').textContent = title;
  $('#topEyebrow').textContent = eyebrow || EYEBROW;
  $('#backBtn').hidden = stack[tab].length === 0;
  document.title = `${title} · Bar Lab`;
}
function go(route) { stack[tab].push(route); render(); window.scrollTo(0, 0); }
function back() { stack[tab].pop(); render(); window.scrollTo(0, 0); }
function switchTab(name) {
  tab = name;
  document.querySelectorAll('.tabbar button').forEach(x => x.classList.toggle('active', x.dataset.tab === name));
}
$('#backBtn').addEventListener('click', back);
document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => {
  if (tab === b.dataset.tab) stack[tab] = [];
  switchTab(b.dataset.tab);
  render(); window.scrollTo(0, 0);
}));
window.addEventListener('scroll', () => $('#topbar').classList.toggle('scrolled', window.scrollY > 4), { passive: true });

function render() {
  const top = stack[tab][stack[tab].length - 1];
  if (top) {
    if (top.type === 'session') return renderSession(top.n);
    if (top.type === 'recipe') return renderRecipe(top.id);
    if (top.type === 'rubric') return renderRubric(top.idx);
  }
  ({ today: renderToday, schedule: renderSchedule, recipes: renderRecipes, tools: renderTools, study: renderStudy })[tab]();
}
function openIn(tabName, route) {
  switchTab(tabName); stack[tabName] = route ? [route] : []; render(); window.scrollTo(0, 0);
}

/* ---------- shared bits ---------- */
const chev = '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>';
const shield = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>';
const thermo = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.5a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/></svg>';
function sessionTags(s) {
  const t = [];
  const q = quizOn(s.date);
  if (q) t.push(`<span class="chip quiz">Quiz ${q.n}</span>`);
  if (s.kind === 'exam') t.push('<span class="chip exam">Exam</span>');
  else if (s.kind === 'practical') t.push(`<span class="chip prac">${esc(s.practical.name)}</span>`);
  else if (s.kind === 'review') t.push('<span class="chip rev">Review</span>');
  return t.join('');
}
function sessionRow(s, t) {
  const d = parseISO(s.date);
  const cls = s.date === t ? 'today' : (s.date < t ? 'past' : '');
  return `<button class="row ${cls}" data-session="${s.n}">
    <div class="date"><b>${d.getDate()}</b><span>${DOW[d.getDay()]}</span></div>
    <div class="body"><div class="t">${esc(s.title)}</div><div class="s">${esc(MON[d.getMonth()])} · Session ${s.n} of 31 · ${esc(s.chapter)}</div></div>
    <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">${sessionTags(s)}</div>${chev}</button>`;
}
function recipeRow(r, showDate) {
  return `<button class="row" data-recipe="${esc(r.id)}"><div class="body"><div class="t">${esc(r.name)}</div>
    <div class="s">${esc(famName(r.family))} · ${esc(r.batch)}${showDate ? ' · ' + esc(short(r.date)) : ''}</div></div>${chev}</button>`;
}
function bindRows(root = view) {
  root.querySelectorAll('[data-session]').forEach(b => b.addEventListener('click', () => go({ type: 'session', n: +b.dataset.session })));
  root.querySelectorAll('[data-recipe]').forEach(b => b.addEventListener('click', () => go({ type: 'recipe', id: b.dataset.recipe })));
  root.querySelectorAll('[data-rubric]').forEach(b => b.addEventListener('click', () => go({ type: 'rubric', idx: +b.dataset.rubric })));
}
const labList = items => `<ul class="clean timeline">${items.map(x => `<li><span class="tm">${esc(x.time)}</span><span>${esc(x.task)}</span></li>`).join('')}</ul>`;

/* ---------- TODAY ---------- */
function renderToday() {
  setTop('Today', DOWL[parseISO(todayISO()).getDay()] + ', ' + MON[parseISO(todayISO()).getMonth()] + ' ' + parseISO(todayISO()).getDate() + ' · ' + EYEBROW.split(' · ')[1]);
  const t = todayISO();
  const todays = D.sessions.find(s => s.date === t);
  const next = D.sessions.find(s => s.date > t);
  let html = '', focus = null, focusLabel = '';

  if (t < C.start) {
    const n = daysBetween(t, C.start);
    const mlk = t === C.mlk;
    html += `<div class="card hero"><span class="label">${mlk ? 'No class today · Martin Luther King Day' : 'Class starts ' + esc(short(C.start))}</span>
      <h2>${esc(C.name)}</h2>
      <div class="meta"><span class="chip">${esc(C.instructor)}</span><span class="chip">Room ${esc(C.room)}</span><span class="chip">${esc(C.time)}</span></div>
      <div class="countdown"><div><b>${n}</b><span>${n === 1 ? 'day to go' : 'days to go'}</span></div><div><b>31</b><span>lab sessions</span></div><div><b>16</b><span>chapters</span></div></div>
      ${mlk ? '<p class="small" style="margin-top:var(--space-4)">Campus is closed for MLK Day. The course begins tomorrow, Tuesday, January 19, at 2:00 PM.</p>' : ''}</div>`;
    html += `<div class="section"><span class="label">Before day one</span><div class="card"><ul class="clean">
      <li>Get the textbook: ${esc(C.textbook)}. Read Ch. 1, pp. 1–30 before the first class.</li>
      <li>Lab dress every day: apron, closed-toe non-slip shoes, hair restrained. Bring your bar journal and a pen.</li><li>Every lab is alcohol-free. Practice bottles hold tinted water and are never tasted.</li>
      <li>Class meets ${esc(C.time)} in Room ${esc(C.room)}. No class Mon, Jan 18 (MLK Day).</li></ul></div></div>`;
    focus = D.sessions[0]; focusLabel = 'First class';
  } else if (t > C.end) {
    const grades = t === C.gradesDue;
    html += `<div class="card hero"><span class="label">${grades ? 'Fri, Mar 12 · No class' : 'Course complete'}</span>
      <h2>${grades ? 'Final grades are due at noon' : 'Nice work, bartenders.'}</h2>
      <p class="small">${grades ? 'Bar and Beverage met for the last time yesterday. Chef is finalizing grades today; check the campus portal after noon.' : 'Bar and Beverage has wrapped for Flex I, Spring 2027. Every lesson, drink spec, tool and study card stays here for reference.'}</p>
      <div class="countdown"><div><b>31</b><span>sessions</span></div><div><b>${D.recipes.length}</b><span>drink specs</span></div><div><b>16</b><span>chapters</span></div></div></div>`;
    html += `<div class="section"><span class="label">Keep practicing</span><div class="list">
      <button class="row" data-goto="recipes"><div class="body"><div class="t">Browse all ${D.recipes.length} drink specs</div><div class="s">Search by ingredient, week or technique</div></div>${chev}</button>
      <button class="row" data-goto="tools"><div class="body"><div class="t">Bar tools</div><div class="s">Pours, ABV and proof, pour costing, timers</div></div>${chev}</button></div></div>`;
  } else if (todays) {
    html += sessionHero(todays, 'Today · ' + short(todays.date));
    focus = todays; focusLabel = '';
  } else if (next) {
    const d = parseISO(t).getDay();
    const why = (d === 0 || d === 6) ? "It's the weekend" : d === 5 ? 'No class on Fridays' : 'No class today';
    html += `<div class="card hero"><span class="label">${esc(why)}</span><h2>Next class ${daysBetween(t, next.date) === 1 ? 'tomorrow' : esc(DOWL[parseISO(next.date).getDay()])}</h2>
      <p class="small">${esc(next.title)} · ${esc(short(next.date))} · 2:00 PM · Room ${esc(C.room)}</p>
      ${t === '2027-02-12' ? '<p class="small" style="margin-top:var(--space-2)">Midterm grades are due at noon today.</p>' : ''}
      <div class="btn-row" style="position:relative"><button class="btn light" data-open="${next.n}">Preview the lesson</button></div></div>`;
    focus = next; focusLabel = 'Next class · ' + short(next.date);
  }

  if (focus) {
    if (focusLabel) html += `<div class="section"><span class="label">${esc(focusLabel)}</span><div class="list">${sessionRow(focus, t)}</div></div>`;
    html += `<div class="section"><span class="label">Reading</span><div class="card"><div class="h2" style="font-size:var(--text-base)">${esc(focus.chapter)}</div><p class="small muted" style="margin-top:4px">${esc(focus.reading)}</p></div></div>`;
    if (focus.practical) html += `<div class="section"><span class="label">${esc(focus.practical.name)} · ${esc(focus.practical.time_limit)}</span><div class="card"><p class="prose">${esc(focus.practical.task)}</p>
      ${focus.rubric != null ? `<div class="btn-row">${D.rubrics.map((r, i) => r.session === focus.n ? `<button class="btn ghost" data-rubric="${i}">${D.rubrics.filter(x => x.session === focus.n).length > 1 ? esc(r.title.split(':')[0]) + ' rubric' : 'See the grading rubric'}</button>` : '').join('')}</div>` : ''}</div></div>`;
    html += `<div class="section"><span class="label">Lab plan</span><div class="card">${labList(focus.lab)}</div></div>`;
    if (focus.recipes.length) html += `<div class="section"><span class="label">Drink specs for this lab</span><div class="list">${focus.recipes.map(id => recipeRow(recipeById(id))).join('')}</div></div>`;
    html += `<div class="section"><span class="label">Homework</span><div class="card"><p class="prose">${esc(focus.homework)}</p></div></div>`;
  }
  if (t <= C.end) {
    const nq = D.quizzes.find(q => q.date >= t);
    if (nq) {
      const n = daysBetween(t, nq.date);
      html += `<div class="section"><span class="label">Next quiz</span><div class="card${n === 0 ? ' quiz-today' : ''}"><div style="display:flex;justify-content:space-between;align-items:center;gap:1rem">
        <div><div class="h2">Quiz ${nq.n}: ${esc(nq.topic)}</div><div class="small muted">${esc(short(nq.date))} · 2:00 PM · 10 min · 20 pts · Ch. ${esc(nq.chapters)}</div></div>
        <span class="chip quiz">${inDays(n)}</span></div>
        <div class="btn-row"><button class="btn ghost" id="toQuiz">What to review</button></div></div></div>`;
    }
    const ex = D.exams.find(e => (e.date2 || e.date) >= t);
    if (ex) {
      const n = daysBetween(t, ex.date);
      html += `<div class="section"><span class="label">Coming up</span><div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:1rem">
        <div><div class="h2">${esc(ex.name)} exam</div><div class="small muted">${esc(short(ex.date))}${ex.date2 ? '–' + esc(short(ex.date2).split(', ')[1]) : ''} · ${esc(ex.covers)}</div></div>
        <span class="chip exam">${n <= 0 ? 'Now' : inDays(n)}</span></div>
        <div class="btn-row"><button class="btn ghost" id="toStudy">Study for it</button></div></div></div>`;
    }
  }
  html += `<p class="foot">${esc(C.school)} · ${esc(C.dept)}<br>${esc(C.term)} · ${esc(C.instructor)}</p>`;
  view.innerHTML = html;
  bindRows();
  view.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => go({ type: 'session', n: +b.dataset.open })));
  view.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => openIn(b.dataset.goto)));
  $('#toStudy')?.addEventListener('click', () => { ui.studySeg = 'exams'; openIn('study'); });
  $('#toQuiz')?.addEventListener('click', () => { ui.studySeg = 'quizzes'; openIn('study'); });
}
function sessionHero(s, label) {
  return `<div class="card hero"><span class="label">${esc(label)}</span><h2>${esc(s.title)}</h2>
    <div class="meta"><span class="chip">2:00–3:00 PM</span><span class="chip">Room ${esc(C.room)}</span><span class="chip">Week ${s.week} · Day ${s.day}</span>${quizOn(s.date) ? `<span class="chip quiz">Quiz ${quizOn(s.date).n} at 2:00</span>` : ''}${s.kind === 'exam' ? '<span class="chip exam">Exam day</span>' : s.kind === 'practical' ? `<span class="chip prac">${esc(s.practical.name)}</span>` : ''}</div>
    <div class="btn-row" style="position:relative"><button class="btn light" data-open="${s.n}">Open full lesson plan</button></div></div>`;
}

/* ---------- SCHEDULE ---------- */
function renderSchedule() {
  setTop('Schedule', `${C.time} · ${C.room}`);
  const t = todayISO();
  let html = `<div class="notice" style="margin-top:var(--space-2)">No class Mon, Jan 18 (MLK Day). Week 1 runs Tue–Thu. Final grades due Fri, Mar 12 at noon.</div>`;
  for (const w of D.weeks) {
    const ss = D.sessions.filter(s => s.week === w.week);
    html += `<div class="week-h"><span class="h2">Week ${w.week}: ${esc(w.title)}</span><span class="label">${esc(short(ss[0].date).split(', ')[1])}</span></div>
      <div class="list">${ss.map(s => sessionRow(s, t)).join('')}</div>`;
  }
  view.innerHTML = html; bindRows();
  const cur = view.querySelector('.row.today');
  if (cur && !stack.schedule.length) setTimeout(() => cur.scrollIntoView({ block: 'center' }), 0);
}

/* ---------- SESSION ---------- */
function renderSession(n) {
  const s = sessionByN(n);
  setTop(s.title, `Session ${s.n} · Week ${s.week} · ${short(s.date)}`);
  const q = quizOn(s.date);
  let html = `<div class="card"><div class="meta" style="display:flex;flex-wrap:wrap;gap:var(--space-2)">${sessionTags(s) || '<span class="chip">Lab day</span>'}<span class="chip">${esc(s.chapter)}</span></div>
    <p class="prose" style="margin-top:var(--space-3)"><b>Reading:</b> ${esc(s.reading)}</p>
    <p class="prose muted">${esc(s.topic)}</p>
    ${q ? `<div class="notice">Quiz ${q.n} at 2:00–2:10 PM covers Ch. ${esc(q.chapters)}: ${esc(q.covers)}.</div>` : ''}</div>`;
  html += `<div class="section"><span class="label">Objectives</span><div class="card"><ul class="clean">${s.objectives.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div></div>`;
  html += `<div class="section"><span class="label">Daily structure</span><div class="card"><table class="ttable"><tbody>${C.daily.map(([a, b]) => `<tr><td style="width:7.5rem;font-weight:600;white-space:nowrap">${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</tbody></table></div></div>`;
  html += `<div class="section"><span class="label">Lecture & demo · 2:00</span><div class="card"><p class="prose">${esc(s.lecture)}</p></div></div>`;
  if (s.practical) {
    const p = s.practical;
    html += `<div class="section"><span class="label">${esc(p.name)} · ${esc(p.time_limit)}</span><div class="card"><p class="prose">${esc(p.task)}</p>
      ${p.products?.length ? `<div class="label" style="margin-top:var(--space-4)">Products</div><ul class="clean" style="margin-top:var(--space-2)">${p.products.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${p.standards?.length ? `<div class="label" style="margin-top:var(--space-4)">Standards</div><ul class="clean" style="margin-top:var(--space-2)">${p.standards.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${s.rubric != null ? `<div class="btn-row">${D.rubrics.map((r, i) => r.session === s.n ? `<button class="btn" data-rubric="${i}">${D.rubrics.filter(x => x.session === s.n).length > 1 ? esc(r.title.split(':')[0]) + ' rubric' : 'Open grading rubric'}</button>` : '').join('')}</div>` : ''}</div></div>`;
  }
  html += `<div class="section"><span class="label">Lab timeline</span><div class="card">${labList(s.lab)}</div></div>`;
  if (s.recipes.length) html += `<div class="section"><span class="label">Drink specs (${s.recipes.length})</span><div class="list">${s.recipes.map(id => recipeRow(recipeById(id))).join('')}</div></div>`;
  html += `<div class="section"><span class="label">Tasting & critique · 2:45</span><div class="card"><p class="prose">${esc(s.critique)}</p></div></div>`;
  html += `<div class="section"><span class="label">Homework</span><div class="card"><p class="prose">${esc(s.homework)}</p></div></div>`;
  if (s.chefPrep) html += `<div class="section"><span class="label">Chef's advance prep</span><div class="card"><p class="prose muted">${esc(s.chefPrep)}</p></div></div>`;
  const prev = sessionByN(n - 1), nxt = sessionByN(n + 1);
  html += `<div class="btn-row" style="justify-content:space-between;margin-top:var(--space-8)">${prev ? `<button class="btn ghost" data-sib="${prev.n}">‹ ${esc(short(prev.date))}</button>` : '<span></span>'}${nxt ? `<button class="btn ghost" data-sib="${nxt.n}">${esc(short(nxt.date))} ›</button>` : ''}</div>`;
  view.innerHTML = html; bindRows();
  view.querySelectorAll('[data-sib]').forEach(b => b.addEventListener('click', () => { stack[tab][stack[tab].length - 1] = { type: 'session', n: +b.dataset.sib }; render(); window.scrollTo(0, 0); }));
}

/* ---------- RECIPES ---------- */
function renderRecipes() {
  setTop('Drink Specs', `${D.recipes.length} lab specs · all alcohol-free · per team of 2 unless noted`);
  const q = ui.rq.trim().toLowerCase();
  let list = D.recipes;
  if (ui.rWeek) list = list.filter(r => r.week === ui.rWeek);
  if (ui.rFam) list = list.filter(r => r.family === ui.rFam);
  if (q) list = list.filter(r => (r.name + ' ' + r.method + ' ' + r.glass + ' ' + r.ingredients.map(x => x.item).join(' ')).toLowerCase().includes(q));
  let html = `<div class="search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
    <label class="sr" for="rq">Search drink specs</label><input id="rq" type="search" placeholder="Search drinks, ingredients or glasses" value="${esc(ui.rq)}" autocomplete="off"></div>
    <div class="filters" aria-label="Filter by week">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(w => `<button data-w="${w}" class="${w === ui.rWeek ? 'on' : ''}">${w ? 'Week ' + w : 'All weeks'}</button>`).join('')}</div>
    <div class="filters" aria-label="Filter by technique"><button data-f="" class="${!ui.rFam ? 'on' : ''}">All techniques</button>${D.families.map(([k, n]) => `<button data-f="${k}" class="${ui.rFam === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>
    <p class="small muted" style="margin-top:var(--space-3)">${list.length} drink spec${list.length === 1 ? '' : 's'}</p>`;
  if (!list.length) html += `<div class="empty">No drink specs match${q ? ` “${esc(ui.rq)}”` : ''} with these filters.<br>Try an ingredient like “lime” or clear a filter.</div>`;
  else {
    let cur = 0;
    html += list.map(r => {
      let h = '';
      if (r.session !== cur) { if (cur) h += '</div>'; cur = r.session; const s = sessionByN(r.session); h += `<div class="week-h"><span class="h2">${esc(s.title)}</span><span class="label">${esc(short(r.date))}</span></div><div class="list">`; }
      return h + recipeRow(r);
    }).join('') + '</div>';
  }
  view.innerHTML = html;
  const inp = $('#rq');
  inp.addEventListener('input', () => { ui.rq = inp.value; const pos = inp.selectionStart; renderRecipes(); const n = $('#rq'); n.focus(); n.setSelectionRange(pos, pos); });
  view.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => { ui.rWeek = +b.dataset.w; renderRecipes(); }));
  view.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { ui.rFam = b.dataset.f; renderRecipes(); }));
  bindRows();
}

const STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12];
function renderRecipe(id) {
  const r = recipeById(id);
  const s = sessionByN(r.session);
  setTop(r.name, `${famName(r.family)} · ${short(r.date)}`);
  const scaleKey = 'scale:' + id, checkKey = 'check:' + id;
  const f = store.get(scaleKey, 1);
  const checks = store.get(checkKey, []);
  const done = checks.length, total = r.ingredients.length;
  const cookMin = firstMinutes(r.build);
  const team = /team/i.test(r.batch), student = /student/i.test(r.batch);
  const scaleNote = f === 1 ? r.batch : team ? `${f} team batches` : student ? `${f} students' worth` : `${f} batches`;
  let html = `<div class="card">${r.name.length > 26 ? `<div class="h2">${esc(r.name)}</div>` : ''}
    <div class="rec-meta"><div><div class="label">Yield${f !== 1 ? ' (×1)' : ''}</div><div class="v">${esc(r.yield)}</div></div>
    <div><div class="label">Technique</div><div class="v">${esc(r.method)} · Ch. ${r.chapter}</div></div>
    <div><div class="label">Glass</div><div class="v">${esc(r.glass)}</div></div>
    <div><div class="label">Ice · Garnish</div><div class="v">${esc(r.ice)} · ${esc(r.garnish)}</div></div></div>
    ${r.tasted ? '' : '<div class="notice" style="margin-top:var(--space-4)">Prep, practice or service item. Not tasted as made.</div>'}
    <div class="scaler"><div class="label">Batch size</div>
      <div class="scaler-row"><div class="stepper"><button id="sMinus" aria-label="Smaller batch">−</button><output id="sOut" aria-live="polite">×${f}</output><button id="sPlus" aria-label="Larger batch">+</button></div>
      <span class="small muted">${esc(scaleNote)}</span></div></div>
    ${r.safety ? `<div class="safe">${shield}<div><b>Safety and holding.</b> ${esc(r.safety)}</div></div>` : ''}
  </div>
  <div class="section"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="label">Mise en place · tap to check off</span><span class="small muted">${done}/${total}</span></div>
  <div class="progress"><i style="width:${total ? done / total * 100 : 0}%"></i></div>
  <div class="list" style="margin-top:.75rem">${r.ingredients.map((x, i) => {
    const us = fmtUS(x, f);
    return `<button class="ing ${checks.includes(i) ? 'done' : ''}" data-i="${i}" aria-pressed="${checks.includes(i)}">
    <span class="box"></span><span class="n">${esc(x.item)}</span><span class="q"><span>${esc(fmtMetric(x.amount, x.unit, f))}</span>${us && us !== fmtMetric(x.amount, x.unit, f) ? `<small>${esc(us)}</small>` : ''}</span></button>`;
  }).join('')}</div>
  ${f !== 1 ? '<p class="formula">Metric amounts are scaled exactly. US amounts are converted and rounded. Taste and adjust balance after scaling.</p>' : ''}
  ${done ? '<div class="btn-row"><button class="btn ghost" id="resetChecks">Clear checkmarks</button></div>' : ''}</div>
  <div class="section"><span class="label">Method</span><div class="card"><ol class="steps">${r.steps.map(st => {
    const m = firstMinutes(st);
    return `<li>${esc(st)}${m && m >= 1 && m <= 300 ? `<button class="stimer" data-tm="${m}" aria-label="Start ${m}-minute timer">⏱ ${m} min</button>` : ''}</li>`;
  }).join('')}</ol></div></div>
  <div class="section"><span class="label">Build</span><div class="card"><p class="prose">${esc(r.build)}</p>
    ${cookMin ? `<div class="btn-row"><button class="btn" id="addTimer">Start ${cookMin}-min timer</button></div>` : ''}</div></div>
  <div class="section"><span class="label">Quality standard</span><div class="card"><p class="prose">${esc(r.quality)}</p></div></div>
  ${r.classic_spec ? `<div class="section"><span class="label">Classic reference · not made in lab</span><div class="card"><p class="prose muted">${esc(r.classic_spec)}</p></div></div>` : ''}
  <div class="section"><span class="label">From the lesson</span><div class="list"><button class="row" data-session="${s.n}"><div class="body"><div class="t">${esc(s.title)}</div><div class="s">${esc(short(s.date))} · full lesson plan</div></div>${chev}</button></div></div>`;
  view.innerHTML = html;
  const setF = nf => { store.set(scaleKey, nf); renderRecipe(id); };
  $('#sMinus').addEventListener('click', () => { const i = STEPS.indexOf(f); if (i > 0) setF(STEPS[i - 1]); });
  $('#sPlus').addEventListener('click', () => { const i = STEPS.indexOf(f); if (i < STEPS.length - 1) setF(STEPS[i + 1]); });
  view.querySelectorAll('.ing').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i; const c = store.get(checkKey, []);
    store.set(checkKey, c.includes(i) ? c.filter(x => x !== i) : [...c, i]); const y = window.scrollY; renderRecipe(id); window.scrollTo(0, y);
  }));
  $('#resetChecks')?.addEventListener('click', () => { store.set(checkKey, []); renderRecipe(id); });
  $('#addTimer')?.addEventListener('click', () => { addTimer(r.name, cookMin); unlockAudio(); toast(`${cookMin}-minute timer started · see Tools`); });
  view.querySelectorAll('[data-tm]').forEach(b => b.addEventListener('click', () => { const m = +b.dataset.tm; addTimer(r.name + ' · step', m); unlockAudio(); toast(`${m}-minute timer started · see Tools`); }));
  bindRows();
}

/* ---------- RUBRIC ---------- */
function renderRubric(idx) {
  const r = D.rubrics[idx];
  const [a, b] = r.title.split(': ');
  setTop(b || r.title, `${a} · ${short(r.date)} · ${r.time_limit.split(',')[0]}`);
  const P = D.policy;
  let html = `<div class="card"><div class="label">${esc(r.date_label)} · ${esc(r.time_limit)}</div><p class="prose" style="margin-top:.5rem">${esc(r.task)}</p>
    <p class="small muted" style="margin-top:var(--space-3)">${esc(r.grade_category)}</p></div>
    <div class="section"><span class="label">${r.total_points}-point rubric</span><div class="list">${r.categories.map(c => `<div class="rub-cat"><span>${esc(c.name)}</span><span>${c.points} pts</span></div>` +
    c.criteria.map(i => `<div class="rub-item"><span><span class="rt">${i.n}. ${esc(i.title)}</span><span class="rd">${esc(i.full_credit)}</span></span><b>${i.points}</b></div>`).join('')).join('')}
    <div class="rub-cat" style="background:var(--color-primary-soft)"><span>Total</span><span>${r.total_points} pts</span></div></div></div>`;
  if (r.required_temperatures?.length) html += `<div class="section"><span class="label">Temperatures Chef will record</span><div class="card"><table class="ttable"><tbody>${r.required_temperatures.map(x => `<tr><td>${esc(x.item)}</td><td class="t hot">${esc(x.required_minimum)}</td></tr>`).join('')}</tbody></table></div></div>`;
  html += `<div class="section"><span class="label">How it's scored</span><div class="card"><ul class="clean">${P.how_graded.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
    <div class="section"><span class="label">Deductions · ${esc(P.deductions_note)}</span><div class="card"><table class="ttable"><tbody>${P.deductions.map(d => `<tr><td>${esc(d.issue)}</td><td class="t hot" style="white-space:normal;max-width:9rem">${esc(d.deduction)}</td></tr>`).join('')}</tbody></table></div></div>`;
  view.innerHTML = html;
}

/* ---------- TOOLS ---------- */
const TSEG = [['pours', 'Pours'], ['abv', 'ABV'], ['cost', 'Costing'], ['convert', 'Convert'], ['timers', 'Timers']];
function renderTools() {
  setTop('Bar Tools');
  let html = `<div class="seg" role="tablist">${TSEG.map(([k, n]) => `<button role="tab" aria-selected="${ui.toolSeg === k}" class="${ui.toolSeg === k ? 'on' : ''}" data-seg="${k}">${n}${k === 'timers' && timers.length ? ` (${timers.length})` : ''}</button>`).join('')}</div>`;
  html += ({ pours: poursHTML, abv: abvHTML, cost: costHTML, convert: convertHTML, timers: timersHTML })[ui.toolSeg]();
  view.innerHTML = html;
  view.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => { ui.toolSeg = b.dataset.seg; renderTools(); }));
  ({ pours: bindPours, abv: bindAbv, cost: bindCost, convert: bindConvert, timers: bindTimers })[ui.toolSeg]();
}
const tr2 = (a, b, c) => `<tr><td>${esc(a)}</td><td class="t hot">${esc(b)}${c ? `<small>${esc(c)}</small>` : ''}</td></tr>`;
function poursHTML() {
  const pours = [['Bar spoon', '5 mL', '1 tsp'], ['Half pour', '15 mL', '1/2 oz'], ['Three-quarter', '22 mL', '3/4 oz'], ['Single', '30 mL', '1 oz'], ['Standard spirit pour', '45 mL', '1 1/2 oz'], ['Double / tall', '60 mL', '2 oz'], ['Wine glass', '150 mL', '5 oz'], ['Beer', '355 mL', '12 oz']];
  const count = [['1-count', '≈ 7.5 mL', '1/4 oz'], ['2-count', '≈ 15 mL', '1/2 oz'], ['3-count', '≈ 22 mL', '3/4 oz'], ['4-count', '≈ 30 mL', '1 oz'], ['6-count', '≈ 45 mL', '1 1/2 oz']];
  const bottles = [['Split', '187 mL', '6.3 fl oz'], ['Half bottle', '375 mL', '12.7 fl oz'], ['Standard bottle', '750 mL', '25.4 fl oz'], ['Liter', '1 L', '33.8 fl oz'], ['Magnum / handle', '1.5 L · 1.75 L', '50.7 · 59.2 fl oz'], ['Half-barrel keg', '15.5 gal', '1,984 fl oz']];
  const tech = [['Stir', '20–30 sec', 'clear drinks, mixing glass'], ['Shake hard', '10–12 sec', 'juice, dairy, egg white'], ['Dry shake', '≈ 10 sec', 'no ice, for foam'], ['Beer head', '2–3 cm', 'about 1 in.']];
  return `<div class="tool-nav"><a href="#t-pours">Pour sizes</a><a href="#t-count">Free-pour count</a><a href="#t-per">Pours per bottle</a><a href="#t-std">Standard drinks</a><a href="#t-law">Arkansas ages</a></div>
  <div class="section" id="t-pours"><span class="label">Common pour sizes</span><div class="card"><table class="ttable"><tbody>${pours.map(x => tr2(...x)).join('')}</tbody></table>
    <p class="src">Class rounding: 1 fl oz = 30 mL (exact 29.57 mL). Every lab drink is measured, not guessed.</p></div></div>
  <div class="section" id="t-count"><span class="label">Free-pour count (class standard)</span><div class="card"><table class="ttable"><tbody>${count.map(x => tr2(...x)).join('')}</tbody></table>
    <p class="src">Check your count against a jigger with practice bottles of tinted water. Practice liquids are never tasted.</p></div></div>
  <div class="section"><span class="label">Technique timing</span><div class="card"><table class="ttable"><tbody>${tech.map(x => tr2(...x)).join('')}</tbody></table></div></div>
  <div class="section" id="t-per"><span class="label">Pours per bottle</span><div class="card">
    <div class="grid2">${field('bSize', 'Bottle size (mL)', '750')}${field('bPour', 'Pour size (mL)', '45')}</div>
    <div class="result"><span class="small">Pours per bottle</span><span class="big" id="bPours">—</span></div>
    <p class="formula" id="bFull"></p>
    <table class="ttable" style="margin-top:var(--space-3)"><tbody>${bottles.map(x => tr2(...x)).join('')}</tbody></table></div></div>
  <div class="section" id="t-std"><span class="label">U.S. standard drink</span><div class="card"><table class="ttable"><tbody>
    ${tr2('Beer at 5% ABV', '12 fl oz', '355 mL')}${tr2('Wine at 12% ABV', '5 fl oz', '150 mL')}${tr2('Spirits at 40% ABV (80 proof)', '1 1/2 fl oz', '45 mL')}</tbody></table>
    <p class="src">Each holds about 0.6 fl oz (14 g) of pure alcohol, per the <a href="https://www.niaaa.nih.gov/alcohols-effects-health/what-standard-drink" target="_blank" rel="noopener">NIAAA standard drink guide</a>. Only time lowers BAC.</p></div></div>
  <div class="section" id="t-law"><span class="label">Arkansas age rules</span><div class="card"><table class="ttable"><tbody>
    ${tr2('Buy or drink alcohol', '21')}${tr2('Serve alcohol (server)', '19')}${tr2('Tend bar (mix and pour)', '21')}</tbody></table>
    <p class="src">Per <a href="https://alcoholpolicy.niaaa.nih.gov/underage-drinking/state-profiles/arkansas/55" target="_blank" rel="noopener">NIAAA Alcohol Policy Information System, Arkansas</a>. In this class every lab is alcohol-free.</p></div></div>
  <div class="section"><span class="label">Holding</span><div class="card"><table class="ttable"><tbody>
    ${tr2('Cut garnish and fresh juice', '41°F or below', 'discard at end of shift')}${tr2('Simple and flavored syrups', '41°F or below', 'up to 2 weeks; discard if cloudy')}${tr2('Draft beer storage', '≈ 38°F', '3°C')}</tbody></table></div></div>`;
}
function bindPours() {
  const upd = () => {
    const n = num('bSize') / num('bPour');
    $('#bPours').textContent = ok(n) && num('bPour') > 0 ? fmt(n, 1) : '—';
    $('#bFull').textContent = ok(n) && num('bPour') > 0 ? `${Math.floor(n)} full pours · ${fmt(num('bSize') - Math.floor(n) * num('bPour'), 0)} mL left over` : '';
  };
  view.querySelectorAll('input').forEach(i => i.addEventListener('input', upd)); upd();
}
function abvHTML() {
  return `<div class="section"><span class="label">Proof and ABV</span><div class="card"><div class="grid2">${field('pProof', 'Proof (U.S.)', '80')}${field('pAbv', 'ABV %', '')}</div>
    <p class="formula">Proof = 2 × ABV. 80 proof = 40% ABV.</p></div></div>
  <div class="section"><span class="label">Alcohol in a drink</span><div class="card">
    <p class="small muted">List each alcohol-containing ingredient. Use this for textbook and exam problems; lab drinks are alcohol-free.</p>
    <div class="grid2" style="margin-top:var(--space-3)">${field('a1v', 'Ingredient 1 volume (mL)', '45')}${field('a1p', 'Ingredient 1 ABV %', '40')}${field('a2v', 'Ingredient 2 volume (mL)', '0')}${field('a2p', 'Ingredient 2 ABV %', '0')}${field('aTot', 'Total drink volume (mL)', '150', '', 'decimal', true)}</div>
    <div class="result"><span class="small">Pure alcohol</span><span class="big" id="aPure">—</span></div>
    <div class="result" style="margin-top:var(--space-2)"><span class="small">Standard drinks</span><span class="big" id="aStd">—</span></div>
    <div class="result" style="margin-top:var(--space-2)"><span class="small">Finished drink ABV</span><span class="big" id="aDrink">—</span></div>
    <p class="formula">Pure alcohol = volume × ABV. One U.S. standard drink ≈ 17.7 mL (0.6 fl oz) pure alcohol. Drink ABV = pure alcohol ÷ total volume × 100.</p></div></div>`;
}
function bindAbv() {
  const r = (n, d = 1) => ok(n) ? String(Math.round(n * 10 ** d) / 10 ** d) : '';
  $('#pProof').addEventListener('input', () => { const v = num('pProof'); if (ok(v)) $('#pAbv').value = r(v / 2); });
  $('#pAbv').addEventListener('input', () => { const v = num('pAbv'); if (ok(v)) $('#pProof').value = r(v * 2); });
  const upd = () => {
    const pure = (num('a1v') || 0) * (num('a1p') || 0) / 100 + (num('a2v') || 0) * (num('a2p') || 0) / 100;
    $('#aPure').textContent = fmt(pure, 1) + ' mL';
    $('#aStd').textContent = fmt(pure / 17.74, 2);
    $('#aDrink').textContent = num('aTot') > 0 ? fmt(pure / num('aTot') * 100, 1) + '%' : '—';
  };
  ['a1v', 'a1p', 'a2v', 'a2p', 'aTot'].forEach(id => $('#' + id).addEventListener('input', upd));
  $('#pProof').dispatchEvent(new Event('input')); upd();
}

const num = id => parseFloat(($('#' + id)?.value || '').replace(/[$,]/g, ''));
const ok = n => Number.isFinite(n);
const money = n => ok(n) ? '$' + n.toFixed(2) : '—';
const fmt = (n, d = 1) => ok(n) ? (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('en-US') : '—';
const field = (id, label, val, ph = '', mode = 'decimal', full) => `<div class="field"${full ? ' style="grid-column:1/-1"' : ''}><label for="${id}">${label}</label><input id="${id}" inputmode="${mode}" value="${esc(val)}" placeholder="${esc(ph)}"></div>`;
function costHTML() {
  if (!ui.plate) ui.plate = [['Lime juice, 22 mL', '0.18'], ['Simple syrup, 15 mL', '0.03'], ['Ginger beer, 120 mL', '0.55'], ['Lime wheel garnish', '0.05']];
  return `
  <div class="section"><span class="label">Cost per pour</span><div class="card">
    <div class="grid2">${field('cbSize', 'Bottle size (mL)', '750')}${field('cbPrice', 'Bottle cost ($)', '21.00')}
    ${field('cbPour', 'Pour size (mL)', '45', '', 'decimal', true)}</div>
    <div class="result"><span class="small">Cost per mL</span><span class="big" id="cbMl">—</span></div>
    <div class="result" style="margin-top:var(--space-2)"><span class="small">Cost per pour</span><span class="big" id="cbPer">—</span></div>
    <p class="formula">Cost per pour = bottle cost ÷ bottle size × pour size.</p>
  </div></div>
  <div class="section"><span class="label">Drink cost and price</span><div class="card">
    <div id="pcRows">${ui.plate.map(([n, c], i) => `<div class="pc-row"><div class="field"><label for="pn${i}">Ingredient</label><input id="pn${i}" data-pn="${i}" value="${esc(n)}"></div><div class="field"><label for="pc${i}">Cost ($)</label><input id="pc${i}" data-pc="${i}" inputmode="decimal" value="${esc(c)}"></div><button class="tbtn" data-pdel="${i}" aria-label="Remove ingredient">✕</button></div>`).join('')}</div>
    <button class="btn ghost" id="pcAdd" style="margin-top:var(--space-3)">+ Add ingredient</button>
    <div class="grid2" style="margin-top:var(--space-4)">${field('pcPct', 'Target pour cost %', '20', '', 'decimal', true)}</div>
    <div class="result"><span class="small">Drink cost</span><span class="big" id="pcTot">—</span></div>
    <div class="result" style="margin-top:var(--space-2)"><span class="small">Selling price at target</span><span class="big" id="pcPrice">—</span></div>
    <div class="grid2" style="margin-top:var(--space-4)">${field('pcSell', 'Actual selling price ($)', '5.00', '', 'decimal', true)}</div>
    <div class="result"><span class="small">Actual pour cost %</span><span class="big" id="pcAct">—</span></div>
    <p class="formula">Pour cost % = drink cost ÷ selling price × 100. Selling price = drink cost ÷ target pour cost %.</p>
  </div></div>
  <div class="section"><span class="label">Scale a spec or batch</span><div class="card">
    <div class="grid2">${field('sOldN', 'Spec makes (drinks)', '1')}${field('sNewN', 'Drinks needed', '12')}
    ${field('sQty', 'Ingredient amount in spec (mL)', '22', '', 'decimal', true)}</div>
    <div class="result"><span class="small">Conversion factor</span><span class="big" id="sFac">—</span></div>
    <div class="result" style="margin-top:var(--space-2)"><span class="small">Scaled amount</span><span class="big" id="sNewQ">—</span></div>
    <p class="formula">Factor = drinks needed ÷ drinks the spec makes. Add carbonated mixers at service, not in the batch.</p>
  </div></div>
  <div class="section"><span class="label">Inventory and ordering</span><div class="card">
    <div class="grid2">${field('iBeg', 'Beginning inventory ($)', '3000')}${field('iPur', 'Purchases ($)', '1800')}${field('iEnd', 'Ending inventory ($)', '2700')}${field('iSales', 'Beverage sales ($)', '9000')}</div>
    <div class="result"><span class="small">Cost of beverages sold</span><span class="big" id="iCogs">—</span></div>
    <div class="result" style="margin-top:var(--space-2)"><span class="small">Pour cost %</span><span class="big" id="iPct">—</span></div>
    <p class="formula">Cost of beverages sold = beginning + purchases − ending.</p>
    <div class="grid2" style="margin-top:var(--space-4)">${field('oPar', 'Par', '36')}${field('oHand', 'On hand', '11')}</div>
    <div class="result"><span class="small">Order</span><span class="big" id="oOrd">—</span></div>
    <p class="formula">Order = par − on hand. Count open bottles in tenths.</p>
  </div></div>`;
}
function bindCost() {
  const upd = () => {
    const perMl = num('cbPrice') / num('cbSize');
    $('#cbMl').textContent = ok(perMl) && num('cbSize') > 0 ? '$' + perMl.toFixed(3) : '—';
    $('#cbPer').textContent = ok(perMl) && num('cbSize') > 0 && ok(num('cbPour')) ? money(perMl * num('cbPour')) : '—';
    const fac = num('sNewN') / num('sOldN');
    $('#sFac').textContent = ok(fac) && fac > 0 ? fmt(fac, 3) : '—';
    $('#sNewQ').textContent = ok(fac * num('sQty')) && fac > 0 ? fmt(fac * num('sQty'), 1) + ' mL' : '—';
    view.querySelectorAll('[data-pn]').forEach(i => { ui.plate[+i.dataset.pn][0] = i.value; });
    view.querySelectorAll('[data-pc]').forEach(i => { ui.plate[+i.dataset.pc][1] = i.value; });
    const tot = ui.plate.reduce((a, [, c]) => a + (parseFloat(String(c).replace(/[$,]/g, '')) || 0), 0);
    $('#pcTot').textContent = money(tot);
    $('#pcPrice').textContent = num('pcPct') > 0 ? money(tot / (num('pcPct') / 100)) : '—';
    $('#pcAct').textContent = num('pcSell') > 0 ? fmt(tot / num('pcSell') * 100, 1) + '%' : '—';
    const cogs = num('iBeg') + num('iPur') - num('iEnd');
    $('#iCogs').textContent = ok(cogs) ? money(cogs) : '—';
    $('#iPct').textContent = ok(cogs) && num('iSales') > 0 ? fmt(cogs / num('iSales') * 100, 1) + '%' : '—';
    const o = num('oPar') - num('oHand');
    $('#oOrd').textContent = ok(o) ? fmt(Math.max(0, o), 1) : '—';
  };
  view.querySelectorAll('input').forEach(i => i.addEventListener('input', upd));
  $('#pcAdd').addEventListener('click', () => { ui.plate.push(['', '']); renderTools(); const last = view.querySelector(`[data-pn="${ui.plate.length - 1}"]`); last?.focus(); });
  view.querySelectorAll('[data-pdel]').forEach(b => b.addEventListener('click', () => { ui.plate.splice(+b.dataset.pdel, 1); renderTools(); }));
  upd();
}
function convertHTML() {
  return `
  <div class="section"><span class="label">Bar volume</span><div class="card"><div class="grid2">${field('vMl', 'Milliliters', '45')}${field('vFl', 'Fluid ounces', '')}${field('vTsp', 'Teaspoons (bar spoons)', '')}${field('vTbsp', 'Tablespoons', '')}${field('vCup', 'Cups', '')}${field('vL', 'Liters', '')}${field('vQt', 'Quarts', '')}${field('vGal', 'Gallons', '')}</div>
    <p class="formula">1 fl oz = 29.57 mL (class rounds to 30) · 1 Tbsp ≈ 15 mL · 1 cup = 8 fl oz · 1 L = 33.8 fl oz · 1 gal = 128 fl oz</p></div></div>
  <div class="section"><span class="label">Temperature</span><div class="card"><div class="grid2">${field('cF', '°F', '41')}${field('cC', '°C', '')}</div>
    <p class="formula">°C = (°F − 32) × 5 ÷ 9 · °F = °C × 9 ÷ 5 + 32</p></div></div>
  <div class="section"><span class="label">Weight</span><div class="card"><div class="grid2">${field('wG', 'Grams', '250')}${field('wKg', 'Kilograms', '')}${field('wOz', 'Ounces', '')}${field('wLb', 'Pounds', '')}</div>
    <p class="formula" id="wLbOz"></p><p class="formula">1 oz = 28.35 g · 1 lb = 453.6 g · 1 kg = 2.2 lb</p></div></div>`;
}
function bindConvert() {
  const r = (n, d = 2) => ok(n) ? String(Math.round(n * 10 ** d) / 10 ** d) : '';
  const link = (ids, toBase, fromBase, after) => ids.forEach(id => $('#' + id).addEventListener('input', () => {
    const v = num(id); if (!ok(v)) return;
    const base = toBase[id](v);
    ids.forEach(o => { if (o !== id) $('#' + o).value = r(fromBase[o](base)); });
    after && after(base);
  }));
  link(['cF', 'cC'], { cF: v => v, cC: v => v * 9 / 5 + 32 }, { cF: v => v, cC: v => (v - 32) * 5 / 9 }, null);
  const lbOz = g => { const oz = g / 28.3495, lb = Math.floor(oz / 16); $('#wLbOz').textContent = ok(oz) ? `= ${lb} lb ${r(oz - lb * 16, 1)} oz` : ''; };
  link(['wG', 'wKg', 'wOz', 'wLb'], { wG: v => v, wKg: v => v * 1000, wOz: v => v * 28.3495, wLb: v => v * 453.592 }, { wG: v => v, wKg: v => v / 1000, wOz: v => v / 28.3495, wLb: v => v / 453.592 }, lbOz);
  const U = { vMl: 1, vFl: 29.5735, vTsp: 4.92892, vTbsp: 14.7868, vCup: 236.588, vL: 1000, vQt: 946.353, vGal: 3785.41 };
  const to = {}, from = {}; for (const k in U) { to[k] = v => v * U[k]; from[k] = v => v / U[k]; }
  link(Object.keys(U), to, from, null);
  ['cF', 'wG', 'vMl'].forEach(id => $('#' + id).dispatchEvent(new Event('input')));
}

/* timers */
let timers = [];
let tid = 0;
function addTimer(name, min) { timers.push({ id: ++tid, name, total: Math.round(min * 60), end: Date.now() + min * 60e3, paused: null, ring: false }); }
const left = t => t.paused != null ? t.paused : Math.max(0, Math.round((t.end - Date.now()) / 1000));
const mmss = s => s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function timersHTML() {
  const presets = [['Stir', 0.5], ['Shake hard', 0.2], ['Dry shake', 1 / 6], ['Steep tea', 5], ['Cool syrup', 15], ['3-drink ticket', 6], ['4-drink ticket', 5], ['Practical station', 3], ['Lab block', 25], ['Breakdown', 8]];
  const pl = m => m < 1 ? Math.round(m * 60) + 's' : m + 'm';
  return `<div class="section"><span class="label">Running · ${timers.length}</span>${timers.length ? `<div class="list" id="tlist">${timers.map(t => `<div class="timer ${t.ring ? 'ring' : ''}" data-t="${t.id}">
      <div class="tname">${esc(t.name)}<div class="small muted">${t.ring ? 'Done · tap ✓ to clear' : t.total < 60 ? t.total + ' sec' : Math.round(t.total / 60) + ' min'}</div></div><span class="tleft" data-left="${t.id}">${mmss(left(t))}</span>
      <button class="tbtn ${t.paused != null || t.ring ? 'go' : ''}" data-act="toggle" aria-label="${t.ring ? 'Dismiss' : t.paused != null ? 'Resume' : 'Pause'}">${t.ring ? '✓' : t.paused != null ? '▶' : '❚❚'}</button>
      <button class="tbtn" data-act="add" aria-label="Add one minute">+1</button>
      <button class="tbtn" data-act="del" aria-label="Remove timer">✕</button></div>`).join('')}</div>` : '<div class="card empty" style="padding:2rem 1rem">No timers running. Start one below, or tap a time in any recipe.</div>'}</div>
    <div class="section"><span class="label">New timer</span><div class="card">
      <div class="grid2"><div class="field"><label for="tName">Label</label><input id="tName" placeholder="e.g. Team 3 syrup"></div>
      <div class="field"><label for="tMin">Minutes</label><input id="tMin" inputmode="decimal" value="10"></div></div>
      <button class="btn block" id="tAdd" style="margin-top:1rem">Start timer</button>
      <div class="presets">${presets.map(([n, m]) => `<button data-p="${m}" data-n="${n}">${n} · ${pl(m)}</button>`).join('')}</div>
      <p class="formula">Run as many timers at once as you need. Keep this app open while they run; timers reset if the app is closed.</p></div></div>`;
}
function bindTimers() {
  $('#tAdd').addEventListener('click', () => { const m = num('tMin'); if (!(m > 0)) return toast('Enter minutes'); addTimer($('#tName').value.trim() || `${m}-minute timer`, m); unlockAudio(); renderTools(); });
  view.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { addTimer(b.dataset.n, +b.dataset.p); unlockAudio(); renderTools(); }));
  view.querySelectorAll('.timer').forEach(el => el.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
    const t = timers.find(x => x.id === +el.dataset.t);
    if (act === 'del' || (act === 'toggle' && t.ring)) timers = timers.filter(x => x !== t);
    else if (act === 'add') { if (t.ring) { t.ring = false; t.end = Date.now() + 60e3; } else if (t.paused != null) t.paused += 60; else t.end += 60e3; t.total += 60; }
    else if (t.paused != null) { t.end = Date.now() + t.paused * 1000; t.paused = null; }
    else t.paused = left(t);
    renderTools();
  }));
}
let actx = null;
function unlockAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch {} }
function beep() {
  try { unlockAudio(); [0, .35, .7].forEach(d => { const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(actx.destination); g.gain.setValueAtTime(.0001, actx.currentTime + d); g.gain.exponentialRampToValueAtTime(.3, actx.currentTime + d + .02); g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + d + .25); o.start(actx.currentTime + d); o.stop(actx.currentTime + d + .3); }); } catch {}
  try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch {}
}
setInterval(() => {
  let changed = false;
  timers.forEach(t => {
    if (!t.ring && t.paused == null && left(t) === 0) { t.ring = true; changed = true; beep(); toast(`${t.name}: time's up`); }
    const el = document.querySelector(`[data-left="${t.id}"]`); if (el) el.textContent = mmss(left(t));
  });
  const tb = document.querySelector('[data-seg="timers"]'); if (tb) tb.textContent = 'Timers' + (timers.length ? ` (${timers.length})` : '');
  if (changed && tab === 'tools' && ui.toolSeg === 'timers' && !stack.tools.length) renderTools();
}, 500);

/* ---------- STUDY ---------- */
function renderStudy() {
  setTop('Study');
  const segs = [['exams', 'Exams'], ['quizzes', 'Quizzes'], ['rubrics', 'Rubrics'], ['cards', 'Cards'], ['practice', 'Practice']];
  let html = `<div class="seg" role="tablist">${segs.map(([k, n]) => `<button role="tab" aria-selected="${ui.studySeg === k}" class="${ui.studySeg === k ? 'on' : ''}" data-seg="${k}">${n}</button>`).join('')}</div>`;
  html += ({ exams: examsHTML, quizzes: quizzesHTML, rubrics: rubricsHTML, cards: cardsHTML, practice: practiceHTML })[ui.studySeg]();
  view.innerHTML = html;
  view.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => { ui.studySeg = b.dataset.seg; ui.flipped = false; renderStudy(); }));
  if (ui.studySeg === 'cards') bindCards();
  bindRows();
}
function examsHTML() {
  const t = todayISO();
  return D.exams.map(e => {
    const n = daysBetween(t, e.date), end = e.date2 || e.date;
    const chip = t > end ? '<span class="chip">Done</span>' : `<span class="chip exam">${n <= 0 ? 'Today' : inDays(n)}</span>`;
    return `<div class="section"><div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem"><div><div class="h2">${esc(e.name)} exam</div><div class="small muted">${esc(short(e.date))}${e.date2 ? ' – ' + esc(short(e.date2)) : ''} · ${esc(e.covers)}</div></div>${chip}</div>
      <div class="rec-meta"><div><div class="label">Written</div><div class="v">${esc(e.written)}</div></div><div><div class="label">Practical</div><div class="v">${esc(e.practical)}</div></div></div>
      <p class="small muted" style="margin-top:var(--space-3)">${esc(e.weight)}</p>
      <div class="btn-row">${e.rubrics.map(i => `<button class="btn ghost" data-rubric="${i}">${esc(D.rubrics[i].title.split(':')[0])} rubric</button>`).join('')}</div>
      <details class="review"><summary>Review sessions</summary><div class="list" style="margin-top:var(--space-3)">${e.reviewSessions.map(n => sessionRow(sessionByN(n), t)).join('')}</div></details></div></div>`;
  }).join('') + `<div class="section"><span class="label">Key dates</span><div class="card"><table class="ttable"><tbody>
    <tr><td>Census date</td><td class="t">Jan 26</td></tr><tr><td>Midterm grades due</td><td class="t">Feb 12, noon</td></tr><tr><td>Last day to withdraw</td><td class="t">Mar 2</td></tr><tr><td>Final exams</td><td class="t">Mar 10–11</td></tr><tr><td>Final grades due</td><td class="t">Mar 12, noon</td></tr></tbody></table></div></div>
  <div class="section"><span class="label">Course grade</span><div class="card"><table class="ttable"><tbody>${C.grading.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="t">${esc(b)}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="section"><span class="label">Exam tips</span><div class="card"><ul class="clean"><li>A calculator is allowed; phones and notes are not.</li><li>Show your setup on every calculation; it earns partial credit.</li><li>Know the key numbers: standard drinks, proof and ABV, Arkansas ages, pour sizes and the pour cost formulas.</li><li>Bring your apron, closed-toe non-slip shoes and bar journal to every practical.</li></ul></div></div>`;
}
function quizzesHTML() {
  const t = todayISO();
  let html = `<div class="section"><div class="card"><div class="h2">Weekly quizzes</div><p class="small muted" style="margin-top:var(--space-2)">Mondays at 2:00–2:10 PM, Weeks 2–8. 20 points each: 6 multiple choice, 2 true/false, one calculation and one short answer. Each quiz covers the week before and counts toward the 10% quizzes and worksheets grade.</p></div></div>`;
  html += D.quizzes.map(q => {
    const n = daysBetween(t, q.date);
    const chip = n < 0 ? '<span class="chip">Done</span>' : `<span class="chip quiz">${inDays(n)}</span>`;
    const ss = D.sessions.filter(s => s.week === q.reviewWeek);
    return `<div class="section"><div class="card${q.date === t ? ' quiz-today' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem"><div><div class="h2">Quiz ${q.n}: ${esc(q.topic)}</div><div class="small muted">${esc(short(q.date))} · 2:00 PM · Ch. ${esc(q.chapters)}</div></div>${chip}</div>
      <p class="small" style="margin-top:var(--space-3)">Covers ${esc(q.covers)}.</p>
      <details class="review"${q.date === t || (n > 0 && n <= 7) ? ' open' : ''}><summary>Review Week ${q.reviewWeek} lessons</summary><div class="list" style="margin-top:var(--space-3)">${ss.map(s => sessionRow(s, t)).join('')}</div></details>
      <div class="btn-row"><button class="btn ghost" data-cards="${q.chapters}">Ch. ${esc(q.chapters)} flashcards</button><button class="btn ghost" data-goseg="practice">Practice problems</button></div></div></div>`;
  }).join('');
  return html + `<p class="foot">Quiz questions are given in class only. Use the lessons, flashcards and practice problems to prepare.</p>`;
}
function rubricsHTML() {
  const t = todayISO();
  return `<div class="section"><span class="label">Practical and exam rubrics · 100 points each</span><div class="list">${D.rubrics.map((r, i) => `<button class="row ${r.date === t ? 'today' : r.date < t ? 'past' : ''}" data-rubric="${i}">
    <div class="date"><b>${parseISO(r.date).getDate()}</b><span>${MON[parseISO(r.date).getMonth()]}</span></div>
    <div class="body"><div class="t">${esc(r.title)}</div><div class="s">${esc(r.time_limit.split(',')[0])} · Ch. ${r.chapters.length > 2 ? r.chapters[0] + '–' + r.chapters[r.chapters.length - 1] : r.chapters.join(', ')}</div></div>${chev}</button>`).join('')}</div></div>
    <div class="section"><span class="label">How practicals count</span><div class="card"><ul class="clean">${D.policy.weight_in_course_grade.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`;
}
function deck() {
  const ch = ui.cardCh;
  const want = String(ch || 0).split(/\s*,\s*/).flatMap(p => { const [lo, hi] = p.split(/[–-]/).map(Number); const a = []; for (let x = lo; x <= (hi || lo); x++) a.push(x); return a; }).filter(Boolean);
  const base = D.cards.map((c, i) => i).filter(i => !want.length || want.includes(D.cards[i].ch));
  if (!ui.cardOrder || ui.cardOrder.key !== ch) { ui.cardOrder = base; ui.cardOrder.key = ch; }
  return ui.cardOrder;
}
function cardsHTML() {
  const o = deck(); const known = store.get('known', []);
  const i = Math.min(ui.cardIdx, o.length - 1); const c = D.cards[o[i]];
  const chs = [...new Set(D.cards.map(c => c.ch))].sort((a, b) => a - b);
  return `<div class="filters" style="margin-top:var(--space-4)"><button data-ch="0" class="${!ui.cardCh || ui.cardCh === '0' ? 'on' : ''}">All ${D.cards.length}</button>${chs.map(n => `<button data-ch="${n}" class="${String(ui.cardCh) === String(n) ? 'on' : ''}">Ch. ${n}</button>`).join('')}</div>
    <div class="flash ${ui.flipped ? 'flipped' : ''}" id="flash" role="button" tabindex="0" aria-label="Flashcard: ${esc(c.term)}. Tap to flip.">
    <div class="flash-inner"><div class="face front"><span class="label" style="margin-bottom:.75rem">${known.includes(o[i]) ? '✓ Known · ' : ''}Ch. ${c.ch}</span><div class="term">${esc(c.term)}</div><span class="hint">Tap to flip</span></div>
    <div class="face back"><div>${esc(c.def)}</div><span class="hint">Tap to flip back</span></div></div></div>
    <div class="counter"><span>Card ${i + 1} of ${o.length}</span><span>${o.filter(x => known.includes(x)).length} known</span></div>
    <div class="grid2" style="margin-top:.75rem"><button class="btn ghost" id="again">Still learning</button><button class="btn" id="gotit">Got it</button></div>
    <div class="btn-row" style="justify-content:space-between"><button class="btn ghost" id="prev">‹ Prev</button><button class="btn ghost" id="shuffle">Shuffle</button><button class="btn ghost" id="next">Next ›</button></div>
    ${known.length ? '<p class="foot"><button id="resetKnown" class="small" style="text-decoration:underline;color:var(--color-text-muted)">Reset known cards</button></p>' : ''}`;
}
function bindCards() {
  const o = deck(); const n = o.length;
  const flip = () => { ui.flipped = !ui.flipped; $('#flash').classList.toggle('flipped', ui.flipped); };
  $('#flash').addEventListener('click', flip);
  $('#flash').addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
  const move = d => { ui.cardIdx = (Math.min(ui.cardIdx, n - 1) + d + n) % n; ui.flipped = false; renderStudy(); };
  view.querySelectorAll('[data-ch]').forEach(b => b.addEventListener('click', () => { ui.cardCh = b.dataset.ch; ui.cardIdx = 0; ui.flipped = false; renderStudy(); }));
  $('#prev').addEventListener('click', () => move(-1));
  $('#next').addEventListener('click', () => move(1));
  $('#gotit').addEventListener('click', () => { const k = store.get('known', []); const id = o[Math.min(ui.cardIdx, n - 1)]; if (!k.includes(id)) store.set('known', [...k, id]); move(1); });
  $('#again').addEventListener('click', () => { store.set('known', store.get('known', []).filter(x => x !== o[Math.min(ui.cardIdx, n - 1)])); move(1); });
  $('#shuffle').addEventListener('click', () => { const a = [...o]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } a.key = ui.cardCh; ui.cardOrder = a; ui.cardIdx = 0; ui.flipped = false; renderStudy(); toast('Cards shuffled'); });
  $('#resetKnown')?.addEventListener('click', () => { store.set('known', []); renderStudy(); });
  let x0 = null;
  $('#flash').addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  $('#flash').addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) { e.preventDefault(); move(dx < 0 ? 1 : -1); } });
}
function practiceHTML() {
  return `<div class="section"><span class="label">Bar math practice · tap to reveal answers</span><div class="stack">${D.problems.map((p, i) => `<details class="card problem"><summary><span class="num">${i + 1}</span><span><span class="tagx">${esc(p.tag)}</span>${esc(p.q)}</span></summary><span class="reveal">Show answer</span><div class="ans">${esc(p.a)}</div></details>`).join('')}</div></div>
    <p class="foot">Check your work with the calculators in Tools → Costing and Convert.</p>`;
}
view.addEventListener('click', e => {
  const g = e.target.closest('[data-goseg]'); if (g) { ui.studySeg = g.dataset.goseg; renderStudy(); window.scrollTo(0, 0); return; }
  const c = e.target.closest('[data-cards]'); if (c) { ui.studySeg = 'cards'; ui.cardCh = c.dataset.cards; ui.cardIdx = 0; ui.flipped = false; renderStudy(); window.scrollTo(0, 0); }
});

/* ---------- toast ---------- */
let tt;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2400); }

/* ---------- offline (service worker, when allowed) ---------- */
try { if ('serviceWorker' in navigator && location.protocol === 'https:' && window === window.top) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch {}

render();
})();
