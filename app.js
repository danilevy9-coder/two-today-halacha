'use strict';
// Two Today: the whole app. Runs inside the Android shell (window.Android is its bridge) and in a plain browser.
(async () => {
  const A = window.Android || null;
  const SITE = 'https://two-today-halacha.vercel.app/', APK = SITE + 'two-today.apk';
  const app = document.querySelector('#app');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Saved state: in the phone's preferences when native, else in localStorage.
  const store = {
    get(k) { try { return (A ? A.get(k) : localStorage.getItem('tt:' + k)) || ''; } catch (e) { return ''; } },
    set(k, v) { try { if (A) A.set(k, v); else localStorage.setItem('tt:' + k, v); } catch (e) {} },
  };
  const done = new Set(store.get('done').split(',').filter(Boolean)); // dates finished
  const favs = new Set(store.get('favs').split(',').filter(Boolean)); // "date/cardIndex"
  const save = (key, set) => store.set(key, [...set].join(','));

  // Content: one line per day, tab-separated (see tools/make_content.py). Days without cards have no line.
  const lines = new Map();
  try {
    const text = await (await fetch('content.txt')).text();
    for (const l of text.split('\n').slice(1)) if (l) lines.set(l.slice(0, 10), l);
  } catch (e) {}
  if (!lines.size) {
    app.innerHTML = '<div class="center"><h1>Could not load the cards.</h1><p>Please close Two Today and open it again.</p></div>';
    return;
  }
  const dates = [...lines.keys()], FIRST = dates[0], LAST = dates[dates.length - 1];
  function getDay(date) {
    const p = (lines.get(date) || '').split('\t');
    if (p.length < 13) return null;
    const card = (i) => ({ topic: p[i], q: p[i + 1], a: p[i + 2], ref: p[i + 3], url: p[i + 4].startsWith('https://') ? p[i + 4] : '#' });
    return { heb: p[1], occ: p[2], cards: [card(3), card(8)] };
  }

  // Dates are plain local calendar dates, "YYYY-MM-DD".
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => new URLSearchParams(location.search).get('date') || iso(new Date()); // ?date= is for previews in a browser
  const asDate = (s) => new Date(s + 'T12:00:00');
  const nice = (s) => asDate(s).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: s.slice(0, 4) === today().slice(0, 4) ? undefined : 'numeric',
  });
  const short = (s) => asDate(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (!store.get('since')) store.set('since', today()); // first day of use: earlier days are not "missed"

  const PATHS = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    forward: '<path d="M9 5l7 7-7 7"/>',
    list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"/>',
    share: '<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  };
  const ico = (name, filled) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
  const BACK = `<button class="icon" data-act="back" aria-label="Back">${ico('back')}</button>`;

  // The little picture on each card, chosen by topic.
  const ART = {
    flame: '<path d="M48 10c6 11 13 16 13 25a13 13 0 1 1-26 0c0-8 6-12 13-25z"/><path d="M48 27c4 6 7 9 7 13a7 7 0 1 1-14 0c0-4 4-8 7-13z" fill="#f8f0d3"/>',
    cup: '<path d="M38 14h20v9a10 10 0 0 1-20 0zM48 33v13M40 47h16"/>',
    book: '<path d="M48 19c-5-4-12-4-17-2v27c5-2 12-2 17 2 5-4 12-4 17-2V17c-5-2-12-2-17 2zM48 19v27"/>',
    home: '<path d="M31 31l17-15 17 15M36 28v19h24V28M45 47V37h6v10"/>',
    people: '<circle cx="40" cy="23" r="6"/><circle cx="57" cy="23" r="6"/><path d="M28 47c1-9 6-12 12-12 4 0 6 2 8 4 2-2 4-4 9-4 6 0 11 3 12 12"/>',
    spark: '<path d="M48 11l4 15 15 5-15 5-4 15-4-15-15-5 15-5z"/>',
  };
  function art(topic) {
    const name = /Chanukah|Shabbat|Women/.test(topic) ? 'flame' : /Brachot|Pesach|Purim|Bishvat/.test(topic) ? 'cup'
      : /Home|Sukkah|Shmita|Lulav|Eruv/.test(topic) ? 'home' : /people/.test(topic) ? 'people'
      : /Tefilla|Elul|Rosh|Kippur|Levana|Omer|Fast|Tisha|Weeks|Shavuot|Tal|Morid/.test(topic) ? 'book' : 'spark';
    return `<span class="art" aria-hidden="true"><svg viewBox="0 0 96 62" fill="none" stroke="#21372b" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><rect width="96" height="62" rx="14" stroke="none"/><path d="M12 31h72" stroke-opacity=".3" stroke-dasharray="2 4"/>${ART[name]}</svg></span>`;
  }

  // Anonymous usage numbers: at most once a day each, load a blank page from the site (n/app-open.html, n/app-done.html,
  // or web-...) in a hidden frame, where Vercel Analytics counts the visit. Nothing about the person is sent.
  function count(what) {
    const day = iso(new Date()), live = A || location.hostname === 'two-today-halacha.vercel.app';
    if (!live || navigator.webdriver || !navigator.onLine || store.get('n-' + what) === day) return;
    const frame = Object.assign(document.createElement('iframe'), { hidden: true, src: `${SITE}n/${A ? 'app' : 'web'}-${what}.html` });
    frame.onload = () => { store.set('n-' + what, day); setTimeout(() => frame.remove(), 8000); };
    document.body.append(frame);
  }

  let current = null; // the top card: { date, step, key, card }
  let shown = null;   // the last card drawn, to know how the next one should arrive
  let busy = false;   // a card is flying off

  // ---- screens
  function route() {
    current = null;
    const h = location.hash.slice(1);
    if (h === 'past') return past(30);
    if (h === 'favs') return favourites();
    if (h === 'settings') return settings();
    const m = h.match(/^d\/(\d{4}-\d\d-\d\d)\/([012])$/);
    if (m && lines.has(m[1])) return showDay(m[1], +m[2]); // any card can be opened by its link, e.g. one that was shared
    if (h) return void location.replace('#');
    home();
  }

  function home() {
    const t = today();
    if (A && !store.get('seen')) return welcome();
    if (t < FIRST) return message(`Two Today begins ${nice(FIRST)}.`, 'Two short halachot every day, matched to the Jewish calendar.', `<a class="primary" href="#d/${FIRST}/0">Preview the first day</a>`);
    if (t > LAST) return message('You have reached the end.', 'Five years of Two Today are complete. Update the app for more.', '<a class="primary" href="#past">Past days</a>');
    if (!lines.has(t)) return message(asDate(t).getDay() === 6 ? 'Shabbat shalom.' : 'No cards today.', 'Two Today rests on Shabbat and Yom Tov.', '<a class="primary" href="#past">Past days</a>');
    showDay(t, done.has(t) ? 2 : 0);
  }

  // People may look back as far as they like, and ahead to the end of next week (a Shabbat), but no further.
  function lastOpen() {
    const d = asDate(today()); d.setDate(d.getDate() - d.getDay() + 13);
    return iso(d);
  }
  // The day to land on in the week before (dir -1) or after (dir 1): the nearest one that has cards and is open.
  function otherWeek(date, dir) {
    const base = asDate(date), limit = lastOpen(); base.setDate(base.getDate() + 7 * dir);
    let best = null;
    for (let k = 0; k < 7; k++) {
      const x = new Date(base); x.setDate(base.getDate() - base.getDay() + k);
      const s = iso(x);
      if (lines.has(s) && s <= limit && (!best || Math.abs(x - base) < Math.abs(asDate(best) - base))) best = s;
    }
    return best;
  }
  const dayLink = (s) => `href="#${s === today() ? '' : `d/${s}/0`}"`;

  // Top of the main screen: name, shortcuts, and one week of days with a tick on the ones done.
  function chrome(date, label) {
    const t = today(), sel = asDate(date), d = getDay(date), limit = lastOpen();
    let strip = '';
    for (let k = 0; k < 7; k++) {
      const x = new Date(sel); x.setDate(sel.getDate() - sel.getDay() + k);
      const s = iso(x), open = lines.has(s) && s <= limit, isDone = done.has(s);
      strip += `<a ${open ? dayLink(s) : 'aria-disabled="true"'} class="${isDone ? 'is-done' : ''}${s === t ? ' today' : ''}"${s === date ? ' aria-current="true"' : ''}>${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Shabbat'][k]}<strong>${x.getDate()}${isDone ? '<i>✓</i>' : ''}</strong></a>`;
    }
    const week = (dir, name, label) => { const s = otherWeek(date, dir); return `<a class="icon week" ${s ? dayLink(s) : 'aria-disabled="true"'} aria-label="${label}">${ico(name)}</a>`; };
    return `<header class="mast"><a class="brand" href="#"><img src="mark.svg" alt=""><span>Two Today<small>DAILY HALACHA</small></span></a>
        <a class="icon" href="#past" aria-label="Past days">${ico('list')}</a><a class="icon" href="#favs" aria-label="Favourites">${ico('star')}</a><a class="icon" href="#settings" aria-label="Settings">${ico('settings')}</a></header>
      <p class="eyebrow">${week(-1, 'back', 'Previous week')}<span>${esc(label || (d ? d.occ : ''))}</span><bdi>${d ? esc(d.heb) : ''}</bdi>${week(1, 'forward', 'Next week')}</p><nav class="days" aria-label="Days of the week">${strip}</nav><p class="pitch" aria-hidden="true">Two halachot.<br><em>Every day.</em></p>`;
  }

  function message(title, sub, actions) {
    shown = null;
    app.className = 'day';
    app.innerHTML = `${chrome(today(), 'Two Today')}<div class="deck"><section class="card done top"><div class="finish"><h2 class="done-title">${esc(title)}</h2><p>${esc(sub)}</p>${actions}</div></section></div>`;
  }

  function welcome() {
    app.className = '';
    app.innerHTML = `<div class="center"><img src="mark.svg" width="64" height="64" alt=""><h1>Two halachot a day.</h1><p>Short, practical and Sefardi, matched to the Jewish calendar. When should we remind you?</p><input type="time" id="time" value="07:30" aria-label="Reminder time"><button class="primary" data-act="start">Remind me daily</button><button class="link" data-act="skip">Not now</button></div>`;
  }

  function cardHTML(date, d, i, cls) {
    const c = d.cards[i], saved = favs.has(`${date}/${i}`), n = c.q.length;
    return `<article class="card ${cls}" data-p="${i}"${cls.startsWith('top') ? '' : ' aria-hidden="true"'}>
      <header class="card-head"><span class="mini">${esc(short(date))} · ${esc(c.topic)}</span>
        <button class="pill" data-act="fav" aria-pressed="${saved}" aria-label="Save to favourites">${ico('star', saved)}</button>
        <button class="pill" data-act="share" aria-label="Share this card">${ico('share')}</button></header>
      <div class="body">${art(c.topic)}<h2 class="q${n > 85 ? ' xs' : n > 50 ? ' sm' : ''}">${esc(c.q)}</h2><p class="answer">${esc(c.a)}</p>
        <p class="source"><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.ref)} ↗</a></p>
        <p class="legal">A short summary. For a ruling in your own case, ask your rav.</p></div>
      <footer class="controls"><div><div class="dots"><span${i ? '' : ' class="on"'}></span><span${i ? ' class="on"' : ''}></span></div><div class="count">${i + 1} / 2 · swipe</div></div>
        <div class="actions">${i ? '<button class="ghost" data-act="prev">Back</button>' : ''}<button class="primary" data-act="next">${i ? 'Done' : 'Next'} →</button></div></footer></article>`;
  }

  function doneHTML(date, cls) {
    const t = today(), weekAgo = new Date(asDate(t) - 7.5 * 864e5), since = store.get('since');
    const missed = dates.filter((x) => x < t && x >= since && asDate(x) >= weekAgo && !done.has(x)).length;
    const title = date === t ? 'Done for today.' : date > t ? `See you on ${nice(date)}.` : 'Done.';
    return `<section class="card done ${cls}"${cls === 'top' ? '' : ' aria-hidden="true"'}><div class="finish"><span class="done-badge" aria-hidden="true">✓</span><p class="mini">${esc(short(date))} · 2 of 2</p><h2 class="done-title">${esc(title)}</h2><p>Two halachot learned. That’s it.</p>${missed ? `<a class="primary" href="#past">Catch up on ${missed} missed day${missed > 1 ? 's' : ''}</a>` : ''}<a class="link" href="#d/${date}/0">Read again</a></div></section>`;
  }

  // A day is a stack: card 1 on top, card 2 under it, "Done" at the bottom. `step` is how many have been swiped away.
  function showDay(date, step) {
    const d = getDay(date), prev = shown;
    shown = { date, step };
    if (step === 2 && date <= today() && !done.has(date)) { done.add(date); save('done', done); }
    if (step === 2 && date === today()) count('done');
    // A new day is dealt in; a card that was swiped away comes back from the side; the next card is already in place.
    const arrive = !prev || prev.date !== date ? ' deal' : prev.step > step ? ' return' : '';
    const layers = [doneHTML(date, step === 2 ? 'top' : step === 1 ? 'under' : 'hidden')];
    if (step <= 1) layers.push(cardHTML(date, d, 1, step === 1 ? 'top' + arrive : 'under'));
    if (step === 0) layers.push(cardHTML(date, d, 0, 'top' + arrive));
    current = step < 2 ? { date, step, key: `${date}/${step}`, card: d.cards[step] } : null;
    app.className = 'day';
    app.innerHTML = `${chrome(date)}<div class="deck">${layers.join('')}</div>`;
    scrollTo(0, 0);
  }

  function page(title, body) {
    app.className = '';
    app.innerHTML = `<header class="mast">${BACK}</header><div class="page"><h1>${title}</h1>${body}</div>`;
  }
  const row = (date, i, q, ticked) => `<a class="row${ticked ? ' done' : ''}" href="#d/${date}/${i}"><span><span class="mini">${esc(nice(date))}</span><b>${esc(q)}</b></span><span class="tick">${ticked ? '✓' : ''}</span></a>`;

  function past(limit) {
    const t = today(), list = dates.filter((x) => x <= t).reverse();
    const rows = list.slice(0, limit).map((x) => row(x, 0, lines.get(x).split('\t')[4], done.has(x))).join('');
    page('Past days', (rows || `<p class="empty">Nothing yet. The first cards arrive on ${esc(nice(FIRST))}.</p>`) + (list.length > limit ? `<button class="ghost" data-act="more" data-n="${limit + 30}">Show earlier days</button>` : ''));
  }

  function favourites() {
    const rows = [...favs].reverse().map((k) => { const [date, i] = k.split('/'), d = getDay(date); return d ? row(date, i, d.cards[i].q, false) : ''; }).join('');
    page('Favourites', rows || '<p class="empty">Tap the star on a card to keep it here.</p>');
  }

  function settings() {
    const r = store.get('reminder');
    let body;
    if (A) {
      const blocked = r && !A.notificationsAllowed(), next = r && A.nextReminder(); // "2026-12-01T07:30"
      body = `<section class="set"><h2>Daily reminder</h2>
        <p>One reminder a day. None on Shabbat or Yom Tov; on Friday and Erev Yom Tov a late reminder comes at 1:00 pm instead.</p>
        <div class="line"><input type="time" id="time" value="${esc(r || '07:30')}" aria-label="Reminder time"><button class="switch" role="switch" data-act="toggle" aria-checked="${r ? 'true' : 'false'}" aria-label="Daily reminder"></button></div>
        ${next ? `<p>Next reminder: <b>${esc(nice(next.slice(0, 10)))} at ${esc(next.slice(11, 16))}</b>${next.slice(0, 10) > today() && today() < FIRST ? ', when the cards begin' : ''}.</p>` : ''}
        ${blocked ? '<p>Notifications are switched off for Two Today.</p><button class="primary" data-act="notif">Turn notifications on</button>' : ''}
        ${r && !A.exactAllowed() ? '<p>Your phone may deliver the reminder up to an hour late.</p><button class="primary" data-act="exact">Allow on-time reminders</button>' : ''}
        <button class="ghost" data-act="test">Send a test reminder</button>
        <button class="ghost" data-act="battery">Reminders not arriving?</button></section>`;
      const newApp = +store.get('latestApp') > A.version(), note = store.get('note');
      store.set('note', '');
      body += `<section class="set"><h2>Updates</h2>
        <p>App version ${esc(A.versionName())} · cards version ${A.contentVersion()}. Corrected cards arrive by themselves once a day.</p>
        ${newApp ? `<p><b>A new app version is ready.</b> Download it and tap Install; your settings and progress stay.</p><a class="primary" href="${APK}" target="_blank" rel="noopener">Download the update</a>` : ''}
        <button class="ghost" data-act="update">Check for updates</button>${note ? `<p><b>${esc(note)}</b></p>` : ''}</section>`;
    } else {
      body = `<section class="set"><h2>Get the Android app</h2><p>A daily reminder at the time you choose, and a home-screen widget.</p><a class="primary" href="${APK}">Download for Android</a></section>`;
    }
    page('Settings', body + `<section class="set"><h2>About</h2><p>Two short halachot a day for Sefardim, summarised from Yalkut Yosef, with a link to the source on yalkut.info. The days follow the calendar of Eretz Yisrael. These are summaries for learning; for a ruling in your own case, ask your rav.</p><p>Two Today counts how many times a day it is opened and finished. Nothing that identifies you is collected.</p></section>`);
  }

  // ---- actions
  function setReminder(time) { if (A) A.setReminder(time); else store.set('reminder', time); }
  function toast(text) {
    const el = Object.assign(document.createElement('div'), { className: 'toast', textContent: text });
    document.body.append(el); setTimeout(() => el.remove(), 1600);
  }
  function share() {
    // A short link to this card on the Two Today site; the card there carries the link to the source.
    const c = current.card, text = `${c.q}\n\n${c.a}\n\n${c.ref}\nTwo Today: ${SITE}#d/${current.date}/${current.step}`;
    if (A) A.share(text);
    else if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard.writeText(text).then(() => toast('Copied'));
  }
  const goBack = () => (history.length > 1 ? history.back() : location.replace('#'));

  // Throw the top card off to one side (dir -1 left, 1 right), then show what was under it.
  function fling(dir, dy) {
    const card = app.querySelector('.card.top');
    if (!current || busy || !card) return;
    const { date, step } = current;
    busy = true;
    card.style.transition = 'transform .28s ease-in';
    card.style.transform = `translate(${dir * 150}vw, ${dy || 0}px) rotate(${dir * 24}deg)`;
    card.parentElement.classList.add('settle');
    card.parentElement.style.setProperty('--p', 1);
    setTimeout(() => { busy = false; location.hash = `d/${date}/${step + 1}`; }, 250);
  }

  // Drag the top card with a finger or the mouse; it follows and tilts. Let go far enough, or flick, and it flies off.
  let drag = null, dragEnded = 0;
  app.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.card.top:not(.done)');
    drag = card && !busy && e.button < 1 ? { card, id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0, at: performance.now(), moving: false } : null;
  });
  app.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moving) {
      if (Math.abs(dx) < 8) return;
      drag.moving = true; drag.card.style.transition = 'none';
      try { drag.card.setPointerCapture(e.pointerId); } catch (err) {}
    }
    drag.dx = dx; drag.dy = dy;
    drag.card.style.transform = `translate(${dx}px, ${dy * 0.4}px) rotate(${dx / 18}deg)`;
    drag.card.parentElement.style.setProperty('--p', Math.min(1, Math.abs(dx) / 140));
  });
  function release(e) {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    drag = null;
    if (!d.moving) return;
    dragEnded = performance.now();
    const speed = Math.abs(d.dx) / (performance.now() - d.at); // px per ms
    if (e.type === 'pointerup' && (Math.abs(d.dx) > 90 || (Math.abs(d.dx) > 30 && speed > 0.6))) return fling(d.dx < 0 ? -1 : 1, d.dy * 0.4);
    d.card.style.transition = 'transform .3s cubic-bezier(.2,1.4,.4,1)';
    d.card.style.transform = '';
    d.card.parentElement.classList.add('settle');
    d.card.parentElement.style.setProperty('--p', 0);
    setTimeout(() => d.card.parentElement.classList.remove('settle'), 300);
  }
  app.addEventListener('pointerup', release);
  app.addEventListener('pointercancel', release);

  app.addEventListener('click', (e) => {
    if (performance.now() - dragEnded < 350) { e.preventDefault(); return; } // the end of a drag is not a tap
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, time = () => document.querySelector('#time').value || '07:30';
    if (act === 'back') goBack();
    else if (act === 'next') fling(-1);
    else if (act === 'prev') goBack();
    else if (act === 'more') past(+b.dataset.n);
    else if (act === 'share') share();
    else if (act === 'battery') A.battery();
    else if (act === 'update') { b.textContent = 'Checking…'; b.disabled = true; A.checkUpdates(); }
    else if (act === 'test') { A.testReminder(); toast('A test reminder arrives in about 10 seconds'); }
    else if (act === 'exact') A.allowExact();
    else if (act === 'notif') A.notificationSettings();
    else if (act === 'fav') {
      if (!favs.delete(current.key)) favs.add(current.key);
      save('favs', favs);
      b.setAttribute('aria-pressed', favs.has(current.key)); b.innerHTML = ico('star', favs.has(current.key));
    } else if (act === 'toggle') { setReminder(store.get('reminder') ? '' : time()); settings(); }
    else if (act === 'start' || act === 'skip') { if (act === 'start') setReminder(time()); store.set('seen', '1'); route(); }
  });
  app.addEventListener('change', (e) => { if (e.target.id === 'time' && store.get('reminder')) setReminder(e.target.value || '07:30'); });

  // With a keyboard: right arrow turns the card, left arrow brings the first one back.
  addEventListener('keydown', (e) => {
    if (!current || e.target.closest('input')) return;
    if (e.key === 'ArrowRight') fling(-1);
    else if (e.key === 'ArrowLeft' && current.step) goBack();
  });

  // The Android shell reports back after "Check for updates": 'cards' (newer cards downloaded), 'same' or 'error'.
  window.onUpdateChecked = (outcome) => {
    const newApp = +store.get('latestApp') > A.version();
    store.set('note', outcome === 'error' ? 'Could not check. Is the phone online?' : outcome === 'cards' ? 'New cards downloaded.' : newApp ? '' : 'Everything is up to date.');
    if (outcome === 'cards') location.reload(); // load the new cards straight away
    else if (location.hash === '#settings') settings();
  };

  addEventListener('hashchange', route);
  // Coming back to the app (also called by the Android shell): show the new day, or the result of a permission prompt.
  let shownDay = today();
  window.onAppResume = () => {
    count('open');
    if (location.hash === '#settings' || today() !== shownDay) { shownDay = today(); route(); }
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) window.onAppResume(); });
  route();
  count('open');
})();
