import JSON5 from "json5";
import { bytesToBase64, bytesToHex, decodeUtf8, formatHexDump, getBinaryBytes } from "./binaryUtils.js";

export const DEFAULT_PRESENTATION = Object.freeze({
  mode: "decoded", nested: true, skipBytes: 0, startAfter: "", endBefore: "",
});
export const VIEW_MODES = ["decoded", "raw", "hex", "utf8", "base64", "smart"];

export function normalizePresentation(value = {}) {
  return {
    mode: VIEW_MODES.includes(value.mode) ? value.mode : "decoded",
    nested: value.nested !== false,
    skipBytes: Math.max(0, Math.min(102400, Number.parseInt(value.skipBytes, 10) || 0)),
    startAfter: typeof value.startAfter === "string" ? value.startAfter.slice(0, 500) : "",
    endBefore: typeof value.endBefore === "string" ? value.endBefore.slice(0, 500) : "",
  };
}

export function isBinaryMessage(message, data = message?.data) {
  return Boolean(message?.isBinary || message?.isProtobuf || typeof message?.binaryData === "string" ||
    message?.binaryByteLength != null || data instanceof ArrayBuffer || ArrayBuffer.isView(data) ||
    (typeof Blob !== "undefined" && data instanceof Blob));
}

const asText = value => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
};
const structured = value => value !== null && typeof value === "object";

function parseCandidate(text) {
  try { return { value: JSON.parse(text), repaired: false }; } catch {}
  try { return { value: JSON5.parse(text), repaired: true }; } catch {}
  return null;
}

// Scan balanced objects AND arrays. Quotes/escapes are respected, so a brace
// in a title or nested escaped JSON never ends the payload early.
export function extractStructuredJson(text) {
  if (typeof text !== "string") return null;
  const full = parseCandidate(text.trim());
  if (full && structured(full.value)) return { ...full, prefix: "", suffix: "" };
  // Support a JSON document sent as a JSON string (up to three wrappers).
  if (full && typeof full.value === "string" && full.value !== text) {
    let inner = full.value;
    for (let layer = 0; layer < 3; layer += 1) {
      const parsed = parseCandidate(inner.trim());
      if (!parsed) break;
      if (structured(parsed.value)) return { ...parsed, repaired: true, prefix: "", suffix: "" };
      if (typeof parsed.value !== "string" || parsed.value === inner) break;
      inner = parsed.value;
    }
  }
  let attempts = 0;
  for (let start = 0; start < text.length && attempts < 32; start += 1) {
    if (text[start] !== "{" && text[start] !== "[") continue;
    attempts += 1;
    const stack = [];
    let quote = "", escaped = false, comment = "", closed = false;
    for (let end = start; end < text.length; end += 1) {
      const char = text[end], next = text[end + 1];
      if (comment === "line") { if (char === "\n" || char === "\r") comment = ""; continue; }
      if (comment === "block") { if (char === "*" && next === "/") { comment = ""; end += 1; } continue; }
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = "";
        continue;
      }
      if (char === "/" && next === "/") { comment = "line"; end += 1; continue; }
      if (char === "/" && next === "*") { comment = "block"; end += 1; continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === "{" || char === "[") stack.push(char);
      else if (char === "}" || char === "]") {
        if (stack.pop() !== (char === "}" ? "{" : "[")) break;
        if (!stack.length) {
          closed = true;
          const parsed = parseCandidate(text.slice(start, end + 1));
          if (parsed && structured(parsed.value)) {
            return { ...parsed, prefix: text.slice(0, start), suffix: text.slice(end + 1) };
          }
          start = end;
          break;
        }
      }
    }
    // Never turn a truncated array into only its first complete child object.
    if (!closed && stack.length) return null;
  }
  return null;
}

// Bound nesting and total work; keep string IDs and amounts as strings.
export function parseNestedStructured(value, budget = { nodes: 20000 }, depth = 0) {
  if (depth >= 20 || --budget.nodes <= 0) return value;
  if (typeof value === "string") {
    const candidate = parseCandidate(value.trim());
    if (candidate && structured(candidate.value)) return parseNestedStructured(candidate.value, budget, depth + 1);
    return value;
  }
  if (Array.isArray(value)) return value.map(item => parseNestedStructured(item, budget, depth + 1));
  if (structured(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) =>
      [key, parseNestedStructured(item, budget, depth + 1)]));
  }
  return value;
}

function matchPayload(text, config) {
  let start = 0, end = text.length;
  if (config.startAfter) {
    const found = text.indexOf(config.startAfter);
    if (found < 0) return { text, prefix: "", suffix: "", warning: "startNotFound" };
    start = found + config.startAfter.length;
  }
  if (config.endBefore) {
    const found = text.indexOf(config.endBefore, start);
    if (found < 0) return { text, prefix: "", suffix: "", warning: "endNotFound" };
    end = found;
  }
  return { text: text.slice(start, end), prefix: text.slice(0, start), suffix: text.slice(end), warning: "" };
}

export function presentMessage(message, settings = DEFAULT_PRESENTATION, suppliedBytes) {
  const config = normalizePresentation(settings);
  const binary = isBinaryMessage(message);
  const bytes = suppliedBytes ?? getBinaryBytes(message);
  const utf8 = bytes ? decodeUtf8(bytes) : typeof message?.data === "string" ? message.data : "";
  const decoded = asText(message?.protobufDecoded ?? message?.data);
  let text = decoded, prefix = "", suffix = "", warning = "", repaired = false, parsed = null;
  if (binary && config.mode !== "decoded" && !bytes) warning = "bytesUnavailable";
  if (binary && bytes) {
    if (config.mode === "hex") text = formatHexDump(bytes);
    else if (config.mode === "raw") text = bytesToHex(bytes);
    else if (config.mode === "base64") text = bytesToBase64(bytes);
    else if (config.mode === "utf8" || config.mode === "smart") text = utf8;
    else text = message?.protobufDecoded != null ? asText(message.protobufDecoded) : bytesToHex(bytes);
  }
  if (config.mode === "smart") {
    const source = binary && bytes ? decodeUtf8(bytes.subarray(config.skipBytes)) : text;
    const matched = matchPayload(source, config);
    warning ||= matched.warning;
    const extracted = matched.warning ? null : extractStructuredJson(matched.text);
    if (extracted) {
      parsed = config.nested ? parseNestedStructured(extracted.value) : extracted.value;
      try { text = JSON.stringify(parsed, null, 2); }
      catch { return { text: source, prefix: "", suffix: "", warning: "formatFailed", repaired: false, parsed: null, searchText: source, opaque: true, truncated: Boolean(message?.binaryTruncated) }; }
      prefix = matched.prefix + extracted.prefix;
      suffix = extracted.suffix + matched.suffix;
      repaired = extracted.repaired;
    } else {
      text = matched.text;
      prefix = matched.prefix;
      suffix = matched.suffix;
      warning ||= "noJson";
    }
  }
  // Search sees the selected view AND the original UTF-8/protocol envelope.
  // Grouping consumes only this view's JSON, never a contradictory protobuf guess.
  return {
    text, prefix, suffix, warning, repaired, parsed,
    searchText: [text, binary ? utf8 : "", prefix, suffix].filter(Boolean).join("\n"),
    opaque: binary && ["raw", "hex", "base64"].includes(config.mode),
    truncated: Boolean(message?.binaryTruncated),
  };
}
