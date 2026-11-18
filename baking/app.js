(() => {
'use strict';
const D = window.CUSTOM_DATA || (window.localStorage && JSON.parse(localStorage.getItem("CULINARY_CUSTOM_DATA_baking") || "null")) || window.DATA;
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const view = $('#view');

/* ---------- in-session state ---------- */
const mem = {};
const store = {
  get(k, d) { return k in mem ? mem[k] : d; },
  set(k, v) { mem[k] = v; }
};

/* ---------- dates ---------- */
const params = new URLSearchParams(window.COURSE_SEARCH || location.search);
function todayISO() {
  if (/^\d{4}-\d{2}-\d{2}$/.test(params.get('date') || '')) return params.get('date');
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
}
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5);
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const short = iso => { const d = parseISO(iso); return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`; };

const sessionById = id => D.sessions.find(s => s.id === id);
const recipeById = id => D.recipes.find(r => r.id === id);

/* ---------- quantity scaling ---------- */
function fmtNum(n, unit) {
  if (unit && /^l$/i.test(unit)) return (Math.round(n * 10) / 10).toString();
  if (n >= 100) return Math.round(n).toLocaleString('en-US');
  if (n >= 10) return String(Math.round(n));
  return String(Math.round(n * 10) / 10);
}
function scaleQty(row, f) {
  const q = row.qty;
  if (f === 1 || !/\d/.test(q) || /week|formula|per student/i.test(q) || /^turns/i.test(row.ing)) return q;
  return q.split(/(\([^)]*\))/).map(part => part.startsWith('(') ? part :
    part.replace(/(\d[\d,]*(?:\.\d+)?)(\s*(kg|g|L|ml)\b)?/g, (m, num, u, unit) => fmtNum(parseFloat(num.replace(/,/g, '')) * f, unit) + (u || ''))
  ).join('');
}

/* ---------- navigation (in-memory stack) ---------- */
let tab = 'today';
const stack = { today: [], schedule: [], recipes: [], tools: [], study: [] };
const ui = { recipeQuery: '', recipeWeek: 0, toolSeg: 'calc', studySeg: 'exams', cardIdx: 0, cardOrder: null, flipped: false };

function setTop(title, eyebrow) {
  $('#topTitle').textContent = title;
  $('#topEyebrow').textContent = eyebrow || 'ASU–Newport · Baking & Pastry';
  $('#backBtn').hidden = stack[tab].length === 0;
  document.title = `${title} · Bake Lab`;
}
function go(route) { stack[tab].push(route); render(); window.scrollTo(0, 0); }
function back() { stack[tab].pop(); render(); window.scrollTo(0, 0); }
$('#backBtn').addEventListener('click', back);
document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => {
  if (tab === b.dataset.tab) stack[tab] = [];
  tab = b.dataset.tab;
  document.querySelectorAll('.tabbar button').forEach(x => x.classList.toggle('active', x === b));
  render(); window.scrollTo(0, 0);
}));
window.addEventListener('scroll', () => $('#topbar').classList.toggle('scrolled', window.scrollY > 4), { passive: true });

function render() {
  const top = stack[tab][stack[tab].length - 1];
  if (top) {
    if (top.type === 'session') return renderSession(top.id);
    if (top.type === 'recipe') return renderRecipe(top.id);
    if (top.type === 'rubric') return renderRubric(top.idx);
  }
  ({ today: renderToday, schedule: renderSchedule, recipes: renderRecipes, tools: renderTools, study: renderStudy })[tab]();
}

/* ---------- shared bits ---------- */
const chev = '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>';
const quizOn = date => (D.quizzes || []).find(q => q.date === date);
function sessionRow(s, t) {
  const d = parseISO(s.date);
  const cls = s.date === t ? 'today' : (s.date < t ? 'past' : '');
  const tag = /Exam/.test(s.title) ? '<span class="chip exam">Exam</span>' : (s.rubric != null ? '<span class="chip accent">Practical</span>' : (quizOn(s.date) ? `<span class="chip quiz">Quiz ${quizOn(s.date).n}</span>` : ''));
  return `<button class="row ${cls}" data-session="${s.id}">
    <div class="date"><b>${d.getDate()}</b><span>${DOW[d.getDay()]}</span></div>
    <div class="body"><div class="t">${esc(s.title)}</div><div class="s">${esc(MON[d.getMonth()])} · Week ${s.week}, Day ${s.day}</div></div>${tag}${chev}</button>`;
}
function recipeRow(r) {
  return `<button class="row" data-recipe="${r.id}"><div class="body"><div class="t">${esc(r.name)}</div><div class="s">${esc(r.src === 'PC' ? 'Textbook p. ' + r.page : r.src === 'KA' ? 'Tested recipe · King Arthur Baking' : r.make)}</div></div>${chev}</button>`;
}
function bindRows() {
  view.querySelectorAll('[data-session]').forEach(b => b.addEventListener('click', () => go({ type: 'session', id: b.dataset.session })));
  view.querySelectorAll('[data-recipe]').forEach(b => b.addEventListener('click', () => go({ type: 'recipe', id: b.dataset.recipe })));
  view.querySelectorAll('[data-rubric]').forEach(b => b.addEventListener('click', () => go({ type: 'rubric', idx: +b.dataset.rubric })));
}
function labList(items) {
  return `<ul class="clean timeline">${items.map(x => {
    const m = x.match(/^(\d{1,2}:\d{2}(?:–\d{1,2}:\d{2})?)\s+(.*)$/);
    return m ? `<li><span class="tm">${esc(m[1].split('–')[0])}</span><span>${esc(m[2])}</span></li>` : `<li><span class="tm">·</span><span>${esc(x)}</span></li>`;
  }).join('')}</ul>`;
}

/* ---------- TODAY ---------- */
function renderToday() {
  setTop('Today');
  const t = todayISO();
  const c = D.course;
  const todays = D.sessions.find(s => s.date === t);
  const next = D.sessions.find(s => s.date > t);
  let hero = '', focus = todays || next;

  if (t < c.start) {
    const n = daysBetween(t, c.start);
    hero = `<div class="card hero"><span class="label">Class starts ${esc(short(c.start))}</span>
      <h2>${esc(c.name)}</h2>
      <div class="meta"><span class="chip">${esc(c.instructor)}</span><span class="chip">Room ${esc(c.room)}</span><span class="chip">${esc(c.time)}</span></div>
      <div class="countdown"><div><b>${n}</b><span>days to go</span></div><div><b>32</b><span>lab sessions</span></div><div><b>8</b><span>weeks</span></div></div></div>`;
  } else if (t > c.end) {
    hero = `<div class="card hero"><span class="label">Course complete</span><h2>Nice work, bakers.</h2><p class="small" style="position:relative">Every lesson, formula and study card is still here for reference.</p></div>`;
    focus = null;
  } else if (t >= c.breakStart && t <= c.breakEnd) {
    hero = `<div class="card hero"><span class="label">Spring break · Mar 22–26</span><h2>No class this week</h2><p class="small" style="position:relative">Classes resume ${esc(short(next.date))}. Keep your levain fed if you're on the rotation.</p></div>`;
  } else if (todays) {
    hero = sessionHero(todays, 'Today · ' + short(todays.date));
  } else if (next) {
    hero = sessionHero(next, 'Next class · ' + short(next.date));
  }

  let html = hero;
  if (focus && (t < c.start || t >= c.breakStart && t <= c.breakEnd)) {
    html += `<div class="section"><span class="label">${t < c.start ? 'First class' : 'Next class'}</span><div class="list">${sessionRow(focus, t)}</div></div>`;
  }
  if (focus) {
    html += `<div class="section"><span class="label">Lab plan</span><div class="card">${labList(focus.lab)}</div></div>`;
    if (focus.recipes.length) html += `<div class="section"><span class="label">Formulas for this lab</span><div class="list">${focus.recipes.map(id => recipeRow(recipeById(id))).join('')}</div></div>`;
    html += `<div class="section"><span class="label">Homework & advance prep</span><div class="card"><ul class="clean">${focus.homework.map(h => `<li>${esc(h)}</li>`).join('')}</ul></div></div>`;
  }
  const nq = D.quizzes.find(q => q.date >= t);
  if (nq) {
    const n = daysBetween(t, nq.date);
    html += `<div class="section"><span class="label">Next quiz</span><div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:1rem">
      <div><div class="h2">Quiz ${nq.n}: ${esc(nq.topic)}</div><div class="small muted">${esc(short(nq.date))} · 9:30 AM · 10 min · 20 pts</div></div>
      <span class="chip quiz">${n === 0 ? 'Today' : n + (n === 1 ? ' day' : ' days')}</span></div>
      <div class="btn-row"><button class="btn ghost" id="toQuiz">What to review</button></div></div></div>`;
  }
  const upcoming = D.exams.find(e => e.date >= t);
  if (upcoming) {
    const n = daysBetween(t, upcoming.date);
    html += `<div class="section"><span class="label">Coming up</span><div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:1rem">
      <div><div class="h2">${esc(upcoming.name)} exam</div><div class="small muted">${esc(short(upcoming.date))} · ${esc(upcoming.covers)}</div></div>
      <span class="chip exam">${n === 0 ? 'Today' : n + (n === 1 ? ' day' : ' days')}</span></div>
      <div class="btn-row"><button class="btn ghost" id="toStudy">Study for it</button></div></div></div>`;
  }
  html += `<p class="foot">${esc(c.school)} · ${esc(c.dept)}</p>`;
  view.innerHTML = html;
  bindRows();
  view.querySelector('[data-open]')?.addEventListener('click', e => go({ type: 'session', id: e.currentTarget.dataset.open }));
  $('#toStudy')?.addEventListener('click', () => { ui.studySeg = 'exams'; document.querySelector('[data-tab="study"]').click(); });
  $('#toQuiz')?.addEventListener('click', () => { ui.studySeg = 'quizzes'; document.querySelector('[data-tab="study"]').click(); });
}
function sessionHero(s, label) {
  const tag = /Exam/.test(s.title) ? '<span class="chip exam">Exam day</span>' : (s.rubric != null ? '<span class="chip exam">Graded practical</span>' : '');
  const qz = quizOn(s.date);
  return `<div class="card hero"><span class="label">${esc(label)}</span><h2>${esc(s.title)}</h2>
    <div class="meta"><span class="chip">Week ${s.week} · Day ${s.day}</span><span class="chip">9:30 AM · D508</span>${tag}${qz ? `<span class="chip exam">Quiz ${qz.n} at 9:30</span>` : ''}</div>
    <div class="btn-row" style="position:relative"><button class="btn light" data-open="${s.id}">Open full lesson</button></div></div>`;
}

/* ---------- SCHEDULE ---------- */
function renderSchedule() {
  setTop('Schedule', 'Mon–Thu · 9:30 AM–1:00 PM · D508');
  const t = todayISO();
  let html = '';
  for (let w = 1; w <= 8; w++) {
    const ss = D.sessions.filter(s => s.week === w);
    html += `<div class="week-h"><span class="h2">Week ${w}: ${esc(ss[0].weekTitle)}</span><span class="label">${esc(MON[parseISO(ss[0].date).getMonth()])}</span></div>
      <div class="list">${ss.map(s => sessionRow(s, t)).join('')}</div>`;
    if (w === 1) html += `<div class="break-note">Spring break · March 22–26 · no class</div>`;
  }
  view.innerHTML = html; bindRows();
}

/* ---------- SESSION ---------- */
function renderSession(id) {
  const s = sessionById(id);
  setTop(s.title, `Week ${s.week} · Day ${s.day} · ${short(s.date)}`);
  let html = `<div class="card"><div class="label">Objectives</div><ul class="clean" style="margin-top:.75rem">${s.objectives.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div>`;
  html += `<div class="section"><span class="label">${esc(s.lectureLabel)}</span><div class="card"><ul class="clean">${s.lecture.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div></div>`;
  html += `<div class="section"><span class="label">Lab production</span><div class="card">${labList(s.lab)}</div></div>`;
  if (s.recipes.length) html += `<div class="section"><span class="label">Lab formulas</span><div class="list">${s.recipes.map(r => recipeRow(recipeById(r))).join('')}</div></div>`;
  if (s.rubric != null) html += `<div class="section"><span class="label">How you'll be graded</span><div class="list"><button class="row" data-rubric="${s.rubric}"><div class="body"><div class="t">${esc(D.rubrics[s.rubric].title)}</div><div class="s">100-point rubric · see every criterion</div></div>${chev}</button></div></div>`;
  html += `<div class="section"><span class="label">Critique focus · 12:20</span><div class="card small">${esc(s.critique)}</div></div>`;
  html += `<div class="section"><span class="label">Homework & advance prep</span><div class="card"><ul class="clean">${s.homework.map(o => `<li>${esc(o)}</li>`).join('')}</ul></div></div>`;
  view.innerHTML = html; bindRows();
}

/* ---------- RECIPES ---------- */
function renderRecipes() {
  setTop('Recipes', `Textbook Ch. 29–31 + tested recipes`);
  const q = ui.recipeQuery.trim().toLowerCase();
  let list = D.recipes.filter(r => !/^Practical|^Midterm Practical|^Final Exam/.test(r.name));
  if (ui.recipeWeek) list = list.filter(r => r.week === ui.recipeWeek);
  if (q) list = list.filter(r => (r.name + ' ' + r.rows.map(x => x.ing).join(' ') + ' ' + (r.keys || []).join(' ') + ' ' + (r.var || []).join(' ') + (r.page ? ' p. ' + r.page + ' ' + r.page : '')).toLowerCase().includes(q));
  let html = `<div class="search"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
    <label class="sr" for="rq">Search recipes</label><input id="rq" type="search" placeholder="Search recipes or ingredients" value="${esc(ui.recipeQuery)}" autocomplete="off"></div>
    <div class="filters">${['All', 1, 2, 3, 4, 5, 6, 7, 8].map(w => `<button data-w="${w === 'All' ? 0 : w}" class="${(w === 'All' ? 0 : w) === ui.recipeWeek ? 'on' : ''}">${w === 'All' ? 'All weeks' : 'Week ' + w}</button>`).join('')}</div>`;
  if (!list.length) html += `<div class="empty">No recipes match “${esc(ui.recipeQuery)}”.<br>Try a recipe, ingredient or page number like “meringue” or “827”.</div>`;
  else {
    let cur = '';
    html += list.map(r => {
      const key = r.date; let h = '';
      if (key !== cur) { if (cur) h += '</div>'; cur = key; const s = sessionById(`w${r.week}d${r.day}`); h += `<div class="week-h"><span class="h2">${esc(s.title)}</span><span class="label">${esc(short(r.date))}</span></div><div class="list">`; }
      return h + recipeRow(r);
    }).join('') + '</div>';
  }
  view.innerHTML = html;
  const inp = $('#rq');
  inp.addEventListener('input', () => { ui.recipeQuery = inp.value; const pos = inp.selectionStart; renderRecipes(); const n = $('#rq'); n.focus(); n.setSelectionRange(pos, pos); });
  view.querySelectorAll('.filters button').forEach(b => b.addEventListener('click', () => { ui.recipeWeek = +b.dataset.w; renderRecipes(); }));
  bindRows();
}

function srcLine(r) {
  if (r.src === 'PC') return `The Professional Chef, 10th ed. · Ch. ${r.ch} · p. ${r.page}`;
  if (r.src === 'KA') return 'King Arthur Baking test kitchen · tested recipe';
  return 'Course lab instructions';
}
function bulletCard(label, items, ordered) {
  if (!items || !items.length) return '';
  const tag = ordered ? 'ol' : 'ul';
  return `<div class="section"><span class="label">${esc(label)}</span><div class="card"><${tag} class="clean${ordered ? ' steps' : ''}">${items.map(o => `<li>${esc(o)}</li>`).join('')}</${tag}></div></div>`;
}
function renderRecipe(id) {
  const r = recipeById(id);
  const s = sessionById(`w${r.week}d${r.day}`);
  setTop(r.name.replace(/\s*\(.*\)$/, ''), `Week ${r.week} · Day ${r.day} · ${short(r.date)}`);
  const lesson = `<div class="section"><span class="label">From the lesson</span><div class="list"><button class="row" data-session="${s.id}"><div class="body"><div class="t">${esc(s.title)}</div><div class="s">${esc(short(s.date))} · full lesson plan</div></div>${chev}</button></div></div>`;
  const uses = (r.uses || []).map(recipeById).filter(Boolean);
  const usesHTML = uses.length ? `<div class="section"><span class="label">Uses these components</span><div class="list">${uses.map(recipeRow).join('')}</div></div>` : '';
  if (r.src !== 'KA') {
    let html = `<div class="card"><span class="chip ${r.src === 'PC' ? 'accent' : 'quiz'}">${r.src === 'PC' ? 'Textbook formula' : 'Lab task'}</span>
      <p class="small muted" style="margin-top:.6rem">${esc(srcLine(r))}</p>
      <div class="rec-meta" style="margin-top:.75rem"><div><div class="label">${r.src === 'PC' ? 'Make' : 'Task'}</div><div class="v">${esc(r.make)}</div></div></div>
      ${r.src === 'PC' ? `<p class="small" style="margin-top:.75rem">Open your textbook to <strong>page ${r.page}</strong> for the full formula. It was tested in the CIA's kitchens. Scale it with the batch calculator in Tools and write the scaled weights on your worksheet.</p>
      <div class="btn-row"><button class="btn ghost" id="toCalc">Open batch calculator</button></div>` : ''}</div>`;
    html += bulletCard('Variations in the textbook', r.var);
    html += bulletCard(r.src === 'PC' ? 'Critical checkpoints' : 'Steps', r.src === 'PC' ? r.keys : r.steps, r.src !== 'PC');
    if (r.src !== 'PC') html += bulletCard('Checkpoints', r.keys);
    html += usesHTML + lesson;
    view.innerHTML = html;
    $('#toCalc')?.addEventListener('click', () => { ui.toolSeg = 'calc'; document.querySelector('[data-tab="tools"]').click(); });
    bindRows(); return;
  }
  const scaleKey = 'scale:' + id, checkKey = 'check:' + id;
  const f = store.get(scaleKey, 1);
  const checks = store.get(checkKey, []);
  const done = checks.length, total = r.rows.length;
  const timerMatch = r.bake && r.bake.match(/(\d+)(?:–(\d+))?\s*min/);
  let html = `<div class="card"><span class="chip accent">Tested recipe</span>
    <p class="small muted" style="margin-top:.6rem">${esc(srcLine(r))}${r.url ? ` · <a href="${esc(r.url)}" target="_blank" rel="noopener">original recipe</a>` : ''}</p>
    <div class="rec-meta" style="margin-top:.75rem"><div><div class="label">Yield ${f !== 1 ? '(×1)' : ''}</div><div class="v">${esc(r.yield_)}</div></div>
    <div><div class="label">Bake</div><div class="v">${esc(r.bake || '—')}</div></div></div>
    <p class="small" style="margin-top:.5rem"><strong>Make:</strong> ${esc(r.make)}</p>
    <div class="scaler"><div class="label">Batch size</div>
      <div class="scaler-row"><div class="stepper"><button id="sMinus" aria-label="Smaller batch">−</button><output id="sOut" aria-live="polite">×${f}</output><button id="sPlus" aria-label="Larger batch">+</button></div>
      <span class="small muted">${f === 1 ? 'One batch' : f < 1 ? 'Half batch' : `${f} batches`}</span></div></div>
    ${timerMatch ? `<div class="btn-row"><button class="btn ghost" id="addTimer">Start ${timerMatch[1]}-min bake timer</button></div>` : ''}
  </div>
  <div class="section"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="label">Mise en place · tap to check off</span><span class="small muted">${done}/${total}</span></div>
  <div class="progress"><i style="width:${total ? done / total * 100 : 0}%"></i></div>
  <div class="list" style="margin-top:.75rem">${r.rows.map((x, i) => `<button class="ing ${checks.includes(i) ? 'done' : ''}" data-i="${i}" aria-pressed="${checks.includes(i)}">
    <span class="box"></span><span class="n">${esc(x.ing)}${x.vol ? `<span class="small muted" style="display:block">${esc(x.vol)}</span>` : ''}</span><span class="q">${esc(scaleQty(x, f))}</span></button>`).join('')}</div>
  ${done ? '<div class="btn-row"><button class="btn ghost" id="resetChecks">Clear checkmarks</button></div>' : ''}</div>`;
  html += bulletCard('Method', r.steps, true) + bulletCard('Checkpoints', r.keys) + lesson;
  view.innerHTML = html;
  const steps = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
  const setF = nf => { store.set(scaleKey, nf); renderRecipe(id); };
  $('#sMinus').addEventListener('click', () => { const i = steps.indexOf(f); if (i > 0) setF(steps[i - 1]); });
  $('#sPlus').addEventListener('click', () => { const i = steps.indexOf(f); if (i < steps.length - 1) setF(steps[i + 1]); });
  view.querySelectorAll('.ing').forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.i; const c = store.get(checkKey, []);
    store.set(checkKey, c.includes(i) ? c.filter(x => x !== i) : [...c, i]); renderRecipe(id);
  }));
  $('#resetChecks')?.addEventListener('click', () => { store.set(checkKey, []); renderRecipe(id); });
  $('#addTimer')?.addEventListener('click', () => { addTimer(r.name.replace(/\s*\(.*\)$/, ''), +timerMatch[1]); toast(`${timerMatch[1]}-minute timer started · see Tools`); });
  bindRows();
}

/* ---------- RUBRIC ---------- */
function renderRubric(idx) {
  const r = D.rubrics[idx];
  setTop(r.title.replace(/^Practical \d: /, ''), r.title.startsWith('Practical') ? r.title.split(':')[0] : 'Practical exam');
  let html = `<div class="card"><div class="label">${esc(r.date)}</div><p class="small" style="margin-top:.5rem">${esc(r.task)}</p></div>
    <div class="section"><div class="list">${r.cats.map(c => `<div class="rub-cat"><span>${esc(c.name)}</span><span>${c.items.reduce((a, b) => a + b.pts, 0)} pts</span></div>` +
    c.items.map(i => `<div class="rub-item"><span>${esc(i.text)}</span><b>${i.pts}</b></div>`).join('')).join('')}
    <div class="rub-cat" style="background:var(--color-primary-soft)"><span>Total</span><span>100 pts</span></div></div></div>
    <div class="section"><span class="label">Deductions</span><div class="card"><ul class="clean">
    <li>Late: −5 per 5 minutes; not accepted after 15 minutes</li><li>Incomplete uniform: −5</li><li>Unsafe practice or food safety violation: −10 each</li><li>Station not cleaned and checked out: −10</li></ul></div></div>`;
  view.innerHTML = html;
}

/* ---------- TOOLS ---------- */
function renderTools() {
  setTop('Kitchen Tools');
  let html = `<div class="seg" role="tablist"><button class="${ui.toolSeg === 'calc' ? 'on' : ''}" data-seg="calc">Calculators</button><button class="${ui.toolSeg === 'timers' ? 'on' : ''}" data-seg="timers">Timers${timers.length ? ` (${timers.length})` : ''}</button></div>`;
  if (ui.toolSeg === 'calc') html += calcHTML(); else html += timersHTML();
  view.innerHTML = html;
  view.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => { ui.toolSeg = b.dataset.seg; renderTools(); }));
  if (ui.toolSeg === 'calc') bindCalcs(); else bindTimers();
}
const num = id => parseFloat(($('#' + id)?.value || '').replace(/,/g, ''));
const ok = n => Number.isFinite(n);
function calcHTML() {
  return `
  <div class="section"><span class="label">Baker's percentage</span><div class="card">
    <div class="grid2"><div class="field"><label for="bpFlour">Flour weight (g)</label><input id="bpFlour" inputmode="decimal" value="1000"></div>
    <div class="field"><label for="bpPct">Ingredient %</label><input id="bpPct" inputmode="decimal" value="2"></div></div>
    <div class="result"><span class="small">Ingredient weight</span><span class="big" id="bpOut">—</span></div>
    <div class="grid2" style="margin-top:1rem"><div class="field"><label for="bpW">Ingredient weight (g)</label><input id="bpW" inputmode="decimal" value="130"></div>
    <div class="field"><label for="bpF2">Flour weight (g)</label><input id="bpF2" inputmode="decimal" value="400"></div></div>
    <div class="result"><span class="small">Baker's %</span><span class="big" id="bpOut2">—</span></div>
  </div></div>
  <div class="section"><span class="label">Water temperature (DDT)</span><div class="card">
    <div class="grid2"><div class="field"><label for="dDDT">Desired dough temp °F</label><input id="dDDT" inputmode="decimal" value="78"></div>
    <div class="field"><label for="dFlour">Flour temp °F</label><input id="dFlour" inputmode="decimal" value="70"></div>
    <div class="field"><label for="dRoom">Room temp °F</label><input id="dRoom" inputmode="decimal" value="72"></div>
    <div class="field"><label for="dFric">Friction factor °F</label><input id="dFric" inputmode="decimal" value="24"></div>
    <div class="field" style="grid-column:1/-1"><label for="dPre">Preferment temp °F (leave blank if none)</label><input id="dPre" inputmode="decimal" placeholder="e.g. 68"></div></div>
    <div class="result"><span class="small">Use water at</span><span class="big" id="dOut">—</span></div>
    <p class="formula" id="dForm"></p>
  </div></div>
  <div class="section"><span class="label">Recipe conversion factor</span><div class="card">
    <div class="grid3"><div class="field"><label for="cOld">Old yield</label><input id="cOld" inputmode="decimal" value="12"></div>
    <div class="field"><label for="cNew">New yield</label><input id="cNew" inputmode="decimal" value="60"></div>
    <div class="field"><label for="cQty">Old qty (g)</label><input id="cQty" inputmode="decimal" value="200"></div></div>
    <div class="result"><span class="small" id="cFac">Factor —</span><span class="big" id="cOut">—</span></div>
  </div></div>
  <div class="section"><span class="label">Yeast converter</span><div class="card">
    <div class="grid2"><div class="field"><label for="yAmt">Amount (g)</label><input id="yAmt" inputmode="decimal" value="10"></div>
    <div class="field"><label for="yType">Formula calls for</label><select id="yType"><option value="instant">Instant</option><option value="active">Active dry</option><option value="fresh">Fresh</option></select></div></div>
    <div class="result" style="flex-direction:column;align-items:stretch;gap:.25rem" id="yOut"></div>
  </div></div>
  <div class="section"><span class="label">Ingredient cost</span><div class="card">
    <div class="grid2"><div class="field"><label for="kG">Amount used (g)</label><input id="kG" inputmode="decimal" value="225"></div>
    <div class="field"><label for="kP">Price per kg ($)</label><input id="kP" inputmode="decimal" value="12.00"></div>
    <div class="field" style="grid-column:1/-1"><label for="kN">Portions in batch (optional)</label><input id="kN" inputmode="decimal" placeholder="e.g. 8"></div></div>
    <div class="result"><span class="small" id="kPer"></span><span class="big" id="kOut">—</span></div>
  </div></div>`;
}
function bindCalcs() {
  const fmt = (n, d = 1) => ok(n) ? (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('en-US') : '—';
  const upd = () => {
    $('#bpOut').textContent = ok(num('bpFlour') * num('bpPct')) ? fmt(num('bpFlour') * num('bpPct') / 100) + ' g' : '—';
    const p2 = num('bpW') / num('bpF2') * 100; $('#bpOut2').textContent = ok(p2) && num('bpF2') ? fmt(p2, 2) + '%' : '—';
    const pre = num('dPre'), hasPre = ok(pre);
    const m = hasPre ? 4 : 3, sum = num('dFlour') + num('dRoom') + num('dFric') + (hasPre ? pre : 0);
    const w = num('dDDT') * m - sum;
    $('#dOut').textContent = ok(w) ? fmt(w, 0) + '°F' : '—';
    $('#dForm').textContent = ok(w) ? `(${num('dDDT')} × ${m}) − (${[num('dFlour'), num('dRoom'), num('dFric')].concat(hasPre ? [pre] : []).join(' + ')}) = ${fmt(w, 0)}°F` : 'Enter all temperatures.';
    const fac = num('cNew') / num('cOld');
    $('#cFac').textContent = ok(fac) && num('cOld') ? `Factor ${fmt(fac, 2)}` : 'Factor —';
    $('#cOut').textContent = ok(fac * num('cQty')) && num('cOld') ? fmt(fac * num('cQty'), 0) + ' g' : '—';
    const a = num('yAmt'), t = $('#yType').value;
    const inst = t === 'instant' ? a : t === 'active' ? a / 1.25 : a / 3;
    $('#yOut').innerHTML = ok(inst) ? [['Instant', inst], ['Active dry', inst * 1.25], ['Fresh', inst * 3]].filter(x => x[0] !== ({instant:'Instant',active:'Active dry',fresh:'Fresh'})[t]).map(([n, v]) => `<div style="display:flex;justify-content:space-between;align-items:baseline"><span class="small">${n}</span><span class="big">${fmt(v)} g</span></div>`).join('') : '<span class="small">Enter an amount.</span>';
    const cost = num('kG') / 1000 * num('kP');
    $('#kOut').textContent = ok(cost) ? '$' + cost.toFixed(2) : '—';
    $('#kPer').textContent = ok(cost) && num('kN') > 0 ? `$${(cost / num('kN')).toFixed(2)} per portion` : 'Ingredient cost';
  };
  view.querySelectorAll('input,select').forEach(i => i.addEventListener('input', upd));
  upd();
}

/* timers */
let timers = [];
let tid = 0;
function addTimer(name, min) { timers.push({ id: ++tid, name, total: min * 60, end: Date.now() + min * 60e3, paused: null, ring: false }); }
const left = t => t.paused != null ? t.paused : Math.max(0, Math.round((t.end - Date.now()) / 1000));
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function timersHTML() {
  const presets = [['Bench rest', 20], ['Proof', 45], ['Stretch & fold', 30], ['Chill dough', 30], ['Biscuits', 14], ['Muffins', 22], ['Baguettes', 24], ['Cookies', 11]];
  return `<div class="section"><span class="label">Running</span>${timers.length ? `<div class="list" id="tlist">${timers.map(t => `<div class="timer ${t.ring ? 'ring' : ''}" data-t="${t.id}">
      <div class="tname">${esc(t.name)}<div class="small muted">${Math.round(t.total / 60)} min</div></div><span class="tleft" data-left="${t.id}">${mmss(left(t))}</span>
      <button class="tbtn ${t.paused != null ? 'go' : ''}" data-act="toggle" aria-label="${t.paused != null ? 'Resume' : 'Pause'}">${t.paused != null ? '▶' : '❚❚'}</button>
      <button class="tbtn" data-act="del" aria-label="Remove timer">✕</button></div>`).join('')}</div>` : '<div class="card empty" style="padding:2rem 1rem">No timers running. Start one below or from any recipe.</div>'}</div>
    <div class="section"><span class="label">New timer</span><div class="card">
      <div class="grid2"><div class="field"><label for="tName">Label</label><input id="tName" placeholder="e.g. Focaccia fold"></div>
      <div class="field"><label for="tMin">Minutes</label><input id="tMin" inputmode="numeric" value="10"></div></div>
      <button class="btn block" id="tAdd" style="margin-top:1rem">Start timer</button>
      <div class="presets">${presets.map(([n, m]) => `<button data-p="${m}" data-n="${n}">${n} · ${m}m</button>`).join('')}</div>
      <p class="formula">Keep this app open while timers run. Timers reset if the app is closed.</p></div></div>`;
}
function bindTimers() {
  $('#tAdd').addEventListener('click', () => { const m = num('tMin'); if (!(m > 0)) return toast('Enter minutes'); addTimer($('#tName').value.trim() || `${m}-minute timer`, m); unlockAudio(); renderTools(); });
  view.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { addTimer(b.dataset.n, +b.dataset.p); unlockAudio(); renderTools(); }));
  view.querySelectorAll('.timer').forEach(el => el.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
    const t = timers.find(x => x.id === +el.dataset.t);
    if (act === 'del') timers = timers.filter(x => x !== t);
    else if (t.ring) { timers = timers.filter(x => x !== t); }
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
    if (!t.ring && t.paused == null && left(t) === 0) { t.ring = true; changed = true; beep(); toast(`⏰ ${t.name} is done`); }
    const el = document.querySelector(`[data-left="${t.id}"]`); if (el) el.textContent = mmss(left(t));
  });
  if (changed && tab === 'tools' && ui.toolSeg === 'timers' && !stack.tools.length) renderTools();
}, 500);

/* ---------- STUDY ---------- */
function renderStudy() {
  setTop('Study');
  const segs = [['exams', 'Exams'], ['quizzes', 'Quizzes'], ['cards', 'Flashcards'], ['practice', 'Practice']];
  let html = `<div class="seg">${segs.map(([k, n]) => `<button class="${ui.studySeg === k ? 'on' : ''}" data-seg="${k}">${n}</button>`).join('')}</div>`;
  if (ui.studySeg === 'exams') html += examsHTML();
  if (ui.studySeg === 'quizzes') html += quizzesHTML();
  if (ui.studySeg === 'cards') html += cardsHTML();
  if (ui.studySeg === 'practice') html += practiceHTML();
  view.innerHTML = html;
  view.querySelectorAll('[data-seg]').forEach(b => b.addEventListener('click', () => { ui.studySeg = b.dataset.seg; ui.flipped = false; renderStudy(); }));
  if (ui.studySeg === 'cards') bindCards();
  bindRows();
}
function examsHTML() {
  const t = todayISO();
  return D.exams.map((e, i) => {
    const n = daysBetween(t, e.date);
    return `<div class="section"><div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem"><div><div class="h2">${esc(e.name)} exam</div><div class="small muted">${esc(short(e.date))} · ${esc(e.covers)}</div></div>
      <span class="chip ${n >= 0 ? 'exam' : ''}">${n > 0 ? n + ' days' : n === 0 ? 'Today' : 'Done'}</span></div>
      <div class="rec-meta"><div><div class="label">Written</div><div class="v">${esc(e.written)}</div></div><div><div class="label">Practical</div><div class="v">${esc(e.practical)}</div></div></div>
      <div class="btn-row"><button class="btn ghost" data-rubric="${i === 0 ? 3 : 7}">Practical rubric</button><button class="btn ghost" data-goseg="cards">Flashcards</button></div></div></div>`;
  }).join('') + `<div class="section"><span class="label">Exam tips</span><div class="card"><ul class="clean"><li>Calculators allowed; phones and notes are not.</li><li>Show your work on every calculation — setup earns partial credit.</li><li>Answer short-answer questions in complete sentences using course vocabulary.</li><li>Bring full uniform and your tool kit for the practical.</li></ul></div></div>`;
}
function order() {
  if (!ui.cardOrder) ui.cardOrder = D.cards.map((_, i) => i);
  return ui.cardOrder;
}
function cardsHTML() {
  const o = order(); const known = store.get('known', []);
  const i = Math.min(ui.cardIdx, o.length - 1); const c = D.cards[o[i]];
  return `<div class="flash ${ui.flipped ? 'flipped' : ''}" id="flash" role="button" tabindex="0" aria-label="Flashcard. Tap to flip.">
    <div class="flash-inner"><div class="face front"><span class="label" style="margin-bottom:.75rem">${known.includes(o[i]) ? '✓ Known' : 'Term'}</span><div class="term">${esc(c.term)}</div><span class="hint">Tap to flip</span></div>
    <div class="face back"><div>${esc(c.def_)}</div><span class="hint">Tap to flip back</span></div></div></div>
    <div class="counter"><span>Card ${i + 1} of ${o.length}</span><span>${known.length} known</span></div>
    <div class="grid2" style="margin-top:.75rem"><button class="btn ghost" id="again">Still learning</button><button class="btn" id="gotit">Got it</button></div>
    <div class="btn-row" style="justify-content:space-between"><button class="btn ghost" id="prev">‹ Prev</button><button class="btn ghost" id="shuffle">Shuffle</button><button class="btn ghost" id="next">Next ›</button></div>
    ${known.length ? '<p class="foot"><button id="resetKnown" class="small" style="text-decoration:underline;color:var(--color-text-muted)">Reset known cards</button></p>' : ''}`;
}
function bindCards() {
  const o = order(); const n = o.length;
  const flip = () => { ui.flipped = !ui.flipped; $('#flash').classList.toggle('flipped', ui.flipped); };
  $('#flash').addEventListener('click', flip);
  $('#flash').addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
  const move = d => { ui.cardIdx = (ui.cardIdx + d + n) % n; ui.flipped = false; renderStudy(); };
  $('#prev').addEventListener('click', () => move(-1));
  $('#next').addEventListener('click', () => move(1));
  $('#gotit').addEventListener('click', () => { const k = store.get('known', []); const id = o[ui.cardIdx]; if (!k.includes(id)) store.set('known', [...k, id]); move(1); });
  $('#again').addEventListener('click', () => { store.set('known', store.get('known', []).filter(x => x !== o[ui.cardIdx])); move(1); });
  $('#shuffle').addEventListener('click', () => { const a = [...o]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } ui.cardOrder = a; ui.cardIdx = 0; ui.flipped = false; renderStudy(); toast('Cards shuffled'); });
  $('#resetKnown')?.addEventListener('click', () => { store.set('known', []); renderStudy(); });
  let x0 = null;
  $('#flash').addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  $('#flash').addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) { e.preventDefault(); move(dx < 0 ? 1 : -1); } });
}
function quizzesHTML() {
  const t = todayISO();
  let html = `<div class="section"><div class="card"><div class="h2">Weekly quizzes</div><p class="small muted" style="margin-top:var(--space-2)">10 minutes · 20 points · 9:30 AM on Day 1 of Weeks 2–8. Each quiz covers the week before: 6 multiple choice, 2 true/false, 1 baker's math problem and 1 short answer. Quizzes count toward the 10% worksheets and quizzes grade.</p></div></div>`;
  html += D.quizzes.map(q => {
    const n = daysBetween(t, q.date);
    const chip = n < 0 ? '<span class="chip">Done</span>' : `<span class="chip quiz">${n === 0 ? 'Today' : n + (n === 1 ? ' day' : ' days')}</span>`;
    const ss = D.sessions.filter(s => s.week === q.reviewWeek);
    return `<div class="section"><div class="card${q.date === t ? ' quiz-today' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem"><div><div class="h2">Quiz ${q.n}: ${esc(q.topic)}</div><div class="small muted">${esc(short(q.date))} · 9:30 AM</div></div>${chip}</div>
      <p class="small" style="margin-top:var(--space-3)">${esc(q.covers)}.</p>
      <details class="review"><summary>Review Week ${q.reviewWeek} lessons</summary><div class="list" style="margin-top:var(--space-3)">${ss.map(s => sessionRow(s, t)).join('')}</div></details>
      <div class="btn-row"><button class="btn ghost" data-goseg="cards">Flashcards</button><button class="btn ghost" data-goseg="practice">Math practice</button></div></div></div>`;
  }).join('');
  return html + `<p class="foot">Quiz questions are given in class. Use the lessons, flashcards and practice problems to prepare.</p>`;
}
function practiceHTML() {
  return `<div class="section"><span class="label">Baker's math practice · tap to reveal answers</span><div class="stack">${D.problems.map((p, i) => `<details class="card problem"><summary><span class="num">${i + 1}</span><span>${esc(p.q)}</span></summary><span class="reveal">Show answer</span><div class="ans">${esc(p.a)}</div></details>`).join('')}</div></div>
    <p class="foot">Use the calculators in Tools to check your work.</p>`;
}
view.addEventListener('click', e => { const g = e.target.closest('[data-goseg]'); if (g) { ui.studySeg = g.dataset.goseg; renderStudy(); } });

/* ---------- toast ---------- */
let tt;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2400); }

render();
})();
