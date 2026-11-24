import manifest from "../../src/manifest.json";

// A local popup fixture: navigation writes its target so links can be tested
// without sending data or opening the production website.
window.chrome = {
  runtime: { getManifest: () => manifest, sendMessage: async () => ({ success: true }) },
  storage: { local: {
    get(_keys, callback) { const result = { "websocket-proxy-enabled": true, ws_inspector_language: "zh-cn" }; callback?.(result); return Promise.resolve(result); },
    set: async () => {},
  } },
  tabs: { create({ url }) { document.getElementById("navigation-result").textContent = url; } },
};
await import("../../src/popup/popup.jsx");
const { setLanguage } = await import("../../src/utils/i18n.js");
await setLanguage("zh-cn");
