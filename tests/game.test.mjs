import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const output = ts.transpileModule(
  fs.readFileSync(new URL("../lib/game.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ES2020,
    },
  },
).outputText;
const { CampusGame } = await import(
  "data:text/javascript;base64," + Buffer.from(output).toString("base64")
);
globalThis.matchMedia = () => ({ matches: true });
globalThis.location = { search: "" };
globalThis.devicePixelRatio = 1;
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.document = {
  hidden: false,
  addEventListener() {},
  removeEventListener() {},
};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
Object.defineProperty(globalThis, "navigator", {
  value: { vibrate() {} },
  configurable: true,
});
function game(end = () => {}, easy = false) {
  return new CampusGame(
    {
      getContext: () => ({}),
      addEventListener() {},
      removeEventListener() {},
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 360,
        height: 600,
      }),
    },
    false,
    () => {},
    end,
    undefined,
    easy,
  );
}
test("round begins with four sleeping students and ends after 45 active seconds", () => {
  let result;
  const g = game((r) => (result = r));
  assert.equal(g.students.filter((s) => !s.awake).length, 4);
  g.spawn = 999;
  for (let i = 0; i < 2920 && !g.ended; i++) g.step(1 / 60);
  assert.equal(result.earlyEnd, false);
  assert.ok(result.durationMs >= 45000 && result.durationMs <= 45020);
});
test("Chill Campus has fewer sleeping students, no heavy clouds and no early loss", () => {
  let result;
  const g = game((r) => (result = r), true);
  assert.equal(g.students.filter((s) => !s.awake).length, 2);
  g.t = 25;
  for (let i = 0; i < 30; i++) {
    g.clouds = [];
    g.spawnCloud();
    assert.equal(g.clouds[0].hp, 1);
  }
  g.clouds = [];
  g.spawn = 999;
  g.students.forEach((s) => (s.awake = false));
  for (let i = 0; i < 240; i++) g.step(1 / 60);
  assert.equal(result, undefined);
  assert.equal(g.ended, false);
  while (!g.ended) g.step(1 / 60);
  assert.equal(result.earlyEnd, false);
});
test("round completion callback is fired exactly once", () => {
  let completions = 0;
  const g = game(() => completions++);
  g.t = 48.59;
  g.step(0.02);
  g.step(0.02);
  g.step(0.02);
  assert.equal(completions, 1);
});
test("all sleeping for three continuous seconds ends a round early", () => {
  let result;
  const g = game((r) => (result = r));
  g.t = 10;
  g.spawn = 999;
  g.students.forEach((s) => (s.awake = false));
  for (let i = 0; i < 181; i++) g.step(1 / 60);
  assert.equal(result.earlyEnd, true);
});
test("pops wake nearby students, chain combos, and empty taps reset", () => {
  const g = game();
  g.t = 10;
  g.students.forEach((s) => {
    s.awake = true;
    s.x = 300;
    s.y = 500;
  });
  g.students[0] = { x: 50, y: 50, awake: false, variant: 0 };
  const c = { x: 50, y: 50, hp: 1, target: 0, label: "Monday", sitting: 0 };
  g.clouds = [c];
  g.pop(c);
  assert.equal(g.result.score, 25);
  assert.equal(g.result.woken, 1);
  g.pop({ ...c });
  assert.equal(g.combo, 2);
  assert.equal(g.result.score, 45);
  g.tap({ preventDefault() {}, clientX: 180, clientY: 200 });
  assert.equal(g.combo, 0);
});
test("heavy clouds need two taps and power-up collection is unique", () => {
  const g = game();
  g.t = 10;
  g.clouds = [{ x: 100, y: 100, hp: 2, target: 0, label: "Viva", sitting: 0 }];
  const e = { preventDefault() {}, clientX: 100, clientY: 100 };
  g.tap(e);
  assert.equal(g.clouds.length, 1);
  assert.equal(g.result.pops, 0);
  g.tap(e);
  assert.equal(g.clouds.length, 0);
  for (let i = 0; i < 2; i++) {
    g.power = { x: 100, y: 100, type: "chai", until: 20 };
    g.tap(e);
  }
  assert.deepEqual(g.result.cards, ["chai"]);
  assert.equal(g.result.powerupsUsed, 2);
});
