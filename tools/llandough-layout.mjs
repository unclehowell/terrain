// Re-lays a terrain scene.json as a schematic of Llandough (Cardiff / Vale of Glamorgan).
// Usage: node tools/llandough-layout.mjs <in-scene.json> <out-scene.json>
// The layout itself lives in worker/scene-ops.js (llandoughRelayout) so the deployed worker
// can apply it to the live scene. SCHEMATIC, not survey-accurate: see the anchors there.
import fs from "node:fs";
import { llandoughRelayout } from "../worker/scene-ops.js";
const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) { console.error("usage: node tools/llandough-layout.mjs <in> <out>"); process.exit(1); }
const raw = fs.readFileSync(inPath, "utf8");
const scene = llandoughRelayout(JSON.parse(raw));
const pretty = raw.trimStart().startsWith("{\n");
fs.writeFileSync(outPath, pretty ? JSON.stringify(scene, null, 1) + "\n" : JSON.stringify(scene));
const c = {}; for (const o of scene.objects) c[o.kind] = (c[o.kind] || 0) + 1;
console.log("objects", scene.objects.length, c);
