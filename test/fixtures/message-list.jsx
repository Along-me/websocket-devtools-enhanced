import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import MessageDetails from "../../src/components/MessageDetails.jsx";
import WebSocketList from "../../src/components/WebSocketList.jsx";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { bytesToBase64 } from "../../src/utils/binaryUtils.js";
import { setLanguage } from "../../src/utils/i18n.js";
import "../../src/styles/main.css";

function capture(text, id, timestamp) {
  const bytes = new TextEncoder().encode(text);
  return { type: "message", messageId: id, timestamp, direction: "incoming", isBinary: true, isProtobuf: true,
    data: "binary", binaryData: bytesToBase64(bytes), binaryByteLength: bytes.length, protobufDecoded: '{"field_0":0}' };
}
const prefix = "\u0000\u0000\u0000\u000b)\u0060\u0000\u0000 /heracles/inbox/mail\u0000Get";
const connection = { id: "fixture-connection", url: "wss://example.test/ws", messages: [
  capture(prefix + JSON.stringify([{ id: 9732, title: "标记为风险用户", content: JSON.stringify({ userTitle: "Aviso de Elegibilidad", showToast: true, msgId: 35, amount: "1000.000000" }) }]), "mail", 3),
  capture("\u0000\u0001heartbeat", "heartbeat", 2),
  { type: "message", messageId: "plain", timestamp: 1, direction: "outgoing", data: '{"requestID":"ordinary","text":"hello"}' },
] };
function Fixture() {
  const [result, setResult] = useState("");
  const [language, setFixtureLanguage] = useState("zh-cn");
  const [connections, setConnections] = useState(new Map([
    ["live", { id: "live", url: "wss://example.test/live", status: "open", timestamp: 1, lastActivity: 1 }],
    ["closed", { id: "closed", url: "wss://example.test/closed", status: "closed", timestamp: 2, lastActivity: 2 }],
  ]));
  return <MantineProvider><main style={{ width: "min(1250px, 100%)", margin: "20px auto", fontFamily: "system-ui", color: "#ddd" }}>
    <h3>全局消息解析验证（测试数据）</h3>
    <button onClick={async () => { const next = language === "zh-cn" ? "en-us" : "zh-cn"; await setLanguage(next); setFixtureLanguage(next); }}>中文 / English</button>
    <div style={{ height: 760, display: "flex", marginTop: 8 }}>
      <div style={{ width: 240, flexShrink: 0 }}><WebSocketList websocketEvents={[]} connectionsMap={connections} onSelectConnection={() => {}}
        onClearConnections={() => setConnections(new Map())} onManualConnect={() => {}} onSetConnectionClosing={() => {}} /></div>
      <div style={{ flex: 1, minWidth: 0 }}><MessageDetails connection={connection} selectedConnectionId={connection.id} onOpenSimulatePanel={value => setResult(JSON.stringify(value))} /></div>
    </div>
    <output data-testid="action-result">{result}</output>
  </main></MantineProvider>;
}
document.body.style.background = "#1b1b1b";
await setLanguage("zh-cn");
createRoot(document.getElementById("root")).render(<Fixture />);
