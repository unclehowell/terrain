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
        const baseName = a.species && oo.kind === "tree" ? a.species + " tree" : a.species && ["animal", "vehicle"].includes(oo.kind) ? a.species : (a.species ? a.species + " " : "") + (norm(a.kind) || oo.kind); const nm = a.name || (a.text && ["label", "sign"].includes(oo.kind) ? a.text : null) || baseName.replace(/^(\w)/, c => c.toUpperCase());
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

// ---------- Llandough schematic layout (also run by tools/llandough-layout.mjs) ----------
// Pure: takes a scene and returns it re-laid as a schematic of Llandough. Idempotent.
// SCHEMATIC, not survey-accurate; see the anchors noted beside the river and roads below.
export function llandoughRelayout(scene) {
  let seed = 20261024;
  const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const r2 = n => Math.round(n * 100) / 100;

  // ---------- keep / drop ----------
  const DROP_IDS = new Set(["stone_path", "hill", "button", "button_2", "button_3"]);
  const kept = scene.objects.filter(o => !DROP_IDS.has(o.id) && !String(o.id).startsWith("ll_"));
  const isSite = o => o.kind === "building" && o.url;
  const sites = kept.filter(isSite);
  const rest = kept.filter(o => !isSite(o));
  const enemy = sites.find(o => o.enemy);
  const campFence = rest.find(o => o.id === "enemy_camp_fence");
  const campSign = rest.find(o => o.id === "enemy_camp_sign");

  // ---------- occupancy ----------
  const blocks = [];
  const circle = (x, z, r) => blocks.push({ t: "c", x, z, r });
  const rect = (x, z, w, d, pad = 0) => blocks.push({ t: "r", x0: x - w / 2 - pad, x1: x + w / 2 + pad, z0: z - d / 2 - pad, z1: z + d / 2 + pad });
  const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1; let t = ((px - ax) * dx + (pz - az) * dz) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (ax + t * dx), pz - (az + t * dz)); };
  const polyDist = (px, pz, pts) => { let m = 1e9; for (let i = 1; i < pts.length; i++) m = Math.min(m, segDist(px, pz, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])); return m; };
  const line = (pts, hw) => blocks.push({ t: "s", pts, hw });
  function free(x, z, r, rRoad = r) {
    for (const b of blocks) {
      if (b.t === "c") { if (Math.hypot(x - b.x, z - b.z) < b.r + r) return false; }
      else if (b.t === "r") { if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return false; }
      else if (polyDist(x, z, b.pts) < b.hw + rRoad) return false;
    }
    return true;
  }
  const freeRect = (x, z, w, d) => { for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) if (!free(x - w / 2 + w * i / 4, z - d / 2 + d * j / 4, 1.5, 2)) return false; return true; };

  // existing farm / church objects stay put and block
  for (const o of rest) {
    if (o.id === "enemy_camp_fence" || o.id === "enemy_camp_sign") continue;
    if (o.kind === "building") { const s = o.size || [6, 4, 6]; circle(o.pos[0], o.pos[2], Math.hypot(s[0], s[2]) / 2); }
    else if (o.kind === "field") rect(o.pos[0], o.pos[2], o.size[0], o.size[1]);
    else if (o.kind === "water") circle(o.pos[0], o.pos[2], (o.radius || 4) + 1);
    else if (o.kind === "tree") circle(o.pos[0], o.pos[2], 2);
    else if (o.kind === "path" && o.points) line(o.points, (o.width || 1.6) / 2);
    else if (o.kind === "wall" && o.points) line(o.points, 0.6);
    else if (o.pos && o.kind !== "label") circle(o.pos[0], o.pos[2], 1.5);
  }
  rect(0, 38, 104, 108); // keep the whole Great House Farm / churchyard area clear

  // ---------- river and roads ----------
  // Anchors used (real coordinates): St Dochdwy's church 51.4496N 3.1979W; University
  // Hospital Llandough 51.4492N 3.2028W (about 340 m west of the church); Cogan station
  // 51.4461N 3.1891W; Pont y Werin over the Ely 51.4477N 3.1864W (about 800 m east); the
  // Ely mouth in Cardiff Bay 51.4561N 3.1739W; Cardiff City Stadium at Leckwith
  // 51.4728N 3.2031W (about 2.6 km north of the hospital). The Ely therefore runs down the
  // EAST side of the village from the Leckwith end in the north, and Leckwith Road
  // (B4267) leaves the village northwards to cross it by Leckwith Bridge.
  // Distances are compressed (roughly 1 unit = 7 m) and the farm area stays oversize.
  const RIVER = { id: "river_ely", name: "River Ely", w: 12, pts: [[-55, -170], [-28, -148], [5, -125], [35, -92], [60, -50], [72, -10], [84, 28], [98, 66], [112, 92], [150, 94], [195, 82]] };
  const ROAD = "#3a3d40", LANE = "#6b5a45", WATER = "#2f6f9f";
  const roads = [
    { id: "leckwith_road", name: "Leckwith Road (B4267)", w: 5.5, pts: [[-62, 8], [-63, -50], [-52, -100], [-35, -135], [-10, -165]] },
    { id: "penlan_road", name: "Penlan Road (B4267)", w: 5.5, pts: [[-62, 8], [-58, 35], [-60, 62], [-55, 95], [-40, 130], [-10, 150]] },
    { id: "llandough_hill", name: "Llandough Hill", w: 5, pts: [[-62, 8], [-35, -12], [5, -18], [40, -12], [58, 10], [70, 40], [82, 75], [90, 108]] },
    { id: "penarth_road", name: "Penarth Road (A4160)", w: 7, pts: [[30, 156], [90, 116], [118, 95], [150, 70], [185, 45]] },
    { id: "barry_road", name: "Barry Road (A4055)", w: 7, pts: [[-95, 172], [-40, 160], [-10, 150], [30, 156]] },
    { id: "church_road", name: "Church Road", w: 3.5, pts: [[-60.8, 16], [-35, 17], [-10, 14], [0, 14]] },
    { id: "greenway_close", name: "Greenway Close", w: 4, pts: [[5, -18], [5, -44], [-2, -62]], minor: true },
    { id: "corbett_road", name: "Corbett Road", w: 4, pts: [[-57, 100], [-95, 112], [-130, 118]], minor: true },
    { id: "hospital_drive", name: "Hospital drive", w: 4.5, pts: [[-60, 74], [-72, 74]], minor: true },
    { id: "authorities_track", name: "Authorities track", w: 3, pts: [[-52, -98], [-32, -95]], lane: true },
  ];
  const out = [];
  for (const r of roads) {
    out.push({ id: "ll_" + r.id, name: r.name, kind: "path", points: r.pts, width: r.w, color: r.lane ? LANE : ROAD, ...(r.lane ? { texture: "gravel" } : {}) });
    line(r.pts, r.w / 2 + 0.6);
  }
  const road = id => roads.find(r => r.id === id);

  // The Ely: cut where a road crosses it, and give each crossing a bridge (parapet walls).
  {
    const cum = [0]; for (let i = 1; i < RIVER.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(RIVER.pts[i][0] - RIVER.pts[i - 1][0], RIVER.pts[i][1] - RIVER.pts[i - 1][1]));
    const total = cum.at(-1);
    const at = s => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1]); return [RIVER.pts[i - 1][0] + (RIVER.pts[i][0] - RIVER.pts[i - 1][0]) * t, RIVER.pts[i - 1][1] + (RIVER.pts[i][1] - RIVER.pts[i - 1][1]) * t]; };
    const cuts = [], bridges = [];
    for (const r of roads) {
      for (let j = 1; j < r.pts.length; j++) for (let i = 1; i < RIVER.pts.length; i++) {
        const [x1, z1] = RIVER.pts[i - 1], [x2, z2] = RIVER.pts[i], [x3, z3] = r.pts[j - 1], [x4, z4] = r.pts[j];
        const den = (x2 - x1) * (z4 - z3) - (z2 - z1) * (x4 - x3); if (Math.abs(den) < 1e-9) continue;
        const t = ((x3 - x1) * (z4 - z3) - (z3 - z1) * (x4 - x3)) / den, u = ((x3 - x1) * (z2 - z1) - (z3 - z1) * (x2 - x1)) / den;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue;
        const px = x1 + (x2 - x1) * t, pz = z1 + (z2 - z1) * t;
        const rl = Math.hypot(x2 - x1, z2 - z1), ql = Math.hypot(x4 - x3, z4 - z3), sinT = Math.abs(((x2 - x1) * (z4 - z3) - (z2 - z1) * (x4 - x3)) / (rl * ql));
        const g = r.w / 2 / Math.max(0.5, sinT) + 6.8, s = cum[i - 1] + rl * t;
        cuts.push({ s0: s - g, s1: s + g }); bridges.push({ r, px, pz, dx: (x4 - x3) / ql, dz: (z4 - z3) / ql });
      }
    }
    cuts.sort((a, b) => a.s0 - b.s0);
    let start = 0; const spans = [];
    for (const c of cuts) { if (c.s0 > start + 1) spans.push([start, c.s0]); start = Math.max(start, c.s1); }
    if (start < total - 1) spans.push([start, total]);
    spans.forEach(([a, b], k) => {
      const pts = [at(a)]; for (let i = 1; i < RIVER.pts.length - 1; i++) if (cum[i] > a && cum[i] < b) pts.push(RIVER.pts[i]); pts.push(at(b));
      out.push({ id: "ll_river_ely_" + (k + 1), name: "River Ely", kind: "path", points: pts.map(p => [r2(p[0]), r2(p[1])]), width: RIVER.w, color: WATER });
    });
    line(RIVER.pts, RIVER.w / 2 + 1.5);
    bridges.forEach((b, k) => {
      const nx = -b.dz, nz = b.dx, hw = b.r.w / 2 + 0.5, g = 11;
      for (const sd of [1, -1]) out.push({ id: `ll_bridge_${k + 1}_${sd > 0 ? "a" : "b"}`, name: "Bridge parapet", kind: "wall", points: [[r2(b.px - b.dx * g + nx * hw * sd), r2(b.pz - b.dz * g + nz * hw * sd)], [r2(b.px + b.dx * g + nx * hw * sd), r2(b.pz + b.dz * g + nz * hw * sd)]], color: "#8a8d8f", height: 1, texture: "stone" });
      if (b.r.id === "leckwith_road") out.push({ id: "ll_label_leckwith_bridge", name: "Leckwith Bridge", kind: "label", pos: [r2(b.px + 12), 4, r2(b.pz)], text: "LECKWITH BRIDGE", color: "#ffffff", rot: 0 });
    });
  }

  // ---------- helpers along polylines ----------
  function sample(pts, step, jitter = 0) {
    const res = []; let carry = rnd() * step * 0.5;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i]; const len = Math.hypot(bx - ax, bz - az); const dx = (bx - ax) / len, dz = (bz - az) / len;
      for (let d = carry; d < len; d += step + (jitter ? (rnd() - 0.5) * jitter : 0)) res.push({ x: ax + dx * d, z: az + dz * d, dx, dz, a: Math.atan2(dz, dx) * 180 / Math.PI });
      carry = 0;
    }
    return res;
  }
  const normal = p => [-p.dz, p.dx]; // door-facing side at rot = a
  const rotFor = (p, s) => r2(p.a + (s === 1 ? 180 : 0));

  // ---------- special places ----------
  // hospital (University Hospital Llandough): west of Penlan Road, level with the church
  const hosp = [
    { n: "Hospital main block", pos: [-95, 0, 62], size: [30, 10, 14], color: "#c9c2b0", roof: "flat", roofColor: "#8a8d8f" },
    { n: "Hospital ward block", pos: [-95, 0, 84], size: [24, 9, 12], color: "#cdbfa4", roof: "flat", roofColor: "#8a8d8f" },
    { n: "Hospital tower", pos: [-76, 0, 74], size: [10, 17, 10], color: "#d8d2c0", roof: "flat", roofColor: "#6b6f73" },
    { n: "Hospital outpatients", pos: [-76, 0, 52], size: [14, 6, 10], color: "#b9715a", roof: "gable", roofColor: "#4d5862" },
  ];
  hosp.forEach((h, i) => { out.push({ id: "ll_hospital_" + (i + 1), name: h.n, kind: "building", roof: h.roof, pos: h.pos, rot: 0, scale: 1, size: h.size, color: h.color, roofColor: h.roofColor, texture: "plaster" }); circle(h.pos[0], h.pos[2], Math.hypot(h.size[0], h.size[2]) / 2); });
  out.push({ id: "ll_hospital_carpark", name: "Hospital car park", kind: "field", pos: [-100, 0, 38], size: [26, 14], color: "#55585c" }); rect(-100, 38, 26, 14);
  out.push({ id: "ll_hospital_label", name: "Hospital label", kind: "label", pos: [-95, 19, 66], text: "UNIVERSITY HOSPITAL LLANDOUGH", color: "#ffffff", rot: 0 });
  rect(-90, 66, 56, 62);
  // primary school and village green near the Leckwith Road / Llandough Hill junction
  out.push({ id: "ll_school", name: "Primary school", kind: "building", roof: "gable", pos: [-32, 0, -46], rot: 0, scale: 1, size: [18, 4.5, 10], color: "#b9715a", roofColor: "#7a4b32", texture: "brick" }); rect(-32, -46, 20, 12);
  out.push({ id: "ll_school_playground", name: "School playground", kind: "field", pos: [-32, 0, -62], size: [18, 12], color: "#6b6f73" }); rect(-32, -62, 18, 12);
  out.push({ id: "ll_school_label", name: "School label", kind: "label", pos: [-32, 8, -46], text: "PRIMARY SCHOOL", color: "#ffffff", rot: 0 });
  out.push({ id: "ll_village_green", name: "Village green", kind: "field", pos: [-44, 0, -24], size: [14, 10], color: "#6cae4a" }); rect(-44, -24, 14, 10);
  out.push({ id: "ll_village_green_label", name: "Village green label", kind: "label", pos: [-44, 5, -24], text: "VILLAGE GREEN", color: "#ffffff", rot: 0 });
  // King George V Playing Field (Greenway Close side of Llandough Hill)
  out.push({ id: "ll_kgv_field", name: "King George V Playing Field", kind: "field", pos: [26, 0, -44], size: [30, 24], color: "#5fa043" }); rect(26, -44, 30, 24);
  out.push({ id: "ll_kgv_fence", name: "Playing field fence", kind: "fence", points: [[11, -32], [41, -32], [41, -56], [11, -56], [11, -32.01]], color: "#8b5a2b", height: 1.2 });
  out.push({ id: "ll_kgv_label", name: "Playing field label", kind: "label", pos: [26, 6, -44], text: "KING GEORGE V PLAYING FIELD", color: "#ffffff", rot: 0 });
  for (const [bx, bz] of [[14, -30], [22, -30]]) out.push({ id: `ll_bench_${bx}`, name: "Bench", kind: "bench", pos: [bx, 0, bz], rot: 0, scale: 1, color: "#8b5a2b" });
  // allotments (Corbett Road)
  out.push({ id: "ll_allotments", name: "Allotments", kind: "field", pos: [-118, 0, 140], size: [36, 22], color: "#6f8a3a", crop: "wheat" }); rect(-118, 140, 36, 22, 2);
  out.push({ id: "ll_allotments_hedge", name: "Allotments hedge", kind: "hedge", points: [[-136, 129], [-100, 129], [-100, 151], [-136, 151], [-136, 129.01]], color: "#2f5a2a", height: 1.4 });
  out.push({ id: "ll_allotments_label", name: "Allotments label", kind: "label", pos: [-118, 5, 140], text: "ALLOTMENTS", color: "#ffffff", rot: 0 });
  out.push({ id: "ll_allotments_lane", name: "Allotments lane", kind: "path", points: [[-112, 114], [-118, 129]], width: 2.2, color: LANE, texture: "gravel" });
  line([[-112, 114], [-118, 129]], 2);
  for (let i = 0; i < 6; i++) { const x = -130 + i * 7, z = 136 + (i % 2) * 9; out.push({ id: "ll_shed_" + (i + 1), name: "Allotment shed", kind: "building", roof: "flat", pos: [x, 0, z], rot: 0, scale: 1, size: [2.4, 2.2, 2], color: "#6b5a45", roofColor: "#3a3d40", texture: "wood" }); }
  // Merrie Harrier (Penlan Road meets Barry Road) and Cogan, east of the village by the river
  out.push({ id: "ll_merrie_harrier", name: "The Merrie Harrier", kind: "building", roof: "gable", pos: [-22, 0, 140], rot: 30, scale: 1, size: [14, 6, 8], color: "#e9e2d0", roofColor: "#4d5862", texture: "plaster", chimneys: 2 }); circle(-22, 140, 9);
  out.push({ id: "ll_merrie_harrier_label", name: "Merrie Harrier label", kind: "label", pos: [-22, 9, 140], text: "THE MERRIE HARRIER", color: "#ffffff", rot: 0 });
  out.push({ id: "ll_cogan_label", name: "Cogan label", kind: "label", pos: [88, 7, 128], text: "COGAN", color: "#ffffff", rot: 0 });
  // enemy camp (Public Authorities) keeps its fence and sign, on its own plot off Leckwith Road
  if (enemy) {
    const ex = -20, ez = -95;
    enemy.pos = [ex, 0, ez]; enemy.rot = 180;
    circle(ex, ez, 14);
    if (campFence) campFence.points = [[ex - 5.8, ez - 9], [ex + 0.0, ez - 9], [ex + 12, ez - 9], [ex + 12, ez + 9], [ex - 12, ez + 9], [ex - 12, ez - 9], [ex - 5.8, ez - 9]];
    if (campSign) campSign.pos = [ex, campSign.pos[1], ez + 9.3];
    rect(ex, ez, 28, 24);
  }

  // ---------- site buildings on the roads ----------
  const siteRoadOrder = ["llandough_hill", "leckwith_road", "penlan_road", "penarth_road"];
  const slots = [];
  for (const rid of siteRoadOrder) {
    const r = road(rid); let side = 1;
    for (const p of sample(r.pts, 24)) { slots.push({ p, r, s: side }); side = -side; }
  }
  const placedSites = [];
  let si = 0;
  for (const s of sites) {
    if (s === enemy) { placedSites.push(s); continue; }
    const sz = s.size || [5.6, 3.4, 4.6];
    let ok = false;
    while (si < slots.length && !ok) {
      const { p, r, s: side } = slots[si++]; const n = normal(p); const off = r.w / 2 + 5 + sz[2] / 2;
      // side=+1 means the house sits on the +normal side; its door faces back to the road
      const px = p.x + n[0] * side * off, pz = p.z + n[1] * side * off;
      if (free(px, pz, Math.max(sz[0], sz[2]) / 2, sz[2] / 2 + 0.5)) {
        s.pos = [r2(px), 0, r2(pz)]; s.rot = rotFor(p, side); circle(px, pz, Math.max(sz[0], sz[2]) / 2); ok = true;
      }
    }
    if (!ok) /* no free slot: leave it where it is */ void 0;
    placedSites.push(s);
  }

  // ---------- houses ----------
  const RENDER = ["#e9e2d0", "#d8cdb4", "#cfd8dc", "#e8d9b0", "#c9c2b0", "#f1e6c8"], BRICK = ["#b9715a", "#a8624d", "#9c5b48"];
  const SLATE = ["#4d5862", "#3b4148", "#5b4a42"], TILE = ["#7a4b32", "#8a5a3a"];
  let hn = 0;
  function house(p, side, r) {
    const semi = rnd() < 0.45, w = semi ? 12 + rnd() * 2 : 7 + rnd() * 3, d = 6 + rnd() * 1.5, h = 4.4 + rnd() * 1.2;
    const off = r.w / 2 + 3.5 + d / 2, n = normal(p);
    const x = p.x + n[0] * side * off, z = p.z + n[1] * side * off;
    if (!free(x, z, Math.max(w, d) / 2 * 0.95, d / 2 + 0.6)) return false;
    const brick = rnd() < 0.4;
    out.push({ id: "ll_house_" + String(++hn).padStart(3, "0"), name: semi ? "Semi-detached house" : "House", kind: "building", roof: "gable", pos: [r2(x), 0, r2(z)], rot: rotFor(p, side), scale: 1, size: [r2(w), r2(h), r2(d)], color: brick ? pick(BRICK) : pick(RENDER), roofColor: rnd() < 0.7 ? pick(SLATE) : pick(TILE), texture: brick ? "brick" : "plaster", chimneys: semi ? 2 : 1 });
    circle(x, z, Math.max(w, d) / 2 * 0.95); return true;
  }
  for (const r of roads) {
    if (r.lane || r.id === "hospital_drive") continue;
    const step = r.minor ? 11 : 12.5;
    for (const p of sample(r.pts, step, 3)) {
      // fewer houses on the trunk roads and on the lonely ends
      for (const side of [1, -1]) { if (rnd() < (r.id.endsWith("_road") && r.w >= 7 ? 0.9 : 0.12)) continue; house(p, side, r); }
    }
  }

  // ---------- greenery ----------
  const SPECIES = ["oak", "ash", "beech", "birch", "hawthorn", "oak", "ash"];
  let tn = 0;
  const tree = (x, z, sp, h) => { out.push({ id: "ll_tree_" + String(++tn).padStart(3, "0"), name: sp[0].toUpperCase() + sp.slice(1) + " tree", kind: "tree", species: sp, pos: [r2(x), 0, r2(z)], height: r2(h), rot: 0, scale: 1 }); circle(x, z, 2.2); };
  // street trees
  for (const r of roads) { if (r.lane) continue; for (const p of sample(r.pts, 19, 6)) { const n = normal(p), s = rnd() < 0.5 ? 1 : -1, off = r.w / 2 + 2; const x = p.x + n[0] * s * off, z = p.z + n[1] * s * off; if (rnd() < 0.45 && free(x, z, 2.2, 1)) tree(x, z, pick(SPECIES), 6 + rnd() * 5); } }
  // Leckwith Woods style banks along the Ely
  for (const p of sample(RIVER.pts, 6, 2)) for (const sd of [1, -1]) {
    if (rnd() < 0.5) continue; const n = normal(p), off = RIVER.w / 2 + 3 + rnd() * 9; const x = p.x + n[0] * sd * off, z = p.z + n[1] * sd * off;
    if (Math.hypot(x, z) < 205 && free(x, z, 2.2, 2.5)) tree(x, z, pick(["ash", "beech", "oak", "birch"]), 8 + rnd() * 6);
  }
  // pastures around the edge
  const PASTURE = ["#6b8f3a", "#7a9a40", "#5f8a38"];
  const pastures = [];
  for (let tries = 0; tries < 400 && pastures.length < 11; tries++) {
    const a = rnd() * Math.PI * 2, rad = 85 + rnd() * 100, x = Math.cos(a) * rad - 5, z = Math.sin(a) * rad * 0.9 + 10, w = 28 + rnd() * 22, d = 22 + rnd() * 14;
    if (Math.hypot(x, z) > 190) continue;
    if (!freeRect(x, z, w, d)) continue;
    const wheat = pastures.length % 4 === 3;
    out.push({ id: "ll_pasture_" + (pastures.length + 1), name: wheat ? "Wheat field" : "Pasture", kind: "field", pos: [r2(x), 0, r2(z)], size: [r2(w), r2(d)], color: wheat ? "#a39a4a" : pick(PASTURE), ...(wheat ? { crop: "wheat" } : {}) });
    rect(x, z, w, d, 1); pastures.push({ x, z, w, d });
    if (pastures.length % 2 === 0) out.push({ id: "ll_hedge_" + pastures.length, name: "Hedgerow", kind: "hedge", points: [[r2(x - w / 2), r2(z - d / 2)], [r2(x + w / 2), r2(z - d / 2)], [r2(x + w / 2), r2(z + d / 2)], [r2(x - w / 2), r2(z + d / 2)], [r2(x - w / 2), r2(z - d / 2 + 0.01)]], color: "#2f5a2a", height: 1.4 });
  }
  // small woods and copses
  for (let w = 0, tries = 0; w < 6 && tries < 300; tries++) {
    const a = rnd() * Math.PI * 2, rad = 100 + rnd() * 60, cx = Math.cos(a) * rad - 5, cz = Math.sin(a) * rad * 0.9 + 10;
    if (Math.hypot(cx, cz) > 165 || !free(cx, cz, 11, 8)) continue;
    for (let k = 0; k < 10; k++) { const t = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 10; const x = cx + Math.cos(t) * rr, z = cz + Math.sin(t) * rr; if (free(x, z, 2.2, 3)) tree(x, z, pick(["oak", "ash", "beech", "oak"]), 8 + rnd() * 5); }
    w++;
  }
  // garden and verge trees inside the village
  for (let tries = 0, got = 0; tries < 600 && got < 55; tries++) {
    const x = -150 + rnd() * 300, z = -130 + rnd() * 260;
    let near = 1e9; for (const r of roads) near = Math.min(near, polyDist(x, z, r.pts));
    if (near > 28 || near < 6) continue;
    if (free(x, z, 3, 3)) { tree(x, z, pick(SPECIES), 5 + rnd() * 5); got++; }
  }
  // churchyard yew and the existing oak ring are kept as they are

  // ---------- road name labels ----------
  const lab = [["penlan_road", 3, "PENLAN ROAD"], ["leckwith_road", 2, "LECKWITH ROAD"], ["llandough_hill", 3, "LLANDOUGH HILL"], ["penarth_road", 1, "PENARTH ROAD"], ["barry_road", 1, "BARRY ROAD"], ["church_road", 1, "CHURCH ROAD"], ["corbett_road", 1, "CORBETT ROAD"], ["greenway_close", 1, "GREENWAY CLOSE"]];
  for (const [rid, seg, text] of lab) { const r = road(rid); const a = r.pts[seg - 1], b = r.pts[seg]; out.push({ id: "ll_label_" + rid, name: text, kind: "label", pos: [r2((a[0] + b[0]) / 2), 3.2, r2((a[1] + b[1]) / 2)], text, color: "#f2c94c", rot: 0 }); }
  out.push({ id: "ll_label_river", name: "River Ely label", kind: "label", pos: [90, 5, 38], text: "RIVER ELY", color: "#8fd0ff", rot: 0 });
  out.push({ id: "ll_label_north", name: "North label", kind: "label", pos: [-30, 6, -150], text: "TO LECKWITH AND CARDIFF CITY STADIUM", color: "#ffffff", rot: 0 });
  out.push({ id: "ll_label_bay", name: "Bay label", kind: "label", pos: [165, 6, 100], text: "TO CARDIFF BAY", color: "#8fd0ff", rot: 0 });

  // ---------- assemble ----------
  // farm and church objects first, then the linked site buildings, then the new village
  scene.objects = [...rest, ...sites, ...out];
  scene.env = { ...scene.env, camera: { pos: [95, 145, 215], target: [-5, 0, 0] } };
  scene.meta = { ...(scene.meta || {}), version: "Llandough", layout: "llandough-schematic" };
  return scene;
}
