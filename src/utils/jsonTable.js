export const isContainer = value => value !== null && typeof value === "object";

// Drill into a JSON-encoded field without changing the captured document.
export function tableValue(value) {
  if (typeof value === "string" && /^[\s]*[\[{]/.test(value)) {
    try { const parsed = JSON.parse(value); if (isContainer(parsed)) return parsed; } catch {}
  }
  return value;
}

export function valueAtPath(root, path) {
  let value = tableValue(root);
  for (const key of path) {
    if (!isContainer(value) || !Object.hasOwn(value, key)) return undefined;
    value = tableValue(value[key]);
  }
  return value;
}

export function tablePreview(value) {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (isContainer(value)) {
    const entries = Object.entries(value).slice(0, 3);
    const sample = entries.map(([key, item]) => (Array.isArray(value) ? "" : key + ": ") +
      (isContainer(item) ? Array.isArray(item) ? "[…]" : "{…}" : String(item).slice(0, 50))).join(", ");
    return (Array.isArray(value) ? "[" : "{") + sample + (Object.keys(value).length > 3 ? ", …" : "") + (Array.isArray(value) ? "]" : "}");
  }
  const text = String(value);
  return text.length > 100 ? text.slice(0, 100) + "…" : text;
}

export function buildTable(value) {
  if (Array.isArray(value)) {
    const columns = [];
    const keys = new Set();
    value.forEach(item => {
      if (isContainer(item) && !Array.isArray(item)) Object.keys(item).forEach(key => {
        if (!keys.has(key)) { keys.add(key); columns.push(key); }
      });
    });
    return { kind: "array", columns, rows: value.map((item, index) => ({ key: index, value: item })) };
  }
  if (isContainer(value)) return { kind: "object", columns: [], rows: Object.entries(value).map(([key, value]) => ({ key, value })) };
  return { kind: "primitive", columns: [], rows: [{ key: "$", value }] };
}
