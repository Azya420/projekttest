import test from "node:test";
import assert from "node:assert/strict";
import { findMonsterSpawn } from "../../client/src/world.js";

function createMap(blocked = false) {
  return Array.from({ length: 48 }, () =>
    Array.from({ length: 48 }, () => ({ blocked }))
  );
}

test("finds valid monster spawns outside the town safe zone", () => {
  const map = createMap();

  for (let index = 0; index < 34; index++) {
    const spawn = findMonsterSpawn(map, index);
    assert.ok(spawn);
    assert.equal(spawn.x > 16 && spawn.x < 31 && spawn.y > 16 && spawn.y < 30, false);
    assert.equal(map[spawn.y][spawn.x].blocked, false);
  }
});

test("moves to another tile when the initial candidate is blocked", () => {
  const map = createMap(true);
  map[40][40] = { blocked: false };

  assert.deepEqual(findMonsterSpawn(map, 7), { x: 40, y: 40 });
});

test("returns null instead of looping forever when no spawn exists", () => {
  assert.equal(findMonsterSpawn(createMap(true), 7), null);
});
