# Builds content.txt for the app from the audited 5-year CSV (English only; the Hebrew stays out of this repo).
# usage: python3 tools/make_content.py path/to/two_today_cards_5y.csv VERSION
# Format: first line "v<TAB>VERSION"; then one line per day, 13 tab-separated fields:
# date, hebrew date, occasion, then for each of the two cards: topic, heading, answer, reference, link
import csv, re, sys, collections
src, version = sys.argv[1], int(sys.argv[2])
days = collections.OrderedDict()
for r in csv.DictReader(open(src, encoding="utf-8-sig")):
    days.setdefault(r["Date"], []).append(r)
clean = lambda s: re.sub(r"\s+", " ", s).strip()
out = [f"v\t{version}"]
for date, cards in days.items():
    assert len(cards) == 2, date
    cards.sort(key=lambda r: r["Card"])
    occ = min((re.sub(r"\s*\(OC [^)]*\)", "", c["Occasion"]) for c in cards), key=len)
    f = [date, cards[0]["Hebrew date"], occ]
    for c in cards:
        f += [c["Topic"], c["Heading"], c["Halacha (English)"], c["Reference"], c["Link"]]
    f = [clean(x) for x in f]
    for i in (6, 11):  # keep "§12" after a Hebrew section title reading left to right
        f[i] = re.sub(r"([\u0590-\u05FF])(, §)", "\\1\u200e\\2", f[i])
    assert len(f) == 13 and all(f), date
    out.append("\t".join(f))
open("content.txt", "w", encoding="utf-8").write("\n".join(out) + "\n")
print(len(out) - 1, "days", list(days)[0], "to", list(days)[-1])
