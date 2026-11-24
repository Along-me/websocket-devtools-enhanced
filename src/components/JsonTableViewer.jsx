import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { t } from "../utils/i18n.js";
import { buildTable, isContainer, tablePreview, tableValue, valueAtPath } from "../utils/jsonTable.js";
import "../styles/JsonTableViewer.css";

const PAGE_SIZE = 100;
const JsonTableViewer = forwardRef(({ data }, ref) => {
  const [path, setPath] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const inputRef = useRef(null);
  const current = valueAtPath(data, path);
  const model = useMemo(() => buildTable(current), [current]);
  const rows = useMemo(() => model.rows.filter(row => !query ||
    (String(row.key) + " " + JSON.stringify(row.value)).toLocaleLowerCase().includes(query.toLocaleLowerCase())), [model, query]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const activePage = Math.min(page, pages - 1);
  useEffect(() => { setPath([]); setQuery(""); setPage(0); }, [data]);
  useImperativeHandle(ref, () => ({ focusSearch: () => inputRef.current?.focus() }), []);
  const navigate = next => { setPath(next); setQuery(""); setPage(0); };
  const cell = (value, target, missing = false) => {
    const container = isContainer(tableValue(value));
    return container ? <button className="json-table-drill" title={t("jsonTable.enter")} onClick={() => navigate(target)}>
      <span>{tablePreview(value)}</span><small>{t("jsonTable.enter")} ›</small>
    </button> : <span className={"json-table-scalar " + (value === null ? "null" : typeof value)} title={missing ? t("jsonTable.missing") : String(value)}>
      {missing ? "—" : typeof value === "string" && !value ? '""' : tablePreview(value)}
    </span>;
  };
  return <div className="json-table-viewer">
    <nav className="json-table-breadcrumbs" aria-label={t("jsonTable.path")}>
      <button onClick={() => navigate([])}>{t("jsonTable.root")}</button>
      {path.map((key, index) => <React.Fragment key={index}><span>›</span><button onClick={() => navigate(path.slice(0, index + 1))}>{String(key)}</button></React.Fragment>)}
    </nav>
    <div className="json-table-tools"><input ref={inputRef} aria-label={t("jsonTable.filter")} placeholder={t("jsonTable.filter")} value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} />
      <span>{t("jsonTable.count", { count: rows.length })}</span>
    </div>
    <div className="json-table-scroll"><table>
      <thead><tr><th>{model.kind === "array" ? t("jsonTable.index") : t("jsonTable.key")}</th>
        {model.kind === "array" && model.columns.map(key => <th key={key}>{key}</th>)}<th>{t("jsonTable.value")}</th></tr></thead>
      <tbody>{rows.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE).map(row => <tr key={row.key}>
        <th>{String(row.key)}</th>
        {model.kind === "array" && model.columns.map(key => {
          const object = isContainer(row.value) && !Array.isArray(row.value);
          const present = object && Object.hasOwn(row.value, key);
          return <td key={key}>{cell(present ? row.value[key] : undefined, [...path, row.key, key], !present)}</td>;
        })}
        <td>{cell(row.value, model.kind === "primitive" ? path : [...path, row.key])}</td>
      </tr>)}</tbody>
    </table>{!rows.length && <p className="json-table-empty">{t("jsonTable.empty")}</p>}</div>
    <div className="json-table-pagination"><button disabled={!activePage} onClick={() => setPage(activePage - 1)}>{t("jsonTable.previous")}</button>
      <span>{activePage + 1} / {pages}</span><button disabled={activePage + 1 >= pages} onClick={() => setPage(activePage + 1)}>{t("jsonTable.next")}</button></div>
  </div>;
});
export default JsonTableViewer;
