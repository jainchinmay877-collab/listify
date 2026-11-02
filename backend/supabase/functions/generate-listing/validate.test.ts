import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeListing, parseModelJson } from "./validate.ts";

test("parses fenced JSON", () => {
  assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 });
});

test("returns null for garbage", () => {
  assert.equal(parseModelJson("not json"), null);
  assert.equal(normalizeListing(null), null);
  assert.equal(normalizeListing([]), null);
  assert.equal(normalizeListing({ title: "x" }), null);
});

test("normalizes a good listing", () => {
  const out = normalizeListing({
    title: "  Sony Cyber-shot  ", description: "Works.", tags: ["a", 5, "", "b"],
    price_low: "30", price_high: 20, currency_symbol: "$", check_before_posting: "Battery?",
  });
  assert.ok(out);
  assert.equal(out.title, "Sony Cyber-shot");
  assert.deepEqual(out.tags, ["a", "b"]);
  assert.equal(out.price_low, 20);
  assert.equal(out.price_high, 30);
});

test("missing or invalid prices become null, tags non-array becomes empty", () => {
  const out = normalizeListing({ title: "t", description: "d", tags: "x", price_low: "abc", price_high: -4 });
  assert.ok(out);
  assert.equal(out.price_low, null);
  assert.equal(out.price_high, null);
  assert.deepEqual(out.tags, []);
  assert.equal(out.currency_symbol, "$");
});

test("caps tags at 12 and title length", () => {
  const out = normalizeListing({ title: "x".repeat(500), description: "d", tags: Array.from({ length: 30 }, (_, i) => `t${i}`) });
  assert.ok(out);
  assert.equal(out.tags.length, 12);
  assert.equal(out.title.length, 140);
});
