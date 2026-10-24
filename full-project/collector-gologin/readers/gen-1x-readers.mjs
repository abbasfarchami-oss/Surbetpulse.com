// One-off generator: writes ONE standalone file per 1xBet-family book (books/<key>.mjs).
// After generation each file is independent: own config, own parser copy, own log/status. Edit files directly.
import fs from "node:fs";
const C = JSON.parse(fs.readFileSync(new URL("../config.json", import.meta.url)));
const pid = (k) => (/^[0-9a-f]{24}$/.test(C.BOOKS[k]?.gologinProfileId || "") ? C.BOOKS[k].gologinProfileId : null);
const BOOKS = [
  ["1xbet", "1xBet", "1xbet.fi", ["1xbet.com"]], ["melbet", "Melbet", "melbet.com", []], ["888starz", "888Starz", "888starz.bet", []],
  ["betwinner", "Betwinner", "betwinner2.com", ["betwinner.com"]], ["22bet", "22Bet", "22bet.com", []],
  ["megapari", "MegaPari", "2457320mp.pro", ["megapari.com"]], ["paripesa", "PariPesa", "paripesa.bet", []],
  ["fairpari", "FairPari", "fairpari-39771.top", ["fairpari.com"]], ["winwin", "WinWin", "ww-bet.com", ["winwin.bet"]],
  ["linebet", "Linebet", "linebet.com", []], ["helabet", "Helabet", "helabet.com", []], ["betandyou", "Betandyou", "betandyou.com", []],
  ["dbbet", "DB-Bet", "dbbet.com", []], ["betlabel", "Betlabel", "betlabel.com", []], ["spinbetter", "Spinbetter", "spinbetter.com", []],
  ["sapphirebet", "Sapphirebet", "sapphirebet.com", []], ["1xbit", "1xBit", "1xbit.com", []], ["betpari", "Betpari", "betpari.com", []],
  ["fastpari", "Fastpari", "fastpari.com", []], ["doublebet", "Doublebet", "doublebet.com", []],
  ["betforward", "BetForward", "betforward.com", [], "engine NOT verified as 1x; 301 redirect from box"],
];
const tpl = fs.readFileSync(new URL("./_1x-template.mjs", import.meta.url), "utf8");
for (const [key, name, domain, mirrors, note = ""] of BOOKS) {
  const cfg = { key, name, family: "1xbet", engine: "1x", domain, mirrors, feedPrefix: "service-api/",
    v3Query: "cfView=3&fcountry=197&gr=285&grMode=4&lng=en&ref=1&selectedMs=1.1,2.1,10.1",
    legacyQuery: "sports=1&count=50&lng=en&mode=4&country=1", gologinProfileId: pid(key), note };
  fs.writeFileSync(new URL(`./books/${key}.mjs`, import.meta.url), tpl.replace("/*__CONFIG__*/null", JSON.stringify(cfg, null, 2)));
}
console.log("wrote", BOOKS.length, "readers");
