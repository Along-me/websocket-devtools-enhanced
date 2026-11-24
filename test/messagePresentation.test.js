import assert from "node:assert/strict";
import test from "node:test";
import { bytesToBase64 } from "../src/utils/binaryUtils.js";
import { extractStructuredJson, parseNestedStructured, presentMessage } from "../src/utils/messagePresentation.js";
import { filterMessages } from "../src/utils/filterUtils.js";
import { extractGroupValues, createMessageGroupingCache } from "../src/utils/messageGrouping.js";

const nested = { content: [], showToast: true, userTitle: "¡Depósito exitoso! 🎉", msgId: 35, amount: "1000.000000" };
const mails = [{ id: 9732, title: "标记为风险用户", content: JSON.stringify(nested), metadata: { mailFrom: "second_recharge" } }];
const prefix = "\u0000\u0000\u0000\u000b)\u0060\u0000\u0000 /heracles/inbox/mail\u0000Get";
const payload = prefix + JSON.stringify(mails);
function binary(text, id = "mail") {
  const bytes = new TextEncoder().encode(text);
  return { type: "message", messageId: id, data: "hex representation", isBinary: true, isProtobuf: true,
    protobufDecoded: '{"field_0":0}', binaryData: bytesToBase64(bytes), binaryByteLength: bytes.length,
    timestamp: 1, direction: "incoming" };
}

test("extracts a complete prefixed JSON array and expands nested content without changing raw capture", () => {
  const message = binary(payload);
  const before = JSON.stringify(message);
  const result = presentMessage(message, { mode: "smart" });
  const parsed = JSON.parse(result.text);
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0].content, nested);
  assert.equal(result.prefix, prefix);
  assert.equal(result.warning, "");
  assert.equal(JSON.stringify(message), before);
  assert.deepEqual(JSON.parse(presentMessage(message, { mode: "smart", nested: false }).text), mails);
});

test("global search matches Chinese UTF-8, protocol path, and nested fields in every encoding", () => {
  for (const mode of ["decoded", "utf8", "hex", "base64", "smart"]) {
    const message = binary(payload);
    const presented = { ...message, presentation: presentMessage(message, { mode }) };
    for (const text of ["风险用户", "/heracles/inbox/mail", "second_recharge", "Depósito", "/风险用户/g"]) {
      assert.equal(filterMessages([presented], { text }).length, 1, mode + ": " + text);
      assert.equal(filterMessages([presented], { text, invert: true }).length, 0);
    }
  }
});

test("grouping uses the shared formatted content rather than the protobuf guess", () => {
  const message = binary(payload);
  const presented = { ...message, presentation: presentMessage(message, { mode: "smart" }) };
  assert.deepEqual(extractGroupValues(presented, "msgId", createMessageGroupingCache()), ["35"]);
  assert.deepEqual(extractGroupValues(presented, "field_0", createMessageGroupingCache()), []);
});

test("relaxed formatting handles comments, single quotes, bare keys and trailing commas", () => {
  const text = "protocol Get[{id: 1, title: '你好', /*note*/ amount: '1000.00',},] tail";
  const result = presentMessage(binary(text), { mode: "smart" });
  assert.deepEqual(JSON.parse(result.text), [{ id: 1, title: "你好", amount: "1000.00" }]);
  assert.equal(result.repaired, true);
  assert.equal(result.prefix, "protocol Get");
  assert.equal(result.suffix, " tail");
});

test("quoted delimiters, escaped quotes, arrays and multiple string wrappers are parsed correctly", () => {
  const object = [{ text: 'a ] } brace and " quote', child: JSON.stringify({ ok: true }) }];
  const encoded = JSON.stringify(object);
  assert.deepEqual(extractStructuredJson("HEAD" + encoded + "TAIL").value, object);
  assert.deepEqual(extractStructuredJson(JSON.stringify(JSON.stringify(encoded))).value, object);
  assert.equal(parseNestedStructured({ id: "9732", value: "1000.00" }).id, "9732");
});

test("custom byte offset and literal boundaries extract a selected payload and preserve envelope", () => {
  const result = presentMessage(binary("XXXXheaderBEGIN{ok: true,}ENDfooter"), { mode: "smart", skipBytes: 4, startAfter: "BEGIN", endBefore: "END" });
  assert.deepEqual(JSON.parse(result.text), { ok: true });
  assert.equal(result.prefix, "headerBEGIN");
  assert.equal(result.suffix, "ENDfooter");
  const missing = presentMessage(binary(payload), { mode: "smart", startAfter: "missing" });
  assert.equal(missing.warning, "startNotFound");
  assert.equal(missing.text, payload);
});

test("truncated and invalid JSON are kept rather than replaced by a partial child", () => {
  for (const text of ['[{"id":1},{"id":', '{"a":', 'not JSON']) {
    const result = presentMessage(binary(text), { mode: "smart" });
    assert.equal(result.warning, "noJson");
    assert.equal(result.text, text);
  }
  const history = presentMessage({ isBinary: true, data: "", binaryTruncated: true }, { mode: "smart" });
  assert.equal(history.warning, "bytesUnavailable");
  assert.equal(history.truncated, true);
});

test("views preserve binary lengths and distinct messages with the same decoded presentation", () => {
  const first = binary(payload, "first"), second = binary(payload, "second");
  const views = [first, second].map(message => ({ ...message, presentation: presentMessage(message, { mode: "smart" }) }));
  assert.equal(filterMessages(views, {}).length, 2);
  assert.equal(views[0].binaryByteLength, first.binaryByteLength);
  assert.equal(presentMessage(first, { mode: "utf8" }).text, payload);
  assert.equal(presentMessage(first, { mode: "base64" }).text, first.binaryData);
});

test("group caches follow view changes and plain JSON messages keep their original view", () => {
  const message = binary(payload);
  const wrapper = { ...message, presentation: presentMessage(message, { mode: "decoded" }) };
  const cache = createMessageGroupingCache();
  assert.deepEqual(extractGroupValues(wrapper, "msgId", cache), []);
  wrapper.presentation = presentMessage(message, { mode: "smart" });
  assert.deepEqual(extractGroupValues(wrapper, "msgId", cache), ["35"]);
  const plain = { data: '{"hello":"world"}' };
  assert.equal(presentMessage(plain, { mode: "hex" }).text, plain.data);
});
