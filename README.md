# Two Today

Two practical Sefardi halachot a day, matched to the Jewish calendar (Eretz Yisrael). Each card is a short question and answer summarised from Yalkut Yosef, with a link to the source on yalkut.info.

Live web version: https://two-today-halacha.vercel.app/ · Android download: https://two-today-halacha.vercel.app/two-today.apk

## How it is built

The whole app is three plain files with no build step and no libraries:

- `index.html`, `styles.css`, `app.js`: every screen (today's two cards, done, past days, favourites, settings).
- `content.txt`: the cards. First line `v<TAB>version`, then one line per day with 13 tab-separated fields: date, Hebrew date, occasion, then topic, heading, answer, reference and link for each of the two cards. Shabbat and Yom Tov have no line, which is how the app knows to stay silent.
- `n/`: four blank pages (`app-open`, `app-done`, `web-open`, `web-done`). The app loads one unseen, at most once a day each, so Vercel Analytics can count opens and completions. No ids or cookies.
- `version.txt`: the newest Android `versionCode`. The app shows "A new version is ready" when this is higher than its own.

The Android app (`android/`, plain Java, no libraries) is a thin shell around those same files:

- `MainActivity`: one WebView that serves the files from inside the app, plus a small bridge (`Android.get/set/setReminder/share/...`).
- `Reminder`: the one daily notification. It fires only on days that have a line in `content.txt`; before Shabbat or Yom Tov a late reminder moves to 13:00. It is set again after a restart, an update or a clock change. Settings shows when the next one is due and has "Send a test reminder".
- `Widget`: home-screen widget with today's first question.
- `Updater`: once a day, fetches `content.txt` and `version.txt` from the website, so corrected cards reach phones without a new release. "Check for updates" in Settings does the same check on the spot.
- `Content`: reads `content.txt`.

## Changing things

- **Fix or add cards:** regenerate `content.txt` with a higher version number and push. Phones pick it up within a day.
  `python3 tools/make_content.py two_today_cards_5y.csv 2`
  (The CSV with the Hebrew source text is kept out of this repo.)
- **Change a screen:** edit `app.js` / `styles.css`. Open `index.html` through any local web server to try it; add `?date=2026-12-04` to see a given day.
- **Release a new Android version:** raise `versionCode` in `android/app/build.gradle`, build, copy the APK to `two-today.apk`, put the same number in `version.txt`, push.
  `cd android && gradle assembleRelease -PTT_STORE=/path/twotoday.jks -PTT_PASS=...`
  The signing key (`twotoday.jks`) is not in the repo. Every update must be signed with the same key, so keep it and its password safe.

Publishing is by pushing to `main` (Vercel deploys from git).

The cards are summaries for learning and are awaiting rabbinic review.
