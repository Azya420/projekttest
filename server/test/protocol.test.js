import test from "node:test";
import assert from "node:assert/strict";
import { cleanChat, cleanName, publicPlayer, validPosition } from "../src/protocol.js";

test("sanitizes player names and chat", () => {
  assert.equal(cleanName("<script>Łowca</script>"), "scriptŁowcascript");
  assert.equal(cleanChat(" hej\u0000! "), "hej!");
});

test("rejects invalid world coordinates", () => {
  assert.equal(validPosition({ x: 120, y: 240 }), true);
  assert.equal(validPosition({ x: -1, y: 20 }), false);
  assert.equal(validPosition({ x: Number.NaN, y: 20 }), false);
});

test("normalizes public player data", () => {
  assert.deepEqual(publicPlayer({
    id: "abc", name: "Nox", vocation: "unknown", level: 5000, x: 10, y: 20
  }), { id: "abc", name: "Nox", vocation: "warden", level: 999, x: 10, y: 20 });
});
