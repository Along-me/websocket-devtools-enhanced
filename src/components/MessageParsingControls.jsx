import React, { useState } from "react";
import { t } from "../utils/i18n.js";

const MessageParsingControls = ({ settings, onChange, rulesOnly = false }) => {
  const [draft, setDraft] = useState(settings);
  if (!rulesOnly) return (
    <label className="global-message-view">
      <span>{t("jsonViewer.presentation.global")}</span>
      <select aria-label={t("jsonViewer.presentation.global")} value={settings.mode}
        onChange={event => onChange({ ...settings, mode: event.target.value })}>
        <option value="decoded">{t("jsonViewer.binaryView.original")}</option>
        <option value="smart">{t("jsonViewer.presentation.smart")}</option>
        <option value="utf8">UTF-8</option>
        <option value="hex">Hex</option>
        <option value="raw">{t("jsonViewer.presentation.raw")}</option>
        <option value="base64">Base64</option>
      </select>
    </label>
  );
  return (
    <details className="message-parsing-rules">
      <summary onClick={() => setDraft(settings)}>{t("jsonViewer.presentation.rules")}</summary>
      <form onSubmit={event => { event.preventDefault(); onChange({ ...draft, mode: "smart" }); }}>
        <p>{t("jsonViewer.presentation.ruleHint")}</p>
        <label>{t("jsonViewer.presentation.skipBytes")}<input aria-label={t("jsonViewer.presentation.skipBytes")} type="number" min="0" max="102400" value={draft.skipBytes} onChange={event => setDraft({ ...draft, skipBytes: event.target.value })} /></label>
        <label>{t("jsonViewer.presentation.startAfter")}<input aria-label={t("jsonViewer.presentation.startAfter")} value={draft.startAfter} maxLength={500} placeholder="Get" onChange={event => setDraft({ ...draft, startAfter: event.target.value })} /></label>
        <label>{t("jsonViewer.presentation.endBefore")}<input aria-label={t("jsonViewer.presentation.endBefore")} value={draft.endBefore} maxLength={500} onChange={event => setDraft({ ...draft, endBefore: event.target.value })} /></label>
        <label><input type="checkbox" checked={draft.nested} onChange={event => setDraft({ ...draft, nested: event.target.checked })} />{t("jsonViewer.presentation.nested")}</label>
        <button type="submit">{t("jsonViewer.presentation.apply")}</button>
        <button type="button" onClick={() => { const reset = { mode: "smart", nested: true, skipBytes: 0, startAfter: "", endBefore: "" }; setDraft(reset); onChange(reset); }}>{t("common.reset")}</button>
      </form>
    </details>
  );
};
export default MessageParsingControls;
