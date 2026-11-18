(() => {
  'use strict';
  const courses = (() => {
    try {
      const custom = localStorage.getItem('CULINARY_CUSTOM_SCHEDULE');
      if (custom) return JSON.parse(custom);
    } catch(e) {}
    return window.SCHEDULE_DATA;
  })();
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = iso => new Date(iso + 'T12:00:00Z');
  const iso = d => d.toISOString().slice(0,10);
  const add = (s,n) => { const d=date(s);d.setUTCDate(d.getUTCDate()+n);return iso(d); };
  const monday = s => add(s,-((date(s).getUTCDay()+6)%7));
  const fmt = (s,options) => new Intl.DateTimeFormat('en-US',{...options,timeZone:'UTC'}).format(date(s));
  const long = s => fmt(s,{month:'long',day:'numeric',year:'numeric'});
  const short = s => fmt(s,{month:'short',day:'numeric'});
  const start = courses.flatMap(c=>c.sessions.map(s=>s.date)).sort()[0];
  const end = courses.flatMap(c=>c.sessions.map(s=>s.date)).sort().at(-1);
  const weeks=[];
  for(let w=monday(start);w<=end;w=add(w,7))weeks.push(w);
  const params=new URLSearchParams(location.search);
  const permitted=['all',...courses.map(c=>c.id)];
  let filter=permitted.includes(params.get('class'))?params.get('class'):'all';
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(new Date());
  let week=weeks.includes(params.get('week'))?params.get('week'):monday(today<start?start:today>end?end:today);
  const selected=()=>courses.filter(c=>filter==='all'||c.id===filter);
  const range=()=>`${long(week)} – ${short(add(week,3))}`;
  const filterName=()=>filter==='all'?'All classes':selected()[0].name;
  function dayEntries(day){
    return selected().flatMap(c=>c.sessions.filter(s=>s.date===day).map(s=>({...s,course:c})));
  }
  function empty(day){
    if(day==='2027-01-18')return 'No class · Martin Luther King Jr. Day';
    if(selected().some(c=>c.id==='baking')&&day>='2027-03-22'&&day<='2027-03-26')return 'No class · Spring break';
    return 'No scheduled class';
  }
  function render(){
    $('classFilter').value=filter;
    $('weekSelect').value=week;
    $('weekHeading').textContent='Week of '+range();
    $('filterHeading').textContent=filterName();
    $('previousWeek').disabled=week===weeks[0];
    $('nextWeek').disabled=week===weeks.at(-1);
    $('downloadStatus').textContent='';
    $('weekGrid').innerHTML=Array.from({length:4},(_,i)=>{
      const day=add(week,i), entries=dayEntries(day);
      return `<section class="day-column"><h3 class="day-heading">${fmt(day,{weekday:'long'})}<time datetime="${day}">${long(day)}</time></h3>${entries.length?entries.map(s=>`<section class="class-session ${s.course.id}"><p class="class-name">${esc(s.course.name)}</p><p class="session-time">${esc(s.course.time)}</p><p class="session-room">Room ${esc(s.course.room)}</p><h4 class="lesson-title">${esc(s.title)}</h4>${s.recipes.length?`<p class="recipes"><b>Lab:</b> ${s.recipes.map(esc).join(' · ')}</p>`:''}</section>`).join(''):`<p class="empty-day">${esc(empty(day))}</p>`}</section>`;
    }).join('');
    try{history.replaceState(null,'',`?week=${week}&class=${filter}`);}catch{}
  }
  $('weekSelect').innerHTML=weeks.map(w=>`<option value="${w}">${short(w)} – ${short(add(w,3))}, ${w.slice(0,4)}</option>`).join('');
  $('weekSelect').addEventListener('change',e=>{week=e.target.value;render();});
  $('classFilter').addEventListener('change',e=>{
    filter=e.target.value;
    if(!Array.from({length:4},(_,i)=>dayEntries(add(week,i)).length).some(Boolean)){
      const first=selected().flatMap(c=>c.sessions.map(s=>s.date)).sort()[0];
      week=monday(first);
    }
    render();
  });
  $('previousWeek').addEventListener('click',()=>{const i=weeks.indexOf(week);if(i>0){week=weeks[i-1];render();}});
  $('nextWeek').addEventListener('click',()=>{const i=weeks.indexOf(week);if(i<weeks.length-1){week=weeks[i+1];render();}});
  $('printPage').addEventListener('click',()=>{
    $('downloadStatus').textContent='Print this week using your browser. If no dialog opens, use Download PDF.';
    window.print();
  });
  // A direct PDF download works even when the preview disallows native print dialogs.
  $('downloadPdf').addEventListener('click',()=>{
    try{
      const {jsPDF}=window.jspdf;
      const pdf=new jsPDF({orientation:'landscape',unit:'pt',format:'letter'});
      const clean=s=>String(s).normalize('NFKD').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/·/g,' / ').replace(/[^\x20-\x7E]/g,'');
      const text=(s,x,y,size=10,style='normal')=>{pdf.setFont('helvetica',style);pdf.setFontSize(size);pdf.text(clean(s),x,y);};
      pdf.setDrawColor(75);pdf.setLineWidth(2);pdf.line(28,28,764,28);
      text('ASU-NEWPORT / CULINARY ARTS',28,48,10,'bold');
      text('Week of '+range(),28,72,17,'bold');
      text(filterName()+' / Chef Joseph Jones',28,91,10);
      const colW=170,gap=18;
      for(let i=0;i<4;i++){
        const day=add(week,i),x=28+i*(colW+gap);let y=120;
        text(fmt(day,{weekday:'long'}),x,y,12,'bold');y+=16;
        text(long(day),x,y,10);y+=12;pdf.setLineWidth(.5);pdf.line(x,y,x+colW,y);y+=20;
        const entries=dayEntries(day);
        const block=(s,size=10,style='normal')=>{
          pdf.setFont('helvetica',style);pdf.setFontSize(size);
          const lines=pdf.splitTextToSize(clean(s),colW);
          pdf.text(lines,x,y);y+=lines.length*(size*1.18)+6;
        };
        if(!entries.length)block(empty(day));
        for(const s of entries){
          block(s.course.name,10,'bold');block(s.course.time+' / Room '+s.course.room,9);
          block(s.title,11,'bold');
          if(s.recipes.length)block('Lab: '+s.recipes.join(' / '),9);
          y+=10;
        }
        if(y>554)throw new Error('This week is too long for one PDF page. Please use Print instead.');
      }
      pdf.setLineWidth(.5);pdf.line(28,560,764,560);
      text('Monday-Thursday classes / Based on the course schedules in Culinary Arts.',28,578,9);
      text('Room TBA = not yet assigned.',28,591,9);
      pdf.save(`Culinary-Arts-Week-${week}-${filter}.pdf`);
      $('downloadStatus').textContent='PDF downloaded for the selected week. Open it to print.';
    }catch(e){$('downloadStatus').textContent=e.message||'The PDF could not be created. Use Print instead.';}
  });
  render();
  for(const id of ['classFilter','weekSelect','downloadPdf','printPage'])$(id).disabled=false;
  $('weekSheet').setAttribute('aria-busy','false');
})();
