// scene-ops.js — pure scene-graph operations for terrain.bucklerfamily.estate (no I/O). — Sion's Tab agent
export const KINDS = ["building", "tree", "fence", "wall", "hedge", "path", "water", "field", "label", "sign", "marker", "rock", "lamp", "bench", "shrub", "flower", "gate", "animal", "vehicle", "well", "statue", "ruin"];
export const TEXTURES = ["plain", "stone", "brick", "wood", "plaster", "slate", "glass", "metal", "thatch", "gravel", "grass", "bark", "moss", "soil"];
export const TIMES = { dawn: 6.5, morning: 9, day: 12, noon: 12, afternoon: 15, evening: 18, dusk: 19.5, sunset: 19.5, night: 23, midnight: 0 };
export const WEATHER = ["clear", "cloudy", "fog", "rain", "snow", "storm"];
const NAMED = {
  "stone grey": "#8a8d8f", "stone gray": "#8a8d8f", stone: "#9a978f", "slate grey": "#5b6670", "slate gray": "#5b6670", slate: "#4d5862",
  "dark grey": "#3a3d40", "dark gray": "#3a3d40", "light grey": "#c8c8c8", "light gray": "#c8c8c8", grey: "#808080", gray: "#808080",
  "welsh red": "#c8102e", "dragon red": "#c8102e", "welsh green": "#00ab39", "brick red": "#9c3b2a", brick: "#9c3b2a", terracotta: "#c4643f",
  cream: "#f1e6c8", ivory: "#fffff0", white: "#f2f2f2", black: "#111111", whitewash: "#f4f1e8", limewash: "#efe8d6", sandstone: "#c9a96e",
  red: "#c0392b", crimson: "#a3162b", maroon: "#6d1f2a", orange: "#e67e22", amber: "#f0a020", yellow: "#f1c40f", gold: "#f2c94c", golden: "#f2c94c",
  green: "#2e8b57", "dark green": "#1f4d2b", "forest green": "#228b22", olive: "#6b7a2a", lime: "#8bc34a", moss: "#5d7a3a", sage: "#9caf88",
  blue: "#2f6fd6", "navy": "#1b2a4a", "navy blue": "#1b2a4a", "sky blue": "#87ceeb", teal: "#1f8a8a", turquoise: "#33c3b5", cyan: "#22c3d6",
  purple: "#7d3c98", violet: "#8e44ad", lilac: "#c8a2c8", pink: "#e88fb0", magenta: "#c2185b", brown: "#7a4b32", "dark brown": "#4a2e1f",
  tan: "#c8a46e", beige: "#d9c9a3", oak: "#9c7a4b", wood: "#8b5a2b", charcoal: "#36393d", silver: "#c0c0c0", copper: "#b87333", bronze: "#8c6a3c",
};
const TEX_COLOR = { stone: "#9a978f", brick: "#9c3b2a", wood: "#8b5a2b", plaster: "#e9e2d0", slate: "#4d5862", glass: "#9fc6d8", metal: "#9aa0a6", thatch: "#b8963e", gravel: "#8a7f70", grass: "#4f7f3a" };
export function parseColor(c) {
  if (!c) return null;
  const s = String(c).trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").replace(/^(a |the )/, "").replace(/ colou?r(ed)?$/, "");
  if (/^#?[0-9a-f]{6}$/.test(s)) return "#" + s.replace("#", "");
  if (/^#?[0-9a-f]{3}$/.test(s)) { const h = s.replace("#", ""); return "#" + h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
  if (NAMED[s]) return NAMED[s];
  const words = s.split(" ");
  for (let n = words.length; n > 0; n--) for (let i = 0; i + n <= words.length; i++) { const k = words.slice(i, i + n).join(" "); if (NAMED[k]) return NAMED[k]; }
  return null;
}
export function norm(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim(); }
const STOP = new Set(["the", "a", "an", "of", "to", "by", "near", "next", "on", "at", "in", "that", "this", "it", "my", "our"]);
function toks(s) { return norm(s).split(" ").filter(w => w && !STOP.has(w)); }
export function resolve(scene, ref) {
  if (!ref) return null;
  const O = scene.objects;
  if (typeof ref === "object" && ref.id) ref = ref.id;
  const r = norm(ref);
  if (!r) return null;
  if (["it", "that", "this", "last", "the last one", "that one", "this one"].includes(r) && scene.meta && scene.meta.last) return O.find(o => o.id === scene.meta.last) || null;
  let o = O.find(o => o.id === ref || norm(o.id) === r || norm(o.id.replace(/_/g, " ")) === r);
  if (o) return o;
  o = O.find(o => norm(o.name) === r) || O.find(o => (o.aliases || []).some(a => norm(a) === r));
  if (o) return o;
  // kind words: "the tree", "the oak", "the barn" -> most recently touched matching object
  const rt = toks(ref); if (!rt.length) return null;
  let best = null, bs = 0;
  O.forEach((o, idx) => {
    const hay = new Set([...toks(o.name), ...toks(o.id.replace(/_/g, " ")), ...(o.aliases || []).flatMap(toks), o.kind, o.species || "", o.roof === undefined ? "" : ""]);
    let sc = 0; for (const w of rt) { if (hay.has(w)) sc += 2; else if ([...hay].some(h => h.length > 3 && (h.startsWith(w) || w.startsWith(h)))) sc += 1; }
    if (sc === 0) return;
    sc = sc / rt.length + idx / (O.length * 100) + ((scene.meta && scene.meta.last === o.id) ? 0.05 : 0);
    if (sc > bs) { bs = sc; best = o; }
  });
  return bs >= 1 ? best : null;
}
export function center(o) {
  if (o.pos) return [o.pos[0], o.pos[2]];
  if (o.points && o.points.length) { let x = 0, z = 0; o.points.forEach(p => { x += p[0]; z += p[1]; }); return [x / o.points.length, z / o.points.length]; }
  return [0, 0];
}
export function radius(o) {
  const s = o.scale || 1;
  if (o.kind === "building") { const sz = o.size || [6, 4, 6]; return Math.hypot(sz[0], sz[2]) / 2 * s; }
  if (o.kind === "field") { const sz = o.size || [20, 20]; return Math.max(sz[0], sz[1]) / 2 * s; }
  if (o.kind === "water") return (o.radius || 4) * s;
  if (o.kind === "tree") return (o.height || 8) * 0.35 * s;
  if (o.kind === "field") { const sz = o.size || [20, 20]; return Math.max(sz[0], sz[1]) / 2 * s; }
  if (o.kind === "hedge" || o.kind === "wall" || o.kind === "fence" || o.kind === "path") { if (o.points) { const c = center(o); return Math.max(...o.points.map(p => Math.hypot(p[0] - c[0], p[1] - c[1]))); } return 3 * s; }
  if (o.kind === "vehicle") return 2.8 * s;
  if (o.kind === "animal") return 1.3 * s;
  if (o.kind === "shrub" || o.kind === "flower") return 1.1 * s;
  if (o.kind === "gate" || o.kind === "well" || o.kind === "statue" || o.kind === "sign" || o.kind === "ruin") return 2 * s;
  if (o.points) { const c = center(o); return Math.max(...o.points.map(p => Math.hypot(p[0] - c[0], p[1] - c[1]))); }
  return 1.5 * s;
}
function freeSpot(scene, near, r0, avoidId) {
  const [cx, cz] = center(near); const base = radius(near) + r0 + 1.5;
  const solid = scene.objects.filter(o => o.id !== avoidId && ["building", "tree", "water", "rock", "lamp", "bench", "marker", "hedge", "shrub", "animal", "vehicle", "well", "statue", "ruin"].includes(o.kind));
  for (let ring = 0; ring < 6; ring++) for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + ring * 0.37 + 0.6, d = base + ring * 2.5;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (solid.every(o => { const [ox, oz] = center(o); return Math.hypot(ox - x, oz - z) > radius(o) + r0 + 0.5; })) return [x, z];
  }
  return [cx + base, cz];
}
let _seq = 0;
function newId(scene, kind, name) {
  const b = (norm(name || kind).replace(/ /g, "_") || kind).slice(0, 28); let id = b, n = 1;
  while (scene.objects.some(o => o.id === id)) id = b + "_" + (++n);
  return id;
}
const DIRS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0], left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1], forward: [0, -1], back: [0, 1], backward: [0, 1], northeast: [0.707, -0.707], northwest: [-0.707, -0.707], southeast: [0.707, 0.707], southwest: [-0.707, 0.707] };
const r2 = v => Math.round(v * 100) / 100;
const label = o => (o.name || o.id.replace(/_/g, " ")).replace(/\s*\(.*?\)\s*/g, " ").trim();
const the = o => { const l = label(o); return (/^(St |Saint )|\b\w+'s\b/.test(l) ? "" : "the ") + l; };
function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
const PRESET = {
  farmhouse: { kind: "building", roof: "gable", size: [11, 5.5, 6], color: "#e9e2d0", roofColor: "#3b4148", texture: "plaster", chimneys: 2 },
  house: { kind: "building", roof: "gable", size: [8, 5, 6], color: "#e9e2d0", roofColor: "#4d5862", texture: "plaster", chimneys: 1 },
  cottage: { kind: "building", roof: "gable", size: [7, 4, 5], color: "#f1e6c8", roofColor: "#b8963e", texture: "plaster", chimneys: 1 },
  barn: { kind: "building", roof: "gable", size: [10, 5, 6], color: "#7a4b32", roofColor: "#4a4d52", texture: "wood" },
  church: { kind: "building", roof: "gable", size: [6, 6, 14], color: "#9a978f", roofColor: "#3a3f45", texture: "stone", tower: true },
  chapel: { kind: "building", roof: "gable", size: [5, 5, 9], color: "#9a978f", roofColor: "#3a3f45", texture: "stone" },
  tower: { kind: "building", roof: "tower", size: [4, 9, 4], color: "#9a978f", roofColor: "#3a3f45", texture: "stone" },
  shed: { kind: "building", roof: "flat", size: [4, 2.6, 3], color: "#6b5a45", roofColor: "#3a3d40", texture: "wood" },
  stable: { kind: "building", roof: "gable", size: [9, 3.5, 5], color: "#8b5a2b", roofColor: "#4a4d52", texture: "wood" },
  greenhouse: { kind: "building", roof: "gable", size: [6, 3, 4], color: "#cfe8f0", roofColor: "#cfe8f0", texture: "glass" },
  castle: { kind: "building", roof: "tower", size: [10, 10, 10], color: "#8a8d8f", roofColor: "#5b6670", texture: "stone" },
  building: { kind: "building", roof: "gable", size: [6, 4, 5], color: "#c8c8c8", roofColor: "#4d5862", texture: "plain" },
  tree: { kind: "tree", species: "oak", height: 8 }, oak: { kind: "tree", species: "oak", height: 9 }, pine: { kind: "tree", species: "pine", height: 10 },
  yew: { kind: "tree", species: "yew", height: 7 }, birch: { kind: "tree", species: "birch", height: 9 }, willow: { kind: "tree", species: "willow", height: 8 },
  ash: { kind: "tree", species: "ash", height: 10 }, beech: { kind: "tree", species: "beech", height: 11 }, apple: { kind: "tree", species: "apple", height: 5 }, chestnut: { kind: "tree", species: "chestnut", height: 12 }, hawthorn: { kind: "tree", species: "hawthorn", height: 5 }, holly: { kind: "tree", species: "holly", height: 5 }, hedge: { kind: "hedge", color: "#2f5a2a", height: 1.4 }, shrub: { kind: "shrub", color: "#426d35", height: 1.4 }, flower: { kind: "flower", color: "#c85b72", height: 0.9 }, flowers: { kind: "flower", color: "#c85b72", height: 0.9 },
  pond: { kind: "water", radius: 4 }, lake: { kind: "water", radius: 10 }, water: { kind: "water", radius: 4 }, field: { kind: "field", size: [20, 20], color: "#4f7f3a" },
  meadow: { kind: "field", size: [20, 20], color: "#6b8f3a" }, garden: { kind: "field", size: [10, 8], color: "#5a8f3a" }, fence: { kind: "fence", color: "#8b5a2b", height: 1.3 },
  wall: { kind: "wall", color: "#8a8d8f", height: 1.3, texture: "stone" }, path: { kind: "path", width: 1.6, color: "#8a7f70", texture: "gravel" }, road: { kind: "path", width: 5, color: "#3a3d40" },
  track: { kind: "path", width: 3, color: "#6b5a45", texture: "gravel" }, label: { kind: "label", color: "#f2c94c" }, sign: { kind: "sign", color: "#8b5a2b", text: "SIGN" },
  marker: { kind: "marker", color: "#e53935" }, pin: { kind: "marker", color: "#e53935" }, flag: { kind: "marker", color: "#c8102e" }, rock: { kind: "rock", color: "#7d7f80" },
  stone: { kind: "rock", color: "#9a978f" }, boulder: { kind: "rock", color: "#7d7f80", size: 2 }, lamp: { kind: "lamp", color: "#f2c94c" }, bench: { kind: "bench", color: "#8b5a2b" },
  gate: { kind: "gate", color: "#8b5a2b", height: 1.6 }, animal: { kind: "animal", species: "sheep", color: "#e7e1d4" }, sheep: { kind: "animal", species: "sheep", color: "#e7e1d4" }, cow: { kind: "animal", species: "cow", color: "#e7e1d4" }, horse: { kind: "animal", species: "horse", color: "#694a32" }, dog: { kind: "animal", species: "dog", color: "#a77d52" }, chicken: { kind: "animal", species: "chicken", color: "#f0e5d0" },
  vehicle: { kind: "vehicle", species: "cart", color: "#8b5a2b" }, cart: { kind: "vehicle", species: "cart", color: "#8b5a2b" }, wagon: { kind: "vehicle", species: "wagon", color: "#8b5a2b" }, tractor: { kind: "vehicle", species: "tractor", color: "#536e35" },
  well: { kind: "well", color: "#8a8d8f" }, statue: { kind: "statue", color: "#7f8781" }, monument: { kind: "statue", color: "#7f8781" }, ruin: { kind: "ruin", color: "#8a8d8f", texture: "stone" }, ruins: { kind: "ruin", color: "#8a8d8f", texture: "stone" },
};
export function presetFor(kind, species) {
  const k = norm(kind).replace(/ tree$/, "").replace(/s$/, "");
  return PRESET[norm(species || "")] && /tree/.test(norm(kind) + " tree") && species ? { ...PRESET.tree, ...PRESET[norm(species)] } : (PRESET[k] || PRESET[norm(kind)] || null);
}
// Every op returns {ok, say, changed:[ids]}; it mutates `scene`.
export function apply(scene, name, a = {}) {
  scene.meta = scene.meta || {};
  const touch = id => { scene.meta.last = id; };
  const need = ref => { const o = resolve(scene, ref); if (!o) throw new Error(`I couldn't find "${ref}" in the scene`); return o; };
  switch (name) {
    case "add_object": {
      let pre = presetFor(a.kind || "building", a.species);
      if (!pre) pre = { kind: KINDS.includes(norm(a.kind)) ? norm(a.kind) : "marker" };
      const o = JSON.parse(JSON.stringify(pre));
      const count = Math.max(1, Math.min(20, Math.round(num(a.count, 1))));
      const made = [];
      for (let i = 0; i < count; i++) {
        const oo = JSON.parse(JSON.stringify(o));
        const nm = a.name || (a.text && (oo.kind === "label") ? a.text : null) || ((a.species ? a.species + " " : "") + (norm(a.kind) || oo.kind)).replace(/^(\w)/, c => c.toUpperCase());
        oo.id = newId(scene, oo.kind, nm); oo.name = count > 1 ? nm + " " + (i + 1) : nm;
        if (a.color && parseColor(a.color)) oo.color = parseColor(a.color);
        if (a.roof_color && parseColor(a.roof_color)) oo.roofColor = parseColor(a.roof_color);
        if (a.texture && TEXTURES.includes(norm(a.texture))) oo.texture = norm(a.texture);
        if (a.roof && ["gable", "flat", "dome", "tower", "portico", "awning", "hip"].includes(norm(a.roof))) oo.roof = norm(a.roof);
        if (a.height) { if (oo.kind === "building") { oo.size = oo.size || [6, 4, 5]; oo.size[1] = num(a.height, oo.size[1]); } else oo.height = num(a.height, oo.height || 2); }
        if (a.width || a.length) { if (oo.kind === "building") { oo.size = oo.size || [6, 4, 5]; oo.size[0] = num(a.width, oo.size[0]); oo.size[2] = num(a.length, oo.size[2]); } else if (oo.kind === "field") oo.size = [num(a.width, 20), num(a.length, a.width || 20)]; else if (oo.kind === "path") oo.width = num(a.width, oo.width); }
        if (a.radius && oo.kind === "water") oo.radius = num(a.radius, 4);
        if (oo.kind === "label" || oo.kind === "sign" || a.text) oo.text = String(a.text || a.name || oo.text || "Label").slice(0, 60);
        const from = a.from ? need(a.from) : null, to = a.to ? need(a.to) : null;
        if (["fence", "wall", "hedge", "path"].includes(oo.kind)) {
          if (Array.isArray(a.points) && a.points.length > 1) oo.points = a.points.map(p => [num(p[0], 0), num(p[1], 0)]);
          else if (from && to) { oo.points = [center(from), center(to)]; }
          else if (a.around || a.near) { const t = need(a.around || a.near); const [cx, cz] = center(t); const rr = radius(t) + 2; oo.points = [[cx - rr, cz - rr], [cx + rr, cz - rr], [cx + rr, cz + rr], [cx - rr, cz + rr], [cx - rr, cz - rr]]; if (oo.kind === "fence" && a.around) oo.points.splice(4, 1, [cx - rr, cz - rr + 0.01]); }
          else { const x = num(a.x, 0), z = num(a.z, 0), L = num(a.length, 12); oo.points = [[x - L / 2, z], [x + L / 2, z]]; }
          oo.points = oo.points.map(p => [r2(p[0]), r2(p[1])]);
        } else {
          let x, z;
          if (a.x !== undefined && a.z !== undefined) { x = num(a.x, 0); z = num(a.z, 0); }
          else if (a.near || from) { const t = need(a.near || a.from); const [fx, fz] = freeSpot(scene, t, radius(oo), null); x = fx; z = fz;
            if (a.direction && DIRS[norm(a.direction)]) { const d = DIRS[norm(a.direction)], [cx, cz] = center(t), dist = num(a.distance, radius(t) + radius(oo) + 2); x = cx + d[0] * dist + (i ? (i % 2 ? 1 : -1) * 3 * Math.ceil(i / 2) * Math.abs(d[1]) : 0); z = cz + d[1] * dist + (i ? (i % 2 ? 1 : -1) * 3 * Math.ceil(i / 2) * Math.abs(d[0]) : 0); } }
          else { const t = scene.objects.find(o => o.id === "farmhouse") || { pos: [0, 0, 0], kind: "marker" }; const [fx, fz] = freeSpot(scene, t, radius(oo), null); x = fx; z = fz; }
          oo.pos = [r2(x), oo.kind === "label" ? num(a.y, 4) : 0, r2(z)];
          oo.rot = num(a.rotation, 0); oo.scale = num(a.scale, 1);
        }
        if (a.species && ["tree", "animal", "vehicle"].includes(oo.kind)) oo.species = norm(a.species);
        if (oo.kind === "tree" && a.height === undefined) oo.height = r2((oo.height || 8) * (0.85 + ((scene.objects.length * 37 + i * 11) % 30) / 100));
        scene.objects.push(oo); made.push(oo); touch(oo.id);
      }
      const where = a.near ? ` by ${the(need(a.near))}` : (a.from && a.to ? ` from ${the(need(a.from))} to ${the(need(a.to))}` : a.around ? ` around ${the(need(a.around))}` : "");
      return { ok: true, say: `Added ${count > 1 ? count + " " + (norm(a.species || a.kind) || made[0].kind) + "s" : "a" + (/^[aeiou]/i.test(made[0].name) ? "n " : " ") + made[0].name.toLowerCase()}${where}.`, changed: made.map(o => o.id) };
    }
    case "move_object": {
      const o = need(a.target);
      if (o.points && !o.pos) { const [cx, cz] = center(o); let nx = cx, nz = cz;
        if (a.x !== undefined && a.z !== undefined) { nx = num(a.x, cx); nz = num(a.z, cz); } else if (a.direction && DIRS[norm(a.direction)]) { const d = DIRS[norm(a.direction)], L = num(a.distance, 5); nx = cx + d[0] * L; nz = cz + d[1] * L; } else if (a.near) { const t = need(a.near); [nx, nz] = freeSpot(scene, t, radius(o), o.id); }
        o.points = o.points.map(p => [r2(p[0] + nx - cx), r2(p[1] + nz - cz)]); touch(o.id); return { ok: true, say: `Moved ${the(o)}.`, changed: [o.id] }; }
      let [x, , z] = o.pos;
      if (a.x !== undefined && a.z !== undefined) { x = num(a.x, x); z = num(a.z, z); }
      else if (a.near) { const t = need(a.near); if (a.direction && DIRS[norm(a.direction)]) { const d = DIRS[norm(a.direction)], [cx, cz] = center(t), dist = num(a.distance, radius(t) + radius(o) + 2); x = cx + d[0] * dist; z = cz + d[1] * dist; } else[x, z] = freeSpot(scene, t, radius(o), o.id); }
      else if (a.direction && DIRS[norm(a.direction)]) { const d = DIRS[norm(a.direction)], L = num(a.distance, 5); x += d[0] * L; z += d[1] * L; }
      else if (a.dx !== undefined || a.dz !== undefined) { x += num(a.dx, 0); z += num(a.dz, 0); }
      else throw new Error("tell me where to move it");
      o.pos = [r2(x), o.pos[1], r2(z)]; if (a.y !== undefined) o.pos[1] = num(a.y, o.pos[1]); touch(o.id);
      return { ok: true, say: `Moved ${the(o)}${a.near ? " next to " + the(need(a.near)) : a.direction ? " " + num(a.distance, 5) + " metres " + norm(a.direction) : ""}.`, changed: [o.id] };
    }
    case "rotate_object": { const o = need(a.target); const d = num(a.degrees, 90); if (o.pos) o.rot = ((num(o.rot, 0) + d) % 360 + 360) % 360; else { const [cx, cz] = center(o), t = -d * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); o.points = o.points.map(p => [r2(cx + (p[0] - cx) * c - (p[1] - cz) * s), r2(cz + (p[0] - cx) * s + (p[1] - cz) * c)]); } touch(o.id); return { ok: true, say: `Turned ${the(o)} ${Math.abs(d)} degrees.`, changed: [o.id] }; }
    case "scale_object": { const o = need(a.target); let f = num(a.factor, NaN); if (!Number.isFinite(f)) f = /small|less|shrink/.test(norm(a.factor)) ? 0.7 : 1.5; f = Math.max(0.1, Math.min(10, f)); o.scale = r2(Math.max(0.05, Math.min(30, num(o.scale, 1) * f))); touch(o.id); return { ok: true, say: `Made ${the(o)} ${f >= 1 ? "bigger" : "smaller"}.`, changed: [o.id] }; }
    case "delete_object": { const o = need(a.target); scene.objects = scene.objects.filter(x => x.id !== o.id); if (scene.meta.last === o.id) scene.meta.last = null; return { ok: true, say: `Removed ${the(o)}.`, changed: [o.id] }; }
    case "set_color": { const o = need(a.target); const c = parseColor(a.color); if (!c) throw new Error(`I don't know the colour "${a.color}"`); if (/roof/.test(norm(a.part))) o.roofColor = c; else o.color = c; if (o.texture && o.texture !== "plain" && TEX_COLOR[o.texture] && !/roof/.test(norm(a.part)) && /stone|brick|slate/.test(norm(a.color))) o.texture = /brick/.test(norm(a.color)) ? "brick" : /slate/.test(norm(a.color)) ? "slate" : "stone"; touch(o.id); return { ok: true, say: `The ${label(o)}${/roof/.test(norm(a.part)) ? " roof" : ""} is ${norm(a.color)} now.`, changed: [o.id] }; }
    case "set_texture": { const o = need(a.target); const t = norm(a.texture).replace(/s$/, ""); const T = TEXTURES.find(x => x === t || t.includes(x)); if (!T) throw new Error(`I can do ${TEXTURES.join(", ")}`); o.texture = T; if (a.recolor !== false && TEX_COLOR[T]) o.color = TEX_COLOR[T]; touch(o.id); return { ok: true, say: `The ${label(o)} is ${T} now.`, changed: [o.id] }; }
    case "rename_object": { const o = need(a.target); const nm = String(a.name || "").slice(0, 60); if (!nm) throw new Error("what should I call it?"); o.name = nm; if (o.kind === "label") o.text = nm; touch(o.id); return { ok: true, say: `Renamed it ${nm}.`, changed: [o.id] }; }
    case "set_label_text": { const o = need(a.target); o.text = String(a.text || "").slice(0, 60); if (o.label) o.label.title = o.text; touch(o.id); return { ok: true, say: `Changed the sign to ${o.text}.`, changed: [o.id] }; }
    case "set_time_of_day": { let h = num(a.hour, NaN); const w = norm(a.time); if (!Number.isFinite(h)) h = TIMES[w] !== undefined ? TIMES[w] : 12; scene.env.time = Object.keys(TIMES).find(k => TIMES[k] === h) || String(h); scene.env.hour = h; return { ok: true, say: `It's ${w || h + " o'clock"} now.`, changed: ["env"] }; }
    case "set_weather": { const w = norm(a.weather); const W = WEATHER.find(x => w.includes(x)) || (/sun|fine|bright/.test(w) ? "clear" : /mist|haz/.test(w) ? "fog" : /drizzle|shower|wet/.test(w) ? "rain" : /thunder/.test(w) ? "storm" : null); if (!W) throw new Error(`I can do ${WEATHER.join(", ")}`); scene.env.weather = W; return { ok: true, say: W === "clear" ? "Clear skies." : `Weather's ${W} now.`, changed: ["env"] }; }
    case "set_camera": {
      let pos, target;
      if (a.target) { const o = need(a.target); const [cx, cz] = center(o); const r = Math.max(8, radius(o) * 2.2); const v = norm(a.view);
        target = [r2(cx), 1, r2(cz)]; pos = v.includes("overhead") || v.includes("above") || v.includes("top") ? [r2(cx + 0.1), r2(r * 2.6), r2(cz + 0.1)] : v.includes("ground") || v.includes("street") || v.includes("eye") ? [r2(cx + r * 0.9), 1.7, r2(cz + r * 1.1)] : [r2(cx + r * 0.9), r2(r * 0.9), r2(cz + r * 1.3)]; }
      else { const v = norm(a.view); if (v.includes("overhead") || v.includes("above") || v.includes("map") || v.includes("top")) { pos = [0.1, 190, 0.1]; target = [0, 0, -10]; } else { pos = [60, 55, 120]; target = [0, 0, -20]; } }
      scene.env.camera = { pos, target }; scene.meta.camera_seq = (scene.meta.camera_seq || 0) + 1;
      return { ok: true, say: a.target ? `Here's ${the(need(a.target))}.` : "There's the whole estate.", changed: ["camera"] };
    }
    default: throw new Error("unknown tool " + name);
  }
}
export function summary(scene, max = 90) {
  const L = scene.objects.slice(-max).map(o => { const [x, z] = center(o); return `${o.id} | ${o.name || ""} | ${o.kind}${o.species ? "/" + o.species : ""}${o.color ? " " + o.color : ""} @(${Math.round(x)},${Math.round(z)})`; });
  return `time=${scene.env.time} weather=${scene.env.weather}\n` + L.join("\n");
}
