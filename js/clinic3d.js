/* The clinic you can walk through.

   Not a 360° photograph like the hotel's tour (js/tour.js) — a real room you stand in, built out of geometry here
   in the page. There is nothing to download: every stone, marble, brushed-metal and plaster surface is drawn on a
   canvas at boot, and the whole clinic is ~45 000 triangles, which a mid-range phone walks through at 50 fps.

   Why built and not photographed: no free 360° photograph of a dermatology clinic exists, and a drawn clinic can be
   relit, rearranged and relabelled by the owner later. The look is Dubai luxury minimalism — warm ivory, champagne
   beige, soft gold, dark taupe — travertine underfoot, cream marble on the counters, glass partitions, and light
   from ceiling coves rather than from lamps you can see.

   The rules this file obeys, because breaking any of them costs frames on a phone:
     · Exactly four lights for the whole visit. three.js bakes the light COUNT into the shader, so adding or hiding
       one when you walk into a room recompiles every program — a half-second freeze. Entering a room moves and
       retints the two pools instead.
     · No shadow maps at all. Corner darkening is baked into vertex colours once at build time; every object that
       stands on the floor gets a warm contact blob, and all the blobs in the clinic are one instanced draw call.
     · One material registry. A room is 6–9 draw calls however many boxes it was modelled from, because everything
       sharing a material is welded into one geometry.
     · Only the room you are in, plus what is genuinely visible through its doorways, is drawn.

   Two ways in:
     startClinic(canvas, { onRoom, onHotspot, onReady })  → the walk.
     ROOMS, SPACE_KEYS                                     → the room list, for the chip bar.

   The owner's own photographs can go on the gallery and doctor walls later: see SCREEN_ART. */
import * as THREE from "./three.module.min.js";

/* ── the clinic, in metres ──────────────────────────────────────────────────────────────────────────────────────
   One storey, rooms as axis-aligned rectangles, a central corridor, reception at the entrance. x runs right,
   z runs towards the entrance, and the camera at yaw 0 looks along −z (deeper into the clinic).

                                   ┌──────────┐
                                   │  دکتر    │            z = −18
                                   └────┬─────┘
            ┌──────────┐           ┌────┴─────┐          ┌──────────┐
            │  لیزر    ├───────────┤          ├──────────┤   مو     │   z = −14 … −9.4
            ├──────────┤           │  راهرو   │          ├──────────┤
            │ آنالیز   ├───────────┤          ├──────────┤  فیشال   │   z = −9.2 … −5.2
            ├──────────┤           │          │          ├──────────┤
            │  پوست    ├───────────┤          ├──────────┤  تزریق   │   z = −5 … −1
            └──────────┘           │          ├──────────┤  نوبت    │   z = −0.8 … 2
                                   └────┬─────┘          └──────────┘
   ┌────────┐  ┌───────────────────────┴────────────────────┐  ┌──────────┐
   │ لانژ   ├──┤                 پذیرش                      ├──┤  گالری   │   z = 2 … 9
   └────────┘  └────────────────────────────────────────────┘  └──────────┘                                     */

const EYE = 1.62;          // eye height: a standing adult, never bobbing
const RADIUS = 0.26;       // how wide the walker is, for collisions
const DOOR_H = 2.2;        // every doorway opening is this tall; the wall above it is a header

/* x, z are the room's CENTRE; w runs along x and d along z. `light` is the per-room rig (see lightRoom). */
export const ROOMS = {
  reception: {
    nameFa: "پذیرش بزرگ", nameEn: "Grand Reception", lineFa: "سنگ تراورتن، مرمر و نور طلایی", icon: "pinI",
    x: 0, z: 5.5, w: 9, d: 7, h: 4.0, spawn: [-0.8, 8.3], yaw: 315,
    floor: "polished", wall: "wall", light: { key: 1.45, hemi: 0.60, a: [0, 3.2, 3.4, 18, 0xFFE2BC], b: [0, 3.2, 7.6, 12, 0xFFEDD6] },
  },
  lounge: {
    nameFa: "لانژ انتظار VIP", nameEn: "VIP Waiting Lounge", lineFa: "مبل‌های نرم و میز سنگی", icon: "heartS",
    x: -7.5, z: 4.5, w: 6, d: 5, h: 3.2, spawn: [-5.2, 4.5], yaw: 90,
    floor: "stone", wall: "wallWarm", light: { key: 1.2, hemi: 0.58, a: [-7.5, 2.6, 3.2, 15, 0xFFE2BC], b: [-7.5, 2.6, 6, 10, 0xFFEDD6] },
  },
  gallery: {
    nameFa: "گالری درمان‌ها", nameEn: "Treatment Gallery", lineFa: "قبل و بعد، با اجازه‌ی مراجعه‌کننده", icon: "tagO",
    x: 7.25, z: 4.5, w: 5.5, d: 5, h: 3.2, spawn: [5.2, 4.5], yaw: 270,
    floor: "stone", wall: "wall", light: { key: 1.0, hemi: 0.52, a: [7.25, 2.7, 3.0, 16, 0xFFE8CC], b: [7.25, 2.7, 6.2, 14, 0xFFE8CC] },
  },
  corridor: {
    nameFa: "راهرو", nameEn: "Corridor", lineFa: "به اتاق‌های درمان", icon: "chev",
    x: 0, z: -6, w: 2.6, d: 16, h: 3.0, spawn: [0, 1.2], yaw: 0,
    floor: "stone", wall: "wall", light: { key: 0.75, hemi: 0.50, a: [0, 2.6, -2, 11, 0xFFE6C6], b: [0, 2.6, -11, 7, 0xFFEDD6] },
  },
  booking: {
    nameFa: "نوبت و تماس", nameEn: "Appointment & Contact", lineFa: "همین‌جا وقت بگیرید", icon: "calO",
    x: 3.55, z: 0.6, w: 4.5, d: 2.8, h: 3.0, spawn: [2.1, 0.6], yaw: 270,
    floor: "stone", wall: "wallWarm", light: { key: 1.0, hemi: 0.54, a: [3.55, 2.5, 0.6, 14, 0xFFE8CC], b: [5.4, 2.5, 0.6, 8, 0xFFEDD6] },
  },
  derm: {
    nameFa: "مشاوره‌ی پوست", nameEn: "Dermatology Consultation", lineFa: "میز دکتر و نمایشگر پوست", icon: "consultS",
    x: -3.55, z: -3, w: 4.5, d: 4, h: 3.0, spawn: [-1.9, -3], yaw: 90,
    floor: "stone", wall: "wall", light: { key: 0.7, hemi: 0.48, a: [-3.55, 2.5, -3, 18, 0xFFF2E2], b: [-5.2, 2.5, -4.2, 6, 0xFFE2BC] },
  },
  inject: {
    nameFa: "مشاوره‌ی تزریق", nameEn: "Injectable Consultation", lineFa: "فضایی آرام و خصوصی", icon: "syringe",
    x: 3.55, z: -3, w: 4.5, d: 4, h: 3.0, spawn: [1.9, -3], yaw: 270,
    floor: "stone", wall: "wallWarm", light: { key: 0.65, hemi: 0.46, a: [3.55, 2.5, -3, 18, 0xFFF2E2], b: [5.2, 2.5, -1.8, 6, 0xFFE2BC] },
  },
  analysis: {
    nameFa: "آنالیز پیشرفته‌ی پوست", nameEn: "Advanced Skin Analysis", lineFa: "دستگاه آنالیز و نمایشگر بزرگ", icon: "spark",
    x: -3.55, z: -7.2, w: 4.5, d: 4, h: 3.0, spawn: [-1.9, -7.2], yaw: 90,
    floor: "stone", wall: "wallWarm", light: { key: 0.6, hemi: 0.45, a: [-3.55, 2.5, -7.2, 20, 0xFFF2E2], b: [-5.2, 2.5, -8.4, 6, 0xFFE2BC] },
  },
  facial: {
    nameFa: "فیشال و جوان‌سازی", nameEn: "Facial & Rejuvenation", lineFa: "تخت درمان و نور ملایم", icon: "cleanI",
    x: 3.55, z: -7.2, w: 4.5, d: 4, h: 3.0, spawn: [1.9, -7.2], yaw: 270,
    floor: "stone", wall: "wall", light: { key: 0.55, hemi: 0.45, a: [3.55, 2.5, -7.2, 22, 0xFFF2E2], b: [5.2, 2.5, -6, 6, 0xFFE2BC] },
  },
  laser: {
    nameFa: "اتاق لیزر", nameEn: "Laser Treatment", lineFa: "دستگاه لیزر و تخت درمان", icon: "laserI",
    x: -3.55, z: -11.7, w: 4.5, d: 4.6, h: 3.0, spawn: [-1.9, -11.7], yaw: 90,
    floor: "stone", wall: "wall", light: { key: 0.55, hemi: 0.44, a: [-3.55, 2.5, -11.7, 22, 0xFFF2E2], b: [-5.2, 2.5, -13, 6, 0xFFE2BC] },
  },
  hair: {
    nameFa: "احیای مو", nameEn: "Hair Restoration", lineFa: "آنالیز پوست سر و مشاوره", icon: "mesoI",
    x: 3.55, z: -11.7, w: 4.5, d: 4.6, h: 3.0, spawn: [1.9, -11.7], yaw: 270,
    floor: "stone", wall: "wallWarm", light: { key: 0.6, hemi: 0.46, a: [3.55, 2.5, -11.7, 20, 0xFFF2E2], b: [5.2, 2.5, -10.4, 6, 0xFFE2BC] },
  },
  doctor: {
    nameFa: "دفتر دکتر", nameEn: "Doctor's Office", lineFa: "دکترهای کلینیک", icon: "doctorI",
    x: 0, z: -16, w: 5, d: 4, h: 3.0, spawn: [0, -14.6], yaw: 0,
    floor: "stone", wall: "wallWarm", light: { key: 0.9, hemi: 0.52, a: [0, 2.5, -16, 16, 0xFFE8CC], b: [0, 2.5, -17.4, 9, 0xFFEDD6] },
  },
};

/* Every doorway: the two spaces it joins, its centre, how wide it is, and which axis the opening runs along.
   `axis:"z"` is a gap in a wall at constant x (you walk through it sideways on the map); `axis:"x"` the other way. */
export const DOORS = [
  { a: "reception", b: "corridor", x: 0, z: 2, w: 2.6, axis: "x", glass: false, labelFa: "راهرو و اتاق‌ها" },
  { a: "reception", b: "lounge", x: -4.5, z: 4.5, w: 1.8, axis: "z", glass: true, labelFa: "لانژ انتظار" },
  { a: "reception", b: "gallery", x: 4.5, z: 4.5, w: 1.8, axis: "z", glass: true, labelFa: "گالری درمان‌ها" },
  { a: "corridor", b: "booking", x: 1.3, z: 0.6, w: 1.6, axis: "z", glass: true, labelFa: "نوبت و تماس" },
  { a: "corridor", b: "derm", x: -1.3, z: -3, w: 1.5, axis: "z", glass: false, labelFa: "مشاوره‌ی پوست" },
  { a: "corridor", b: "inject", x: 1.3, z: -3, w: 1.5, axis: "z", glass: false, labelFa: "مشاوره‌ی تزریق" },
  { a: "corridor", b: "analysis", x: -1.3, z: -7.2, w: 1.5, axis: "z", glass: false, labelFa: "آنالیز پوست" },
  { a: "corridor", b: "facial", x: 1.3, z: -7.2, w: 1.5, axis: "z", glass: false, labelFa: "فیشال" },
  { a: "corridor", b: "laser", x: -1.3, z: -11.7, w: 1.5, axis: "z", glass: false, labelFa: "اتاق لیزر" },
  { a: "corridor", b: "hair", x: 1.3, z: -11.7, w: 1.5, axis: "z", glass: false, labelFa: "احیای مو" },
  { a: "corridor", b: "doctor", x: 0, z: -14, w: 1.6, axis: "x", glass: false, labelFa: "دفتر دکتر" },
];

/* The order the chip bar shows them, and the order the guided walk visits them. */
export const SPACE_KEYS = ["reception", "lounge", "derm", "analysis", "laser", "facial", "hair", "inject",
                           "doctor", "gallery", "booking"];
export const spaceInfo = (k) => ({ key: k, ...ROOMS[k] });

/* Where the guide will stand, in the order she tries them: [how far ahead, how far to the side]. The first is
   the one that composes best — a conversation's distance, a little off centre so she is beside what you came to
   look at. The rest are what you do when someone is standing behind a pillar. */
const GUIDE_SPOTS = [
  [3.0, .55], [3.0, -.55], [2.6, 1.0], [2.6, -1.0], [3.2, .15], [3.2, -.15],
  [2.2, .7], [2.2, -.7], [1.9, .3], [1.9, -.3],
];

const RAD = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const rect = (r) => ({ x0: r.x - r.w / 2, x1: r.x + r.w / 2, z0: r.z - r.d / 2, z1: r.z + r.d / 2 });

/* ── the surfaces, drawn on canvases at boot ────────────────────────────────────────────────────────────────────
   Nothing is fetched. A tiled canvas is what stops a 6 m wall reading as flat colour — the single loudest tell
   that a scene was built rather than photographed. */

// Draw the same list nine times, offset by ±size, so no shape is clipped at the tile edge and the tile is seamless.
// The list is built BEFORE wrapping: randomising inside the loop would put a different shape on each copy.
function wrap(x, s, drawAll) {
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { x.save(); x.translate(i * s, j * s); drawAll(); x.restore(); }
}

function travertineCanvas(s = 512) {
  const c = document.createElement("canvas"); c.width = c.height = s;
  const x = c.getContext("2d");
  x.fillStyle = "#C8C2B6"; x.fillRect(0, 0, s, s);
  const bands = Array.from({ length: 90 }, () => ({ cx: Math.random() * s, cy: Math.random() * s,
    rx: s * (.25 + Math.random() * .5), ry: 2 + Math.random() * 14, light: Math.random() < .5 }));
  const pores = Array.from({ length: 260 }, () => ({ cx: Math.random() * s, cy: Math.random() * s,
    r: .8 + Math.random() * 2.6, k: 1.6 + Math.random() }));
  wrap(x, s, () => bands.forEach((b) => {                       // sedimentary bedding, stretched sideways
    x.fillStyle = b.light ? "rgba(214,207,195,.22)" : "rgba(164,159,149,.16)";
    x.beginPath(); x.ellipse(b.cx, b.cy, b.rx, b.ry, 0, 0, 6.2832); x.fill();
  }));
  wrap(x, s, () => pores.forEach((p) => {                       // the pitting travertine is known for
    x.fillStyle = "rgba(138,131,120,.30)";
    x.beginPath(); x.ellipse(p.cx, p.cy, p.r * p.k, p.r, 0, 0, 6.2832); x.fill();
  }));
  return c;
}

function marbleCanvas(s = 512) {
  const c = document.createElement("canvas"); c.width = c.height = s;
  const x = c.getContext("2d");
  x.fillStyle = "#E7E4DE"; x.fillRect(0, 0, s, s);
  x.lineCap = "round"; x.lineJoin = "round";
  // A vein enters at x=0 and leaves at x=s on the same y, so the seam across U is invisible.
  const vein = (y0, w, col, steps) => {
    x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(0, y0);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, drift = Math.sin(t * 7.3 + y0) * 26 * Math.sin(Math.PI * t);
      x.lineTo(t * s, y0 + drift + (Math.random() - .5) * 6);
    }
    x.stroke();
  };
  for (let i = 0; i < 4; i++) {
    const y0 = (i + .5) * s / 4 + (Math.random() - .5) * 40;
    vein(y0, 2.2, "rgba(151,138,116,.55)", 26);
    for (let k = 0; k < 3; k++) vein(y0 + (Math.random() - .5) * 30, .7, "rgba(137,122,107,.30)", 22);
  }
  return c;
}

// three.js has no anisotropic highlight, so brushed metal is faked: full-width 1 px scratches in the roughness
// map (seamless by construction) plus stretched UVs, which smears the reflection along the grain.
function brushedCanvas(s = 256, base = .34) {
  const c = document.createElement("canvas"); c.width = c.height = s;
  const x = c.getContext("2d"), v = Math.round(base * 255);
  x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(0, 0, s, s);
  for (let i = 0; i < s * 3; i++) {
    const y = Math.random() * s, a = .05 + Math.random() * .14;
    x.strokeStyle = Math.random() < .5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    x.lineWidth = Math.random() < .8 ? 1 : 2;
    x.beginPath(); x.moveTo(0, y); x.lineTo(s, y + (Math.random() - .5) * 1.5); x.stroke();
  }
  return c;
}

function toothCanvas(s = 256) {
  const c = document.createElement("canvas"); c.width = c.height = s;
  const x = c.getContext("2d"), img = x.createImageData(s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) {                       // fine plaster grain, seamless by nature
    const n = 128 + (Math.random() - .5) * 46;
    d[i] = d[i + 1] = d[i + 2] = n; d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  for (let i = 0; i < 14; i++) {                                // a trowel sweep, so it is not flat noise
    const r = s * (.18 + Math.random() * .3), gx = Math.random() * s, gy = Math.random() * s;
    const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0, "rgba(255,255,255,.10)"); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, s, s);
  }
  return c;
}

// grey height → tangent-space normal map, wrapping at the edges (Sobel; 256² is about 5 ms)
function normalFromHeight(h, strength = 1.4) {
  const s = h.width, src = h.getContext("2d").getImageData(0, 0, s, s).data;
  const out = document.createElement("canvas"); out.width = out.height = s;
  const oc = out.getContext("2d"), img = oc.createImageData(s, s), d = img.data;
  const at = (px, py) => src[(((py + s) % s) * s + ((px + s) % s)) * 4];
  for (let y = 0; y < s; y++) for (let px = 0; px < s; px++) {
    const dx = (at(px + 1, y) - at(px - 1, y)) / 255 * strength;
    const dy = (at(px, y + 1) - at(px, y - 1)) / 255 * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * s + px) * 4;
    d[i] = (-dx / l * .5 + .5) * 255; d[i + 1] = (dy / l * .5 + .5) * 255;
    d[i + 2] = (1 / l * .5 + .5) * 255; d[i + 3] = 255;
  }
  oc.putImageData(img, 0, 0);
  return out;
}

// The warm blob every object stands on. A floating object is the most immediate "cheap 3D" tell, and the fix is
// two triangles. Warm taupe, never grey or black.
function blobCanvas() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(81,72,63,.85)"); g.addColorStop(.45, "rgba(81,72,63,.38)"); g.addColorStop(1, "rgba(81,72,63,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return c;
}

// The light a ceiling cove throws down the wall. Additive, so it brightens rather than paints.
function spillCanvas() {
  const c = document.createElement("canvas"); c.width = 4; c.height = 128;
  const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "rgba(255,241,220,.55)"); g.addColorStop(.45, "rgba(255,235,205,.16)"); g.addColorStop(1, "rgba(255,230,195,0)");
  x.fillStyle = g; x.fillRect(0, 0, 4, 128);
  return c;
}

/* A wall screen. Text is drawn with the page's own Vazirmatn, so the screens speak Persian like the rest of the app.
   The owner's own photographs can replace these: give SCREEN_ART an image and it is drawn instead. */
export const SCREEN_ART = {};
function screenCanvas(title, lines, accent = "#B89A68") {
  const c = document.createElement("canvas"); c.width = 512; c.height = 288;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, 288);
  g.addColorStop(0, "#1C1813"); g.addColorStop(1, "#2A241C");
  x.fillStyle = g; x.fillRect(0, 0, 512, 288);
  x.strokeStyle = accent; x.globalAlpha = .55; x.lineWidth = 2; x.strokeRect(18, 18, 476, 252); x.globalAlpha = 1;
  x.direction = "rtl"; x.textAlign = "right";
  x.fillStyle = "#F8F5EF"; x.font = "600 34px Vazirmatn, system-ui, sans-serif";
  x.fillText(title, 462, 86);
  x.fillStyle = accent; x.fillRect(372, 104, 90, 3);
  x.fillStyle = "#D8C5A5"; x.font = "400 21px Vazirmatn, system-ui, sans-serif";
  lines.forEach((t, i) => x.fillText(t, 462, 150 + i * 34));
  return c;
}

function makeTextures(renderer) {
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const tex = (canvas, { srgb = false, mips = true } = {}) => {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.generateMipmaps = mips;                                   // a floor seen at a grazing angle shimmers without
    t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    t.anisotropy = aniso;
    return t;
  };
  return {
    travertine: tex(travertineCanvas(512), { srgb: true }),
    travertineN: tex(normalFromHeight(travertineCanvas(256), 1.1)),
    marble: tex(marbleCanvas(512), { srgb: true }),
    toothN: tex(normalFromHeight(toothCanvas(256), 1.4)),
    brushed: tex(brushedCanvas(256)),
    // The big flat boxes — counters, desks, plinths — had no surface at all, which is most of what read as
    // cartoon. Run through the normal map, the brushed canvas becomes a fine linear grain.
    grainN: tex(normalFromHeight(brushedCanvas(256, .5), .7)),
    blob: tex(blobCanvas(), { srgb: true, mips: false }),
    spill: tex(spillCanvas(), { srgb: true, mips: false }),
  };
}

/* ── the materials ─────────────────────────────────────────────────────────────────────────────────────────────
   One instance each, shared by every room: the weld in mergeByMaterial() groups on material identity, so a
   per-mesh `new MeshStandardMaterial` would multiply the draw calls by the number of boxes.
   Every pale albedo is its palette colour multiplied down (×0.84–0.96), because light adds on top of albedo and
   an un-darkened ivory wall blows out to white. Metals keep their hex: a metal's colour IS its reflectance. */
function makeMaterials(T) {
  const S = THREE.FrontSide, D = THREE.DoubleSide;
  const v2 = (a, b) => new THREE.Vector2(a, b);
  return {
    // Honed, not wet: .36 keeps the grain visible and still gives the long soft sheen a stone floor has.
    floorStone: new THREE.MeshStandardMaterial({ color: 0xC8C2B6, roughness: .36, metalness: 0, envMapIntensity: .85,
      side: S, map: T.travertine, normalMap: T.travertineN, normalScale: v2(.5, .5), roughnessMap: T.travertine, vertexColors: true }),
    floorPolished: new THREE.MeshStandardMaterial({ color: 0xC8C2B6, roughness: .16, metalness: 0, envMapIntensity: 1.05,
      side: S, map: T.travertine, vertexColors: true }),
    marble: new THREE.MeshStandardMaterial({ color: 0xE7E4DE, roughness: .13, metalness: 0, envMapIntensity: .95,
      side: S, map: T.marble, vertexColors: true }),
    metal: new THREE.MeshStandardMaterial({ color: 0xD8C5A5, roughness: .28, metalness: 1, envMapIntensity: 1.55,
      side: S, roughnessMap: T.brushed }),
    // No `transmission`: it adds a full-resolution render-target pass every frame. The brushed edge strip, not the
    // body, is what makes a glass partition read as glass.
    glass: new THREE.MeshPhysicalMaterial({ color: 0xE8EFEE, roughness: .05, metalness: 0, ior: 1.5,
      transparent: true, opacity: .16, depthWrite: false, side: D, envMapIntensity: 1.6 }),
    wood: new THREE.MeshPhysicalMaterial({ color: 0x5E4B38, roughness: .34, metalness: 0, envMapIntensity: .8,
      side: S, clearcoat: .55, clearcoatRoughness: .14, normalMap: T.grainN, normalScale: v2(.3, .3), vertexColors: true }),
    // At .35 the tooth is a texture nobody can see. At .62, with the environment no longer turned down to a
    // quarter, plaster reads as plaster across a whole wall instead of as a flat fill.
    wall: new THREE.MeshStandardMaterial({ color: 0xEEEBE5, roughness: .84, metalness: 0, envMapIntensity: .45,
      side: S, normalMap: T.toothN, normalScale: v2(.62, .62), vertexColors: true }),
    wallWarm: new THREE.MeshStandardMaterial({ color: 0xE9E4DB, roughness: .84, metalness: 0, envMapIntensity: .45,
      side: S, normalMap: T.toothN, normalScale: v2(.62, .62), vertexColors: true }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xFAF8F4, roughness: .86, metalness: 0, envMapIntensity: .38,
      side: S, vertexColors: true }),
    gold: new THREE.MeshStandardMaterial({ color: 0xB89A68, roughness: .17, metalness: 1, envMapIntensity: 1.75, side: S }),
    joinery: new THREE.MeshPhysicalMaterial({ color: 0x51483F, roughness: .4, metalness: 0, envMapIntensity: .75,
      side: S, clearcoat: .55, clearcoatRoughness: .16, normalMap: T.grainN, normalScale: v2(.22, .22), vertexColors: true }),
    fabric: new THREE.MeshStandardMaterial({ color: 0xD1C7B6, roughness: .78, metalness: 0, envMapIntensity: .5,
      side: S, normalMap: T.toothN, normalScale: v2(.3, .3), vertexColors: true }),
    // toneMapped:false keeps a cove strip at full value, so it reads as a light and not as painted plastic.
    cove: new THREE.MeshBasicMaterial({ color: 0xFFF1DC, toneMapped: false, fog: false }),
    bezel: new THREE.MeshStandardMaterial({ color: 0x3A342D, roughness: .4, metalness: .2, envMapIntensity: .4, side: S }),
    botanical: new THREE.MeshStandardMaterial({ color: 0xCDB78E, roughness: .8, metalness: 0, envMapIntensity: .3, side: D }),
    // the guide. Skin is the one colour here that is not derived from the stone palette, but it is chosen inside
    // the same warm family so she belongs to the room rather than being pasted onto it.
    skin: new THREE.MeshStandardMaterial({ color: 0xD9B493, roughness: .74, metalness: 0, envMapIntensity: .28, side: S }),
    coat: new THREE.MeshStandardMaterial({ color: 0xF0EDE6, roughness: .88, metalness: 0, envMapIntensity: .22, side: S }),
    hair: new THREE.MeshStandardMaterial({ color: 0x3B322A, roughness: .58, metalness: 0, envMapIntensity: .35, side: S }),
    // her trousers and shoes need materials WITHOUT vertexColors: the furniture's materials carry it for their
    // baked corner shading, and a mesh with no colour attribute would be multiplied to black by it.
    trouser: new THREE.MeshStandardMaterial({ color: 0x9C8B77, roughness: .9, metalness: 0, envMapIntensity: .2, side: S }),
    shoe: new THREE.MeshStandardMaterial({ color: 0x4A4038, roughness: .45, metalness: 0, envMapIntensity: .45, side: S }),
  };
}

/* ── geometry helpers ─────────────────────────────────────────────────────────────────────────────────────── */

// One texture, many tile sizes: bake the scale into the UVs instead of cloning the texture (a clone is a second
// GPU upload). Tile sizes in metres, so every surface in the clinic shares one texel density.
function tileUV(geo, sx, sy, ox = Math.random(), oy = Math.random()) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx + ox, uv.getY(i) * sy + oy);
  uv.needsUpdate = true;
  return geo;
}

const SEG = 0.5;   // a vertex every half metre: without subdivision there is nothing for the baked AO to shade
const plane = (w, h) => new THREE.PlaneGeometry(w, h, Math.max(1, Math.ceil(w / SEG)), Math.max(1, Math.ceil(h / SEG)));

// Corner darkening, floor contact and large-scale unevenness, baked into vertex colours once. Free at render time,
// and it is what keeps eleven rooms from looking like one room lit by one lamp.
function bakeAO(geo, box, { floorFade = .9, cornerFade = 1.1, min = .62 } = {}) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const dy = Math.min(y - box.min.y, box.max.y - y);
    const dw = Math.min(x - box.min.x, box.max.x - x, z - box.min.z, box.max.z - z);
    let k = (.55 + .45 * Math.min(1, dy / floorFade))
          * (.70 + .30 * Math.min(1, dw / cornerFade))
          * (.88 + .12 * Math.max(0, n ? n.getY(i) : 0));
    k = Math.max(min, k);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

// Weld every mesh that shares a material into one geometry. BufferGeometryUtils is not vendored, and this is all
// the clinic needs: position, normal and uv, no indices, no morph targets.
function mergeByMaterial(meshes) {
  const groups = new Map();
  for (const m of meshes) {
    m.updateMatrixWorld(true);
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    let list = groups.get(m.material); if (!list) groups.set(m.material, list = []);
    list.push(g);
  }
  const out = [];
  for (const [mat, list] of groups) {
    const total = list.reduce((n, g) => n + g.attributes.position.count, 0);
    const merged = new THREE.BufferGeometry();
    for (const k of ["position", "normal", "uv"]) {
      if (!list.every((g) => g.attributes[k])) continue;
      const size = list[0].attributes[k].itemSize, arr = new Float32Array(total * size);
      let o = 0;
      for (const g of list) { arr.set(g.attributes[k].array, o); o += g.attributes[k].count * size; }
      merged.setAttribute(k, new THREE.BufferAttribute(arr, size));
    }
    merged.computeBoundingSphere(); merged.computeBoundingBox();
    list.forEach((g) => g.dispose());
    out.push(new THREE.Mesh(merged, mat));
  }
  return out;
}

/* ── the kit the rooms are furnished from ──────────────────────────────────────────────────────────────────────
   Measured, not guessed: a counter 1.05 high, a chair seat 0.44, a treatment bed 0.78 × 0.75 × 2.0, a shadow gap
   0.02. Cartoon proportions are the second loudest tell after flat walls.
   Each helper pushes {geo, mat} parts into `out`, and a solid box into `solids` if the walker should bump into it. */
function kit(M) {
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const put = (out, geo, mat, x, y, z, rotY = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); if (rotY) m.rotation.y = rotY * RAD;
    out.push(m); return m;
  };
  const solid = (solids, x, z, w, d, h = 1.2) => solids.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h });

  return {
    put, solid, box,

    // a counter: marble top on a taupe body with a champagne reveal and a gold shadow-gap line
    counter(out, solids, blobs, x, z, w, rotY = 0) {
      const d = .65;
      const bodyW = rotY % 180 === 0 ? w : d, bodyD = rotY % 180 === 0 ? d : w;
      put(out, box(w, 1.0, d), M.joinery, x, .50, z, rotY);
      put(out, tileUV(box(w + .08, .05, d + .08), w / 1.6, 1), M.marble, x, 1.03, z, rotY);
      put(out, box(w - .1, .06, .02), M.metal, x, .18, z + (rotY ? 0 : d / 2 + .01), rotY);
      put(out, box(w - .3, .012, .012), M.gold, x, .92, z + (rotY ? 0 : d / 2 + .02), rotY);
      solid(solids, x, z, bodyW, bodyD);
      blobs.push([x, z, bodyW + .5, bodyD + .5]);
    },

    // a consulting desk with a slim gold edge
    desk(out, solids, blobs, x, z, rotY = 0) {
      const w = 1.6, d = .72;
      put(out, tileUV(box(w, .05, d), 1, 1), M.wood, x, .74, z, rotY);
      put(out, box(.08, .72, d - .1), M.joinery, x - (rotY ? 0 : w / 2 - .12), .36, z + (rotY ? w / 2 - .12 : 0), rotY);
      put(out, box(.08, .72, d - .1), M.joinery, x + (rotY ? 0 : w / 2 - .12), .36, z - (rotY ? w / 2 - .12 : 0), rotY);
      put(out, box(w, .014, .014), M.gold, x, .765, z + (rotY ? 0 : d / 2), rotY);
      solid(solids, x, z, rotY ? d : w, rotY ? w : d, .8);
      blobs.push([x, z, (rotY ? d : w) + .4, (rotY ? w : d) + .4]);
    },

    chair(out, solids, blobs, x, z, rotY = 0) {
      put(out, box(.46, .07, .46), M.fabric, x, .44, z, rotY);
      put(out, box(.46, .5, .07), M.fabric, x, .68, z, rotY).translateZ(-.2);
      for (const [dx, dz] of [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]])
        put(out, box(.035, .42, .035), M.metal, x + dx, .21, z + dz, rotY);
      solid(solids, x, z, .5, .5, .9);
      blobs.push([x, z, .8, .8]);
    },

    sofa(out, solids, blobs, x, z, w, rotY = 0) {
      const d = .9;
      put(out, box(w, .34, d), M.fabric, x, .34, z, rotY);
      put(out, box(w, .44, .18), M.fabric, x, .70, z, rotY).translateZ(-d / 2 + .09);
      put(out, box(.18, .5, d), M.fabric, x, .55, z, rotY).translateX(-w / 2 + .09);
      put(out, box(.18, .5, d), M.fabric, x, .55, z, rotY).translateX(w / 2 - .09);
      put(out, box(w - .1, .06, d - .1), M.joinery, x, .12, z, rotY);
      solid(solids, x, z, rotY % 180 ? d : w, rotY % 180 ? w : d, 1);
      blobs.push([x, z, (rotY % 180 ? d : w) + .4, (rotY % 180 ? w : d) + .4]);
    },

    // the treatment bed every clinical room has: a leather pad on a champagne base
    bed(out, solids, blobs, x, z, rotY = 0) {
      put(out, box(.75, .1, 2.0), M.fabric, x, .78, z, rotY);
      put(out, box(.75, .08, .5), M.fabric, x, .86, z, rotY).translateZ(-.78);   // raised head
      put(out, box(.5, .62, 1.1), M.metal, x, .40, z, rotY);
      put(out, box(.7, .014, 1.9), M.gold, x, .835, z, rotY);
      solid(solids, x, z, rotY % 180 ? 2.0 : .75, rotY % 180 ? .75 : 2.0, .95);
      blobs.push([x, z, (rotY % 180 ? 2.0 : .75) + .45, (rotY % 180 ? .75 : 2.0) + .45]);
    },

    // a wall screen: bezel, lit face, and a gold hairline under it
    screen(out, x, y, z, rotY, w, h, title, lines) {
      const art = SCREEN_ART[title];
      const t = new THREE.CanvasTexture(art || screenCanvas(title, lines));
      t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
      const face = new THREE.MeshBasicMaterial({ map: t, toneMapped: false, fog: false, side: THREE.FrontSide });
      put(out, box(w + .06, h + .06, .04), M.bezel, x, y, z, rotY);
      const m = put(out, new THREE.PlaneGeometry(w, h), face, x, y, z, rotY);
      m.translateZ(.025);
      put(out, box(w, .012, .012), M.gold, x, y - h / 2 - .06, z, rotY).translateZ(.02);
      return m;
    },

    // floor-to-ceiling joinery: a slatted wood screen, the quiet luxury move
    slats(out, x, z, w, h, rotY = 0) {
      const n = Math.max(2, Math.round(w / .12));
      for (let i = 0; i < n; i++)
        put(out, box(.05, h, .05), M.wood, x - w / 2 + (i + .5) * (w / n), h / 2, z, rotY);
    },

    planter(out, solids, blobs, x, z, soft) {
      put(out, new THREE.CylinderGeometry(.19, .15, .42, 10), M.marble, x, .21, z);
      put(out, box(.012, .012, .38), M.gold, x, .42, z);
      // dried palm and bleached branches: the Dubai reference, and no green anywhere
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * 360;
        const leaf = put(out, new THREE.PlaneGeometry(.1, .62), M.botanical, x, .72, z, a);
        leaf.rotation.z = (i % 2 ? .22 : -.22); leaf.translateY(.1);
      }
      if (!soft) solid(solids, x, z, .4, .4, .5);
      blobs.push([x, z, .64, .64]);
    },

    // the equipment arm the laser and analysis rooms are built around. No brand, no model, no invented spec.
    machine(out, solids, blobs, x, z, rotY = 0) {
      put(out, box(.5, .9, .4), M.metal, x, .45, z, rotY);
      put(out, box(.44, .04, .34), M.gold, x, .92, z, rotY);
      put(out, new THREE.CylinderGeometry(.045, .045, 1.0, 8), M.metal, x, 1.42, z);
      const arm = put(out, box(.07, .07, .8), M.metal, x, 1.88, z, rotY); arm.translateZ(.3);
      const head = put(out, box(.16, .12, .22), M.joinery, x, 1.82, z, rotY); head.translateZ(.66);
      solid(solids, x, z, .6, .5, 1);
      blobs.push([x, z, .95, .85]);
    },

    // A glass partition in a brushed frame. The edge, not the body, is what makes glass read as glass.
    partition(out, solids, x, z, len, h, rotY = 0) {
      const sx = rotY % 180 ? .04 : len, sz = rotY % 180 ? len : .04;
      put(out, box(sx, h - .1, sz), M.glass, x, (h - .1) / 2 + .05, z);
      put(out, box(rotY % 180 ? .07 : len, .07, rotY % 180 ? len : .07), M.metal, x, .035, z);      // sill
      put(out, box(rotY % 180 ? .07 : len, .05, rotY % 180 ? len : .07), M.metal, x, h - .02, z);   // head
      for (const e of [-1, 1]) {
        const ox = rotY % 180 ? 0 : e * len / 2, oz = rotY % 180 ? e * len / 2 : 0;
        put(out, box(.07, h, .07), M.metal, x + ox, h / 2, z + oz);
      }
      solids.push({ x0: x - sx / 2 - .03, x1: x + sx / 2 + .03, z0: z - sz / 2 - .03, z1: z + sz / 2 + .03, h });
    },

    shelf(out, solids, blobs, x, z, w, rotY = 0) {
      for (let i = 0; i < 3; i++) put(out, tileUV(box(w, .04, .26), w / 1.6, 1), M.marble, x, .7 + i * .48, z, rotY);
      put(out, box(.05, 1.7, .28), M.joinery, x - (rotY ? 0 : w / 2), .85, z + (rotY ? w / 2 : 0), rotY);
      put(out, box(.05, 1.7, .28), M.joinery, x + (rotY ? 0 : w / 2), .85, z - (rotY ? w / 2 : 0), rotY);
      // bottles, as plain cylinders: a retail wall with nothing on it reads as unfinished
      for (let i = 0; i < 3; i++) for (let j = 0; j < Math.floor(w / .22); j++) {
        const o = -w / 2 + .14 + j * .22;
        put(out, new THREE.CylinderGeometry(.035, .035, .16, 7), j % 3 ? M.marble : M.metal,
            x + (rotY ? 0 : o), .8 + i * .48, z + (rotY ? o : 0));
      }
      solid(solids, x, z, rotY ? .3 : w, rotY ? w : .3, 1.8);
    },
  };
}

/* ── building one room ─────────────────────────────────────────────────────────────────────────────────────────
   Walls are single inward-facing planes, not a box with BackSide: half the fragment work, and the portal cull
   below assumes a room is sealed except at its doorways. */

// The gaps a wall has to leave. Returns [[from,to], …] along the wall's own axis.
function segmentsOf(from, to, gaps) {
  let out = [[from, to]];
  for (const [g0, g1] of gaps) {
    const next = [];
    for (const [a, b] of out) {
      if (g1 <= a || g0 >= b) { next.push([a, b]); continue; }
      if (g0 > a) next.push([a, g0]);
      if (g1 < b) next.push([g1, b]);
    }
    out = next;
  }
  return out.filter(([a, b]) => b - a > .02);
}

function buildRoom(key, M, K) {
  const r = ROOMS[key], R = rect(r);
  const parts = [], solids = [], blobs = [], screens = [];
  const wallMat = M[r.wall] || M.wall;
  const box3 = new THREE.Box3(new THREE.Vector3(R.x0, 0, R.z0), new THREE.Vector3(R.x1, r.h, R.z1));

  // floor and ceiling
  const fl = new THREE.Mesh(tileUV(plane(r.w, r.d), r.w / 1.2, r.d / 1.2), r.floor === "polished" ? M.floorPolished : M.floorStone);
  fl.rotation.x = -Math.PI / 2; fl.position.set(r.x, 0, r.z); parts.push(fl);
  const ce = new THREE.Mesh(plane(r.w, r.d), M.ceiling);
  ce.rotation.x = Math.PI / 2; ce.position.set(r.x, r.h, r.z); parts.push(ce);

  // the four walls, with a gap at every doorway and a header above it
  const mine = DOORS.filter((d) => d.a === key || d.b === key);
  const wall = (axis, at, facing) => {
    // axis "x": a wall at constant z spanning x. axis "z": a wall at constant x spanning z.
    const [lo, hi] = axis === "x" ? [R.x0, R.x1] : [R.z0, R.z1];
    const gaps = mine.filter((d) => d.axis === axis && Math.abs((axis === "x" ? d.z : d.x) - at) < .01)
                     .map((d) => [(axis === "x" ? d.x : d.z) - d.w / 2, (axis === "x" ? d.x : d.z) + d.w / 2]);
    for (const [a, b] of segmentsOf(lo, hi, gaps)) {
      const w = b - a, c = (a + b) / 2;
      const g = tileUV(plane(w, r.h), w / .6, r.h / .6);
      const m = new THREE.Mesh(g, wallMat);
      if (axis === "x") { m.position.set(c, r.h / 2, at); m.rotation.y = facing > 0 ? 0 : Math.PI; }
      else { m.position.set(at, r.h / 2, c); m.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2; }
      parts.push(m);
    }
    // the header over each doorway, so you do not see sky through the top of a door
    for (const [a, b] of gaps) {
      const w = b - a, c = (a + b) / 2, hh = r.h - DOOR_H;
      if (hh <= .02) continue;
      const m = new THREE.Mesh(tileUV(plane(w, hh), w / .6, hh / .6), wallMat);
      if (axis === "x") { m.position.set(c, DOOR_H + hh / 2, at); m.rotation.y = facing > 0 ? 0 : Math.PI; }
      else { m.position.set(at, DOOR_H + hh / 2, c); m.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2; }
      parts.push(m);
    }
    // a champagne reveal down each doorway edge: the detail that makes an opening look built
    for (const [a, b] of gaps) for (const e of [a, b]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(.06, DOOR_H, .06), M.metal);
      m.position.set(axis === "x" ? e : at, DOOR_H / 2, axis === "x" ? at : e);
      parts.push(m);
    }
  };
  wall("x", R.z0, 1); wall("x", R.z1, -1); wall("z", R.x0, 1); wall("z", R.x1, -1);

  // the ceiling cove: a thin unlit strip in a recess, with an additive spill down the wall under it
  const coveRuns = r.w > r.d ? [[R.x0 + .5, R.x1 - .5, R.z0 + .35, "x"], [R.x0 + .5, R.x1 - .5, R.z1 - .35, "x"]]
                             : [[R.z0 + .5, R.z1 - .5, R.x0 + .35, "z"], [R.z0 + .5, R.z1 - .5, R.x1 - .35, "z"]];
  for (const [a, b, at, axis] of coveRuns) {
    const len = b - a, c = (a + b) / 2;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(axis === "x" ? len : .06, .03, axis === "x" ? .06 : len), M.cove);
    strip.position.set(axis === "x" ? c : at, r.h - .09, axis === "x" ? at : c);
    strip.renderOrder = 1; parts.push(strip);
  }

  return { r, R, box3, parts, solids, blobs, screens, K, M };
}

/* What stands in each room. Kept apart from the shell so the owner can move a bed without touching a wall. */
function furnish(ctx, key) {
  const { r, R, parts: P, solids: S, blobs: B, K, M } = ctx;
  const hot = [];                                        // [key, titleFa, x, y, z, opens]
  const mid = (a, b) => (a + b) / 2;

  if (key === "reception") {
    // the counter along the east side, so the way through to the corridor stays clear
    K.counter(P, S, B, 2.9, 6.0, 3.2, 90);
    K.screen(P, R.x1 - .06, 2.4, 6.0, -90, 2.2, 1.24, "کلینیک زیبایی آرنیک", ["پوست، مو و زیبایی", "خوش آمدید"]);
    hot.push(["intro", "آشنایی با کلینیک", 2.5, 1.3, 6.0, "info"]);
    // the waiting side: two sofas facing each other across a glass partition, west of the walk-through
    K.sofa(P, S, B, -2.9, 7.0, 2.4, 90);
    K.sofa(P, S, B, -2.9, 4.0, 1.8, 90);
    K.partition(P, S, -1.55, 6.2, 2.6, 2.2, 90);   // beside the seating, not across the view of the counter
    K.put(P, new THREE.CylinderGeometry(.38, .34, .34, 12), M.marble, -1.6, .17, 5.6);
    B.push([-1.6, 5.6, .9, .9]);
    // the service directory on the slatted wall, and the booking screen next to it
    K.slats(P, R.x0 + .06, 7.6, 2.0, 3.6, 90);
    K.screen(P, R.x0 + .06, 1.95, 6.0, 90, 1.6, .9, "نوبت امروز", ["مشاوره‌ی اول رایگان است", "۲۰ دقیقه با دکتر"]);
    hot.push(["dir", "فهرست خدمات", R.x0 + .3, 1.6, 7.6, "services"]);
    hot.push(["book", "گرفتن نوبت", R.x0 + .3, 1.6, 6.0, "booking"]);
    K.planter(P, S, B, -4.0, 8.3); K.planter(P, S, B, 4.0, 8.3);
    K.planter(P, S, B, 4.0, 2.7);
  }

  if (key === "lounge") {
    K.sofa(P, S, B, -7.5, 2.9, 2.6, 0);
    K.sofa(P, S, B, R.x0 + 1.0, 4.8, 2.0, 90);
    K.put(P, new THREE.CylinderGeometry(.42, .38, .36, 12), M.marble, -7.5, .18, 4.4);
    B.push([-7.5, 4.4, .98, .98]);
    K.shelf(P, S, B, R.x1 - .2, 6.2, 1.6, -90);          // the refreshment corner
    K.planter(P, S, B, -9.8, 6.6); K.planter(P, S, B, -5.2, 6.6);
    K.screen(P, -7.5, 1.95, R.z0 + .05, 0, 1.9, 1.07, "آسودگی شما", ["بخشی از مراقبت ماست"]);
    hot.push(["comfort", "لانژ انتظار", -7.5, 1.5, 3.2, "info"]);
  }

  if (key === "gallery") {
    // the before/after wall: six framed panels, lit by the cove. Real photographs replace these.
    for (let i = 0; i < 3; i++) {
      const z = 3.0 + i * 1.3;
      K.put(P, K.box(.04, 1.0, 1.0), M.joinery, R.x0 + .05, 1.65, z, 90);
      K.put(P, new THREE.PlaneGeometry(.88, .88), M.marble, R.x0 + .09, 1.65, z, 90);
      K.put(P, K.box(.9, .012, .012), M.gold, R.x0 + .1, 1.12, z, 90);
    }
    K.screen(P, 7.25, 2.0, R.z0 + .05, 0, 2.4, 1.35, "گالری درمان‌ها", ["عکس‌ها فقط با اجازه‌ی مراجعه‌کننده", "و قولِ نتیجه نیستند"]);
    K.shelf(P, S, B, R.x1 - .2, 4.5, 2.2, -90);
    K.planter(P, S, B, 9.4, 6.4);
    hot.push(["gal", "دیدن گالری", 7.25, 1.5, 3.4, "gallery"]);
  }

  if (key === "corridor") {
    K.slats(P, R.x0 + .05, -5.1, 1.2, 2.9, 90);
    K.slats(P, R.x1 - .05, -9.3, 1.2, 2.9, -90);
    K.planter(P, S, B, -0.78, -0.4, true);      // soft: a 2.6 m corridor has no room for a solid one
    K.planter(P, S, B, 0.78, -13.0, true);
  }

  if (key === "booking") {
    K.counter(P, S, B, 3.55, R.z0 + .5, 2.6, 0);
    K.screen(P, 3.55, 2.05, R.z0 + .05, 0, 2.0, 1.12, "نوبت و تماس", ["انتخاب خدمت، دکتر، روز و ساعت", "درخواست نوبت، نه نوبت قطعی"]);
    K.chair(P, S, B, 2.7, 1.6, 180); K.chair(P, S, B, 4.4, 1.6, 180);
    hot.push(["bk", "گرفتن نوبت", 3.55, 1.3, R.z0 + .8, "booking"]);
    hot.push(["call", "تماس و نشانی", 5.2, 1.5, 1.2, "info"]);
  }

  if (key === "derm" || key === "inject") {
    const s = key === "derm" ? -1 : 1;
    K.desk(P, S, B, r.x, r.z - .4, 90);
    K.chair(P, S, B, r.x + s * .9, r.z - .4, 90);                       // the doctor's side
    K.chair(P, S, B, r.x - s * .8, r.z - 1.0, 270); K.chair(P, S, B, r.x - s * .8, r.z + .2, 270);
    K.screen(P, r.x, 1.9, R.z0 + .05, 0, 1.6, .9,
      key === "derm" ? "مشاوره‌ی پوست" : "مشاوره‌ی تزریق",
      key === "derm" ? ["آکنه، جای جوش و لک", "ارزیابی سلامت پوست"] : ["بوتاکس و فیلر", "مشاوره‌ی پزشکی، نه تضمین نتیجه"]);
    K.shelf(P, S, B, r.x + s * 1.9, r.z + 1.2, 1.4, s > 0 ? -90 : 90);
    K.planter(P, S, B, r.x - s * 1.7, R.z1 - .6);
    hot.push([key, ROOMS[key].nameFa, r.x, 1.3, r.z - .4, "services"]);
  }

  if (key === "analysis") {
    K.machine(P, S, B, r.x - 1.1, r.z - .6, 90);
    K.chair(P, S, B, r.x + .5, r.z - .6, 270);
    K.screen(P, r.x, 1.95, R.z0 + .05, 0, 2.2, 1.24, "آنالیز پوست", ["رطوبت، بافت، لک، منافذ، خط‌های ریز", "نمایش آموزشی است، تشخیص پزشکی نیست"]);
    K.shelf(P, S, B, R.x0 + .2, r.z + 1.1, 1.4, 90);
    hot.push(["scan", "نمایش آنالیز پوست", r.x - 1.1, 1.5, r.z - .6, "demo"]);
  }

  if (key === "laser") {
    K.bed(P, S, B, r.x + .2, r.z, 0);
    K.machine(P, S, B, R.x0 + .9, r.z - 1.2, 0);
    K.screen(P, r.x, 1.9, R.z0 + .05, 0, 1.8, 1.01, "اتاق لیزر", ["لیزر موهای زائد", "با عینک محافظ، زیر نظر پزشک"]);
    K.shelf(P, S, B, R.x1 - .2, r.z + 1.4, 1.2, -90);
    hot.push(["laser", "دستگاه لیزر", R.x0 + .9, 1.5, r.z - 1.2, "services"]);
  }

  if (key === "facial") {
    K.bed(P, S, B, r.x - .2, r.z, 0);
    K.put(P, new THREE.CylinderGeometry(.22, .18, .8, 10), M.metal, R.x1 - .9, .4, r.z - 1.3);
    B.push([R.x1 - .9, r.z - 1.3, .72, .72]);
    K.shelf(P, S, B, R.x1 - .2, r.z + 1.3, 1.4, -90);
    K.screen(P, r.x, 1.9, R.z0 + .05, 0, 1.8, 1.01, "فیشال و جوان‌سازی", ["پاکسازی، آبرسانی", "برنامه‌ی مراقبت شخصی"]);
    K.planter(P, S, B, R.x0 + .7, R.z1 - .7);
    hot.push(["facial", "خدمات این اتاق", r.x, 1.3, r.z - 1.0, "services"]);
  }

  if (key === "hair") {
    K.desk(P, S, B, r.x, r.z + .6, 90);
    K.chair(P, S, B, r.x - .9, r.z + .6, 90); K.chair(P, S, B, r.x + .8, r.z + .6, 270);
    K.machine(P, S, B, r.x - .3, r.z - 1.4, 0);
    K.screen(P, r.x, 1.95, R.z0 + .05, 0, 2.0, 1.12, "احیای مو", ["ریزش مو و ارزیابی پوست سر", "برنامه‌ی مراقبت از مو"]);
    hot.push(["hair", "آنالیز پوست سر", r.x - .3, 1.5, r.z - 1.4, "services"]);
  }

  if (key === "doctor") {
    K.desk(P, S, B, 0, r.z + .5, 0);
    K.chair(P, S, B, 0, r.z - .3, 0);
    K.chair(P, S, B, -.8, r.z + 1.4, 180); K.chair(P, S, B, .8, r.z + 1.4, 180);
    // the doctors' wall: a framed portrait each, sample content until the clinic sends its own
    for (let i = 0; i < 3; i++) {
      const x = -1.5 + i * 1.5;
      K.put(P, K.box(.8, 1.0, .04), M.joinery, x, 1.8, R.z0 + .04);
      K.put(P, new THREE.PlaneGeometry(.68, .88), M.marble, x, 1.8, R.z0 + .07);
      K.put(P, K.box(.7, .012, .012), M.gold, x, 1.3, R.z0 + .08);
    }
    K.shelf(P, S, B, R.x1 - .2, r.z - .8, 1.4, -90);
    hot.push(["docs", "دکترهای کلینیک", 0, 1.55, R.z0 + .5, "doctors"]);
  }

  return hot;
}

/* ── the guide ─────────────────────────────────────────────────────────────────────────────────────────────────
   A woman in a clinic coat, 1.7 m tall, built from the same boxes and cylinders as the furniture. She must not
   read as a machine, so there is no screen, no antenna and no glow — only the warm silhouette, dark hair, and a
   face so softly drawn it stays a suggestion at the distance she keeps. At arm's length a drawn face on a simple
   head goes uncanny; at the two and a half metres she stands away it reads as a person, which is the whole point. */
function faceCanvas() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = "#D9B493"; x.fillRect(0, 0, 256, 256);

  // the edges of a face are always in shade; painting that in is what keeps a round head from reading as a ball
  const rim = x.createRadialGradient(128, 132, 60, 128, 132, 140);
  rim.addColorStop(0, "rgba(160,110,82,0)"); rim.addColorStop(1, "rgba(150,100,74,.5)");
  x.fillStyle = rim; x.fillRect(0, 0, 256, 256);
  for (const cx of [72, 184]) {                                   // a little warmth in the cheeks
    const g = x.createRadialGradient(cx, 168, 3, cx, 168, 44);
    g.addColorStop(0, "rgba(201,131,109,.34)"); g.addColorStop(1, "rgba(201,131,109,0)");
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  }

  const eye = (cx) => {
    x.save();
    x.beginPath();                                                // an almond, not a circle
    x.moveTo(cx - 26, 118); x.quadraticCurveTo(cx, 100, cx + 26, 118);
    x.quadraticCurveTo(cx, 134, cx - 26, 118); x.closePath();
    x.fillStyle = "#FBF4EC"; x.fill(); x.clip();
    x.fillStyle = "#4B3826"; x.beginPath(); x.arc(cx, 116, 10.5, 0, 6.2832); x.fill();   // iris
    x.fillStyle = "#1C140D"; x.beginPath(); x.arc(cx, 116, 4.6, 0, 6.2832); x.fill();    // pupil
    x.fillStyle = "rgba(255,255,255,.85)"; x.beginPath(); x.arc(cx - 3.6, 112, 2.6, 0, 6.2832); x.fill();
    x.restore();
    x.strokeStyle = "#3A2B1E"; x.lineWidth = 3.6; x.lineCap = "round";  // the lash line, heavier than the lower lid
    x.beginPath(); x.moveTo(cx - 26, 118); x.quadraticCurveTo(cx, 100, cx + 26, 118); x.stroke();
    x.globalAlpha = .45; x.lineWidth = 2;
    x.beginPath(); x.moveTo(cx - 24, 119); x.quadraticCurveTo(cx, 133, cx + 24, 119); x.stroke();
    x.globalAlpha = 1;
  };
  eye(72); eye(184);

  x.strokeStyle = "#4A3728"; x.lineWidth = 6; x.lineCap = "round"; x.globalAlpha = .62;
  x.beginPath(); x.moveTo(46, 90); x.quadraticCurveTo(72, 78, 98, 88);          // brows
  x.moveTo(158, 88); x.quadraticCurveTo(184, 78, 210, 90); x.stroke();
  x.globalAlpha = .3; x.lineWidth = 4;
  x.beginPath(); x.moveTo(122, 128); x.quadraticCurveTo(118, 158, 130, 166); x.stroke();   // the bridge of the nose
  x.globalAlpha = 1;

  // the mouth: an upper lip of two curves and a fuller lower one, barely smiling
  x.fillStyle = "#B8705C";
  x.beginPath();
  x.moveTo(104, 196);
  x.quadraticCurveTo(116, 188, 128, 193); x.quadraticCurveTo(140, 188, 152, 196);
  x.quadraticCurveTo(128, 214, 104, 196);
  x.fill();
  x.globalAlpha = .4; x.strokeStyle = "#8E5343"; x.lineWidth = 1.6;
  x.beginPath(); x.moveTo(104, 196); x.quadraticCurveTo(128, 200, 152, 196); x.stroke();
  x.globalAlpha = 1;
  return c;
}

function makeGuide(M) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.frustumCulled = false; g.add(m); return m; };
  const cap = (r, len, seg = 8) => new THREE.CapsuleGeometry(r, len, 2, seg);

  /* The coat, as one revolved profile: hem, knee, hip, waist, bust, shoulder, neck. A circle of revolution would
     make her a column, so the whole surface is squashed on z — a body is an oval seen from above, not a tube. */
  const profile = [
    [0, .605], [.192, .615], [.188, .72], [.177, .84], [.159, .945], [.168, 1.03],
    [.186, 1.12], [.182, 1.23], [.17, 1.31], [.138, 1.375], [.08, 1.408], [0, 1.42],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const coat = add(new THREE.LatheGeometry(profile, 18), M.coat, 0, 0, 0);
  coat.scale.set(1.22, 1, .78);

  // a champagne collar sitting on the shoulders, and one thin belt at the waist
  const collar = add(new THREE.TorusGeometry(.1, .016, 6, 14), M.metal, 0, 1.385, 0);
  collar.rotation.x = Math.PI / 2; collar.scale.set(1.2, .8, 1);
  const belt = add(new THREE.TorusGeometry(.159, .01, 6, 18), M.gold, 0, .945, 0);
  belt.rotation.x = Math.PI / 2; belt.scale.set(1.22, .78, 1);

  // arms, hanging with the slight outward fall of a sleeve, and hands below them
  for (const s of [-1, 1]) {
    const arm = add(cap(.044, .38), M.coat, s * .234, 1.11, .012);
    arm.rotation.z = s * -.055;
    add(cap(.035, .04), M.skin, s * .251, .862, .018);                // the hand below the cuff
  }

  /* Weight on her left: one leg takes it, the other is relaxed and a touch forward. Standing square is the
     single most mannequin-like thing a figure can do. */
  add(cap(.057, .45), M.trouser, -.075, .315, 0);
  add(cap(.055, .44), M.trouser, .082, .322, .038);
  for (const [sx, sz] of [[-.075, .012], [.086, .052]]) {
    const shoe = add(cap(.034, .075), M.shoe, sx, .034, sz + .018);
    shoe.rotation.x = Math.PI / 2; shoe.scale.set(1, 1, .6);
  }

  add(cap(.046, .035), M.skin, 0, 1.448, 0);                        // neck

  // the head: an ellipsoid, with the face painted onto a patch of its own surface so it curves with the skull
  const head = new THREE.Group();
  head.position.set(0, 1.565, .004);
  head.scale.set(1, 1.1, .95);
  g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.098, 16, 12), M.skin);
  skull.frustumCulled = false; head.add(skull);
  const t = new THREE.CanvasTexture(faceCanvas());
  t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
  // phi = π/2 faces +z in three.js sphere maths, so this is the front of her face and nothing else
  const face = new THREE.Mesh(
    new THREE.SphereGeometry(.0995, 18, 14, Math.PI / 2 - .62, 1.24, 1.0, .92),
    new THREE.MeshStandardMaterial({ map: t, roughness: .62, metalness: 0, envMapIntensity: .26 }));
  face.frustumCulled = false; head.add(face);

  // hair: a cap over the crown, the weight of it down her back, and two strands framing her face
  const crown = new THREE.Mesh(new THREE.SphereGeometry(.106, 14, 10, 0, 6.2832, 0, 1.0), M.hair);
  crown.position.set(0, .006, -.012); crown.frustumCulled = false; head.add(crown);
  const fall = add(new THREE.SphereGeometry(.098, 12, 10), M.hair, 0, 1.432, -.062);
  fall.scale.set(.98, 1.7, .58);
  for (const s of [-1, 1]) {                                          // two strands down the sides of her face
    const strand = add(new THREE.SphereGeometry(.05, 8, 8), M.hair, s * .101, 1.5, -.012);
    strand.scale.set(.52, 1.85, .95);
  }
  return g;
}


/* ── the stage ─────────────────────────────────────────────────────────────────────────────────────────────── */

// An environment to reflect, with no file. Without one, metal and glass have nothing to catch and read as plastic.
function makeRoomEnv(renderer) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "#FFFBF3"); g.addColorStop(.42, "#EDE4D4");
  g.addColorStop(.52, "#D8C5A5");                               // the horizon band metal picks up
  g.addColorStop(.75, "#8E8275"); g.addColorStop(1, "#4A423A");
  x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  const glow = (cx, cy, rx, ry, a) => {
    const r = x.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    r.addColorStop(0, `rgba(255,255,255,${a})`); r.addColorStop(1, "rgba(255,255,255,0)");
    x.save(); x.translate(cx, cy); x.scale(1, ry / Math.max(rx, ry)); x.translate(-cx, -cy);
    x.fillStyle = r; x.fillRect(0, 0, 256, 128); x.restore();
  };
  // Low-roughness surfaces only look expensive if there is something in the reflection to see. A flat
  // gradient gives a flat sheen; a lit ceiling, a bright band of glazing and two warm pools give a floor
  // something to carry across it.
  x.fillStyle = "rgba(255,252,246,.55)"; x.fillRect(0, 0, 256, 16);         // the lit ceiling plane
  x.fillStyle = "rgba(184,154,104,.18)"; x.fillRect(0, 62, 256, 5);         // a gold reveal at the horizon
  glow(52, 44, 50, 24, 1); glow(186, 38, 34, 18, .78); glow(128, 6, 130, 12, .5);
  glow(96, 96, 52, 22, .2); glow(214, 92, 40, 18, .16);                     // warm pools on the floor plane
  const src = new THREE.CanvasTexture(c);
  src.mapping = THREE.EquirectangularReflectionMapping; src.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromEquirectangular(src);
  pm.dispose(); src.dispose();
  return rt.texture;
}

const _pv = new THREE.Matrix4(), _frustum = new THREE.Frustum(), _v4 = new THREE.Vector4();
const _guidePos = new THREE.Vector3();

// A doorway's rectangle in screen space, or the whole screen if it straddles the camera.
function projectRect(box) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < 8; i++) {
    _v4.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z, 1);
    _v4.applyMatrix4(_pv);
    if (_v4.w <= 0) return { x0: -1, y0: -1, x1: 1, y1: 1 };
    const x = _v4.x / _v4.w, y = _v4.y / _v4.w;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}
const clipRect = (a, b) => {
  const r = { x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) };
  return (r.x1 > r.x0 && r.y1 > r.y0) ? r : null;
};

/* ── the walk ──────────────────────────────────────────────────────────────────────────────────────────────────
   On a phone there is no WASD and no mouse. Drag anywhere to look, push the thumb pad bottom-left to walk, tap a
   marker to open it, tap a doorway label to walk through. A keyboard, if there is one, also works. */
export function startClinic(canvas, { onRoom, onHotspot, onReady, onStat, showcase = false, at: startAt } = {}) {
  const host = canvas.parentElement || document.body;

  // ── renderer
  const CAP = 1.5;                        // a walkable PBR scene is fragment-bound; full dpr is 15–20 fps
  let dpr = Math.min(window.devicePixelRatio || 1, CAP);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr <= 1.25, alpha: false, stencil: false,
    depth: true, powerPreference: "high-performance", failIfMajorPerformanceCaveat: false });
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Khronos PBR Neutral keeps champagne and gold at their own hue; ACES drifts them grey-pink.
  renderer.toneMapping = THREE.NeutralToneMapping ?? THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = THREE.NeutralToneMapping ? .98 : 1.06;   // deepen the shadow end a little
  renderer.shadowMap.enabled = false;
  renderer.debug.checkShaderErrors = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xEFE9DE);
  // Fog is here to soften the cut where a culled room ends at a doorway — which happens at twenty metres,
  // not at seven. Starting at seven was hazing the far wall of a nine-metre reception.
  scene.fog = new THREE.Fog(0xEFE9DE, 16, 55);
  const camera = new THREE.PerspectiveCamera(78, 1, .08, 40);

  const T = makeTextures(renderer);
  const M = makeMaterials(T);
  const K = kit(M);
  scene.environment = makeRoomEnv(renderer);
  scene.environmentIntensity = 1.15;

  // ── exactly four lights, for the whole visit. Adding or hiding one recompiles every shader program.
  const hemi = new THREE.HemisphereLight(0xFFF6E8, 0x574C41, .55);   // a darker ground bounce: more gradient down a wall
  const key = new THREE.DirectionalLight(0xFFE9CC, 1.1);
  key.position.set(-4.2, 6.0, 3.4);
  const poolA = new THREE.PointLight(0xFFE2BC, 15, 9, 2);
  const poolB = new THREE.PointLight(0xFFEDD6, 9, 7, 2);
  scene.add(hemi, key, poolA, poolB);
  const lightRoom = (k) => {
    const L = ROOMS[k].light;
    poolA.position.set(L.a[0], L.a[1], L.a[2]); poolA.intensity = L.a[3]; poolA.color.setHex(L.a[4]);
    poolB.position.set(L.b[0], L.b[1], L.b[2]); poolB.intensity = L.b[3]; poolB.color.setHex(L.b[4]);
    key.intensity = L.key; hemi.intensity = L.hemi;
  };

  // ── every object's contact shadow, in one draw call for the whole clinic
  const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ map: T.blob, transparent: true, opacity: .9, depthWrite: false,
    toneMapped: false, fog: false, side: THREE.FrontSide });
  const blobs = new THREE.InstancedMesh(blobGeo, blobMat, 256);
  blobs.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  blobs.renderOrder = 2; blobs.frustumCulled = false;
  scene.add(blobs);
  const _m4 = new THREE.Matrix4();
  let blobN = 0;

  // ── the guide, and the soft patch of floor she stands on
  const guide = makeGuide(M);
  scene.add(guide);
  const guideShadow = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: T.blob, transparent: true,
    opacity: .72, depthWrite: false, toneMapped: false, fog: false }));
  guideShadow.scale.set(.62, 1, .62); guideShadow.renderOrder = 2; guideShadow.frustumCulled = false;
  scene.add(guideShadow);
  const guideAt = new THREE.Vector3(), guideTo = new THREE.Vector3();
  let guideSaid = 0, guideIdle = 0, guideLook = 0;

  // ── build the clinic: all eleven spaces at once, then cull by what you can see
  const rooms = new Map();
  const HOTSPOTS = [];
  const solids = [];
  for (const key of Object.keys(ROOMS)) {
    const ctx = buildRoom(key, M, K);
    const hot = furnish(ctx, key);
    const group = new THREE.Group();
    for (const mesh of mergeByMaterial(ctx.parts)) {
      if (mesh.material.vertexColors) bakeAO(mesh.geometry, ctx.box3);
      group.add(mesh);
    }
    group.matrixAutoUpdate = false; group.updateMatrix();
    scene.add(group);
    for (const [x, z, sx, sz] of ctx.blobs) {
      if (blobN >= blobs.count) break;
      _m4.makeScale(sx, 1, sz).setPosition(x, .006, z);
      blobs.setMatrixAt(blobN++, _m4);
    }
    for (const s of ctx.solids) solids.push(s);
    for (const [hk, title, x, y, z, opens] of hot) HOTSPOTS.push({ key: hk, room: key, title, pos: new THREE.Vector3(x, y, z), opens });
    rooms.set(key, { group, box: ctx.box3, R: ctx.R, portals: [] });
  }
  blobs.count = blobN; blobs.instanceMatrix.needsUpdate = true;

  // a thin box filling each doorway, both for the portal cull and for the "walk through" label
  const PORTALS = [];
  for (const d of DOORS) {
    const b = d.axis === "x"
      ? new THREE.Box3(new THREE.Vector3(d.x - d.w / 2, .05, d.z - .08), new THREE.Vector3(d.x + d.w / 2, DOOR_H, d.z + .08))
      : new THREE.Box3(new THREE.Vector3(d.x - .08, .05, d.z - d.w / 2), new THREE.Vector3(d.x + .08, DOOR_H, d.z + d.w / 2));
    rooms.get(d.a).portals.push({ to: d.b, box: b });
    rooms.get(d.b).portals.push({ to: d.a, box: b });
    PORTALS.push({ ...d, box: b, centre: new THREE.Vector3(d.x, 1.1, d.z) });
    // the walkable slot through the wall, so collision lets you pass
    // The field 'pull' is the axis to drift onto while crossing: the one the opening runs along, never the one you walk
    // along. Aiming a doorway with four arrow buttons is otherwise much harder than aiming it with your feet.
    if (d.axis === "x") solids.push({ pass: true, pull: "x", at: d.x, x0: d.x - d.w / 2 + RADIUS, x1: d.x + d.w / 2 - RADIUS, z0: d.z - .7, z1: d.z + .7 });
    else solids.push({ pass: true, pull: "z", at: d.z, x0: d.x - .7, x1: d.x + .7, z0: d.z - d.w / 2 + RADIUS, z1: d.z + d.w / 2 - RADIUS });
  }
  const passes = solids.filter((s) => s.pass);
  const blocks = solids.filter((s) => !s.pass);

  // ── where the visitor is
  const first = ROOMS[startAt] ? startAt : "reception";
  let at = { x: ROOMS[first].spawn[0], z: ROOMS[first].spawn[1] };
  let yaw = ROOMS[first].yaw, pitch = -4;
  let vx = 0, vz = 0;                       // walking velocity, in metres a second
  let room = first;
  lightRoom(room);

  const inRect = (R, x, z, pad = 0) => x > R.x0 + pad && x < R.x1 - pad && z > R.z0 + pad && z < R.z1 - pad;
  const roomAt = (x, z) => {
    for (const [k, v] of rooms) if (inRect(v.R, x, z, 0)) return k;
    return null;
  };
  // A position is legal if it is inside a room (minus the walker's width) or inside a doorway slot; then it is
  // pushed out of anything solid. Trying each axis separately is what lets you slide along a wall.
  const legal = (x, z) => {
    let ok = false;
    for (const [, v] of rooms) if (inRect(v.R, x, z, RADIUS)) { ok = true; break; }
    if (!ok) for (const p of passes) if (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) { ok = true; break; }
    if (!ok) return false;
    for (const b of blocks) {
      if (x > b.x0 - RADIUS && x < b.x1 + RADIUS && z > b.z0 - RADIUS && z < b.z1 + RADIUS) return false;
    }
    return true;
  };
  const step = (dx, dz) => {
    if (legal(at.x + dx, at.z + dz)) { at.x += dx; at.z += dz; return; }
    if (legal(at.x + dx, at.z)) { at.x += dx; return; }               // slide along a wall
    if (legal(at.x, at.z + dz)) { at.z += dz; return; }
    // Both axes blocked at once is a corner, and the old code simply stopped there with the arrow still held.
    // Try a short sidestep along whichever wall is being pressed into, so the corner releases you.
    const s = Math.hypot(dx, dz) * .7;
    if (s < 1e-5) return;
    for (const [ox, oz] of [[dz, -dx], [-dz, dx]]) {
      const k = s / Math.hypot(ox, oz);
      if (legal(at.x + ox * k, at.z + oz * k)) { at.x += ox * k; at.z += oz * k; return; }
    }
  };
  // Crossing a threshold, drift onto its centre line. A person aims for a gap without thinking about it; four
  // arrow buttons cannot, and clipping the frame was what made walking feel like fighting.
  const throughDoor = (dt, dx, dz) => {
    for (const p of passes) {
      if (at.x <= p.x0 || at.x >= p.x1 || at.z <= p.z0 || at.z >= p.z1) continue;
      // You cross an opening along the axis it does NOT run along. Walking past a side door — down a corridor,
      // say — must not drag you sideways into the room you are walking past.
      const crossing = p.pull === "x" ? Math.abs(dz) : Math.abs(dx);
      const along = p.pull === "x" ? Math.abs(dx) : Math.abs(dz);
      if (crossing < along * 1.2) return;
      const k = Math.min(1, dt * 5);
      if (p.pull === "x") at.x += (p.at - at.x) * k; else at.z += (p.at - at.z) * k;
      return;
    }
  };

  // ── looking and walking
  let dragging = false, px = 0, py = 0, moved = 0, downAt = 0;
  const held = { f: 0, b: 0, l: 0, r: 0 };  // which arrows are being pressed
  const keys = new Set();
  let walking = null;                        // an automatic walk: { fx, fz, tx, tz, t, dur, after }
  let tour = null;                           // the guided walk: a list of room keys
  let idle = 0;

  const at2 = (e) => (e.touches ? e.touches[0] : e);
  const fit = () => {
    const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
    // A phone in portrait is so tall that a comfortable vertical angle is a narrow horizontal one: 68° down
    // the screen is only 35° across it, and a 4.5 m room then reads as a corridor. 78 gives ~42° across, which
    // is about a 50 mm lens — wide enough to see a room, still short of the barrel-distorted look of a game.
    camera.fov = h > w ? 78 : 58;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };

  const onDown = (e) => {
    const p = at2(e);
    idle = 0;
    dragging = true; px = p.clientX; py = p.clientY; moved = 0; downAt = performance.now();
  };
  const onMove = (e) => {
    const p = at2(e);
    if (!dragging) return;
    const dx = p.clientX - px, dy = p.clientY - py;
    px = p.clientX; py = p.clientY; moved += Math.abs(dx) + Math.abs(dy);
    yaw -= dx * .16;                                   // a slow, confident turn, not a shooter's flick
    pitch = clamp(pitch - dy * .14, -38, 38);          // ±38°, not ±85°: a person does not crane like that
    idle = 0;
    if (e.cancelable) e.preventDefault();
  };
  const onUp = (e) => {
    if (dragging && moved < 10 && performance.now() - downAt < 420) tapped(e);
    dragging = false;
  };

  // ── markers: the taps that open something. A showcase has nothing to press, so it builds none.
  const layer = document.createElement("div");
  layer.className = "c3spots";
  if (!showcase) host.appendChild(layer);
  const marks = new Map();
  const markFor = (id, title, kind) => {
    let m = marks.get(id);
    if (!m) {
      m = document.createElement("button");
      m.type = "button"; m.className = "c3spot " + kind; m.dataset.id = id;
      m.innerHTML = `<i></i><b></b>`;
      layer.appendChild(m); marks.set(id, m);
    }
    m.querySelector("b").textContent = title;
    return m;
  };
  layer.addEventListener("click", (e) => {
    const b = e.target.closest(".c3spot"); if (!b) return;
    const id = b.dataset.id;
    const d = PORTALS.find((p) => "door:" + p.a + ">" + p.b === id || "door:" + p.b + ">" + p.a === id);
    if (d) return walkTo(d.x, d.z, d);
    if (id === "guide") { if (onHotspot) onHotspot({ key: "guide", room, title: "راهنمای کلینیک", opens: "advisor" }); return; }
    const h = HOTSPOTS.find((x) => x.key === id);
    if (h && onHotspot) onHotspot(h);
  });

  const tapped = (e) => {
    // a tap on the canvas, not on a marker: nothing to do but stop a guided walk
    if (tour) { tour = null; walking = null; }
  };

  // ── automatic walking: a doorway, a chip, or the guided tour
  function walkTo(tx, tz, door, turn = true) {
    const fx = at.x, fz = at.z;
    const dist = Math.hypot(tx - fx, tz - fz);
    walking = { fx, fz, tx, tz, t: 0, dur: clamp(dist / 1.25, .5, 3.2), door };
    // turn towards where we are going, the short way round
    if (turn) {
      const want = Math.atan2(fx - tx, fz - tz) / RAD;
      walking.fy = yaw; walking.ty = yaw + (((want - yaw) % 360 + 540) % 360 - 180);
    }
  }
  const show = (k) => {
    const s = ROOMS[k];
    // step into the room through its own doorway, so it is a walk and not a jump
    at.x = s.spawn[0]; at.z = s.spawn[1]; yaw = s.yaw; pitch = -4;
    walking = null;
    setRoom(k);
    // walk towards the middle, but stop at the last point that is not inside a bed, a desk or a sofa: the
    // automatic walk does not collide with anything, so the target itself has to be somewhere you could stand
    const c = rect(s);
    const cx = clamp(s.x, c.x0 + .9, c.x1 - .9), cz = clamp(s.z, c.z0 + .9, c.z1 - .9);
    let tx = s.spawn[0], tz = s.spawn[1];
    for (let i = 0; i <= 12; i++) {
      const t = 1 - i / 12;
      const px = s.spawn[0] + (cx - s.spawn[0]) * t, pz = s.spawn[1] + (cz - s.spawn[1]) * t;
      if (legal(px, pz)) { tx = px; tz = pz; break; }
    }
    // and face what the room was built to show — its first marker — rather than a wall
    const h = HOTSPOTS.find((x) => x.room === k);
    if (h) yaw = Math.atan2(tx - h.pos.x, tz - h.pos.z) / RAD;
    walkTo(tx, tz, null, false);
  };
  const setRoom = (k) => {
    if (k === room || !ROOMS[k]) return;
    room = k; lightRoom(k);
    // put her inside the new room before she starts walking, or she would cross a wall to reach you
    const r = rooms.get(k);
    if (r && !showcase) guideAt.set(clamp(guideAt.x, r.R.x0 + .65, r.R.x1 - .65), 0, clamp(guideAt.z, r.R.z0 + .65, r.R.z1 - .65));
    guideSaid = performance.now();
    if (onRoom) onRoom(spaceInfo(k));
  };
  const startTour = () => { tour = SPACE_KEYS.slice(); nextTourStop(); };
  const nextTourStop = () => {
    if (!tour || !tour.length) { tour = null; return; }
    const k = tour.shift();
    show(k);
  };

  // ── the loop
  let drift = 0;
  const home0 = { x: at.x, z: at.z, yaw };
  let last = performance.now(), acc = 0, frames = 0, lastDpr = 0, stop = false;
  const WALK = 1.9;                         // metres a second. A person walks at 1.4 and strides at 2; the
                                            // old 1.3 looked unhurried and felt heavy.

  function frame(now) {
    if (stop) return;
    const dt = Math.min((now - last) / 1000, .05); last = now;

    if (showcase) {
      // a slow breath around the spot the room looks best from: it must never look like a camera on rails
      drift += dt;
      at.x = home0.x + Math.sin(drift * .085) * .85;
      at.z = home0.z + Math.sin(drift * .061 + 1.1) * .65;
      yaw = home0.yaw + Math.sin(drift * .049 + .4) * 11;
      pitch = -3 + Math.sin(drift * .037) * 1.8;
    } else if (walking) {
      walking.t += dt;
      const k = ease(clamp(walking.t / walking.dur, 0, 1));
      at.x = walking.fx + (walking.tx - walking.fx) * k;
      at.z = walking.fz + (walking.tz - walking.fz) * k;
      if (walking.fy !== undefined) yaw = walking.fy + (walking.ty - walking.fy) * k;
      const here = roomAt(at.x, at.z);
      if (here) setRoom(here);
      if (walking.t >= walking.dur) {
        const d = walking.door; walking = null;
        if (d) { const far = ROOMS[d.a === room ? d.b : d.a]; walkTo(far.spawn[0], far.spawn[1]); }
        else if (tour) setTimeout(nextTourStop, 2600);
      }
    } else {
      // the arrows and the keyboard feed the same numbers. Left and right TURN rather than slide sideways:
      // turning is what a person does with their feet, and sidling is what a crab does.
      let fwd = held.f - held.b, side = 0;
      if (keys.has("w") || keys.has("ArrowUp")) fwd += 1;
      if (keys.has("s") || keys.has("ArrowDown")) fwd -= 1;
      if (keys.has("a")) side -= 1;
      if (keys.has("d")) side += 1;
      const turning = (held.l - held.r) + (keys.has("ArrowLeft") ? 1 : 0) - (keys.has("ArrowRight") ? 1 : 0);
      if (turning) { yaw += turning * 88 * dt; idle = 0; }
      const n = Math.hypot(fwd, side);
      if (n > 1) { fwd /= n; side /= n; }
      const s = Math.sin(yaw * RAD), c = Math.cos(yaw * RAD);
      const wx = (-s * fwd + c * side) * WALK, wz = (-c * fwd - s * side) * WALK;
      vx += (wx - vx) * Math.min(1, dt * 13); vz += (wz - vz) * Math.min(1, dt * 13);
      if (Math.abs(vx) > .002 || Math.abs(vz) > .002) {
        step(vx * dt, vz * dt);
        throughDoor(dt, vx * dt, vz * dt);
        const here = roomAt(at.x, at.z);
        if (here) setRoom(here);
        idle = 0;
      } else { idle += dt; }
    }

    camera.position.set(at.x, EYE, at.z);
    camera.rotation.set(pitch * RAD, yaw * RAD, 0, "YXZ");
    camera.updateMatrixWorld();

    // She keeps a conversation's distance and stands a little to one side, beside what you are looking at rather
    // than in front of it. In the header she simply waits in the lobby instead of following a drifting camera.
    if (!showcase) {
      guideLook -= dt;
      if (guideLook <= 0) {
        guideLook = .16;
        const s = Math.sin(yaw * RAD), c = Math.cos(yaw * RAD);
        const r = rooms.get(room);
        // Free floor is not the same as being visible: a counter, a post or a glass screen in between hides her.
        // So try the place she would like to stand first, then a step either way, then nearer — the order a
        // person would try them in.
        const clear = (px, pz) => {
          for (let k = .3; k <= 1.001; k += .14) if (!legal(at.x + (px - at.x) * k, at.z + (pz - at.z) * k)) return false;
          return true;
        };
        // and she does not stand in front of what she is showing you, which would put its label across her face
        const onTopOfAMarker = (px, pz) =>
          HOTSPOTS.some((h) => h.room === room && Math.hypot(h.pos.x - px, h.pos.z - pz) < 1.25);
        let ok = false;
        for (let pass = 0; pass < 2 && !ok; pass++) {
          for (const d of GUIDE_SPOTS) {
            let px = at.x - s * d[0] + c * d[1], pz = at.z - c * d[0] - s * d[1];
            if (r) { px = clamp(px, r.R.x0 + .6, r.R.x1 - .6); pz = clamp(pz, r.R.z0 + .6, r.R.z1 - .6); }
            if (pass === 0 && onTopOfAMarker(px, pz)) continue;
            if (legal(px, pz) && clear(px, pz)) { guideTo.set(px, 0, pz); ok = true; break; }
          }
        }
        if (!ok) guideTo.set(at.x - s * 2.2, 0, at.z - c * 2.2);        // nothing worked: stand in front of you
      }
      guideAt.lerp(guideTo, Math.min(1, dt * 1.2));          // she walks over; she does not appear
    }
    // Standing still is never quite still: a slow shift of weight, and that is all.
    // She turns on her vertical axis ONLY. lookAt() would pitch her backwards towards the camera's eye line —
    // the closer you stood, the further she leaned, until she was lying on the floor.
    guideIdle += dt;
    guide.position.set(guideAt.x, Math.sin(guideIdle * .9) * .006, guideAt.z);
    guide.rotation.set(
      0,
      Math.atan2(camera.position.x - guideAt.x, camera.position.z - guideAt.z),   // the figure is built facing +z
      Math.sin(guideIdle * .55) * .006,
    );
    guideShadow.position.set(guideAt.x, .008, guideAt.z);

    // only the room you are in, plus what is genuinely visible through its doorways
    _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_pv);
    for (const v of rooms.values()) v.group.visible = false;
    const cur = rooms.get(room);
    if (cur) cur.group.visible = true;
    const shown = new Set([room]);
    const queue = [{ id: room, depth: 0, r: { x0: -1, y0: -1, x1: 1, y1: 1 } }];
    while (queue.length) {
      const { id, depth, r } = queue.shift();
      if (depth >= 2) continue;                        // deeper than two doorways is a few pixels
      for (const p of (rooms.get(id) || { portals: [] }).portals) {
        if (!_frustum.intersectsBox(p.box)) continue;
        const sub = clipRect(projectRect(p.box), r); if (!sub) continue;
        const t = rooms.get(p.to); if (!t) continue;
        t.group.visible = true;
        if (!shown.has(p.to)) { shown.add(p.to); queue.push({ id: p.to, depth: depth + 1, r: sub }); }
      }
    }

    // the markers, projected to the screen
    const seen = new Set();
    if (showcase) { renderer.render(scene, camera); requestAnimationFrame(frame); return; }
    const place = (id, title, kind, pos, maxDist) => {
      const d = Math.hypot(pos.x - at.x, pos.z - at.z);
      if (d > maxDist) return;
      _v4.set(pos.x, pos.y, pos.z, 1).applyMatrix4(_pv);
      if (_v4.w <= 0) return;
      const nx = _v4.x / _v4.w, ny = _v4.y / _v4.w;
      if (nx < -1.05 || nx > 1.05 || ny < -1.05 || ny > 1.05) return;
      const m = markFor(id, title, kind);
      m.hidden = false;
      m.style.left = ((nx + 1) / 2 * 100).toFixed(2) + "%";
      m.style.top = ((1 - ny) / 2 * 100).toFixed(2) + "%";
      m.style.opacity = d > maxDist * .72 ? ".6" : "1";
      m.classList.toggle("near", d < 2.4);
      seen.add(id);
    };
    _guidePos.set(guideAt.x, 1.86, guideAt.z);
    place("guide", now - guideSaid < 5200 ? "من راهنماییت می‌کنم" : "بپرس", "guide", _guidePos, 9);
    for (const h of HOTSPOTS) if (shown.has(h.room)) place(h.key, h.title, "hot", h.pos, 7);
    for (const p of PORTALS) {
      if (!shown.has(p.a) && !shown.has(p.b)) continue;
      place("door:" + p.a + ">" + p.b, p.labelFa, "door", p.centre, 6.5);
    }
    for (const [id, m] of marks) if (!seen.has(id)) m.hidden = true;

    renderer.render(scene, camera);

    // the one runtime quality dial: trade sharpness for frames, slowly, and never thrash the drawbuffer
    acc += dt; frames++;
    if (frames >= 45 && now - lastDpr > 750) {
      const ms = acc / frames * 1000; acc = 0; frames = 0;
      const want = ms > 22 ? dpr - .25 : ms < 12 ? dpr + .25 : dpr;
      const next = clamp(want, .85, CAP);
      if (Math.abs(next - dpr) > .01) { dpr = next; renderer.setPixelRatio(dpr); lastDpr = now; }
      if (onStat) onStat({ ms: Math.round(ms), dpr: +dpr.toFixed(2), rooms: shown.size,
                           calls: renderer.info.render.calls, tris: renderer.info.render.triangles });
    }
    requestAnimationFrame(frame);
  }

  // ── listeners
  if (!showcase) {
    // the arrows: press and hold to keep going, let go to stop. They sit over the canvas as real buttons, so a
    // press on one never reaches the drag-to-look handler below.
    const stop = () => { held.f = held.b = held.l = held.r = 0; };
    for (const b of host.querySelectorAll("[data-dir]")) {
      const d = b.dataset.dir;
      // The arrow takes ownership of the pointer the moment it is pressed. Without that the browser hands the
      // gesture back the instant the finger drifts a pixel off the button — pointerleave, or a pointercancel it
      // raises by itself — and the walk stops while the finger is still down. That is what "سخت حرکت میکنه"
      // actually was: the press was being taken away, not the speed being wrong.
      const go = (e) => {
        held[d] = 1; idle = 0; b.classList.add("on");
        if (e.pointerId !== undefined) { try { b.setPointerCapture(e.pointerId); } catch (err) {} }
        if (e.cancelable) e.preventDefault();
      };
      const end = () => { held[d] = 0; b.classList.remove("on"); };
      b.addEventListener("pointerdown", go);
      b.addEventListener("pointerup", end);
      b.addEventListener("pointercancel", end);
      b.addEventListener("touchstart", go, { passive: false });
      b.addEventListener("touchend", end);
      b.addEventListener("contextmenu", (e) => e.preventDefault());
    }
    addEventListener("blur", stop);                 // a backgrounded tab must not keep walking

    canvas.addEventListener("pointerdown", onDown);
    addEventListener("pointermove", onMove, { passive: false });
    addEventListener("pointerup", onUp);
    canvas.addEventListener("touchstart", onDown, { passive: true });
    canvas.addEventListener("touchmove", onMove, { passive: false });
    addEventListener("touchend", onUp);
  }
  addEventListener("resize", fit);
  const onKey = (e) => {
    if (e.target && /input|textarea/i.test(e.target.tagName)) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.type === "keydown") {
      keys.add(k);
      if (k === "e" || k === "Enter") { const h = HOTSPOTS.find((x) => x.room === room && Math.hypot(x.pos.x - at.x, x.pos.z - at.z) < 2.6); if (h && onHotspot) onHotspot(h); }
      if (k === "Escape" && tour) { tour = null; walking = null; }
    } else keys.delete(k);
  };
  if (!showcase) { addEventListener("keydown", onKey); addEventListener("keyup", onKey); }

  fit();
  const ready = () => {
    if (onRoom) onRoom(spaceInfo(room));
    if (onReady) onReady();
    requestAnimationFrame(frame);
  };
  // compile every shader while the splash is still up, instead of six freezes on the first look round
  if (renderer.compileAsync) renderer.compileAsync(scene, camera).then(ready, ready);
  else ready();

  return {
    spaces: SPACE_KEYS.map(spaceInfo),
    show, startTour, fit,
    get room() { return room; },
    stopTour() { tour = null; walking = null; },
    pause() { stop = true; },
    resume() { if (stop) { stop = false; last = performance.now(); requestAnimationFrame(frame); } },
    dispose() {
      stop = true;
      removeEventListener("pointermove", onMove); removeEventListener("pointerup", onUp);
      removeEventListener("touchend", onUp); removeEventListener("resize", fit);
      removeEventListener("keydown", onKey); removeEventListener("keyup", onKey);
      layer.remove();
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      Object.values(M).forEach((m) => m.dispose());
      Object.values(T).forEach((t) => t.dispose());
      renderer.dispose();
    },
  };
}

/* Does this phone have what the walk needs? If not, the app says so plainly and offers the flat tour instead. */
export function canWalk() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    return !/SwiftShader|Software|Mesa OffScreen/i.test(
      (gl.getExtension("WEBGL_debug_renderer_info") &&
       gl.getParameter(gl.getExtension("WEBGL_debug_renderer_info").UNMASKED_RENDERER_WEBGL)) || "");
  } catch (e) { return false; }
}
