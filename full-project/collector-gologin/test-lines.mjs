// node test-lines.mjs — unit test for AH line normalization (1xBet + SBOBet), quarter lines and sign.
import assert from "node:assert/strict";
import { parse1xLines, parseSboLines, normLine } from "./lines.mjs";
import { normLine as _n } from "./lines.mjs";
const src = `function(E, GE){ const normLine = ${normLine.toString()}; return (${parse1xLines.toString()})(E, GE); }`;
const inPage = new Function("return " + src)(); // same path as inside page.evaluate
// 1xBet: home -0.75 @1.9 / away +0.75 @1.95 (flat E), plus GameZip quarter lines +0.25 and -1.25, and a level line.
const E = [{ G: 1, T: 1, C: 2.1 }, { G: 2, T: 7, P: -0.75, C: 1.9 }, { G: 2, T: 8, P: 0.75, C: 1.95 }];
const GE = [{ G: 2, E: [[{ T: 7, P: 0.25, C: 1.8 }, { T: 7, P: -1.25, C: 2.4 }, { T: 7, C: 1.85 }], [{ T: 8, P: -0.25, C: 2.0 }, { T: 8, P: 1.25, C: 1.55 }, { T: 8, P: 0, C: 1.95 }]] },
            { G: 17, E: [[{ T: 9, P: 2.75, C: 1.9 }], [{ T: 10, P: 2.75, C: 1.9 }]] }];
for (const f of [parse1xLines, inPage]) assert.deepEqual(f(E, GE), {
  "AH:-0.75": { h: 1.9, a: 1.95 }, "AH:0.25": { h: 1.8, a: 2.0 }, "AH:-1.25": { h: 2.4, a: 1.55 }, "AH:0": { h: 1.85, a: 1.95 }, "OU:2.75": { o: 1.9, u: 1.9 } });
// SBOBet: point = home line; quarter lines; -0 normalized to 0; sign flip option.
const R = [{ marketType: "Handicap", point: -0.75, prices: [{ option: "h", price: 1.93 }, { option: "a", price: 1.97 }] },
           { marketType: "Handicap", point: 0.25, prices: [{ option: "h", price: 1.78 }, { option: "a", price: 2.1 }] },
           { marketType: "Handicap", point: -0, prices: [{ option: "h", price: 1.9 }, { option: "a", price: 1.9 }] },
           { marketType: "OverUnder", point: 2.75, prices: [{ option: "o", price: 1.95 }, { option: "u", price: 1.85 }] }];
assert.deepEqual(parseSboLines(R), { "AH:-0.75": { h: 1.93, a: 1.97 }, "AH:0.25": { h: 1.78, a: 2.1 }, "AH:0": { h: 1.9, a: 1.9 }, "OU:2.75": { o: 1.95, u: 1.85 } });
assert.deepEqual(Object.keys(parseSboLines(R, -1)).sort(), ["AH:-0.25", "AH:0", "AH:0.75", "OU:2.75"]);
// Both books produce identical keys for the same line → they pair.
const k1 = Object.keys(parse1xLines(E, GE)), k2 = Object.keys(parseSboLines(R));
assert.deepEqual(k1.filter((k) => k2.includes(k)).sort(), ["AH:-0.75", "AH:0", "AH:0.25", "OU:2.75"]);
assert.equal(normLine(-0.249), -0.25); assert.ok(Object.is(normLine(-0), 0));
console.log("test-lines: all assertions passed");
// Real 1xbet.fi v3 game (Ipswich v Nottingham Forest, captured 2026-10-23): G2 lines, G2854 quarter AH, G17/G99 totals.
import fs from "node:fs";
import { parse1xV3 } from "./lines.mjs";
const g = JSON.parse(fs.readFileSync(new URL("./fixtures-1x-v3-game.json", import.meta.url)));
const v = parse1xV3(g);
assert.equal(v.home, "Ipswich Town"); assert.equal(v.away, "Nottingham Forest");
assert.deepEqual(v.o, { 1: 3.29, 2: 3.575, 3: 2.316 });
assert.deepEqual(v.mk["AH:0.25"], { h: 1.959, a: 1.98 });    // 3829 P=+0.25 home / 3830 P=-0.25 away -> one key
assert.deepEqual(v.mk["AH:0"], { h: 2.363, a: 1.689 });      // level line, no parameter
assert.deepEqual(v.mk["AH:-1.5"], { h: 6.16, a: 1.084 });    // T8 P=+1.5 -> home line -1.5
assert.deepEqual(v.mk["OU:2.25"], { o: 1.616, u: 2.523 }); assert.deepEqual(v.mk["OU:2.5"], { o: 1.827, u: 2.137 });
console.log("test-lines v3: all assertions passed");
