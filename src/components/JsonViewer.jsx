import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { search, openSearchPanel } from "@codemirror/search";
import Protobuf from "../Icons/Protobuf";
import BinaryViewer from "./BinaryViewer.jsx";
import JsonTableViewer from "./JsonTableViewer.jsx";
import { editorPhrases } from "../utils/editorPhrases.js";
import { getBinaryBytes } from "../utils/binaryUtils.js";
import { extractStructuredJson, isBinaryMessage as checkBinaryMessage, normalizePresentation, parseNestedStructured, presentMessage } from "../utils/messagePresentation.js";

const deepEqual = (a, b) => {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  
  return keysA.every(key => keysB.includes(key) && deepEqual(a[key], b[key]));
};
import {
  WrapText,
  Minimize2,
  Hash,
  Copy,
  Edit,
  CheckCircle,
  SquareStack,
  Star,
  Send,
  Layers2,
  Check,
  Info,
  Search
} from "lucide-react";
import { t, getCurrentLanguage, addLanguageChangeListener } from "../utils/i18n.js";
import "../styles/JsonViewer.css";


const JsonViewer = ({
  data,
  message = null, // Complete message object for protobuf handling
  presentationSettings = null,
  onPresentationSettingsChange = null,
  className = "",
  showControls = true,
  onCopy = null,
  copyButtonText = t("jsonViewer.controls.copy"),
  copiedText = t("jsonViewer.controls.copied"),
  isCopied: isCopiedProp = false,
  readOnly = true,
  onChange = null,
  enableWrap = true,
  enableNestedParse = true,
  onAddToFavorites = null,
  showFavoritesButton = false,
  onSimulate = null,
  // New props
  showNestedParseButton = true, // Control existing nested parse button
  showSimulateNestedParseButton = false, // Control button specifically for Simulate Message
  onSimulateNestedParse = null, // Callback for Simulate Message specific nested parse
}) => {
  // Set initial wrap value based on content type: JSON defaults to no wrap, non-JSON defaults to wrap
  const [textWrap, setTextWrap] = useState(() => {
    // In read-only mode, auto wrap based on content type; in editable mode, default to no wrap
    if (!readOnly) return false;
    if (typeof data === 'string') {
      try {
        JSON.parse(data);
        return false; // Is JSON
      } catch {
        return true; // Is not JSON
      }
    }
    return true;
  });

  const [collapsed, setCollapsed] = useState(false);
  const [nestedParse, setNestedParse] = useState(false); // Default to no nested parsing
  const [forceUpdate, setForceUpdate] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [renderMode, setRenderMode] = useState("code");
  const [language, setLanguage] = useState(getCurrentLanguage);
  const tableRef = useRef(null);
  const renderModeRef = useRef("code");
  useEffect(() => addLanguageChangeListener(setLanguage), []);
  
  // Protobuf data toggle state
  const [localPresentation, setLocalPresentation] = useState(() => normalizePresentation());
  const config = presentationSettings || localPresentation;
  const resolvedMessage = useMemo(() => message || { data }, [message, data]);
  const isBinaryMessage = checkBinaryMessage(resolvedMessage, data);
  const directBytes = useMemo(() => getBinaryBytes(message, data), [message, data]);
  const [blobSnapshot, setBlobSnapshot] = useState(null);
  const binaryBytes = directBytes || (blobSnapshot?.data === data ? blobSnapshot.bytes : null);
  useEffect(() => {
    let active = true;
    if (!directBytes && typeof Blob !== "undefined" && data instanceof Blob) {
      data.slice(0, 100 * 1024).arrayBuffer().then(buffer => {
        if (active) setBlobSnapshot({ data, bytes: new Uint8Array(buffer) });
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [data, directBytes]);
  const presentation = useMemo(
    () => message?.presentation || presentMessage(resolvedMessage, config, binaryBytes),
    [message, resolvedMessage, config, binaryBytes]
  );
  const isOpaqueBinaryView = presentation.opaque;
  const changeView = mode => {
    const next = { ...config, mode };
    if (onPresentationSettingsChange) onPresentationSettingsChange(next);
    else setLocalPresentation(next);
    setShowPartialJson(false);
  };

  // PartialJson data toggle state
  const [showPartialJson, setShowPartialJson] = useState(false);
  
  // Check if current message is protobuf
  const isProtobufMessage = message && message.isProtobuf;
  
  const getEffectiveData = useCallback(() => presentation.text, [presentation]);
  // Use effective data for all processing
  const effectiveData = getEffectiveData();

  // Listen for data changes, automatically switch textWrap initial value (only if user hasn't manually toggled, and in read-only mode)
  const [userToggledWrap, setUserToggledWrap] = useState(false);
  useEffect(() => {
    if (!readOnly) return; // Do not auto-toggle wrap in editable mode
    if (!userToggledWrap) {
      const dataToCheck = getEffectiveData();
      if (typeof dataToCheck === 'string') {
        try {
          JSON.parse(dataToCheck);
          setTextWrap(false);
        } catch {
          setTextWrap(true);
        }
      } else {
        setTextWrap(true);
      }
    }
  }, [getEffectiveData, userToggledWrap, readOnly]);

  // Recursively parse nested JSON strings
  const parseNestedJson = useCallback(obj => parseNestedStructured(obj), []);

  // Try to find and parse a JSON object in text
  const findValidJson = useCallback((text) => {
    if (!text) return null;
    return extractStructuredJson(text)?.value ?? null;
  }, []);

  // Detect and parse JSON
  const {
    isValidJson,
    parsedData,
    displayData,
    nestedParsedData,
    hasNestedData,
    hasPartialJson,
  } = useMemo(() => {
    if (!effectiveData || typeof effectiveData !== "string" || isOpaqueBinaryView) {
      return {
        isValidJson: false,
        parsedData: null,
        displayData: String(effectiveData || ""),
        nestedParsedData: null,
        hasNestedData: false,
        hasPartialJson: false,
      };
    }

    try {
      // First try to parse the entire string
      let parsed;
      let hasPartialJson = false;
      try {
        parsed = JSON.parse(effectiveData);
      } catch {
        // If full parse fails, try to find valid JSON within the string
        parsed = findValidJson(effectiveData);
        if (!parsed) {
          throw new Error("No valid JSON found");
        }
        hasPartialJson = true;
      }

      const nestedParsed = parseNestedStructured(parsed);
      // Check if nested parsing actually found nested JSON using shallow comparison
      const hasNestedData = !deepEqual(parsed, nestedParsed);

      return {
        isValidJson: true,
        parsedData: parsed,
        displayData: effectiveData,
        nestedParsedData: nestedParsed,
        hasNestedData,
        hasPartialJson,
      };
    } catch {
      return {
        isValidJson: false,
        parsedData: null,
        displayData: effectiveData,
        nestedParsedData: null,
        hasNestedData: false,
        hasPartialJson: false,
      };
    }
  }, [effectiveData, parseNestedJson, forceUpdate, isOpaqueBinaryView]);

  // Get display content
  const getDisplayContent = () => {
    if (!isValidJson) {
      return displayData;
    }

    // If we have partial JSON and showPartialJson is false, show original content
    if (hasPartialJson && !showPartialJson) {
      return displayData;
    }

    // Apply formatting and transformations
    const jsonData = nestedParse ? nestedParsedData : parsedData;
    return JSON.stringify(jsonData, null, collapsed ? 0 : 2);
  };

  const handleCopyClick = () => {
    const copyData = getDisplayContent();
    if (onCopy) {
      onCopy(copyData);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } else {
      // Default copy implementation
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard
          .writeText(copyData)
          .then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
          })
          .catch((err) => {
            fallbackCopyTextToClipboard(copyData);
          });
      } else {
        fallbackCopyTextToClipboard(copyData);
      }
    }
  };

  // Fallback copy method (for older browsers or non-secure contexts)
  const fallbackCopyTextToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand("copy");
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }

    document.body.removeChild(textArea);
  };

  const handleAddToFavorites = () => {
    if (onAddToFavorites) {
      const favoriteData = getDisplayContent();
      onAddToFavorites(favoriteData);
    }
  };

  const handleChange = useCallback(
    (value) => {
      if (onChange && !readOnly) {
        if (nestedParse) {
          try {
            // Try to parse and apply nested parsing
            const parsed = JSON.parse(value);
            const nestedParsed = parseNestedJson(parsed);
            const formattedContent = JSON.stringify(
              nestedParsed,
              null,
              collapsed ? 0 : 2
            );
            onChange(formattedContent);
            return;
          } catch (error) {
            // If parsing fails, use original value
          }
        }
        onChange(value);
      }
    },
    [onChange, readOnly, nestedParse, parseNestedJson, collapsed]
  );

  // Handle formatting changes in edit mode
  const handleFormatChange = useCallback(
    (newCollapsed, newNestedParse) => {
      if (!readOnly && onChange && isValidJson) {
        try {
          const jsonData = newNestedParse ? nestedParsedData : parsedData;
          const formattedContent = JSON.stringify(
            jsonData,
            null,
            newCollapsed ? 0 : 2
          );
          onChange(formattedContent);
        } catch (error) {
          console.error("Error formatting JSON:", error);
        }
      }
    },
    [readOnly, onChange, isValidJson, nestedParsedData, parsedData]
  );

  const handleCollapsedChange = useCallback(
    (e) => {
      const newCollapsed = e.target.checked;
      setCollapsed(newCollapsed);
      handleFormatChange(newCollapsed, nestedParse);
    },
    [handleFormatChange, nestedParse]
  );

  const handleNestedParseChange = useCallback(
    (newNestedParse) => {
      setNestedParse(newNestedParse);
      handleFormatChange(collapsed, newNestedParse);

      // Force a re-render to ensure UI updates
      setForceUpdate((prev) => prev + 1);
    },
    [handleFormatChange, collapsed, nestedParse, hasNestedData]
  );

  // No longer auto-switch nestedParse due to data changes, only user operation switches

  // Handler for Simulate Message specific nested parse button
  const [simulateNestedParsed, setSimulateNestedParsed] = useState(false);
  const handleSimulateNestedParse = useCallback(() => {
    if (hasNestedData && isValidJson && onSimulateNestedParse && !simulateNestedParsed) {
      try {
        // Only do nested parse once
        const parsed = JSON.parse(effectiveData);
        const nestedParsed = parseNestedJson(parsed);
        const formattedContent = JSON.stringify(nestedParsed, null, collapsed ? 0 : 2);
        onSimulateNestedParse(formattedContent);
        setSimulateNestedParsed(true);
      } catch {
        // ignore
      }
    }
  }, [hasNestedData, isValidJson, onSimulateNestedParse, effectiveData, parseNestedJson, collapsed, simulateNestedParsed]);

  // Reset button state when Simulate Message panel switches content
  useEffect(() => {
    setSimulateNestedParsed(false);
  }, [effectiveData]);

  const content = getDisplayContent();
  const canShowTable = readOnly && isValidJson && !isOpaqueBinaryView && (!hasPartialJson || showPartialJson);
  const tableVisible = canShowTable && renderMode === "table";
  renderModeRef.current = tableVisible ? "table" : "code";
  const tableData = nestedParse ? nestedParsedData : parsedData;

  // References for programmatic actions (search) and focus-scoped shortcut handling
  const cmRef = useRef(null);
  const rootRef = useRef(null);

  // Open CodeMirror's native search panel (also reachable via Ctrl/Cmd+F)
  const handleOpenSearch = useCallback(() => {
    if (renderModeRef.current === "table") { tableRef.current?.focusSearch(); return; }
    const view = cmRef.current?.view;
    if (view) {
      openSearchPanel(view);
      view.focus();
    }
  }, []);

  // Intercept Ctrl/Cmd+F when focus is inside this viewer so the CodeMirror
  // search panel opens instead of the browser's native find bar.
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isFindShortcut =
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey &&
        e.key.toLowerCase() === "f";
      if (!isFindShortcut) return;

      const root = rootRef.current;
      const view = cmRef.current?.view;
      if (!root) return;

      if (root.contains(document.activeElement)) {
        e.preventDefault();
        e.stopPropagation();
        if (renderModeRef.current === "table") tableRef.current?.focusSearch();
        else if (view) openSearchPanel(view);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // CodeMirror extensions configuration
  const extensions = [
    EditorState.phrases.of(editorPhrases(language)),
    isValidJson ? json() : [],
    search({ top: true }),
    EditorView.theme({
      "&": {
        fontSize: "12px",
        height: "100%",
        backgroundColor: "#262626", // Editor background color
      },
      ".cm-editor": {
        height: "100%",
      },
      ".cm-scroller": {
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        lineHeight: "1.3",
        overflow: "auto",
      },
      ".cm-focused": {
        outline: "none",
      },
      ".cm-editor.cm-focused": {
        outline: "none",
      },
      ".cm-content": {
        padding: "8px",
        minHeight: "100%",
      },
      ".cm-gutters": {
        backgroundColor: "#333333", // Line number area background color
        borderRight: "1px solid #404040",
      },
      "&.cm-editor.cm-focused .cm-selectionBackground": {
        backgroundColor: "rgba(0, 122, 204, 0.3)",
      },
      ".cm-line": {
        lineHeight: "1.3",
      },
    }),
    textWrap ? EditorView.lineWrapping : [],
    // Keep the view focusable even when read-only so it can hold a cursor and
    // Ctrl/Cmd+F search + text selection work; EditorState.readOnly blocks edits.
    EditorState.readOnly.of(readOnly),
  ].filter(Boolean);

  return (
    <div className={`json-viewer ${className}`} ref={rootRef}>
      {showControls && (
        <div className="json-viewer-controls">
          <div className="json-viewer-controls-left">
            {/* Protobuf data toggle controls */}
            {isBinaryMessage && (
              <BinaryViewer message={message} bytes={binaryBytes}
                viewType={config.mode} onViewTypeChange={changeView} />
            )}

            {hasPartialJson && (
              <div className="protobuf-controls">
                <button
                  className={`json-viewer-btn btn-wrap ${showPartialJson ? "json-viewer-btn-active-green" : "json-viewer-btn-inactive"}`}
                  onClick={() => setShowPartialJson(!showPartialJson)}
                  title="Toggle between JSON and raw data"
                >
                  <Hash size={14} />
                  <span>{t("jsonViewer.status.json")}</span>
                </button>
              </div>
            )}      

            {enableWrap && (
              <button
                onClick={() => {
                  setTextWrap(!textWrap);
                  setUserToggledWrap(true);
                }}
                className={`json-viewer-btn btn-wrap ${
                  textWrap ? "json-viewer-btn-active-green" : "json-viewer-btn-inactive"
                }`}
                title={t("jsonViewer.tooltips.wrapText")}
              >
                <WrapText size={14} color="currentColor" />
                <span>{t("jsonViewer.controls.wrap")}</span>
              </button>
            )}

            {/* Original nested parse button */}
            {enableNestedParse && showNestedParseButton && (
              <button
                onClick={() => {
                  const newNestedParse = !nestedParse;
                  handleNestedParseChange(newNestedParse);
                }}
                className={`json-viewer-btn btn-nested ${
                  nestedParse ? "json-viewer-btn-active-purple" : "json-viewer-btn-inactive"
                } ${!hasNestedData ? "json-viewer-btn-disabled" : ""}`}
                title={hasNestedData ? t("jsonViewer.tooltips.nestedParseJson") : t("jsonViewer.tooltips.noNestedData")}
                disabled={!hasNestedData}
              >
                <Layers2 size={14} />
                <span>{t("jsonViewer.controls.nestedParse")}</span>
              </button>
            )}

            {/* Simulate Message specific nested parse button */}
            {enableNestedParse && showSimulateNestedParseButton && (
              <button
                onClick={handleSimulateNestedParse}
                className={`json-viewer-btn btn-nested-simulate ${
                  simulateNestedParsed || !hasNestedData ? "json-viewer-btn-disabled" : "json-viewer-btn-inactive"
                }`}
                title={
                  hasNestedData
                    ? t("jsonViewer.tooltips.simulateNestedParseJson") || "Simulate Nested Parse"
                    : t("jsonViewer.tooltips.noNestedData")
                }
                disabled={simulateNestedParsed || !hasNestedData}
              >
                <Layers2 size={14} />
                                    <span>{t("jsonViewer.controls.simulateNestedParse") || "Simulate Nested Parse"}</span>
              </button>
            )}
          </div>

          <div className="json-viewer-controls-right">
            {canShowTable && (
              <button type="button" className={"json-viewer-btn " + (tableVisible ? "json-viewer-btn-active-blue" : "json-viewer-btn-inactive")}
                onClick={() => setRenderMode(tableVisible ? "code" : "table")} title={t("jsonTable.toggle")}>
                {tableVisible ? t("jsonTable.code") : t("jsonTable.table")}
              </button>
            )}
            {/* Action buttons */}
            <div className="json-viewer-action-buttons">
              {/* Search button - opens CodeMirror native search panel */}
              <button
                onClick={handleOpenSearch}
                className="json-viewer-btn btn-search json-viewer-btn-inactive"
                title={t("jsonViewer.tooltips.search") || "Search (Ctrl+F)"}
              >
                <Search size={14} />
              </button>

              {/* Simulate button */}
              {onSimulate && (
                <button
                  onClick={() => onSimulate(getDisplayContent())}
                  className="json-viewer-btn btn-simulate json-viewer-btn-inactive"
                  title={t("jsonViewer.tooltips.simulate") || "Simulate this message"}
                >
                  <Send size={14} />
                </button>
              )}

              <button
                onClick={handleCopyClick}
                className={`json-viewer-btn btn-copy ${
                  isCopied ? "json-viewer-btn-active-green" : "json-viewer-btn-inactive"
                }`}
                title={
                  isCopied
                    ? t("jsonViewer.tooltips.copied") || t("jsonViewer.controls.copied")
                    : t("jsonViewer.tooltips.copy") || t("jsonViewer.controls.copy")
                }
              >
                {isCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>

              {showFavoritesButton && onAddToFavorites && (
                <button
                  onClick={handleAddToFavorites}
                  className="json-viewer-btn btn-favorite json-viewer-btn-inactive"
                  title={t("jsonViewer.tooltips.addToFavorites")}
                >
                  <Star size={14} />
                </button>
              )}
            </div>

            {/* Divider if we have action buttons and status badges */}
            {(!readOnly || (readOnly && isValidJson) || hasNestedData) && <div className="json-viewer-divider" />}
            {readOnly && isValidJson && (
              <div className="json-viewer-badge json-viewer-badge-green">
                <CheckCircle size={12} />
                <span>{t("jsonViewer.status.json")}</span>
              </div>
            )}
            {/* Debug info */}
            {hasNestedData && (
              <div className="json-viewer-badge json-viewer-badge-purple">
                <Layers2 size={12} />
                <span>{t("jsonViewer.status.nested")}</span>
              </div>
            )}
            {/* Protobuf type badge */}
            {isBinaryMessage && (
              <div className="json-viewer-badge json-viewer-badge-blue">
                <Protobuf size={12} />
                <span>{t("common.binary")}</span>
              </div>
            )}
            {/* Status badges */}
            {!readOnly && (
              <div className="json-viewer-badge json-viewer-badge-yellow">
                <Edit size={12} />
                <span>{t("jsonViewer.status.edit")}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {(presentation.prefix || presentation.suffix || presentation.warning || presentation.repaired || presentation.truncated) && (
        <div className="presentation-notices">
          {presentation.repaired && <span>{t("jsonViewer.presentation.repaired")}</span>}
          {presentation.truncated && <span>{t("jsonViewer.binaryView.truncated")}</span>}
          {presentation.warning && <span>{t("jsonViewer.presentation." + presentation.warning)}</span>}
          {(presentation.prefix || presentation.suffix) && (
            <details><summary>{t("jsonViewer.presentation.envelope")}</summary>
              <pre>{JSON.stringify({ prefix: presentation.prefix, suffix: presentation.suffix }, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
      <div className="json-viewer-container">
        {tableVisible ? <JsonTableViewer ref={tableRef} data={tableData} /> : <CodeMirror
          key={language}
          ref={cmRef}
          value={content}
          onChange={handleChange}
          extensions={extensions}
          theme={oneDark}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: !readOnly,
            bracketMatching: true,
            closeBrackets: !readOnly,
            autocompletion: !readOnly,
            highlightSelectionMatches: false,
            searchKeymap: true,
          }}
          className="json-viewer-codemirror"
        />}
      </div>
    </div>
  );
};

export default JsonViewer;
