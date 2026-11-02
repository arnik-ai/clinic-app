# Beauty clinic Telegram Mini App (demo)

Single-page Mini App (plain HTML, no build). Opens inside Telegram from a bot's menu button.
Online consult with answers taken from the clinic's own tariff and care guide (each shows its source),
doctor booking in four steps (service, doctor with days off, Shamsi calendar + time slots with a waitlist,
details + deposit or 4-part installments), "my care" with reminders, cancellation and the aftercare timeline
(day 0, day 2 check-in, day 28 next session), and a tariff list with FAQ.
Sample data only. PREVIEW = true: bookings and payments send nothing yet.

## The look (v3, 2026-11-02)

Redesigned, not rebuilt: the app's markup and logic are the ones that were here, only re-skinned to the Prestige
hotel app's design language in a light key — ivory paper, navy ink, gold hairline and buttons, an eyebrow in spaced
capitals, real photography under a navy scrim, calm white cards with a line icon in a gold ring. No green anywhere.
The sheet is `miniapps-src/clinic/clinic-theme.css`; the colours of the four card families (`t-mint`, `t-lilac`,
`t-peach`, `t-sky`) were redefined there, so every page changed without touching a single class name.

Seven photographs of its own in `img/`, one per treatment plus the hero; `clinic-a.js` says which (`ph`).
`miniapps-src/clinic/photos.py` builds them: it fetches each one from Unsplash (free licence, every one a 2026
upload) and gives the whole set the same grade — gold in the light, navy in the shadow, a soft S-curve — so the
app reads as one photographer's work beside its gold-and-navy look. `python photos.py --force` builds them again;
to use the clinic's own photographs, drop them into `img/` with these names and never run it again.

Vazirmatn and Outfit travel with the app in `fonts/` — Google Fonts does not load reliably inside Iran or inside
Telegram's browser, and a page whose Persian font never arrives falls back to Latin in the middle of Persian.
