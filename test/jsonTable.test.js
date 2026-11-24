import assert from "node:assert/strict";
import test from "node:test";
import { buildTable, tablePreview, tableValue, valueAtPath } from "../src/utils/jsonTable.js";
import { editorPhrases } from "../src/utils/editorPhrases.js";

test("builds union columns for heterogeneous arrays without confusing null and missing", () => {
  const model = buildTable([{ a: null }, { b: false, a: 0 }, null, "hello", [1, 2]]);
  assert.deepEqual(model.columns, ["a", "b"]);
  assert.equal(model.rows.length, 5);
  assert.equal(tablePreview(model.rows[0].value.a), "null");
  assert.equal(tablePreview(model.rows[0].value.b), "—");
  assert.equal(tablePreview(false), "false");
  assert.equal(tablePreview(0), "0");
});

test("drills through array indices and JSON-encoded object fields without mutating data", () => {
  const data = [{ content: '{"nested":[{"name":"你好"}],"id":"001"}' }];
  const before = JSON.stringify(data);
  assert.equal(valueAtPath(data, [0, "content", "nested", 0, "name"]), "你好");
  assert.equal(valueAtPath(data, [0, "content", "id"]), "001");
  assert.equal(valueAtPath(data, ["__proto__"]), undefined);
  assert.equal(JSON.stringify(data), before);
  assert.equal(tableValue("{broken}"), "{broken}");
});

test("handles empty containers, primitives, long strings and null roots", () => {
  assert.equal(buildTable([]).rows.length, 0);
  assert.equal(buildTable({}).rows.length, 0);
  assert.equal(buildTable(null).rows[0].value, null);
  assert.equal(tablePreview("x".repeat(1000)).length, 101);
  assert.equal(tablePreview({ a: {}, b: [], c: 3, d: 4 }), "{a: {…}, b: […], c: 3, …}");
});

test("search phrases cover every supported non-English language", () => {
  for (const language of ["zh-cn", "zh-tw", "ja", "ko", "de", "fr"]) {
    const phrases = editorPhrases(language);
    for (const key of ["Find", "next", "previous", "all", "match case", "regexp", "by word", "close"]) assert.ok(phrases[key], language + ":" + key);
  }
  assert.equal(editorPhrases("zh-cn").next, "下一个");
  assert.deepEqual(editorPhrases("en-us"), {});
});
