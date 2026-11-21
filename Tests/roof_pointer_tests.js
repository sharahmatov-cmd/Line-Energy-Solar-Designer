const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = fs.readFileSync(path.join(__dirname, "../Web/app.js"), "utf8");
function functionSource(name) {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `${name} is missing`);
  const end = source.indexOf("\n  function ", start + 1);
  return source.slice(start, end);
}

const layout = { panelW: 1, panelH: 2, roofW: 10, roofH: 8, setback: 0, gap: 0.03 };
const panels = [1, 2.03, 3.06].map((x) => ({ x, y: 1, w: 1, h: 2, stringId: 1 }));
const rails = [{ minX: 0.5, maxX: 4.5, y: 1.56 }];
const state = {
  manual: true, panels, rails, selected: -1, selectedPanels: [], selectedRail: -1,
  materials: { rails }, draw: { layout, scale: 100 }, drag: null,
};
const listeners = new Map();
let captured = false;
let recalculations = 0;
const canvas = {
  width: 1000,
  addEventListener(name, handler) { listeners.set(name, handler); },
  getBoundingClientRect: () => ({ width: 1000 }),
  setPointerCapture() { captured = true; },
  hasPointerCapture: () => captured,
  releasePointerCapture() { captured = false; },
};
const context = vm.createContext({
  roofLayoutState: state,
  els: { roofLayoutCanvas: canvas, dimensionEditor: { hidden: true } },
  num: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  roofLeftAtY: () => 0,
  roofWidthAtY: () => 10,
  selectedRows: () => ({ panel: {} }),
  enableManualLayoutFromCurrent: () => {},
  canvasToRoofPoint: (event) => ({ x: event.clientX, y: event.clientY }),
  findDimensionHandle: () => null,
  findRoofHandle: () => null,
  connectedRailIndices: (index) => [index],
  railOrientation: () => "horizontal",
  clampLayoutRail: (rail) => rail,
  snapRailGroup: (group) => group,
  drawRoofLayout: () => { state.materials.rails = state.rails; },
  safeCalculate: () => { recalculations++; },
});
[
  "selectedPanelIndices", "panelInsideRoof", "normalizeLayoutPanel", "clampLayoutPanel",
  "panelsOverlap", "validPanelPlacement", "validPanelGroup", "snapLayoutPanel", "snapLayoutPanelGroup", "findLayoutPanel", "findLayoutRail",
].forEach((name) => vm.runInContext(functionSource(name), context));
const start = source.indexOf('    els.roofLayoutCanvas.addEventListener("dblclick"');
const end = source.indexOf('    window.addEventListener("keydown"', start);
assert.ok(start >= 0 && end > start);
vm.runInContext(source.slice(start, end), context);

const emit = (type, x, y, ctrlKey = false) => listeners.get(type)({
  type, clientX: x, clientY: y, ctrlKey, button: 0, pointerId: 1, preventDefault() {},
});
const snapshot = (value) => JSON.parse(JSON.stringify(value));
const originalNeighbors = snapshot(state.panels.slice(1));
const originalRails = snapshot(state.rails);

// The mouse starts exactly on a profile drawn over the selected panel.
emit("dblclick", 1.5, 1.56);
assert.equal(state.selected, 0);
assert.equal(state.selectedRail, -1);
emit("pointerdown", 1.5, 1.56);
assert.equal(state.drag.type, "panel", "A profile steals the selected panel's drag");
emit("pointermove", 1.5, 4.56);
emit("pointerup", 1.5, 4.56);
assert.ok(Math.abs(state.panels[0].y - 4) < 1e-10);
assert.deepEqual(snapshot(state.panels.slice(1)), originalNeighbors);
assert.deepEqual(snapshot(state.rails), originalRails);
assert.equal(state.panels[0].stringId, 1);
assert.equal(state.drag, null);
assert.equal(captured, false);
assert.equal(recalculations, 1);

emit("pointerdown", 2.5, 1.56, true);
emit("pointerup", 2.5, 1.56, true);
assert.deepEqual(snapshot(state.selectedPanels), [0, 1], "Ctrl must select panels even over a profile");
emit("pointerdown", 2.5, 1.56, true);
assert.deepEqual(snapshot(state.selectedPanels), [0, 1], "Drag press must keep the group selected");
emit("pointermove", 2.51, 1.56, true);
emit("pointerup", 2.51, 1.56, true);
assert.deepEqual(snapshot(state.selectedPanels), [0]);

emit("pointerdown", 2.5, 1.56, true);
emit("pointerup", 2.5, 1.56, true);
const beforeGroup = snapshot(state.panels);
emit("pointerdown", 2.5, 1.56, true);
assert.equal(state.drag.type, "panels");
emit("pointermove", 2.5, 3.56, true);
emit("pointerup", 2.5, 3.56, true);
for (const index of [0, 1]) {
  assert.ok(Math.abs(state.panels[index].y - beforeGroup[index].y - 2) < 1e-10);
  assert.equal(state.panels[index].x, beforeGroup[index].x);
  assert.equal(state.panels[index].stringId, beforeGroup[index].stringId);
}
assert.deepEqual(snapshot(state.panels[2]), beforeGroup[2], "Unselected panel moved with the group");
assert.deepEqual(snapshot(state.selectedPanels), [0, 1]);
assert.deepEqual(snapshot(state.rails), originalRails);
assert.equal(captured, false);
const afterGroup = snapshot(state.panels);
emit("pointerdown", 2.5, 3.56, true);
emit("pointermove", 3.5, 1.56, true);
emit("pointerup", 3.5, 1.56, true);
assert.deepEqual(snapshot(state.panels), afterGroup, "Group overlaps an unselected panel");
emit("pointerdown", 2.5, 3.56, true);
emit("pointermove", 2.5, 8.56, true);
emit("pointerup", 2.5, 8.56, true);
assert.deepEqual(snapshot(state.panels), afterGroup, "Group leaves the roof");
emit("pointerdown", 2.5, 3.56, true);
emit("pointercancel", 2.5, 3.56, true);
assert.deepEqual(snapshot(state.selectedPanels), [0, 1], "Cancelled press must not toggle selection");

// An exposed part of the profile must remain draggable.
emit("pointerdown", 0.6, 1.56);
assert.equal(state.drag.type, "rail");
emit("pointermove", 0.6, 2.06);
emit("pointerup", 0.6, 2.06);
assert.ok(Math.abs(state.rails[0].y - 2.06) < 1e-10);
console.log("PASS: double-click selection and drag over a profile move only one panel");
console.log("PASS: Ctrl selection over profiles, string preservation, and profile dragging");
console.log("PASS: Ctrl group drag, click threshold, collision and roof limits, pointer cancellation");
