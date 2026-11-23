# Two Today — daily halacha (Chanukah edition mockup)

Static mockup: tap a reminder, swipe through two practical halachot, done.
Live at https://two-today-halacha.vercel.app/

- `week.js` — the week's cards (question, answer, Yalkut Yosef reference and link). Sefardi practice only for now.
- `app.js` — the phone preview: lock screen, two cards, done screen, swipe/keyboard handling.
- `styles.css`, `index.html`, `mark.svg`, `og.png` — layout and assets.

No build step. Publish by pushing to `main` (Vercel deploys from git).
The halachic summaries are samples awaiting rabbinic review.
