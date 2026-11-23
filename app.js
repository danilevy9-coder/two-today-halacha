
'use strict';
(() => {
  const week=window.HALACHA_WEEK, screen=document.querySelector('#screen'), daybar=document.querySelector('#days'), main=document.querySelector('main');
  const ls=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  const progressKey='two-today:chanukah-2026:complete';
  const complete=new Set();
  try { const saved=JSON.parse(localStorage.getItem(progressKey)||'[]'); if(Array.isArray(saved))for(const d of week)if(saved.includes(d.iso))complete.add(d.iso); } catch {}
  function saveCompletion(){complete.add(week[day].iso);try{localStorage.setItem(progressKey,JSON.stringify([...complete]));}catch{}}

  let day=0, step=-1, touch=null, press=null, touchClick=null;
  const esc=(s)=>String(s).replace(/[&<>"']/g,(k)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
  const lockIcon='<svg viewBox="0 0 16 18" aria-hidden="true"><path d="M5 7V5a3 3 0 1 1 6 0v2m-7 0h8v8H4z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  const arrow='<span aria-hidden="true"> →</span>';
  function art(i){return `<span class="art" aria-hidden="true"><svg viewBox="0 0 96 62" fill="none"><rect width="96" height="62" rx="14"/><path d="M15 31h66M48 11v40" stroke="#314534" stroke-opacity=".35" stroke-dasharray="2 4"/><path d="M48 10c6 11 13 16 13 25a13 13 0 1 1-26 0c0-8 6-12 13-25z" stroke="#21372b" stroke-width="1.4"/><path d="M48 27c4 6 7 9 7 13a7 7 0 1 1-14 0c0-4 4-8 7-13z" fill="${i?'#344630':'#f8f0d3'}" stroke="#21372b" stroke-width="1.3"/><circle cx="${i?76:20}" cy="31" r="3" fill="#21372b"/></svg></span>`;}
  function render(focus=false){
    const d=week[day];
    daybar.querySelectorAll('button').forEach((b,i)=>{
      const done=complete.has(week[i].iso);
      b.setAttribute('aria-pressed',i===day);
      b.setAttribute('aria-label',`${ls[i]}, ${week[i].date}${done?', completed':''}`);
      b.classList.toggle('is-done',done);
    });
    if(step<0){
      const a=day===4?'11:30':day===5?'7:45':'7:30';
      const meridian=(day===4||day===6)?'AM':'PM';
      screen.innerHTML=`<div class="lock" data-accent="${day>=4?'fest':'normal'}"><div class="orb" aria-hidden="true"></div><div class="mini">${lockIcon} Reminder preview</div><div class="clock" aria-hidden="true">${a}<span>${meridian}</span></div><p class="lock-date">${ls[day]}, ${d.date}</p><div class="noticewrap"><button type="button" class="notice" data-act="open"><span class="notice-head"><img src="mark.svg" alt=""> Two Today <span>now</span></span><span class="notice-q">${esc(d.cards[0].question)}</span><span class="notice-sub">Two halachot · Tap to read <b aria-hidden="true">→</b></span></button><p class="timing">${esc(d.note)}</p><div class="homebar" aria-hidden="true"></div></div></div>`;
      if(focus) screen.querySelector('.notice').focus({preventScroll:true});
      return;
    }
    if(step===2){
      screen.innerHTML=`<section class="finish"><span class="done-badge" aria-hidden="true">✓</span><p class="mini">${d.date} · 2 of 2</p><h2 class="done-title" tabindex="-1">Done for today.</h2><p>Two halachot learned. That’s it.</p>${day<week.length-1?`<button type="button" class="primary" data-act="day-next">Preview ${ls[day+1]}${arrow}</button>`:''}<button type="button" class="subtle" data-act="reset">Replay reminder</button><p class="legal">Sample summaries for rabbinic review.</p></section>`;
      if(focus) screen.querySelector('.done-title').focus({preventScroll:true});
      return;
    }
    const c=d.cards[step];
    const p=day===5?'lilac':day===4||step===1?'warm':'green';
    screen.innerHTML=`<section class="study" data-palette="${p}"><header class="card-head"><span class="mini">${d.date} · ${esc(d.theme)}</span><button class="return" data-act="reset" type="button">Reminder</button></header><article class="card">${art(step)}<h2 class="q" tabindex="-1">${esc(c.question)}</h2><p class="answer">${esc(c.answer)}</p><div class="source"><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Read the source · ${esc(c.ref)} ↗</a>${c.extra?`<a href="${esc(c.extra)}" target="_blank" rel="noopener noreferrer">Shamash source ↗</a>`:''}</div></article><footer class="controls"><div><div class="dots" aria-hidden="true"><span aria-current="${step===0}"></span><span aria-current="${step===1}"></span></div><div class="count">${step+1} / 2${step===0?' · swipe left':''}</div></div><div class="actions">${step===1?'<button class="ghost" type="button" data-act="back" aria-label="Previous card">Back</button>':''}<button type="button" class="primary" data-act="next">${step===0?'Next'+arrow:'Done ✓'}</button></div></footer></section>`;
    if(focus) screen.querySelector('.q').focus({preventScroll:true});
  }
  function choose(i){day=i;step=-1;touch=null;render();}
  function activate(button){if(button.dataset.day!==undefined)choose(Number(button.dataset.day));else onAction(button.dataset.act);}
  function onAction(a){switch(a){case 'open':step=0;break;case 'next':if(step<0||step>1)return;step++;if(step===2)saveCompletion();break;case 'back':if(step!==1)return;step=0;break;case 'reset':step=-1;break;case 'day-next':choose(Math.min(day+1,week.length-1));screen.querySelector('.notice').focus({preventScroll:true});return;default:return;}render(true);}
  week.forEach((d,i)=>{
    const b=document.createElement('button'); b.type='button';b.innerHTML=`${d.day}<strong>${d.date.split(' ')[1]}<span class="day-check" aria-hidden="true">✓</span></strong>`;b.setAttribute('aria-label',`${ls[i]}, ${d.date}`);b.dataset.day=i;daybar.append(b);
  });
  main.addEventListener('click',(e)=>{
    const button=e.target.closest('button[data-act], button[data-day]');
    if(!button)return;
    // A touch tap is already handled on release. Ignore the browser’s synthesized click.
    if(touchClick&&performance.now()-touchClick.at<500&&e.detail>0&&Math.hypot(e.clientX-touchClick.x,e.clientY-touchClick.y)<19)return;
    activate(button);
  });
  main.addEventListener('pointerdown',(e)=>{
    if(e.button!==0||!e.isPrimary)return;
    const button=e.target.closest('button[data-act], button[data-day]');
    if(e.pointerType==='touch'&&button){press={button,x:e.clientX,y:e.clientY,id:e.pointerId};return;}
    if(step<0||step>1||!e.target.closest('.study')||e.target.closest('a,button'))return;
    touch={x:e.clientX,y:e.clientY,id:e.pointerId};
    if(e.pointerType!=='touch'){try{screen.setPointerCapture(e.pointerId);}catch(_){}}
  });
  main.addEventListener('pointercancel',(e)=>{if(press?.id===e.pointerId)press=null;if(touch?.id===e.pointerId)touch=null;});
  main.addEventListener('pointerup',(e)=>{
    if(press?.id===e.pointerId){
      const {button,x,y}=press;press=null;
      if(button.isConnected&&Math.hypot(e.clientX-x,e.clientY-y)<14&&button.contains(document.elementFromPoint(e.clientX,e.clientY))){
        touchClick={x:e.clientX,y:e.clientY,at:performance.now()};
        activate(button);
      }
      return;
    }
    if(!touch||e.pointerId!==touch.id)return;
    const dx=e.clientX-touch.x,dy=e.clientY-touch.y;touch=null;
    if(Math.abs(dx)<42||Math.abs(dx)<1.3*Math.abs(dy))return;
    if(dx<0)onAction('next');else if(step===1)onAction('back');
  });
  screen.addEventListener('keydown',(e)=>{if(e.key==='ArrowRight'&&step>=0&&step<2){e.preventDefault();onAction('next');}if(e.key==='ArrowLeft'&&step===1){e.preventDefault();onAction('back');}});
  render();
})();
