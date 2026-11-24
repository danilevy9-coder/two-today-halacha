'use strict';
// Two Today: the whole app. Runs inside the Android shell (window.Android is its bridge) and in a plain browser.
(async () => {
  const A = window.Android || null;
  const APK = 'https://two-today-halacha.vercel.app/two-today.apk';
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
    app.innerHTML = '<div class="full"><div class="center"><h1>Could not load the cards.</h1><p>Please close Two Today and open it again.</p></div></div>';
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
  const today = () => {
    const forced = new URLSearchParams(location.search).get('date'); // for previews in a browser
    const d = new Date();
    return forced || `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const asDate = (s) => new Date(s + 'T12:00:00');
  const nice = (s) => asDate(s).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: s.slice(0, 4) === today().slice(0, 4) ? undefined : 'numeric',
  });

  const PATHS = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"/>',
    share: '<path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  };
  const ico = (name, filled) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
  const BACK = `<button class="icon" data-act="back" aria-label="Back">${ico('back')}</button>`;
  const NAV = `<a class="icon" href="#past" aria-label="Past days">${ico('list')}</a><a class="icon" href="#favs" aria-label="Favourites">${ico('star')}</a><a class="icon" href="#settings" aria-label="Settings">${ico('settings')}</a>`;
  const BRAND = '<span class="brand"><img src="mark.svg" alt="">Two Today</span>';

  if (!store.get('since')) store.set('since', today()); // first day of use: earlier days are not "missed"

  let current = null; // the card on screen, for swipe, share and favourite

  // ---- screens
  function route() {
    current = null;
    const h = location.hash.slice(1), t = today();
    if (h === 'past') return past(30);
    if (h === 'favs') return favourites();
    if (h === 'settings') return settings();
    const m = h.match(/^d\/(\d{4}-\d\d-\d\d)\/([012])$/);
    if (m && lines.has(m[1]) && (m[1] <= t || m[1] === FIRST)) return showDay(m[1], +m[2], false);
    if (h) return void location.replace('#');
    home();
  }

  function home() {
    const t = today();
    if (A && !store.get('seen')) return welcome();
    if (t < FIRST) return message(`Two Today begins ${nice(FIRST)}.`, 'Two short halachot every day, matched to the Jewish calendar.', `<a class="primary" href="#d/${FIRST}/0">Preview the first day</a>`);
    if (t > LAST) return message('You have reached the end.', 'Five years of Two Today are complete. Update the app for more.', '<a class="primary" href="#past">Past days</a>');
    if (!lines.has(t)) return message(asDate(t).getDay() === 6 ? 'Shabbat shalom.' : 'No cards today.', 'Two Today rests on Shabbat and Yom Tov.', '<a class="primary" href="#past">Past days</a>');
    showDay(t, done.has(t) ? 2 : 0, true);
  }

  function message(title, sub, actions) {
    app.innerHTML = `<div class="full"><header class="bar">${BRAND}${NAV}</header><div class="center"><h1>${esc(title)}</h1><p>${esc(sub)}</p>${actions}</div></div>`;
  }

  function welcome() {
    app.innerHTML = `<div class="full"><div class="center"><img src="mark.svg" width="64" height="64" alt=""><h1>Two halachot a day.</h1><p>Short, practical and Sefardi, matched to the Jewish calendar. When should we remind you?</p><input type="time" id="time" value="07:30" aria-label="Reminder time"><button class="primary" data-act="start">Remind me daily</button><button class="link" data-act="skip">Not now</button></div></div>`;
  }

  function showDay(date, step, isHome) {
    const d = getDay(date), t = today();
    const head = `<header class="bar">${isHome ? '' : BACK}<p class="mini">${esc(nice(date))}${date === t ? ' · today' : ''}<span class="heb"><bdi>${esc(d.heb)}</bdi></span></p>${isHome ? NAV : ''}</header>`;
    if (step === 2) {
      if (date <= t && !done.has(date)) { done.add(date); save('done', done); }
      const weekAgo = new Date(asDate(t) - 7.5 * 864e5), since = store.get('since');
      const missed = dates.filter((x) => x < t && x >= since && asDate(x) >= weekAgo && !done.has(x)).length;
      const title = date === t ? 'Done for today.' : date > t ? `See you on ${nice(date)}.` : 'Done.';
      app.innerHTML = `<div class="full">${head}<div class="center"><span class="badge" aria-hidden="true">✓</span><h1>${esc(title)}</h1><p>Two halachot learned.</p>${missed ? `<a class="primary" href="#past">Catch up on ${missed} missed day${missed > 1 ? 's' : ''}</a>` : ''}<a class="link" href="#d/${date}/0">Read again</a></div></div>`;
      return;
    }
    const c = d.cards[step], key = `${date}/${step}`, saved = favs.has(key);
    current = { date, step, key, card: c };
    app.innerHTML = `<section class="study" data-p="${step}">${head}
      <article class="card"><p class="mini topic">${esc(c.topic)}${d.occ === 'Year-round' || d.occ === c.topic ? '' : ' · ' + esc(d.occ)}</p>
        <h2 class="q">${esc(c.q)}</h2><p class="answer">${esc(c.a)}</p>
        <p class="source"><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.ref)} ↗</a></p>
        <p class="legal">A short summary. For a ruling in your own case, ask your rav.</p></article>
      <footer class="controls"><span class="dots"><i class="${step ? '' : 'on'}"></i><i class="${step ? 'on' : ''}"></i></span>
        <button class="icon" data-act="fav" aria-pressed="${saved}" aria-label="Save to favourites">${ico('star', saved)}</button>
        <button class="icon" data-act="share" aria-label="Share this card">${ico('share')}</button>
        <a class="primary" href="#d/${date}/${step + 1}">${step ? 'Done' : 'Next'}</a></footer></section>`;
    scrollTo(0, 0);
  }

  function page(title, body) {
    app.innerHTML = `<header class="bar">${BACK}<span class="brand"></span></header><div class="page"><h1>${title}</h1>${body}</div>`;
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
      const blocked = r && !A.notificationsAllowed();
      body = `<section class="set"><h2>Daily reminder</h2>
        <p>One reminder a day. None on Shabbat or Yom Tov; on Friday and Erev Yom Tov a late reminder comes at 1:00 pm instead.</p>
        <div class="line"><input type="time" id="time" value="${esc(r || '07:30')}" aria-label="Reminder time"><button class="switch" role="switch" data-act="toggle" aria-checked="${r ? 'true' : 'false'}" aria-label="Daily reminder"></button></div>
        ${blocked ? '<p>Notifications are switched off for Two Today.</p><button class="primary" data-act="notif">Turn notifications on</button>' : ''}
        ${r && !A.exactAllowed() ? '<p>Your phone may deliver the reminder up to an hour late.</p><button class="primary" data-act="exact">Allow on-time reminders</button>' : ''}
        <button class="ghost" data-act="battery">Reminders not arriving?</button></section>`;
      if (+store.get('latestApp') > A.version()) body = `<section class="set"><h2>A new version is ready</h2><a class="primary" href="${APK}" target="_blank" rel="noopener">Download the update</a></section>` + body;
    } else {
      body = `<section class="set"><h2>Get the Android app</h2><p>A daily reminder at the time you choose, and a home-screen widget.</p><a class="primary" href="${APK}">Download for Android</a></section>`;
    }
    page('Settings', body + `<section class="set"><h2>About</h2><p>Two short halachot a day for Sefardim, summarised from Yalkut Yosef, with a link to the source on yalkut.info. The days follow the calendar of Eretz Yisrael. These are summaries for learning; for a ruling in your own case, ask your rav.</p></section>`);
  }

  // ---- actions
  function setReminder(time) { if (A) A.setReminder(time); else store.set('reminder', time); }
  function toast(text) {
    const el = Object.assign(document.createElement('div'), { className: 'toast', textContent: text });
    document.body.append(el); setTimeout(() => el.remove(), 1600);
  }
  function share() {
    const c = current.card, text = `${c.q}\n\n${c.a}\n\n${c.ref}\n${c.url}\n\nTwo Today: two halachot a day`;
    if (A) A.share(text);
    else if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard.writeText(text).then(() => toast('Copied'));
  }
  const goBack = () => (history.length > 1 ? history.back() : location.replace('#'));

  app.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act, time = () => document.querySelector('#time').value || '07:30';
    if (act === 'back') goBack();
    else if (act === 'more') past(+b.dataset.n);
    else if (act === 'share') share();
    else if (act === 'battery') A.battery();
    else if (act === 'exact') A.allowExact();
    else if (act === 'notif') A.notificationSettings();
    else if (act === 'fav') {
      if (!favs.delete(current.key)) favs.add(current.key);
      save('favs', favs); showDay(current.date, current.step, !location.hash);
    } else if (act === 'toggle') { setReminder(store.get('reminder') ? '' : time()); settings(); }
    else if (act === 'start' || act === 'skip') { if (act === 'start') setReminder(time()); store.set('seen', '1'); route(); }
  });
  app.addEventListener('change', (e) => { if (e.target.id === 'time' && store.get('reminder')) setReminder(e.target.value || '07:30'); });

  // Swipe sideways between the two cards (a mostly vertical move is a scroll, not a swipe).
  let x0 = null, y0 = 0;
  app.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } else x0 = null;
  }, { passive: true });
  app.addEventListener('touchend', (e) => {
    if (x0 === null || !current) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy)) return;
    if (dx < 0) location.hash = `d/${current.date}/${current.step + 1}`;
    else if (current.step) goBack();
  }, { passive: true });

  addEventListener('hashchange', route);
  // Coming back to the app (also called by the Android shell): show the new day, or the result of a permission prompt.
  let shownDay = today();
  window.onAppResume = () => {
    if (location.hash === '#settings' || today() !== shownDay) { shownDay = today(); route(); }
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) window.onAppResume(); });
  route();
})();
