import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("../worker/parcels-data.json", import.meta.url), "utf8"));
const numbered = data.records.filter(p => /^\d+$/.test(String(p.stewart_no)));
const mapped = data.records.filter(p => Array.isArray(p.poly));

test("preserves the complete original 1–59 register", () => {
  assert.equal(data.register_count, 59);
  assert.equal(numbered.length, 59);
  assert.deepEqual(numbered.map(p => Number(p.stewart_no)), Array.from({ length: 59 }, (_, i) => i + 1));
});

test("maps only source-backed polygon geometries", () => {
  assert.equal(data.mapped_geometry_count, 43);
  assert.equal(mapped.length, 43);
  assert.equal(numbered.filter(p => p.poly).length, 40);
  assert.ok(numbered.filter(p => !p.poly).every(p => p.status.startsWith("not placed:")));
  for (const record of mapped) {
    assert.ok(record.poly.length > 0, record.stewart_no);
    for (const ring of record.poly) {
      assert.ok(ring.length >= 4, record.stewart_no);
      for (const point of ring) {
        assert.equal(point.length, 2);
        assert.ok(Number.isFinite(point[0]) && Number.isFinite(point[1]));
        assert.ok(point[0] > 51.4 && point[0] < 51.5);
        assert.ok(point[1] < -3.1 && point[1] > -3.3);
      }
    }
  }
});

test("retains grouped and unplaced readings without inventing geometry", () => {
  const byNumber = new Map(numbered.map(p => [p.stewart_no, p]));
  for (const n of ["1","2","3","4","18","46","47","48","49","50","51","52","53","54","55","56","57","58","59"]) {
    assert.equal(byNumber.get(n).poly, null, "number " + n);
  }
  assert.ok(data.records.some(p => /homestead group/i.test(p.stewart_no) && p.poly));
  assert.ok(data.records.some(p => /not read A/i.test(p.stewart_no) && p.poly));
  assert.ok(data.records.some(p => /not read B/i.test(p.stewart_no) && p.poly));
});

test("retains georeferencing provenance and separate fit errors", () => {
  assert.equal(data.source_version, "0.2.0");
  assert.equal(data.georeferencing.rms_m, 6.8);
  assert.equal(data.georeferencing.plan_to_tithe_rms_m, 13);
  assert.match(data.georeferencing.method, /7 control points/);
});
