// terrain.bucklerfamily.estate — Worker: static app, scene API, passphrase gate, voice agent. — Sion's Tab agent
import { apply, summary, resolve, norm, KINDS, TEXTURES, WEATHER } from "./scene-ops.js";
import INITIAL_TXT from "./initial-scene.json";
const INITIAL = JSON.parse(INITIAL_TXT);
import HTML from "./index.html";
import APP from "./app.js.txt";
import CSS from "./style.css.txt";
import { loadRoadmap, loadSop, roadmapQuery } from "./roadmap.js";

const HOST = "terrain.bucklerfamily.estate";
const LLM = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const TTS = "@cf/deepgram/aura-1", VOICE = "helios";
const STT = "@cf/openai/whisper-large-v3-turbo";
const SESSION_S = 4 * 3600, MAX_TRIES = 5, WINDOW_S = 600, UNDO_MAX = 30;
const enc = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);

const SEC = { "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin", "permissions-policy": "microphone=(self), camera=(), geolocation=()", "x-frame-options": "SAMEORIGIN" };
const J = (o, st = 200, h = {}) => new Response(JSON.stringify(o), { status: st, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...SEC, ...h } });
const T = (body, type, h = {}) => new Response(body, { headers: { "content-type": type, ...SEC, ...h } });

// ---------- crypto ----------
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
const unhex = h => new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)));
async function hmac(keyBytes, msg) { const k = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return crypto.subtle.sign("HMAC", k, enc.encode(msg)); }
function ctEq(a, b) { if (typeof a !== "string" || typeof b !== "string") return false; let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ (b.charCodeAt(i % (b.length || 1)) || 0); return d === 0; }
async function passMatches(env, text) {
  const words = norm(text).replace(/[0-9]/g, "").split(" ").filter(Boolean).slice(0, 16);
  const cands = new Set([words.join("")]);
  for (let i = 0; i < words.length; i++) for (let n = 1; n <= 3 && i + n <= words.length; n++) cands.add(words.slice(i, i + n).join(""));
  const H = String(env.PASS_HASHES || "").split(";").map(s => s.split(":")).filter(p => p.length === 2);
  let hit = false;
  for (const c of cands) { if (!c || c.length > 40) continue; for (const [salt, h] of H) { const got = hex(await hmac(unhex(salt), c)); if (ctEq(got, h)) hit = true; } }
  return hit;
}
async function mkSession(env) { const p = b64u(enc.encode(JSON.stringify({ adm: 1, exp: now() + SESSION_S, n: crypto.randomUUID().slice(0, 8) }))); return p + "." + b64u(await hmac(enc.encode(env.SESSION_KEY), p)); }
async function isAdmin(env, req) {
  const m = /(?:^|;\s*)terrain_admin=([A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)/.exec(req.headers.get("cookie") || ""); if (!m || !env.SESSION_KEY) return false;
  const [p, s] = m[1].split("."); if (!ctEq(b64u(await hmac(enc.encode(env.SESSION_KEY), p)), s)) return false;
  try { const o = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/"))); return o.adm === 1 && o.exp > now(); } catch { return false; }
}
const cookie = (v, age) => `terrain_admin=${v}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Strict`;

// ---------- storage (R2: strongly consistent, one object per thing) ----------
async function getJ(env, key) { const o = await env.BUCKET.get(key); return o ? o.json() : null; }
const putJ = (env, key, v, meta) => env.BUCKET.put(key, JSON.stringify(v), { httpMetadata: { contentType: "application/json" }, customMetadata: meta });
async function load(env) { return (await getJ(env, "state.json")) || { scene: JSON.parse(JSON.stringify(INITIAL)), undo: [], redo: [], log: [] }; }
async function store(env, st) { st.rev = Math.max(st.rev || 0, st.scene.rev || 0) + 1; st.scene.rev = st.rev; st.scene.updated = new Date().toISOString(); await putJ(env, "state.json", st); }
const ipKey = ip => ip.replace(/[^0-9a-fA-F:.]/g, "").slice(0, 64) || "x";
async function hits(env, ip, kind, win) { const a = (await getJ(env, `rl/${kind}/${ipKey(ip)}.json`)) || []; return a.filter(t => t > now() - win).length; }
async function hit(env, ip, kind) { const k = `rl/${kind}/${ipKey(ip)}.json`; const a = ((await getJ(env, k)) || []).filter(t => t > now() - 3600); a.push(now()); await putJ(env, k, a.slice(-500)); }
async function logEdit(env, kind, detail) { try { const k = `log/${new Date().toISOString().slice(0, 10)}.json`; const a = (await getJ(env, k)) || []; a.push({ at: new Date().toISOString(), kind, detail: String(detail).slice(0, 1500) }); await putJ(env, k, a.slice(-1000)); } catch {} }
async function versionsList(env) { const L = await env.BUCKET.list({ prefix: "versions/", include: ["customMetadata"] }); return (L.objects || []).map(o => ({ name: o.key.slice(9, -5), label: (o.customMetadata && o.customMetadata.label) || o.key.slice(9, -5), at: Number(o.customMetadata && o.customMetadata.at) || Math.floor(new Date(o.uploaded).getTime() / 1000) })).sort((a, b) => b.at - a.at); }
const slug = s => norm(s).replace(/ /g, "-").slice(0, 40) || "version";

// ---------- tool executor (the one path every edit takes) ----------
async function execTool(env, st, name, args) {
  args = args || {};
  if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
  const snap = () => JSON.stringify(st.scene);
  switch (name) {
    case "undo": { const n = Math.max(1, Math.min(10, Number(args.steps) || 1)); let k = 0; for (; k < n && st.undo.length; k++) { st.redo.push(snap()); st.scene = JSON.parse(st.undo.pop()); } return k ? { ok: true, say: k > 1 ? `Undid the last ${k} changes.` : "Undone.", changed: ["*"] } : { ok: false, say: "Nothing to undo." }; }
    case "redo": { if (!st.redo.length) return { ok: false, say: "Nothing to redo." }; st.undo.push(snap()); st.scene = JSON.parse(st.redo.pop()); return { ok: true, say: "Redone.", changed: ["*"] }; }
    case "save_version": { const label = String(args.name || "").trim().slice(0, 60) || new Date().toISOString().slice(0, 16).replace("T", " "); const k = slug(label); await putJ(env, `versions/${k}.json`, { label, at: now(), scene: JSON.parse(snap()) }, { label, at: String(now()) }); st.scene.meta = st.scene.meta || {}; st.scene.meta.version = label; return { ok: true, say: `Saved as "${label}".`, changed: [] , version: k }; }
    case "restore_version": { const want = slug(args.name || ""); const rows = await versionsList(env); const alt = want.replace(/-one$/, "-1").replace(/-two$/, "-2").replace(/-three$/, "-3"); const row = rows.find(r => r.name === want || r.name === alt || r.name.replace(/-1$/, "-one") === want) || rows.find(r => r.name.includes(want) || want.includes(r.name)); if (!row) return { ok: false, say: rows.length ? `No version called ${args.name}. I've got ${rows.slice(0, 5).map(r => r.label).join(", ")}.` : "There are no saved versions yet." }; const v = await getJ(env, `versions/${row.name}.json`); st.undo.push(snap()); st.redo = []; const rev = st.scene.rev; st.scene = v.scene; st.scene.rev = rev; return { ok: true, say: `Restored "${v.label}".`, changed: ["*"] }; }
    case "reset_scene": { st.undo.push(snap()); if (st.undo.length > UNDO_MAX) st.undo.splice(0, st.undo.length - UNDO_MAX); st.redo = []; const rev = st.scene.rev; st.scene = JSON.parse(JSON.stringify(INITIAL)); st.scene.rev = rev; st.scene.meta = { camera_seq: Date.now() % 100000 }; return { ok: true, say: "Back to the original estate. Say undo if you didn't mean it.", changed: ["*"] }; }
    case "list_versions": { const rows = (await versionsList(env)).slice(0, 10); return { ok: true, say: rows.length ? `Saved versions: ${rows.map(r => r.label).join(", ")}.` : "No saved versions yet.", changed: [] , versions: rows }; }
    case "describe_scene": { const o = args.target ? resolve(st.scene, args.target) : null; return { ok: true, say: o ? `${o.name}: a ${o.kind}${o.species ? " (" + o.species + ")" : ""}.` : `There are ${st.scene.objects.length} things here. It's ${st.scene.env.time}, ${st.scene.env.weather}.`, changed: [] }; }
    default: {
      const before = snap();
      try { const r = apply(st.scene, name, args); if (r.changed && r.changed.length) { st.undo.push(before); if (st.undo.length > UNDO_MAX) st.undo.splice(0, st.undo.length - UNDO_MAX); st.redo = []; } return r; }
      catch (e) { st.scene = JSON.parse(before); return { ok: false, say: String(e.message || e).replace(/^Error: /, "") + "." }; }
    }
  }
}

// ---------- LLM tool schema ----------
const S = (props, req = []) => ({ type: "object", properties: props, required: req });
const ref = d => ({ type: "string", description: d || "object id from the scene list, or its name" });
const TOOLS = [
  ["add_object", "Add new objects: buildings (farmhouse, house, cottage, barn, church, chapel, tower, shed, stable, greenhouse, castle), trees (species oak, pine, yew, birch, willow), fences, walls, hedges, paths, roads, ponds, fields, labels/signs, markers/flags, rocks, lamps, benches.", S({ kind: { type: "string" }, species: { type: "string", description: "tree species" }, name: { type: "string" }, text: { type: "string", description: "words on a label/sign" }, near: ref("put it next to this object"), direction: { type: "string", description: "north/south/east/west of the near object" }, distance: { type: "number" }, from: ref("start object for a path/fence/wall"), to: ref("end object for a path/fence/wall"), around: ref("enclose this object (fence/wall/hedge)"), count: { type: "number" }, color: { type: "string" }, roof_color: { type: "string" }, texture: { type: "string", enum: TEXTURES }, roof: { type: "string", enum: ["gable", "flat", "dome", "tower", "portico", "awning"] }, height: { type: "number" }, width: { type: "number" }, length: { type: "number" }, x: { type: "number" }, z: { type: "number" } }, ["kind"])],
  ["move_object", "Move an object: next to another object, or a distance in a compass direction (north, south, east, west, left, right).", S({ target: ref(), near: ref("move it next to this"), direction: { type: "string" }, distance: { type: "number", description: "metres" }, x: { type: "number" }, z: { type: "number" } }, ["target"])],
  ["rotate_object", "Turn an object by degrees (positive = clockwise from above).", S({ target: ref(), degrees: { type: "number" } }, ["target", "degrees"])],
  ["scale_object", "Make an object bigger or smaller by a factor (2 = twice the size, 0.5 = half).", S({ target: ref(), factor: { type: "number" } }, ["target", "factor"])],
  ["delete_object", "Remove an object from the scene.", S({ target: ref() }, ["target"])],
  ["set_color", "Recolour an object (walls by default, or part='roof'). Any colour name or #hex.", S({ target: ref(), color: { type: "string" }, part: { type: "string", enum: ["walls", "roof"] } }, ["target", "color"])],
  ["set_texture", "Change an object's material.", S({ target: ref(), texture: { type: "string", enum: TEXTURES } }, ["target", "texture"])],
  ["rename_object", "Rename an object.", S({ target: ref(), name: { type: "string" } }, ["target", "name"])],
  ["set_label_text", "Change the words on a label or sign.", S({ target: ref(), text: { type: "string" } }, ["target", "text"])],
  ["set_time_of_day", "Change the time of day.", S({ time: { type: "string", enum: ["dawn", "morning", "day", "afternoon", "evening", "dusk", "night"] }, hour: { type: "number" } }, [])],
  ["set_weather", "Change the weather.", S({ weather: { type: "string", enum: WEATHER } }, ["weather"])],
  ["set_camera", "Move the camera to look at an object, or the whole estate. view: close, overhead or ground.", S({ target: ref("object to look at; omit for the whole estate"), view: { type: "string", enum: ["close", "overhead", "ground", "wide"] } }, [])],
  ["undo", "Undo the last change(s).", S({ steps: { type: "number" } }, [])],
  ["redo", "Redo the last undone change.", S({}, [])],
  ["save_version", "Save the current scene as a named version.", S({ name: { type: "string" } }, ["name"])],
  ["restore_version", "Restore a saved version by name.", S({ name: { type: "string" } }, ["name"])],
  ["list_versions", "List saved versions.", S({}, [])],
  ["reset_scene", "Put the whole scene back to the original estate (undoable).", S({}, [])],
].map(([name, description, parameters]) => ({ type: "function", function: { name, description, parameters } }));
const TOOL_NAMES = new Set(TOOLS.map(t => t.function.name).concat(["describe_scene"]));

function sysPrompt(scene) {
  return `You are Tab, a relaxed, friendly British bloke on a live voice call, editing a 3D landscape (the Cedwyn Estate and Great House Farm, Tŷ Mawr) for its owner. Everything he says is a spoken instruction; turn it into tool calls straight away. If he asks for several things, call every tool needed, in order, in the same reply. Use object ids from the list below as targets (fuzzy names are fine if unsure). "It" or "that" means the last object touched${scene.meta && scene.meta.last ? " (" + scene.meta.last + ")" : ""}. North is up the path, where the site buildings are; Great House Farm and St Dochdwy's churchyard are to the south. If he is just chatting or asks a question, answer in one short spoken sentence with no tools. Any colour words, even "stone grey" or "brick red", mean set_color. Material words (stone, brick, wood, slate, thatch, glass) without a colour mean set_texture. Never read out ids, coordinates or hex codes.\nSCENE:\n${summary(scene)}`;
}
function parseCalls(out) {
  let calls = out && (out.tool_calls || (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.tool_calls)) || [];
  calls = calls.map(c => c.function ? { name: c.function.name, arguments: c.function.arguments } : c).map(c => ({ name: c.name, arguments: typeof c.arguments === "string" ? (() => { try { return JSON.parse(c.arguments); } catch { return {}; } })() : (c.arguments || {}) }));
  let text = out && (out.response || (out.choices && out.choices[0] && out.choices[0].message && out.choices[0].message.content)) || "";
  if (typeof text !== "string") text = JSON.stringify(text);
  // some replies put a JSON tool call in the text
  if (!calls.length && /^\s*[\[{]/.test(text)) { try { let j = JSON.parse(text); j = Array.isArray(j) ? j : [j]; const cc = j.filter(x => x && x.name && TOOL_NAMES.has(x.name)).map(x => ({ name: x.name, arguments: x.parameters || x.arguments || {} })); if (cc.length) { calls = cc; text = ""; } } catch {} }
  return { calls: calls.filter(c => TOOL_NAMES.has(c.name)), text: text.trim() };
}
const NUMW = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10" };
function quick(text) {
  const t = norm(text).replace(/^(ok(ay)?|right|tab|please|can you|could you|now) /g, "").replace(/ please$/, "");
  if (/^(undo|undo that|undo it|un do that|and do that|undo this|go back|take that back|scrap that|reverse that)( please)?$/.test(t)) return [{ name: "undo", arguments: {} }];
  const u = /^undo (the )?last (\w+)( changes?)?$/.exec(t); if (u) return [{ name: "undo", arguments: { steps: Number(NUMW[u[2]] || u[2]) || 1 } }];
  if (/^(redo|redo that|redo it|put it back)$/.test(t)) return [{ name: "redo", arguments: {} }];
  let m = /^save (this |it |the scene |that )?(as )?(version )?(called |named )?(.+)$/.exec(t); if (m && !/^(it|this)$/.test(m[5])) return [{ name: "save_version", arguments: { name: (m[3] ? "version " : "") + m[5] } }];
  if (/^save( it| this| the scene)?$/.test(t)) return [{ name: "save_version", arguments: {} }];
  m = /^(restore|load|go back to|bring back|switch to) (version )?(.+)$/.exec(t); if (m && !/^(that|it)$/.test(m[3])) return [{ name: "restore_version", arguments: { name: (m[2] ? "version " : "") + m[3] } }];
  if (/^(list|what are|show me|what) (the )?(saved )?versions/.test(t)) return [{ name: "list_versions", arguments: {} }];
  if (/^(reset|start (again|over)|reset (it|everything|the scene|the estate)|back to (the )?original)$/.test(t)) return [{ name: "reset_scene", arguments: {} }];
  return null;
}
async function agent(env, st, text, history) {
  const results = []; let said = "";
  const q = quick(text);
  if (q) { for (const c of q) { const r = await execTool(env, st, c.name, c.arguments); results.push({ tool: c.name, args: c.arguments, ok: r.ok, say: r.say }); } }
  else {
    const multi = /\b(and|then|also)\b|[,;]/.test(text);
    for (let round = 0; round < (multi ? 3 : 1); round++) {
      const msgs = [{ role: "system", content: sysPrompt(st.scene) }];
      for (const h of (Array.isArray(history) ? history.slice(-6) : [])) if (h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string") msgs.push({ role: h.role, content: h.content.slice(0, 400) });
      msgs.push({ role: "user", content: text.slice(0, 600) });
      if (round > 0) msgs.push({ role: "assistant", content: "Done so far: " + results.map(r => `${r.tool}(${JSON.stringify(r.args)})`).join("; ") }, { role: "user", content: "Do any part of my request that is NOT done yet with tool calls. If everything is done, reply with just the word DONE." });
      const out = await env.AI.run(LLM, { messages: msgs, tools: TOOLS, max_tokens: 600, temperature: 0.2 });
      const { calls, text: t } = parseCalls(out);
      const fresh = calls.filter(c => !results.some(r => r.tool === c.name && JSON.stringify(r.args) === JSON.stringify(c.arguments)));
      if (!fresh.length) { if (round === 0) said = t; break; }
      for (const c of fresh.slice(0, 6)) { const r = await execTool(env, st, c.name, c.arguments); results.push({ tool: c.name, args: c.arguments, ok: r.ok, say: r.say }); }
    }
  }
  let say;
  if (results.length) say = results.map(r => r.say).filter(Boolean).slice(0, 4).join(" ");
  else say = (said && !/^done\.?$/i.test(said) ? said : "Sorry, I didn't catch that. Say it again?").replace(/\s+/g, " ").slice(0, 300);
  return { say, results };
}

// ---------- static agent-readability files ----------
const ROBOTS = `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://${HOST}/sitemap.xml\n`;
const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://${HOST}/</loc><changefreq>daily</changefreq></url><url><loc>https://${HOST}/llms.txt</loc></url></urlset>\n`;
const LLMS = `# Terrain · Cedwyn Estate in 3D\n\n> A live 3D landscape of the Cedwyn Estate and Great House Farm (Tŷ Mawr), Llandough: every Great House Farm site is a building on the path, with the farmhouse, barn, fields, pond and St Dochdwy's churchyard to the south. The owner edits it by voice; visitors can look around, open the Roadmap layer and ask by voice what is due or where a trail stands.\n\n## Pages\n- [Terrain](https://${HOST}/): the 3D scene (orbit, zoom, walk; tap a building to open its site).\n\n## Data (read-only JSON)\n- [Current scene](https://${HOST}/agent/scene.json): every object (id, name, kind, position, colour, link) plus time of day and weather.\n- [Saved versions](https://${HOST}/agent/versions.json): names and dates of saved versions.\n- [Roadmap](https://${HOST}/agent/roadmap.json): one disclosure trail per institution, eleven steps each from request to court, with status and date.\n- [Trigger-event procedure](https://${HOST}/agent/sop.json): the branching steps, gates, routes and outcomes.\n- [Due](https://${HOST}/agent/due.json?days=7): steps falling due in the next N days.\n- [Published changes](https://github.com/unclehowell/terrain/commits/main/data/scene.json): each editing session committed to data/scene.json.\n- [Tools](https://${HOST}/agent/tools.json): the read-only WebMCP tools this site registers.\n\n## Related\n- [Cedwyn Estate 3D walk](https://bucklerfamily.estate/3d/)\n- [Base camp](https://bucklerfamily.estate/cedwyn/)\n`;
const AGENT_TOOLS = { site: HOST, version: "1.3.0", tools: [
  { name: "get_scene", description: "The current 3D scene: every object with id, name, kind, position, colour and link, plus time of day and weather.", endpoint: "/agent/scene.json", inputSchema: { type: "object", properties: {} } },
  { name: "list_versions", description: "Saved versions of the scene, newest first.", endpoint: "/agent/versions.json", inputSchema: { type: "object", properties: {} } },
  { name: "search_objects", description: "Find objects in the scene by name or kind.", endpoint: "/agent/search.json", inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] } },
  { name: "get_roadmap", description: "The disclosure roadmap: one trail per institution with its eleven escalation steps (request to court), each step's status and date.", endpoint: "/agent/roadmap.json", inputSchema: { type: "object", properties: {} } },
  { name: "get_trigger_sop", description: "The trigger-event procedure as a branching graph of steps, gates, routes and outcomes.", endpoint: "/agent/sop.json", inputSchema: { type: "object", properties: {} } },
  { name: "list_due", description: "Roadmap steps falling due in the next N days (0 = today).", endpoint: "/agent/due.json", inputSchema: { type: "object", properties: { days: { type: "integer", minimum: 0, maximum: 90 } } } } ] };
const MCP = { name: "Terrain · Cedwyn Estate in 3D", url: `https://${HOST}/`, readOnly: true, tools: AGENT_TOOLS.tools.map(t => ({ name: t.name, description: t.description, endpoint: `https://${HOST}${t.endpoint}`, method: "GET", inputSchema: t.inputSchema })) };
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#000"/><path d="M6 50 L24 22 L34 36 L42 26 L58 50 Z" fill="#f2c94c"/></svg>`;
const publicScene = sc => ({ ...sc, meta: { version: sc.meta && sc.meta.version, camera_seq: sc.meta && sc.meta.camera_seq, last: sc.meta && sc.meta.last } });

async function readJson(req, max = 20000) { const t = await req.text(); if (t.length > max) throw new Error("too big"); return t ? JSON.parse(t) : {}; }


// Whisper on short clips can echo its prompt or invent filler; drop those.
function cleanStt(t, prompt) {
  t = String(t || "").replace(/\s+/g, " ").trim(); if (!t) return "";
  const low = t.toLowerCase();
  const parts = prompt.toLowerCase().split(/[,.]/).map(s => s.trim()).filter(s => s.length > 3);
  let echo = 0; for (const s of parts) { const n = low.split(s).length - 1; if (n >= 2) echo += n; }
  if (echo >= 3) return "";
  if (/^(thank you|thanks for watching|thanks|you|bye|okay|\.|subtitles by.*)[.!?]*$/i.test(t)) return "";
  const w = t.split(" "); if (w.length > 8) { const seen = {}; let rep = 0; for (let i = 0; i + 3 <= w.length; i++) { const g = w.slice(i, i + 3).join(" ").toLowerCase(); seen[g] = (seen[g] || 0) + 1; if (seen[g] >= 3) rep++; } if (rep) return ""; }
  return t;
}


// ---------- roadmap (read-only, open to everyone) ----------
const londonDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const RM_HINT = /\b(due|deadlines?|coming up|upcoming|trails?|route|lane|steps?|stage|roadmap|sop|trigger|tribunal|court|ico|fly|take me|zoom)\b/i;
const RM_HINT_ADMIN = /\b(due|deadlines?|coming up|upcoming|trails?|roadmap|steps?|stage|sop|trigger (event|route|plan))\b/i;
async function rmAnswer(env, ctx, text, admin) {
  if (!(admin ? RM_HINT_ADMIN : RM_HINT).test(text)) return null;
  try { const rm = await loadRoadmap(env, ctx); return roadmapQuery(text, rm, londonDay()); } catch (e) { return null; }
}

// ---------- admin sessions -> GitHub publish queue ----------
// R2 session.json: { open: {id, started, last, edits[]}, closed: [{id, reason, started, closed, edits[]}] }.
// A session closes on lock, on the 4 h cookie timeout, or after 10 min with no edit. A GitHub Action in the repo
// polls /api/publish/pending and commits data/scene.json for each closed session it has not recorded yet.
const IDLE_S = 600;
function closeOpen(ss, reason, at) { if (ss.open && ss.open.edits.length) { ss.closed = (ss.closed || []).concat([{ ...ss.open, reason, closed: new Date((at || now()) * 1000).toISOString() }]).slice(-20); } ss.open = null; return ss; }
async function sessGet(env) { return (await getJ(env, "session.json")) || { open: null, closed: [] }; }
async function noteEdit(env, says) {
  const ss = await sessGet(env); const t = now();
  if (ss.open && t - ss.open.last > IDLE_S) closeOpen(ss, t - ss.open.started > SESSION_S ? "timeout" : "idle", ss.open.last + IDLE_S);
  if (!ss.open) ss.open = { id: new Date(t * 1000).toISOString().replace(/[-:]/g, "").slice(0, 15) + "-" + crypto.randomUUID().slice(0, 6), started: t, last: t, edits: [] };
  for (let s of says) if (s) { s = String(s).replace(/\s+/g, " ").trim().replace(/^Undone\.?$/, "Undid the last change.").replace(/^Redone\.?$/, "Redid the last change."); ss.open.edits.push(s.slice(0, 160)); }
  ss.open.edits = ss.open.edits.slice(-60); ss.open.last = t; await putJ(env, "session.json", ss);
}
async function sessClose(env, reason) { const ss = await sessGet(env); if (!ss.open) return; closeOpen(ss, reason); await putJ(env, "session.json", ss); }
async function sessSweep(env) { const ss = await sessGet(env); const t = now(); if (ss.open && t - ss.open.last > IDLE_S) { closeOpen(ss, t - ss.open.started > SESSION_S ? "timeout" : "idle", ss.open.last + IDLE_S); await putJ(env, "session.json", ss); } return ss; }

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url), p = url.pathname, ip = req.headers.get("cf-connecting-ip") || "0";
    if (url.hostname !== HOST && !url.hostname.endsWith(".workers.dev")) return Response.redirect(`https://${HOST}${p}`, 301);
    if (req.method === "POST") { const o = req.headers.get("origin"); if (o && new URL(o).host !== url.host) return J({ error: "bad origin" }, 403); }
    try {
      if (req.method === "GET" || req.method === "HEAD") {
        if (p === "/" || p === "/index.html") return T(HTML, "text/html; charset=utf-8", { "cache-control": "no-cache" });
        if (p === "/app.js") return T(APP, "text/javascript; charset=utf-8", { "cache-control": "public, max-age=300" });
        if (p === "/style.css") return T(CSS, "text/css; charset=utf-8", { "cache-control": "public, max-age=300" });
        if (p === "/favicon.svg" || p === "/favicon.ico") return T(FAVICON, "image/svg+xml", { "cache-control": "public, max-age=86400" });
        if (p === "/robots.txt") return T(ROBOTS, "text/plain; charset=utf-8");
        if (p === "/sitemap.xml") return T(SITEMAP, "application/xml; charset=utf-8");
        if (p === "/llms.txt") return T(LLMS, "text/plain; charset=utf-8");
        if (p === "/agent/tools.json") return J(AGENT_TOOLS, 200, { "access-control-allow-origin": "*" });
        if (p === "/.well-known/mcp.json") return J(MCP, 200, { "access-control-allow-origin": "*" });
        if (p === "/api/scene" || p === "/agent/scene.json") { const st = await load(env); const since = Number(url.searchParams.get("rev")); if (since && since === st.scene.rev) return J({ same: true, rev: since }); return J(publicScene(st.scene), 200, { "access-control-allow-origin": "*" }); }
        if (p === "/agent/search.json") { const st = await load(env); const q = norm(url.searchParams.get("q") || ""); return J({ q, results: st.scene.objects.filter(o => !q || norm([o.name, o.kind, o.species, ...(o.aliases || [])].join(" ")).includes(q)).slice(0, 50) }, 200, { "access-control-allow-origin": "*" }); }
        if (p === "/api/versions" || p === "/agent/versions.json") { const rows = (await versionsList(env)).slice(0, 50); return J({ versions: rows.map(r => ({ name: r.name, label: r.label, saved: new Date(r.at * 1000).toISOString() })) }, 200, { "access-control-allow-origin": "*" }); }
        if (p === "/api/session") return J({ admin: await isAdmin(env, req) });
        if (p === "/api/roadmap" || p === "/agent/roadmap.json") return J(await loadRoadmap(env, ctx), 200, { "access-control-allow-origin": "*", "cache-control": "public, max-age=120" });
        if (p === "/api/sop" || p === "/agent/sop.json") return J(await loadSop(env, ctx), 200, { "access-control-allow-origin": "*", "cache-control": "public, max-age=120" });
        if (p === "/agent/due.json") { const days = Math.min(90, Math.max(0, Number(url.searchParams.get("days") || 7))); const q = days === 0 ? "what is due today" : days <= 7 ? "what is due this week" : "what is coming up this month"; const r = roadmapQuery(q, await loadRoadmap(env, ctx), londonDay()); return J({ today: londonDay(), days, say: r && r.say, items: r && r.view.items || [] }, 200, { "access-control-allow-origin": "*", "cache-control": "public, max-age=120" }); }
        if (p === "/api/publish/pending") { const ss = await sessSweep(env); const st = await load(env); return J({ closed: ss.closed || [], open: ss.open ? { id: ss.open.id, edits: ss.open.edits.length, idle_s: now() - ss.open.last } : null, rev: st.scene.rev || 0, updated: st.scene.updated || null, scene: publicScene(st.scene) }, 200, { "cache-control": "no-store" }); }
        return new Response("Not found", { status: 404, headers: { "content-type": "text/plain", ...SEC } });
      }
      if (req.method !== "POST") return J({ error: "method" }, 405);
      const admin = await isAdmin(env, req);
      if (p === "/api/logout") { if (admin) await sessClose(env, "locked"); return J({ ok: true, admin: false }, 200, { "set-cookie": cookie("", 0) }); }
      if (p === "/api/agent") {
        const b = await readJson(req); const text = String(b.text || "").trim();
        if (b.hello) return J({ admin, say: admin ? "You're still in. What do you want to change?" : "Alright, it's Tab. What's the passphrase?" });
        if (!text) return J({ admin, say: "Didn't catch that. Say it again?" });
        if (!admin) {
          const ra = await rmAnswer(env, ctx, text, false); if (ra) return J({ admin: false, say: ra.say, view: ra.view });
          const n = await hits(env, ip, "pass", WINDOW_S);
          if (n >= MAX_TRIES) return J({ admin: false, locked: true, say: "That's too many goes. Try again in ten minutes. You can still look around." });
          if (await passMatches(env, text)) { const tok = await mkSession(env); ctx.waitUntil(sessSweep(env)); ctx.waitUntil(logEdit(env, "unlock", ip)); return J({ admin: true, unlocked: true, say: "You're in. Full control. What are we building?" }, 200, { "set-cookie": cookie(tok, SESSION_S) }); }
          await hit(env, ip, "pass"); const left = MAX_TRIES - n - 1; ctx.waitUntil(logEdit(env, "wrong-pass", ip));
          return J({ admin: false, say: left > 0 ? "No, that's not it. Have another go." : "That's not it, and that's five goes. Try again in ten minutes. You can still look around." });
        }
        const ra = await rmAnswer(env, ctx, text, true); if (ra) return J({ admin: true, say: ra.say, view: ra.view });
        const st = await load(env);
        if (b.selected) { const so = resolve(st.scene, String(b.selected)); if (so) { st.scene.meta = st.scene.meta || {}; st.scene.meta.last = so.id; } }
        const r = await agent(env, st, text, b.history);
        if (r.results.length) { await store(env, st); await noteEdit(env, r.results.filter(x => x.ok !== false).map(x => x.say)); ctx.waitUntil(logEdit(env, "voice", JSON.stringify({ text, results: r.results.map(x => [x.tool, x.args, x.ok]) }))); }
        return J({ admin: true, say: r.say, results: r.results, scene: publicScene(st.scene) });
      }
      if (p === "/api/tool") {
        if (!admin) return J({ error: "locked", say: "Say the passphrase first." }, 401);
        const b = await readJson(req); if (!TOOL_NAMES.has(b.name)) return J({ error: "unknown tool" }, 400);
        const st = await load(env); const r = await execTool(env, st, b.name, b.args || {}); await store(env, st); if (r.ok !== false) await noteEdit(env, [r.say || b.name]); ctx.waitUntil(logEdit(env, "tool", JSON.stringify([b.name, b.args, r.ok])));
        return J({ ...r, scene: publicScene(st.scene) });
      }
      if (p === "/api/tts") {
        const lim = admin ? 400 : 40; if (await hits(env, ip, "tts", WINDOW_S) >= lim) return J({ error: "slow down" }, 429);
        const b = await readJson(req); const text = String(b.text || "").replace(/\s+/g, " ").trim().slice(0, 420); if (!text) return J({ error: "empty" }, 400);
        ctx.waitUntil(hit(env, ip, "tts"));
        const out = await env.AI.run(TTS, { text, speaker: VOICE, encoding: "mp3" }, { returnRawResponse: true });
        if (out instanceof Response) return new Response(out.body, { headers: { "content-type": out.headers.get("content-type") || "audio/mpeg", "cache-control": "no-store", ...SEC } });
        if (out && out.audio) { const bin = Uint8Array.from(atob(out.audio), c => c.charCodeAt(0)); return new Response(bin, { headers: { "content-type": "audio/mpeg", ...SEC } }); }
        return new Response(out, { headers: { "content-type": "audio/mpeg", ...SEC } });
      }
      if (p === "/api/stt") {
        const lim = admin ? 600 : 60; if (await hits(env, ip, "stt", WINDOW_S) >= lim) return J({ error: "slow down", text: "" }, 429);
        const buf = await req.arrayBuffer(); if (buf.byteLength > 3_000_000 || buf.byteLength < 600) return J({ text: "", note: "empty" });
        ctx.waitUntil(hit(env, ip, "stt"));
        let bin = ""; const u8 = new Uint8Array(buf); for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
        const prompt = "Tŷ Mawr, Llandough, farmhouse, churchyard, ICO, HMLR." + (env.STT_HINT ? " " + env.STT_HINT : "");
        let out;
        try { out = await env.AI.run(STT, { audio: btoa(bin), language: "en", vad_filter: true, initial_prompt: prompt }); }
        catch (e) { out = await env.AI.run(STT, { audio: btoa(bin), language: "en", initial_prompt: prompt }); }
        return J({ text: cleanStt(out && out.text || "", prompt), bytes: buf.byteLength });
      }
      return J({ error: "not found" }, 404);
    } catch (e) { return J({ error: "server", say: "Something went wrong on my side. Try that again?", detail: String(e && e.message || e).slice(0, 200) }, 500); }
  },
};
