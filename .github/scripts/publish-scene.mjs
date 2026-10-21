// Reads the closed editing sessions from the live site and commits each one not yet recorded. — Sion's Tab agent
import fs from "node:fs";
import { execSync } from "node:child_process";
const SITE = "https://terrain.bucklerfamily.estate";
const sh = c => execSync(c, { stdio: "inherit" });
const res = await fetch(SITE + "/api/publish/pending?n=" + Date.now(), { headers: { "user-agent": "terrain-publish-action", accept: "application/json" } });
if (!res.ok) { console.log("pending endpoint answered", res.status); process.exit(0); }
const P = await res.json();
fs.mkdirSync("data", { recursive: true });
const pubPath = "data/publish.json";
const pub = fs.existsSync(pubPath) ? JSON.parse(fs.readFileSync(pubPath, "utf8")) : { published: [] };
const fresh = (P.closed || []).filter(s => !pub.published.includes(s.id));
if (!fresh.length) { console.log("nothing new", P.open ? `(a session is open, ${P.open.edits} edits)` : ""); process.exit(0); }
fs.writeFileSync("data/scene.json", JSON.stringify(P.scene, null, 2) + "\n");
pub.published = pub.published.concat(fresh.map(s => s.id)).slice(-500);
pub.rev = P.rev; pub.updated = P.updated; pub.last = fresh[fresh.length - 1];
fs.writeFileSync(pubPath, JSON.stringify(pub, null, 2) + "\n");
const edits = fresh.flatMap(s => s.edits || []);
const why = { locked: "locked", idle: "10 min idle", timeout: "session timeout" };
const reasons = [...new Set(fresh.map(s => why[s.reason] || s.reason))].join(", ");
const day = (P.updated || new Date().toISOString()).slice(0, 10);
const log = fs.existsSync("CHANGELOG.md") ? fs.readFileSync("CHANGELOG.md", "utf8") : "# Scene changes\n";
const entry = fresh.map(s => `## ${s.closed.slice(0, 16).replace("T", " ")} UTC (${why[s.reason] || s.reason})\n` + (s.edits || []).map(e => "- " + e).join("\n")).join("\n\n");
fs.writeFileSync("CHANGELOG.md", log.replace(/^# Scene changes\n/, "# Scene changes\n\n" + entry + "\n"));
const list = edits.slice(0, 20).map(e => "- " + e).join("\n") + (edits.length > 20 ? `\n- and ${edits.length - 20} more` : "");
const msg = `Scene ${day}: ${edits.length} edit${edits.length === 1 ? "" : "s"} (${reasons}), rev ${P.rev}\n\n${list}\n\n— Sion's Tab agent`;
fs.writeFileSync("/tmp/msg.txt", msg);
sh('git config user.name "terrain-publish"');
sh('git config user.email "41898282+github-actions[bot]@users.noreply.github.com"');
sh("git add data/scene.json data/publish.json CHANGELOG.md");
sh("git commit -F /tmp/msg.txt");
for (let i = 0; i < 4; i++) { try { sh("git pull --rebase origin main"); sh("git push origin HEAD:main"); process.exit(0); } catch (e) { console.log("push retry", i); } }
process.exit(1);
