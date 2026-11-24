import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { base64ToBytes, formatHexDump, getBinaryBytes, hexToBytes } from "../src/utils/binaryUtils.js";

async function createBridge() {
  const sent = [];
  let listener;
  const window = {
    top: {},
    location: { href: "https://example.test/socket" },
    addEventListener(type, callback) { if (type === "message") listener = callback; },
  };
  const chrome = {
    storage: { local: { get(_keys, callback) { callback({ "websocket-proxy-enabled": false }); } } },
    runtime: {
      onMessage: { addListener() {} },
      sendMessage(message) {
        // Chrome serializes extension messages as JSON, not structured clones.
        sent.push(JSON.parse(JSON.stringify(message)));
        return Promise.resolve({});
      },
    },
  };
  const context = vm.createContext({ window, chrome, Blob, ArrayBuffer, Uint8Array, btoa, URL });
  vm.runInContext(await readFile(new URL("../src/content/content.js", import.meta.url), "utf8"), context);
  return {
    send(payload) {
      listener({ source: window, data: { source: "websocket-proxy-injected", type: "websocket-event-batch", payload } });
    },
    async drain() {
      await vm.runInContext("captureForwardQueue", context);
      return sent.flatMap(message => message.data);
    },
  };
}

test("retains Blob, ArrayBuffer and typed-array slices across Chrome JSON transport", async () => {
  const bridge = await createBridge();
  const source = new Uint8Array([99, 0, 1, 65, 255, 88]);
  const expected = [0, 1, 65, 255];
  const view = new DataView(source.buffer, 1, 4);
  bridge.send([new Blob([source.subarray(1, 5)]), view, source.slice(1, 5).buffer].map((data, index) => ({
    type: "message", messageId: "binary-" + index, data,
  })));
  const messages = await bridge.drain();
  assert.equal(messages.length, 3);
  for (const message of messages) {
    assert.deepEqual(Array.from(getBinaryBytes(message)), expected);
    assert.equal(message.binaryByteLength, 4);
    assert.equal(message.data, "00 01 41 ff");
    assert.equal(message.binaryTruncated, false);
  }
});

test("keeps later text batches behind asynchronous Blob capture", async () => {
  const bridge = await createBridge();
  bridge.send([{ type: "message", messageId: "first", data: new Blob(["hello"]) }]);
  bridge.send([{ type: "message", messageId: "second", data: "after" }]);
  const messages = await bridge.drain();
  assert.deepEqual(messages.map(message => message.messageId), ["first", "second"]);
  assert.equal(messages[1].data, "after");
});

test("limits large Blob previews and retains the original byte length", async () => {
  const bridge = await createBridge();
  bridge.send([{ type: "message", data: new Blob([new Uint8Array(120 * 1024)]) }]);
  const [message] = await bridge.drain();
  assert.equal(getBinaryBytes(message).length, 100 * 1024);
  assert.equal(message.binaryByteLength, 120 * 1024);
  assert.equal(message.binaryTruncated, true);
});

test("preserves empty binary payloads and formats offsets and ASCII accurately", async () => {
  const bridge = await createBridge();
  bridge.send([{ type: "message", data: new Blob([]) }]);
  const [message] = await bridge.drain();
  assert.equal(getBinaryBytes(message).length, 0);
  assert.equal(base64ToBytes("").length, 0);
  assert.equal(hexToBytes("bad hex [truncated]"), null);
  const bytes = new Uint8Array(17).fill(65);
  const lines = formatHexDump(bytes).split("\n");
  assert.equal(lines.length, 2);
  assert.ok(lines[0].endsWith("|AAAAAAAAAAAAAAAA|"));
  assert.ok(lines[1].startsWith("00000010  41"));
});
