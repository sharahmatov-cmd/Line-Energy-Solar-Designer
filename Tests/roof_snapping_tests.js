const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = fs.readFileSync(path.join(__dirname, "../Web/app.js"), "utf8");
const context = vm.createContext({
  num: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  roofLeftAtY: () => 0, roofWidthAtY: () => 12,
});
for (const name of ["panelInsideRoof", "panelsOverlap", "validPanelPlacement", "snapLayoutPanel", "snapLayoutPanelGroup"]) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0);
  const end = source.indexOf("\n  function ", start + 1);
  vm.runInContext(source.slice(start, end), context);
}
const layout = { roofW: 12, roofH: 12, setback: 0, gap: 0.03 };
const panel = (x, y, extra = {}) => ({ x, y, w: 1, h: 2, stringId: 2, pvInput: "PV 1", ...extra });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} vs ${expected}`);
const snap = (panels, group = [0]) => {
  context.fixture = { panels, group, layout };
  return JSON.parse(JSON.stringify(vm.runInContext("snapLayoutPanelGroup(fixture.panels, fixture.group, fixture.layout, 0.1)", context)));
};
const neighbor = panel(4, 4);
for (const [x, y, expectedX, expectedY] of [
  [2.94, 4.04, 2.97, 4], [5.06, 3.96, 5.03, 4],
  [4.04, 1.94, 4, 1.97], [3.96, 6.06, 4, 6.03],
]) {
  const result = snap([panel(x, y), neighbor]);
  close(result[0].x, expectedX); close(result[0].y, expectedY);
  assert.deepEqual(result[1], neighbor);
}
const group = [panel(5.07, 4.04), panel(6.10, 4.04, { stringId: 3, rotated: true }), neighbor];
const grouped = snap(group, [0, 1]);
close(grouped[0].x, 5.03); close(grouped[0].y, 4);
close(grouped[1].x - grouped[0].x, group[1].x - group[0].x);
close(grouped[1].y - grouped[0].y, 0);
assert.deepEqual(grouped[2], neighbor);
assert.equal(grouped[1].rotated, true);
assert.equal(grouped[1].stringId, 3);
assert.equal(grouped[0].pvInput, "PV 1");
const distant = [panel(8, 8), neighbor];
assert.deepEqual(snap(distant), distant, "Distant panels must not attract");
const blocked = [panel(5.07, 4.04), neighbor, panel(5.03, 4)];
assert.deepEqual(snap(blocked), blocked, "Snapping must not overlap a stationary panel");
const edge = [panel(5.11, 4.04), panel(0.04, 8), neighbor];
assert.deepEqual(snap(edge, [0, 1]), edge, "Snapping must not move a group member outside the roof");
// An existing side contact must not prevent a nearby row/column alignment.
const corner = [panel(4, 6.07), panel(4, 4), panel(5.03, 5)];
const aligned = snap(corner);
close(aligned[0].x, 4); close(aligned[0].y, 6.03);
console.log("PASS: four-way magnetic alignment, rigid group offsets, metadata, collision and roof bounds");
