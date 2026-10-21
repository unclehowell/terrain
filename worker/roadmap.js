// terrain.bucklerfamily.estate — roadmap + SOP data (read-only) and the voice "pull data" answers. — Sion's Tab agent
import SNAP_RM from "./roadmap-snapshot.json";
import SNAP_SOP from "./sop-snapshot.json";
export const RM_URL = "https://dartboard.bucklerfamily.estate/data/roadmap.json";
export const SOP_URL = "https://projects.bucklerfamily.estate/data/sop-branches.json";
const TTL = 600_000;
const mem = { rm: null, rmAt: 0, sop: null, sopAt: 0 };
const cut = (s, n) => (s == null ? null : String(s).slice(0, n));
export function slimRoadmap(r, source) {
  return { schema: r.schema, generated: r.generated, as_of: r.as_of, source, steps: r.steps, totals: r.totals,
    upcoming: (r.upcoming || []).slice(0, 120).map(u => ({ date: u.date, lane: u.lane, institution: u.institution, kind: u.kind, what: cut(u.what, 140), url: u.url || null, step: u.step || null })),
    lanes: (r.lanes || []).map(l => ({ id: l.id, name: l.name, kind: l.kind, regime: l.regime, anchored: !!l.anchored, reached: l.reached, next: l.next || null, ombudsman: cut(l.ombudsman, 120),
      counts: { emails: (l.counts || {}).emails || 0, missed: (l.counts || {}).missed || 0, expected: (l.counts || {}).expected || 0, requests: (l.counts || {}).requests || 0 },
      lead: l.lead ? { title: cut(l.lead.title, 110), ref: cut(l.lead.ref, 40), url: l.lead.url || null } : null,
      steps: (l.steps || []).map(s => ({ n: s.n, label: s.label, date: s.date, dk: s.date_kind === "actual" ? "a" : "p", status: s.status, basis: cut(s.basis, 170), link: s.link || null, axis: s.axis || s.date })) })) };
}
export function slimSop(s, source) {
  return { schema: s.schema, generated: s.generated, title: s.title, page: s.page, side_project: s.side_project, source, trigger: s.trigger, kinds: s.kinds,
    nodes: (s.nodes || []).map(n => ({ id: n.id, kind: n.kind, phase: n.phase, label: n.label, lane: n.lane, owner: n.owner, text: cut(n.text, 360), decider: n.decider || null, deadline: n.deadline ? { anchor: n.deadline.anchor, days: n.deadline.days, rule: cut(n.deadline.rule, 200), kind: n.deadline.kind } : null, link: n.link || null })),
    edges: (s.edges || []).map(e => ({ from: e.from, to: e.to, label: e.label || "" })) };
}
async function getJ(env, key) { try { const o = await env.BUCKET.get(key); return o ? o.json() : null; } catch { return null; } }
async function live(url, check, slim, env, key, ctx) {
  try {
    const r = await fetch(url + "?t=" + Math.floor(Date.now() / TTL), { cf: { cacheTtl: 300 }, headers: { "user-agent": "terrain.bucklerfamily.estate" } });
    if (r.ok) { const j = await r.json(); if (check(j)) { const s = slim(j, url); ctx && ctx.waitUntil(env.BUCKET.put(key, JSON.stringify(s), { httpMetadata: { contentType: "application/json" } })); return s; } }
  } catch {}
  const c = await getJ(env, key); if (c) return { ...c, source: (c.source || url) + " (cached copy)" };
  return null;
}
export async function loadRoadmap(env, ctx) {
  if (mem.rm && Date.now() - mem.rmAt < TTL) return mem.rm;
  const snap = JSON.parse(SNAP_RM);
  mem.rm = (await live(RM_URL, j => j && Array.isArray(j.lanes) && j.lanes.length, slimRoadmap, env, "cache/roadmap.json", ctx)) || { ...snap, source: "snapshot " + snap.generated };
  mem.rmAt = Date.now(); return mem.rm;
}
export async function loadSop(env, ctx) {
  if (mem.sop && Date.now() - mem.sopAt < TTL) return mem.sop;
  const snap = JSON.parse(SNAP_SOP);
  mem.sop = (await live(SOP_URL, j => j && Array.isArray(j.nodes) && j.nodes.length, slimSop, env, "cache/sop.json", ctx)) || { ...snap, source: "snapshot " + snap.generated };
  mem.sopAt = Date.now(); return mem.sop;
}

// ---------- voice: read-only roadmap answers ----------
const STEP_WORDS = [[1, /\b(request|first request|foi request|the ask)\b/], [2, /\b(statutory )?deadline|due date\b/], [3, /\bchaser|chase\b/], [5, /\breview deadline\b/], [4, /\b(internal )?review\b/],
  [7, /\b(ico )?decision( notice)?\b/], [6, /\bico|information commissioner|regulator\b/], [8, /\btribunal|ftt|appeal\b/], [9, /\bombudsman|formal complaint|complaint\b/], [10, /\bpre ?action|letter before action|protocol letter\b/], [11, /\bcourt|judicial review|jr\b/]];
const ALIAS = { "hmlr": "hm-land-registry", "land registry": "hm-land-registry", "swp": "south-wales-police", "police": "south-wales-police", "cadw": "welsh-government-cadw", "welsh government": "welsh-government-cadw",
  "the vale": "vale-of-glamorgan-council", "vale council": "vale-of-glamorgan-council", "the council": "vale-of-glamorgan-council", "hmcts": "ministry-of-justice-hmcts", "moj": "ministry-of-justice-hmcts", "ministry of justice": "ministry-of-justice-hmcts",
  "mod": "ministry-of-defence", "ggat": "heneb-formerly-ggat-historic-environment-record", "heneb": "heneb-formerly-ggat-historic-environment-record", "museum": "amgueddfa-cymru-museum-wales", "museum wales": "amgueddfa-cymru-museum-wales",
  "welsh water": "dwr-cymru-welsh-water", "dwr cymru": "dwr-cymru-welsh-water", "archives": "glamorgan-archives", "tna": "the-national-archives", "national archives": "the-national-archives", "nlw": "national-library-of-wales", "national library": "national-library-of-wales",
  "rcahmw": "rcahmw-royal-commission", "royal commission": "rcahmw-royal-commission", "coflein": "rcahmw-royal-commission", "community council": "llandough-community-council", "llandough": "llandough-community-council", "coroner": "coroner-s-service-rct-council",
  "nio": "northern-ireland-office", "wales office": "wales-office", "cps": "crown-prosecution-service", "nhs": "cardiff-and-vale-university-health-board", "health board": "cardiff-and-vale-university-health-board", "ombudsman for wales": "public-services-ombudsman-for-wales", "psow": "public-services-ombudsman-for-wales",
  "ico": "information-commissioner-s-office", "information commissioner": "information-commissioner-s-office", "nactso": "counter-terrorism-policing-nactso", "counter terrorism": "counter-terrorism-policing-nactso", "ordnance survey": "ordnance-survey", "audit wales": "audit-wales", "persimmon": "persimmon-homes", "bp": "bp" };
const n8 = s => String(s || "").toLowerCase().replace(/ŵ/g, "w").replace(/ŷ/g, "y").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
export function findLane(rm, text, preferStepWords) {
  let t = " " + n8(text) + " ";
  let best = null, bestScore = 0;
  for (const [a, id] of Object.entries(ALIAS)) { if (t.includes(" " + a + " ")) { const l = rm.lanes.find(x => x.id === id); if (l && a.length > bestScore) { best = l; bestScore = a.length + 0.5; } } }
  for (const l of rm.lanes) {
    const nm = n8(l.name); if (nm.length > 3 && t.includes(" " + nm + " ") && nm.length + 1 > bestScore) { best = l; bestScore = nm.length + 1; }
    const words = nm.split(" ").filter(w => w.length > 3 && !["council", "office", "service", "formerly", "historic", "record", "environment", "royal", "wales", "welsh", "national"].includes(w));
    const hit = words.filter(w => t.includes(" " + w + " ")).length; if (hit && hit * 4 > bestScore) { best = l; bestScore = hit * 4; }
  }
  return best;
}
function stepOf(text) { const t = n8(text); for (const [n, re] of STEP_WORDS) if (re.test(t)) return n; return null; }
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function spokenDate(d, today) {
  if (!d) return "no date yet"; const a = new Date(d + "T12:00:00Z"), b = new Date(today + "T12:00:00Z"); const diff = Math.round((a - b) / 864e5);
  if (diff === 0) return "today"; if (diff === 1) return "tomorrow"; if (diff === -1) return "yesterday";
  if (diff > 1 && diff < 7) return DAYS[a.getUTCDay()]; return a.getUTCDate() + " " + MON[a.getUTCMonth()] + (a.getUTCFullYear() !== b.getUTCFullYear() ? " " + a.getUTCFullYear() : "");
}
function lc(s) { s = String(s || ""); const w = s.split(" ")[0]; return /[A-Z].*[A-Z]/.test(w) ? s : s.charAt(0).toLowerCase() + s.slice(1); }
const STATUS_SAY = { done: "done", missed: "missed", pending: "coming up", "not yet reached": "not reached yet", na: "not open on this route" };
export function shortName(l) { return String(l.name).replace(/\s*\(.*?\)\s*/g, " ").replace(/ - .*$/, "").trim(); }
function stepLine(l, s, today) {
  const when = spokenDate(s.date, today), past = s.date && s.date < today;
  if (s.status === "done") return `${shortName(l)}: ${lc(s.label)} done ${when === "today" ? "today" : "on " + when}.`;
  if (s.status === "missed") return `${shortName(l)}: the ${lc(s.label)} was missed, ${when}.`;
  if (s.status === "na") return `${shortName(l)}: the ${lc(s.label)} step doesn't apply on this route.`;
  return `${shortName(l)}: ${lc(s.label)} ${past ? "is due now" : (s.dk === "a" ? "on " : "projected for ") + when}.`;
}
export function dueWindow(rm, today, days) {
  const end = new Date(new Date(today + "T12:00:00Z").getTime() + days * 864e5).toISOString().slice(0, 10);
  const items = []; const seen = new Set();
  for (const l of rm.lanes) { if (!l.anchored) continue; for (const s of l.steps) {
    if (s.status !== "pending" || !s.date) continue;
    if (s.date <= end) { const k = l.id + s.n; if (!seen.has(k)) { seen.add(k); items.push({ lane: l.id, name: shortName(l), n: s.n, label: s.label, date: s.date < today ? today : s.date, overdue: s.date < today, link: s.link }); } }
  } }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.n - b.n);
}
// Returns null when the words are not a roadmap question.
export function roadmapQuery(text, rm, today) {
  const t = n8(text);
  const dueQ = /\b(what s|whats|what is|what are|anything|tell me what s|show me what s|show me what is|list)\b.*\b(due|coming up|upcoming|next)\b|\b(due|deadlines?) (this|next) (week|month|fortnight)\b|^(what s|whats) (due|next|coming up)|^(what s|whats|what) (do|dew|is due|s due)? ?(this|next) (week|month|fortnight)|\bwhat (do|dew) (today|this week)\b/.test(t);
  if (dueQ) {
    const days = /\btoday\b/.test(t) ? 0 : /\bmonth\b/.test(t) ? 30 : /\bfortnight|two weeks\b/.test(t) ? 14 : 7;
    const items = dueWindow(rm, today, days);
    if (!items.length) return { say: days ? `Nothing on the roadmap falls due in the next ${days} days.` : "Nothing falls due today.", view: { action: "due", items: [], days } };
    const head = items.slice(0, 4).map(i => `${i.name}, ${lc(i.label)}, ${i.overdue ? "due now" : spokenDate(i.date, today)}`).join("; ");
    return { say: `${items.length} thing${items.length > 1 ? "s" : ""} ${days ? (days === 7 ? "this week" : `in the next ${days} days`) : "today"}. ${head}${items.length > 4 ? ", and " + (items.length - 4) + " more on screen." : "."}`, view: { action: "due", items: items.slice(0, 40), days } };
  }
  if (/\b(sop|trigger (event|route|plan|map)|trigger event sop|event sop)\b/.test(t) && (/\b(show|so|open|fly|go|take me|zoom|where)\b/.test(t) || /\b(route|sop|plan)\s*$/.test(t))) return { say: "Here's the trigger-event route. It starts at the trigger, runs through the gates, and splits into the routes to an outcome.", view: { action: "sop" } };
  const trailQ = /\b(show|open|find|highlight|take me|fly|go|zoom|where|what s happening|how s|status)\b/.test(t) && /\b(trail|path|route|lane|step|stage|roadmap)\b/.test(t) || /\b(fly|take me|zoom) to\b/.test(t) && stepOf(t) != null;
  let stripped = t; for (const [, re] of STEP_WORDS) stripped = stripped.replace(re, " ");
  const lane = findLane(rm, stripped) || findLane(rm, text);
  if (!lane) { if (/\b(roadmap|trails?)\b/.test(t) && /\b(show|open|turn on)\b/.test(t)) return { say: "Here's the roadmap. One trail per institution, climbing from the request up to court.", view: { action: "layer", on: true } }; return null; }
  if (!trailQ && !/\btrail|roadmap\b/.test(t)) return null;
  const n = /\b(trail|route|lane)\b/.test(t) && !/\b(step|stage)\b/.test(t) ? null : stepOf(n8(text).replace(n8(lane.name), " "));
  if (n) { const s = lane.steps.find(x => x.n === n); return { say: stepLine(lane, s, today), view: { action: "step", lane: lane.id, step: n } }; }
  const nx = lane.steps.find(s => s.status === "pending") || lane.steps.find(s => s.status === "not yet reached");
  const rc = lane.steps.filter(s => s.status === "done" || s.status === "missed").pop();
  let say = `Here's ${shortName(lane)}.`;
  if (rc) say += " Furthest so far: " + lc(rc.label) + ", " + (rc.status === "missed" ? "missed" : "done") + ".";
  if (nx) say += " Next: " + lc(nx.label) + ", " + (nx.date && nx.date < today ? "due now" : spokenDate(nx.date, today)) + ".";
  return { say, view: { action: "trail", lane: lane.id, step: nx ? nx.n : (rc ? rc.n : 1) } };
}
