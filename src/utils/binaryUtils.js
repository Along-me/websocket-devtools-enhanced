/** Helpers for displaying binary WebSocket payloads. */

export function bytesToHex(bytes) {
  if (!bytes) return "";
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(" ");
}

export function bytesToBase64(bytes) {
  if (!bytes) return "";
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function base64ToBytes(value) {
  if (typeof value !== "string") return null;
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

export function hexToBytes(value) {
  if (typeof value !== "string") return null;
  const clean = value.replace(/^(?:0x|\\x)/i, "").replace(/\s/g, "");
  if (clean.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(clean)) return null;
  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < clean.length; index += 2) bytes[index / 2] = Number.parseInt(clean.slice(index, index + 2), 16);
  return bytes;
}

export function toUint8Array(value) {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return null;
}

export function getBinaryBytes(message, fallbackData) {
  if (typeof message?.binaryData === "string") {
    const decoded = base64ToBytes(message.binaryData);
    if (decoded) return decoded;
  }
  const direct = toUint8Array(fallbackData ?? message?.data);
  if (direct) return direct;
  if (typeof message?.protobufRaw === "string" && !message.protobufRaw.startsWith("[")) return hexToBytes(message.protobufRaw);
  return null;
}

export function decodeUtf8(bytes) {
  if (!bytes) return "";
  try { return new TextDecoder("utf-8", { fatal: false }).decode(bytes); }
  catch { return String.fromCharCode(...bytes); }
}

export function formatHexDump(bytes, bytesPerRow = 16) {
  if (!bytes || bytes.length === 0) return "";
  const rows = [];
  for (let offset = 0; offset < bytes.length; offset += bytesPerRow) {
    const row = bytes.subarray(offset, offset + bytesPerRow);
    const hex = Array.from(row, (byte) => byte.toString(16).padStart(2, "0")).join(" ").padEnd(bytesPerRow * 3 - 1, " ");
    const ascii = Array.from(row, (byte) => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".").join("");
    rows.push(`${offset.toString(16).padStart(8, "0")}  ${hex}  |${ascii}|`);
  }
  return rows.join("\n");
}
