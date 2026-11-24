import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import JsonViewer from "../../src/components/JsonViewer.jsx";
import { bytesToBase64 } from "../../src/utils/binaryUtils.js";
import { setLanguage } from "../../src/utils/i18n.js";
import "../../src/styles/variables.css";

const payload = '{"message":"你好","nested":"{\\"ok\\":true}"}';
const bytes = new TextEncoder().encode(payload);
const binaryMessage = {
  messageId: "binary-fixture", isBinary: true, isProtobuf: true,
  binaryData: bytesToBase64(bytes), binaryByteLength: bytes.length,
  protobufDecoded: '{"field_0":0,"nested":"{\\"enabled\\":true}"}',
};
const textMessage = { messageId: "text-fixture", data: '{"message":"ordinary JSON"}' };

function Fixture() {
  const [binary, setBinary] = useState(true);
  const [result, setResult] = useState("");
  const [large, setLarge] = useState(false);
  const largeData = React.useMemo(() => JSON.stringify(Array.from({ length: 205 }, (_, index) => ({ id: index, name: "项目 " + index, nested: { nullable: null, list: [1, false, "hello"] } }))), []);
  const message = large ? { data: largeData, messageId: "large" } : binary ? binaryMessage : textMessage;
  return (
    <main style={{ maxWidth: 1100, margin: "24px auto", color: "#ddd", fontFamily: "system-ui" }}>
      <h2>消息查看器功能回归验证</h2>
      <p>原有工具栏 + 额外二进制视图</p>
      <button onClick={() => { setLarge(false); setBinary(true); }}>Binary sample</button>{" "}
      <button onClick={() => { setLarge(false); setBinary(false); }}>Text sample</button>{" "}
      <button onClick={() => setLarge(true)}>Large array sample</button>
      <div style={{ height: 420, marginTop: 16, border: "1px solid #555", borderRadius: 12, overflow: "hidden" }}>
        <JsonViewer data={message.data} message={message} showFavoritesButton
          onCopy={value => setResult("copy: " + value)}
          onSimulate={value => setResult("simulate: " + value)}
          onAddToFavorites={value => setResult("favorite: " + value)} />
      </div>
      <output data-testid="action-result" style={{ display: "block", whiteSpace: "pre-wrap", marginTop: 16 }}>{result}</output>
    </main>
  );
}

document.body.style.background = "#1b1b1b";
await setLanguage("zh-cn");
createRoot(document.getElementById("root")).render(<Fixture />);
