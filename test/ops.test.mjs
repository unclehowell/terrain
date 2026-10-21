import { test } from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { apply, resolve, parseColor, presetFor, KINDS } from "../worker/scene-ops.js";
const fresh = () => JSON.parse(fs.readFileSync(new URL("../worker/initial-scene.json", import.meta.url)));
test("resolve names", () => { const s = fresh(); assert.equal(resolve(s, "the farmhouse").id, "farmhouse"); assert.equal(resolve(s, "Ty Mawr").id, "farmhouse"); assert.equal(resolve(s, "churchyard").id, "churchyard"); assert.equal(resolve(s, "the wiki").id, "site_wiki"); });
test("colours", () => { assert.equal(parseColor("stone grey"), "#8a8d8f"); assert.equal(parseColor("#abc"), "#aabbcc"); assert.equal(parseColor("a nice dark green colour"), "#1f4d2b"); });
test("five voice commands", () => { const s = fresh(); const n = s.objects.length;
  let r = apply(s, "add_object", { kind: "tree", species: "oak", near: "farmhouse" }); assert.ok(r.ok); assert.equal(s.objects.length, n + 1);
  const oak = s.objects.at(-1); assert.equal(oak.species, "oak"); const f = resolve(s, "farmhouse"); assert.ok(Math.hypot(oak.pos[0] - f.pos[0], oak.pos[2] - f.pos[2]) < 25);
  r = apply(s, "set_color", { target: "farmhouse", color: "stone grey" }); assert.equal(resolve(s, "farmhouse").color, "#8a8d8f");
  r = apply(s, "set_camera", { target: "churchyard" }); assert.ok(s.env.camera.target[2] > 50);
  r = apply(s, "move_object", { target: "it", direction: "east", distance: 4 }); 
  r = apply(s, "delete_object", { target: "the old oak" }); assert.ok(!s.objects.find(o => o.id === "oak_1"));
  r = apply(s, "add_object", { kind: "fence", around: "farm pond" }); assert.ok(s.objects.at(-1).points.length >= 4);
  r = apply(s, "set_weather", { weather: "light drizzle" }); assert.equal(s.env.weather, "rain");
  r = apply(s, "set_time_of_day", { time: "night" }); assert.equal(s.env.hour, 23);
  assert.throws(() => apply(s, "set_color", { target: "spaceship", color: "red" }));
});

test("expanded object library has reusable procedural presets", () => {
  const expected = {
    farmhouse: "building", barn: "building", apple: "tree", chestnut: "tree",
    hedge: "hedge", shrub: "shrub", flower: "flower", gate: "gate",
    animal: "animal", sheep: "animal", cow: "animal", horse: "animal",
    cart: "vehicle", tractor: "vehicle", well: "well", statue: "statue",
    ruin: "ruin", sign: "sign",
  };
  for (const [name, kind] of Object.entries(expected)) {
    assert.equal(presetFor(name)?.kind, kind, `preset ${name}`);
  }
  for (const kind of ["hedge", "shrub", "flower", "gate", "animal", "vehicle", "well", "statue", "ruin", "sign"]) {
    assert.ok(KINDS.includes(kind), `registered kind ${kind}`);
  }
});
test("new object species and signs survive scene operations", () => {
  const s = fresh();
  let r = apply(s, "add_object", { kind: "animal", species: "sheep", near: "farmhouse" });
  assert.ok(r.ok);
  assert.equal(s.objects.at(-1).kind, "animal");
  assert.equal(s.objects.at(-1).species, "sheep");
  assert.equal(s.objects.at(-1).name, "Sheep");
  r = apply(s, "add_object", { kind: "sign", name: "Garden sign", text: "ORCHARD", near: "farmhouse" });
  assert.ok(r.ok);
  assert.equal(s.objects.at(-1).kind, "sign");
  assert.equal(s.objects.at(-1).text, "ORCHARD");
  r = apply(s, "add_object", { kind: "hedge", around: "farm pond" });
  assert.ok(r.ok);
  assert.ok(Array.isArray(s.objects.at(-1).points));
  assert.ok(s.objects.at(-1).points.length >= 4);
});
