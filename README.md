# Beauty clinic Telegram Mini App (demo)

Single-page Mini App (plain HTML, no build step at run time). Opens inside Telegram from a bot's menu button.
A clinic you can walk through in 3D with an advisor in every room, doctor booking in four steps (service, doctor
with days off, Shamsi calendar + time slots with a waitlist, details + deposit or 4-part installments), "my care"
with reminders, cancellation and the aftercare timeline (day 0, day 2 check-in, day 28 next session), and a tariff
list with FAQ.
Sample data only. PREVIEW = true: bookings and payments send nothing yet.

## The walkable clinic (v4, 2026-11-08)

The headline of the app is now a clinic you walk through in first person — not a 360° photograph like the hotel's
tour, but a real room built out of geometry in the page. Eleven spaces off a central corridor: grand reception,
VIP lounge, treatment gallery, dermatology and injectable consultation, advanced skin analysis, laser, facial and
rejuvenation, hair restoration, the doctors' office, and appointment & contact.

It is built rather than photographed because no free 360° photograph of a dermatology clinic exists, and a drawn
clinic can be relit, rearranged and relabelled when the owner sends their own. Nothing is downloaded: travertine,
cream marble, brushed champagne metal and wall plaster are all drawn on a canvas at boot.

- `js/clinic3d.js` — the engine: the floor plan, the furniture, the materials, the walking and the markers.
- `js/three.module.min.js` — three.js r169, vendored (the same copy the hotel app uses).
- Both are fetched the **first time someone walks in**, never on load, so the app still opens instantly for
  everyone who does not.

**How it is walked.** Drag anywhere to look; the pad in the bottom-left corner to walk. The pad is on the left
*physically*, not at the inline start — RTL moves the text, it does not move anyone's hand. Tap a marker to open
it, tap a doorway label to walk through, tap a room in the list to be taken there. A keyboard works too (WASD,
arrows, E, Esc). A phone without WebGL, or one falling back to software rendering, is told so plainly and offered
the flat photo tour instead.

**Why it holds 60 fps on a weak GPU** (measured: 60 fps, 12 draw calls, 2 k triangles on Intel UHD at 414×896 @2×):

- **Exactly four lights for the whole visit.** three.js bakes the *number* of each light type into the shader, so
  adding — or even hiding — one when you enter a room recompiles every program: a half-second freeze on a phone.
  Entering a room moves and retints the two pools instead. Never add a fifth, and never set one to `visible = false`.
- **No shadow maps at all.** Corner and floor-contact darkening is baked into vertex colours once at build time,
  and every object that stands on the floor gets a warm contact blob — all the blobs in the clinic are one
  instanced draw call. A floating object is the most immediate "cheap 3D" tell and it costs nothing to avoid.
- **One material registry.** Everything sharing a material is welded into a single geometry per room, so a room is
  6–9 draw calls however many boxes it was modelled from.
- **Portal culling.** Only the room you are standing in, plus whatever is genuinely visible through its doorways
  (two deep), is drawn.
- **Dynamic resolution**, 0.85–1.5, moved a quarter-step at a time and never more than once a second.

Add `?fps` to the address to see milliseconds, dpr, rooms drawn, draw calls and triangles in the corner.

**Changing the clinic.** The floor plan is `ROOMS` and `DOORS` at the top of `js/clinic3d.js`, in metres: rooms are
axis-aligned rectangles, a doorway is a gap in the wall they share. `furnish()` says what stands in each room, out
of the measured kit (`counter`, `desk`, `chair`, `sofa`, `bed`, `screen`, `shelf`, `slats`, `partition`, `planter`,
`machine`). Everything a visitor *reads* is in `WALK3D` in `clinic-a.js` instead, so copy never hides inside the 3D.
`domtest/clinic3d-plan.mjs` is worth re-running after a change (`node domtest/clinic3d-plan.mjs`): no two rooms may share floor, every
doorway must sit on the wall its two spaces share, and every room must be walkable from reception.

## The living header

The clinic is not something you pick off the home page — it **is** the home page. Where the hero photograph used
to be, under «کلینیک زیبایی آرنیک» and «سلام! پوستت امروز چطوره؟», the reception itself drifts slowly past, and
touching it walks you in. The owner asked for exactly that: «میخواهم بصورت این نباشه که انتخابش کنم».

Two things make it affordable:

- **It arrives late on purpose.** three.js is fetched ~600 ms after the page is interactive, so the app still
  opens instantly; until then the hero photograph is what you see, and on a phone without WebGL it is all you
  ever see. Nothing about the first paint changed.
- **The canvas is moved, not rebuilt.** `render()` replaces the whole page on every route change, so a fresh
  canvas would mean building the eleven rooms again each time you came back home. `heroSync()` keeps one canvas
  node and re-parents it into the new hero, which preserves its WebGL context; the engine is only paused and
  resumed. It is paused while the full-screen walk is open too — one context at a time on a phone.

In showcase mode the engine builds no markers, binds no input, and drifts with three sines at unrelated periods,
so it never visibly repeats and never jolts.

**A trap worth remembering.** `build-app.cjs` inlines `clinic3d.css` *before* `_theme.css`; only
`clinic-theme.css` is loaded last. A rule here written as `.hero .on-photo` therefore loses to the identical
selector in the house layer — which is how the scrim came to be painted across the clinic name, leaving every
word ghosted while the gold pill stayed solid. Anything in this sheet that has to beat `_theme.css` needs the
extra class: `.hero.live .on-photo`.

## The advisor in every room

Walk into a room and an advisor appears: it names the room, asks what you need, and offers four questions a visitor
standing there would really ask. It is **rule-based and says so**. It matches what you type against the clinic's own
knowledge (`KB` in `clinic-a.js` — the 16 answers this app used to carry, plus one set per room), and every answer
carries the clinic paper it came from. The ladder is the house one:

1. an exact question → answered at once;
2. a good keyword score → answered, with its source;
3. a weak score → it offers the two nearest questions rather than guessing;
4. nothing → it says it does not know and will not invent, and hands the question to the clinic's real advisor bot
   (`@clinicahvaz_2advisor_bot`), copying the question to the clipboard on the way.

The matcher normalises Persian the way people actually type it: `ي`/`ی`, `ك`/`ک`, the half-space, Arabic and Persian
digits, vowel marks. An entry belonging to the room you are standing in gets a small bonus, so «چند جلسه» in the
laser room means the laser.

Nothing in `KB` is invented. Every price, session count and rule is the one in `SERVICES` and the care guide, so the
tariff can only ever say one thing. Where a question invites a diagnosis, a promised result or an equipment
specification, the answer redirects to the in-person consultation instead.

## The look (v4, 2026-11-08)

Dubai luxury minimalism, in the palette the walkable clinic is built from: warm ivory `#F8F5EF`, champagne beige
`#D8C5A5`, soft gold `#B89A68`, warm white, dark taupe `#51483F`. No green anywhere. Redesigned, not rebuilt: the
app's markup and logic are the ones that were here — only `miniapps-src/clinic/clinic-theme.css` changed, and it is
loaded last, so a colour there always wins. `--mint-*` and `--peach-*` already alias the accent family and follow it
by themselves; only `--lilac-*` and `--sky-*` had to be warmed by hand.

Soft gold is bright enough to carry dark text *on* it but not dark enough to *be* text on ivory (2.4:1), so
`--accent` is the gold for fills and hairlines and `--accent-ink` is the same gold at 4.8:1 for the few places the
house layer prints a word in it.

Seven photographs of its own in `img/`, one per treatment plus the hero; `clinic-a.js` says which (`ph`).
`miniapps-src/clinic/photos.py` builds them from Unsplash (free licence, every one a 2026 upload) with one grade
across the set. `python photos.py --force` builds them again; to use the clinic's own photographs, drop them into
`img/` with these names and never run it again.

Vazirmatn and Outfit travel with the app in `fonts/` — Google Fonts does not load reliably inside Iran or inside
Telegram's browser, and a page whose Persian font never arrives falls back to Latin in the middle of Persian.

## Building it

    cd miniapps-src
    node build-app.cjs clinic ۴          # writes clinic/clinic-miniapp.html and ../clinic-miniapp/index.html
    cd domtest && node clinic-test.cjs ../../clinic-miniapp/index.html

Defining `WALK3D` in `clinic-a.js` is what makes the build carry the walk — the same way `TOUR`, `DASH` and `WHEEL`
work. `js/` is copied into the deploy folder beside `img/`, `fonts/` and `pano/`.
