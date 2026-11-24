import React from "react";
import { Download } from "lucide-react";
import { t } from "../utils/i18n.js";
import "../styles/BinaryViewer.css";

// Additive controls only: JsonViewer keeps its editor, original toolbar and
// all copy, simulation, favorites, search and formatting behavior.
const BinaryViewer = ({ message, bytes, viewType, onViewTypeChange }) => {
  const byteLength = message?.binaryByteLength ?? bytes?.length;
  const isTruncated = Boolean(message?.binaryTruncated || (bytes && byteLength > bytes.length));
  const handleDownload = () => {
    if (!bytes) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "websocket-message-" + (message?.messageId || Date.now()) + (isTruncated ? ".preview.bin" : ".bin");
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <div className="binary-view-inline">
        <label className="binary-view-select">
          <span>{t("common.rawData")}</span>
          <select value={viewType} onChange={event => onViewTypeChange(event.target.value)} aria-label={t("jsonViewer.binaryView.label")}>
            <option value="decoded">{t("jsonViewer.binaryView.original")}</option>
            <option value="smart" disabled={!bytes}>{t("jsonViewer.presentation.smart")}</option>
            <option value="raw" disabled={!bytes}>{t("jsonViewer.presentation.raw")}</option>
            <option value="hex" disabled={!bytes}>Hex</option>
            <option value="utf8" disabled={!bytes}>UTF-8</option>
            <option value="base64" disabled={!bytes}>Base64</option>
          </select>
        </label>
        <div className="binary-view-metadata">
          {byteLength != null && <span>{byteLength.toLocaleString()} bytes</span>}
          <button type="button" className="json-viewer-btn json-viewer-btn-inactive" title={t("jsonViewer.binaryView.download")} aria-label={t("jsonViewer.binaryView.download")} onClick={handleDownload} disabled={!bytes}>
            <Download size={14} />
          </button>
        </div>
      </div>
    </>
  );
};

export default BinaryViewer;
