# Beauty clinic Telegram Mini App (demo)

Single-page Mini App (plain HTML, no build step at run time). Opens inside Telegram from a bot's menu button.
A clinic you can walk through in 3D with an advisor in every room, doctor booking in four steps (service, doctor
with days off, Shamsi calendar + time slots with a waitlist, details + deposit or 4-part installments), "my care"
with reminders, cancellation and the aftercare timeline (day 0, day 2 check-in, day 28 next session), and a tariff
list with FAQ.
Sample data only. PREVIEW = true: bookings and payments send nothing yet.

## Guided first (v5.1, 2026-11-12)

The owner put it plainly: a thumb stick is a control for somebody who plays Xbox, and the people this clinic is
for will not drive a first-person camera. They get wedged between rooms and conclude the thing is broken. He is
right, and it is the kind of thing no amount of making the stick nicer would have fixed — the default was wrong.

So the clinic is now walked without driving, and free walking is a switch that starts off.

- **No welcome screen.** There was a mark, a headline and three buttons between tapping the header and standing
  in the clinic. It said nothing the clinic does not say better by being there, and it put a second tap in
  front of the one thing the whole app is for. Measured: standing in reception 1.3 s after the tap.
- **The room list is simply on the screen**, always, with an arrow at each end for anybody who would rather
  press next than read a list. Tap a name and you are walked there.
- **"خودش بگردد"** in the top bar walks every room in order, pausing in each, like a film. One touch anywhere
  hands control back. For someone who does not want to drive at all, this is the whole experience.
- **Touch the floor and you walk there** (v5), which is the other control that needs no explaining.
- **The stick is behind a switch**, off by default; turning it on puts the room strip away, and turning it off
  brings it back.
- **"گیر کردی؟ برگرد وسط اتاق".** A second and a half of pushing at something and not moving, and the engine
  says so (`onStuck`); the page offers the button, and `recentre()` glides out — an automatic walk does not
  collide, which is exactly why it can leave a corner the stick cannot. Letting go of the stick does not
  dismiss the offer: letting go is what you do to reach the button.

And a colour per room, because the palette of this clinic is deliberately one warm family — right for the stone,
useless for a list of eleven rooms. `ROOMS[…].tint` in `js/clinic3d.js` is the only place each is written down;
the chip in the room strip, the markers standing in that room and the nav all read it from there. Champagne,
rose, mauve, peach, periwinkle, blush, coral, amber. Never green, and never more than a 30 px chip.

Driven in a real browser end to end: arrives with no box in the way, 11 colour-coded rooms on screen, next and
previous, tap-a-room, the tour walking itself through 7 rooms unattended and stopping on one touch, the stick
appearing only when switched on, and the rescue appearing after 1.5 s of pushing and moving the visitor 4.2 m
clear. 60 fps, no console errors.

## Walking it, and looking at it (v5, 2026-11-12)

Two complaints, and one turned out to be the other. Moving around on a phone was hard — and the reason was not
the controls at all: the advisor panel opened to its full height on **every** room change and sat straight over
the thumb pad. The visitor could not see where they were going and could not reach the control that would take
them there.

- **The advisor is a bubble now.** One line, four chips, sitting above the controls; it opens into the full
  conversation only when someone taps it, a chip, or her marker, and while it is open the stick is taken away.
  Its class is `c3small`, not `mini`: `mini` is a house component class, and its `.mini button { flex: 1 }` was
  stretching the close button right across the head.
- **One analog thumb stick instead of four arrows.** A 44 px button can only say "all the way" or "not at all";
  the stick says how fast. 128 px of hit area around a 104 px ring, so a thumb that lands wide still walks.
- **It moves the way a game moves, and corners let go of you.** The stick walks in the direction it is pushed,
  sideways included, the way the left stick of any game does — it used to turn instead, which is exactly what
  you cannot do once you are wedged into a corner. The move is resolved in 6 cm slices; a slice that cannot go
  diagonally still goes along whichever axis is free, re-testing the second after the first has moved so a
  corner is never cut; and a slice blocked on both at once takes a short step along the wall it is pressed
  against. The walker is 0.34 m wide rather than 0.26, so the camera stops a third of a metre off the plaster
  instead of putting its near plane into it. Measured: 6.6 m straight through a doorway without catching once,
  and sideways always walks you out of a corner.
- **Touch the floor and you walk there.** The ray is met with the floor plane, and the line from here to there
  is stepped along and stopped at the last point that is genuinely legal — half a metre short of whatever
  stopped it. One thumb, no aiming. The ray has to be normalised before its slope is read; unnormalised, every
  tap below the horizon measured as 0.02 down and was thrown away as a tap at the sky.
- **The look glides** a little after the finger lifts instead of stopping dead.

And the room you arrive in is composed now rather than merely entered:

- **Arrive by the door and look across the room on its diagonal**, aimed at the area-weighted centre of the
  furniture footprints — which every piece already declares for its contact shadow. Facing a wall square-on
  from two metres is what every treatment room used to do.
- **Daylight.** The entrance is glazed: champagne mullions, a bright unlit plane behind them, and a pool of it
  lying on the travertine inside. A clinic with no window anywhere has nowhere for its light to come from.
- **Back-lit stone in the reception counter**; a halo on every cove and downlight (one additive Points object
  per room, inside the room group, so the portal cull takes the halos away with the room); lit niches on the
  walls that were blank; sheen on the upholstery; deeper baked corner shading (min 0.54, corner fade 1.4).
- The treatment beds moved against the far wall, and the pool lights cut from 18–22 to 12–13 and lifted nearer
  the ceiling: at 22 they burnt a white hole in the floor directly beneath themselves.
- The guide keeps 2.05 m, stands well to the side, waits by the door when a room is too small to stand aside
  in, and is not drawn at all within 1.5 m.

Still 60 fps at dpr 1.5 on the same machine. Reception is the heaviest room, at 50 draw calls and 11 k
triangles; a treatment room is 12–14 calls and 2 k.

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

## آوا, the guide

Walk into a room and someone is there. She is a woman in a clinic tunic over soft taupe trousers — 1.67 m, in the same
palette as the rooms — and deliberately **not** a machine: no screen for a face, no antenna, no glow.

What gives a figure away as made rather than seen is the silhouette, not the detail, so she is not stacked out of
the furniture's boxes: her body is one revolved profile with shoulders, a waist and a hem, squashed on z so its
cross-section is a person's oval instead of a tube; her head is an ellipsoid; her limbs are capsules; her face is
painted onto a curved patch of her own skull rather than stuck flat on the front of it; and she stands with her
weight on one leg, because standing square is the most mannequin-like thing a figure can do. About 1,400
triangles, which is the only object in the clinic that earns that many.

Two traps worth remembering: she needs **her own materials** for anything the furniture also wears, because the
furniture's carry `vertexColors: true` for their baked corner shading and a limb with no colour attribute is
multiplied to black by it; and her sleeves have to sit at a wider radius than the body they hang beside, or her
arms float clear of her. The owner asked for exactly that: «یک خانم که مشخص نیست رباته». She comes with you from room to
room rather than being a different machine waiting in each, keeps a conversation's distance, turns to face you,
and says «من راهنماییت می‌کنم» when you arrive.

Standing somewhere is not the same as being seen, so before she walks she looks for a spot that is free to stand
in, has nothing between it and you, and is not in front of whatever the room's marker is pointing at — trying a
handful of bearings and distances in the order a person would. (The glass partition in reception was moved for
the same reason: it stood across the view of the counter.) A face drawn on a simple head goes uncanny at arm's
length and reads as a person at the two and a half metres she keeps, which is why she keeps it.

What answers behind her is the rule-based advisor below, and the line under every answer still says where it came
from. A friendly face is not a reason to be less clear about that.

## What she answers from

She names the room, asks what you need, and offers four questions a visitor standing there would really ask. The
answers are **rule-based and say so**. It matches what you type against the clinic's own
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
