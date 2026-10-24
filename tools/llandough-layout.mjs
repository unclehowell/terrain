// Re-lays a terrain scene.json as a schematic of Llandough (Cardiff / Vale of Glamorgan).
// Usage: node tools/llandough-layout.mjs <in-scene.json> <out-scene.json>
//
// SCHEMATIC, not survey-accurate: road names, the hospital, school, playing field,
// village green, allotments and the Merrie Harrier junction follow the village as
// described publicly, but every coordinate is hand-placed. It is not derived from
// OpenStreetMap or Ordnance Survey data.
//
// Great House Farm, St Dochdwy's church/churchyard, the farm fields and pond are kept
// exactly where they are. The linked site buildings keep their ids, sizes, colours and
// urls and are re-placed along the roads. Re-running on its own output is safe.
import fs from "node:fs";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) { console.error("usage: node tools/llandough-layout.mjs <in> <out>"); process.exit(1); }
const raw = fs.readFileSync(inPath, "utf8");
const scene = JSON.parse(raw);

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

// ---------- roads ----------
const ROAD = "#3a3d40", LANE = "#6b5a45";
const roads = [
  { id: "penlan_road", name: "Penlan Road (B4267)", w: 5.5, pts: [[-120, -70], [-90, -35], [-72, 0], [-66, 45], [-45, 95], [0, 120], [60, 131], [100, 128]] },
  { id: "leckwith_road", name: "Leckwith Road", w: 5, pts: [[-120, -70], [-135, -105], [-150, -145]] },
  { id: "llandough_hill", name: "Llandough Hill", w: 5, pts: [[-120, -70], [-75, -95], [-20, -112], [40, -125], [100, -132], [140, -128]] },
  { id: "penarth_road", name: "Penarth Road (A4160)", w: 7, pts: [[140, -128], [150, -70], [150, 0], [145, 70], [130, 120]] },
  { id: "barry_road", name: "Barry Road (A4055)", w: 7, pts: [[30, 155], [100, 128], [158, 100]] },
  { id: "lewis_road", name: "Lewis Road", w: 4.5, pts: [[-81, -18], [-40, -8], [0, -6], [40, -12], [80, -28]] },
  { id: "church_road", name: "Church Road", w: 3.5, pts: [[-72, 0], [-45, 10], [-20, 14], [0, 14]] },
  { id: "greenway_close", name: "Greenway Close", w: 4, pts: [[8, -6], [8, -28], [2, -44]], minor: true },
  { id: "spencer_drive", name: "Spencer Drive", w: 4, pts: [[-69, 22], [-90, 32], [-100, 44]], minor: true },
  { id: "corbett_road", name: "Corbett Road", w: 4, pts: [[-66, 48], [-100, 60], [-132, 66]], minor: true },
  { id: "hospital_drive", name: "Hospital drive", w: 4.5, pts: [[-72, 4], [-98, 6]], minor: true },
  { id: "authorities_track", name: "Authorities track", w: 3, pts: [[56, -70], [56, -128]], lane: true },
];
const out = [];
for (const r of roads) {
  out.push({ id: "ll_" + r.id, name: r.name, kind: "path", points: r.pts, width: r.w, color: r.lane ? LANE : ROAD, ...(r.lane ? { texture: "gravel" } : {}) });
  line(r.pts, r.w / 2 + 0.6);
}
const road = id => roads.find(r => r.id === id);

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
const place = [];
// hospital (University Hospital Llandough)
const hosp = [
  { n: "Hospital main block", pos: [-122, 0, -8], size: [30, 10, 14], rot: 0, color: "#c9c2b0", roof: "flat", roofColor: "#8a8d8f" },
  { n: "Hospital ward block", pos: [-124, 0, 14], size: [24, 9, 12], rot: 0, color: "#cdbfa4", roof: "flat", roofColor: "#8a8d8f" },
  { n: "Hospital tower", pos: [-104, 0, 4], size: [10, 17, 10], rot: 0, color: "#d8d2c0", roof: "flat", roofColor: "#6b6f73" },
  { n: "Hospital outpatients", pos: [-100, 0, -14], size: [14, 6, 10], rot: 0, color: "#b9715a", roof: "gable", roofColor: "#4d5862" },
];
hosp.forEach((h, i) => { out.push({ id: "ll_hospital_" + (i + 1), name: h.n, kind: "building", roof: h.roof, pos: h.pos, rot: h.rot, scale: 1, size: h.size, color: h.color, roofColor: h.roofColor, texture: "plaster" }); circle(h.pos[0], h.pos[2], Math.hypot(h.size[0], h.size[2]) / 2); });
out.push({ id: "ll_hospital_carpark", name: "Hospital car park", kind: "field", pos: [-120, 0, 38], size: [26, 14], color: "#55585c" }); rect(-120, 38, 26, 14);
out.push({ id: "ll_hospital_label", name: "Hospital label", kind: "label", pos: [-118, 19, 2], text: "UNIVERSITY HOSPITAL LLANDOUGH", color: "#ffffff", rot: 0 });
rect(-118, 6, 46, 52);
// primary school
out.push({ id: "ll_school", name: "Primary school", kind: "building", roof: "gable", pos: [66, 0, 8], rot: 0, scale: 1, size: [18, 4.5, 10], color: "#b9715a", roofColor: "#7a4b32", texture: "brick" }); rect(66, 8, 20, 12);
out.push({ id: "ll_school_playground", name: "School playground", kind: "field", pos: [66, 0, 24], size: [18, 12], color: "#6b6f73" }); rect(66, 24, 18, 12);
out.push({ id: "ll_school_label", name: "School label", kind: "label", pos: [66, 8, 8], text: "PRIMARY SCHOOL", color: "#ffffff", rot: 0 });
// King George V Playing Field (between Lewis Road and Greenway Close)
out.push({ id: "ll_kgv_field", name: "King George V Playing Field", kind: "field", pos: [33, 0, -30], size: [36, 26], color: "#5fa043" }); rect(33, -30, 36, 26);
out.push({ id: "ll_kgv_fence", name: "Playing field fence", kind: "fence", points: [[15, -17], [51, -17], [51, -43], [15, -43], [15, -17.01]], color: "#8b5a2b", height: 1.2 });
out.push({ id: "ll_kgv_label", name: "Playing field label", kind: "label", pos: [33, 6, -30], text: "KING GEORGE V PLAYING FIELD", color: "#ffffff", rot: 0 });
for (const [bx, bz] of [[17, -14.5], [25, -14.5]]) { out.push({ id: `ll_bench_${bx}`, name: "Bench", kind: "bench", pos: [bx, 0, bz], rot: 0, scale: 1, color: "#8b5a2b" }); }
// village green
out.push({ id: "ll_village_green", name: "Village green", kind: "field", pos: [-44, 0, -24], size: [16, 12], color: "#6cae4a" }); rect(-44, -24, 16, 12);
out.push({ id: "ll_village_green_label", name: "Village green label", kind: "label", pos: [-44, 5, -24], text: "VILLAGE GREEN", color: "#ffffff", rot: 0 });
// allotments (Corbett Road)
out.push({ id: "ll_allotments", name: "Allotments", kind: "field", pos: [-112, 0, 88], size: [36, 22], color: "#6f8a3a", crop: "wheat" }); rect(-112, 88, 36, 22, 2);
out.push({ id: "ll_allotments_hedge", name: "Allotments hedge", kind: "hedge", points: [[-130, 77], [-94, 77], [-94, 99], [-130, 99], [-130, 77.01]], color: "#2f5a2a", height: 1.4 });
out.push({ id: "ll_allotments_label", name: "Allotments label", kind: "label", pos: [-112, 5, 88], text: "ALLOTMENTS", color: "#ffffff", rot: 0 });
out.push({ id: "ll_allotments_lane", name: "Allotments lane", kind: "path", points: [[-132, 66], [-112, 74], [-112, 77]], width: 2.2, color: LANE, texture: "gravel" });
line([[-132, 66], [-112, 74], [-112, 77]], 2);
for (let i = 0; i < 6; i++) { const x = -124 + i * 7, z = 84 + (i % 2) * 9; out.push({ id: "ll_shed_" + (i + 1), name: "Allotment shed", kind: "building", roof: "flat", pos: [x, 0, z], rot: 0, scale: 1, size: [2.4, 2.2, 2], color: "#6b5a45", roofColor: "#3a3d40", texture: "wood" }); }
// Merrie Harrier (junction of Penlan Road and Barry Road)
out.push({ id: "ll_merrie_harrier", name: "The Merrie Harrier", kind: "building", roof: "gable", pos: [86, 0, 114], rot: 20, scale: 1, size: [14, 6, 8], color: "#e9e2d0", roofColor: "#4d5862", texture: "plaster", chimneys: 2 }); circle(86, 114, 9);
out.push({ id: "ll_merrie_harrier_label", name: "Merrie Harrier label", kind: "label", pos: [86, 9, 114], text: "THE MERRIE HARRIER", color: "#ffffff", rot: 0 });
// enemy camp (Public Authorities) keeps its fence and sign, on its own plot off Llandough Hill
if (enemy) {
  const ex = 56, ez = -88;
  enemy.pos = [ex, 0, ez]; enemy.rot = 180;
  circle(ex, ez, 14);
  if (campFence) campFence.points = [[ex - 5.8, ez - 9], [ex + 0.0, ez - 9], [ex + 12, ez - 9], [ex + 12, ez + 9], [ex - 12, ez + 9], [ex - 12, ez - 9], [ex - 5.8, ez - 9]];
  if (campSign) campSign.pos = [ex, campSign.pos[1], ez + 9.3];
  rect(ex, ez, 28, 24);
}

// ---------- site buildings on the roads ----------
const siteRoadOrder = ["lewis_road", "penlan_road", "llandough_hill", "penarth_road", "leckwith_road"];
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
  if (!ok) console.warn("could not place", s.id);
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
// pastures around the edge
const PASTURE = ["#6b8f3a", "#7a9a40", "#5f8a38"];
const pastures = [];
for (let tries = 0; tries < 400 && pastures.length < 11; tries++) {
  const a = rnd() * Math.PI * 2, rad = 85 + rnd() * 75, x = Math.cos(a) * rad - 5, z = Math.sin(a) * rad * 0.9 + 10, w = 28 + rnd() * 22, d = 22 + rnd() * 14;
  if (Math.hypot(x, z) > 168) continue;
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
const lab = [["penlan_road", 2, "PENLAN ROAD"], ["leckwith_road", 1, "LECKWITH ROAD"], ["llandough_hill", 2, "LLANDOUGH HILL"], ["penarth_road", 2, "PENARTH ROAD"], ["barry_road", 1, "BARRY ROAD"], ["lewis_road", 2, "LEWIS ROAD"], ["church_road", 1, "CHURCH ROAD"], ["corbett_road", 1, "CORBETT ROAD"], ["greenway_close", 1, "GREENWAY CLOSE"], ["spencer_drive", 1, "SPENCER DRIVE"]];
for (const [rid, seg, text] of lab) { const r = road(rid); const a = r.pts[seg - 1], b = r.pts[seg]; out.push({ id: "ll_label_" + rid, name: text, kind: "label", pos: [r2((a[0] + b[0]) / 2), 3.2, r2((a[1] + b[1]) / 2)], text, color: "#f2c94c", rot: 0 }); }

// ---------- assemble ----------
// farm and church objects first, then the linked site buildings, then the new village
scene.objects = [...rest, ...sites, ...out];
scene.env = { ...scene.env, camera: { pos: [95, 115, 190], target: [-10, 0, 5] } };
scene.meta = { ...(scene.meta || {}), version: "Llandough", layout: "llandough-schematic" };
const pretty = raw.trimStart().startsWith("{\n");
fs.writeFileSync(outPath, pretty ? JSON.stringify(scene, null, 1) + "\n" : JSON.stringify(scene));
const c = {}; for (const o of scene.objects) c[o.kind] = (c[o.kind] || 0) + 1;
console.log("objects", scene.objects.length, c, "houses", hn, "trees", tn, "sites", sites.length);
