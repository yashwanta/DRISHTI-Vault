// Dark IT dashboard theme + global styles.
// No CSS framework; plain styled-components-free CSS variables.

export const THEME = {
  bg: "#0d1117",
  bgPanel: "#161b22",
  bgPanelAlt: "#1c2330",
  border: "#2d333b",
  text: "#e6edf3",
  textMuted: "#8b949e",
  accent: "#2f81f7",
  accentHover: "#4493f8",
  danger: "#f85149",
  success: "#3fb950",
  warning: "#d29922",
  warn: "#d29922",
} as const;

export const syntaxColors = {
  command: "#7ee787",
  comment: "#8b949e",
  string: "#a5d6ff",
  number: "#79c0ff",
  keyword: "#ff7b72",
  function: "#d2a8ff",
} as const;

export const graphColors = [
  "#2f81f7",
  "#3fb950",
  "#d29922",
  "#f85149",
  "#a371f7",
  "#39c5cf",
  "#ff7b72",
  "#79c0ff",
  "#ffa657",
  "#56d364",
] as const;

export const notesPanelTokens = {
  documentSidebarWidth: "260px",
  readerMaxWidth: "820px",
  codeBackground: "#0d1117",
  codeText: "#c9d1d9",
  monoFont: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
} as const;

export const GLOBAL_CSS = `
:root {
  --bg: ${THEME.bg};
  --panel: ${THEME.bgPanel};
  --panel-alt: ${THEME.bgPanelAlt};
  --border: ${THEME.border};
  --text: ${THEME.text};
  --muted: ${THEME.textMuted};
  --accent: ${THEME.accent};
  --accent-hover: ${THEME.accentHover};
  --danger: ${THEME.danger};
  --success: ${THEME.success};
  --warning: ${THEME.warning};
}
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
}
a { color: var(--accent); text-decoration: none; }
a:hover { color: var(--accent-hover); }
button { font-family: inherit; cursor: pointer; }
input, select, textarea {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 7px 9px;
  font-size: 14px;
  width: 100%;
}
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(47,129,247,0.25);
}
label { display: block; color: var(--muted); font-size: 12px; margin: 8px 0 4px; }
.btn {
  background: var(--panel-alt);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 7px 13px;
  font-size: 13px;
}
.btn:hover { border-color: var(--accent); }
.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-hover); }
.btn-danger { background: transparent; border-color: var(--danger); color: var(--danger); }
.btn-danger:hover { background: var(--danger); color: #fff; }
.btn-sm { padding: 4px 8px; font-size: 12px; }
.btn-row { display: flex; gap: 6px; flex-wrap: wrap; }
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
}
.grid { display: grid; gap: 14px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td {
  text-align: left;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }
tr:hover td { background: rgba(255,255,255,0.02); }
.pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid var(--border);
  color: var(--muted);
}
.pill-active { color: var(--success); border-color: rgba(63,185,80,0.4); background: rgba(63,185,80,0.1); }
.pill-warn { color: var(--warning); border-color: rgba(210,153,34,0.4); background: rgba(210,153,34,0.1); }
.pill-danger { color: var(--danger); border-color: rgba(248,81,73,0.4); background: rgba(248,81,73,0.1); }
.toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
.toolbar input, .toolbar select { width: auto; min-width: 160px; }
.spacer { flex: 1; }
.muted { color: var(--muted); }
.h1 { font-size: 20px; margin: 0; }
.subtle { color: var(--muted); font-size: 12px; }
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 100;
  padding: 20px;
}
.modal {
  background: var(--panel); border: 1px solid var(--border);
  border-radius: 12px; width: 100%; max-width: 640px; max-height: 88vh;
  overflow: auto; padding: 20px;
}
.modal h3 { margin: 0 0 12px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 14px; }
.form-grid .full { grid-column: 1 / -1; }
.banner {
  background: rgba(210,153,34,0.12);
  border: 1px solid rgba(210,153,34,0.4);
  color: var(--warning);
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
}
.empty { color: var(--muted); text-align: center; padding: 40px; }
.badge-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; }

/* Credentials page */
.cred-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.cred-toolbar { align-items: stretch; }
.cred-view-toggle { display: flex; gap: 2px; }
.cred-type-pill { font-size: 11px; white-space: nowrap; }
.rotation-pill { white-space: nowrap; }
.rotation-overdue { color: var(--danger); border-color: rgba(248,81,73,.4); background: rgba(248,81,73,.1); }
.rotation-soon { color: var(--warning); border-color: rgba(210,153,34,.4); background: rgba(210,153,34,.1); }
.rotation-ok { color: var(--success); border-color: rgba(63,185,80,.4); background: rgba(63,185,80,.1); }

.site-group { margin-bottom: 16px; }
.site-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  color: var(--text);
  background: var(--panel-alt);
  border: 1px solid var(--border);
  border-radius: 8px 8px 0 0;
  text-align: left;
  transition: background .15s, border-color .15s;
}
.site-group-header:hover,
.site-group-header:focus-visible { background: rgba(255,255,255,.04); border-color: var(--accent); outline: none; }
.site-group-header[aria-expanded="false"] { border-radius: 8px; }
.site-group-chevron { width: 12px; color: var(--muted); font-size: 10px; }
.site-group-name { flex: 1; font-size: 14px; font-weight: 600; }
.site-group-body { min-width: 0; }
.cred-table-wrap {
  padding: 0;
  overflow-x: auto;
  border-top: 0;
  border-radius: 0 0 10px 10px;
}
.cred-table { min-width: 820px; }
.cred-table th:first-child,
.cred-table td:first-child { width: 38%; }
.sort-button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  color: inherit;
  background: transparent;
  border: 0;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
}
.sort-button:hover,
.sort-button:focus-visible { color: var(--text); outline: none; }
.sort-indicator { display: inline-block; min-width: 9px; color: var(--accent); font-size: 9px; }
.cred-actions { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }

.cred-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-top: 0;
  border-radius: 0 0 10px 10px;
}
.cred-mobile-cards { display: none; }
.cred-card { min-width: 0; padding: 14px 16px; }
.cred-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.cred-card-title { margin-bottom: 3px; font-size: 14px; font-weight: 600; }
.cred-card-details { display: grid; gap: 8px; margin: 14px 0 0; }
.cred-card-details > div { display: grid; grid-template-columns: 72px minmax(0, 1fr); align-items: center; gap: 8px; }
.cred-card-details dt { color: var(--muted); font-size: 11px; text-transform: uppercase; }
.cred-card-details dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }

.password-input-row,
.view-value-actions { display: flex; align-items: center; gap: 6px; min-width: 0; }
.password-input-row input { flex: 1; }
.form-helper { margin-top: 5px; color: var(--muted); font-size: 12px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 18px; }
.reveal-banner {
  margin-bottom: 14px;
  padding: 9px 12px;
  color: var(--success);
  background: rgba(63,185,80,.1);
  border: 1px solid rgba(63,185,80,.35);
  border-radius: 8px;
  font-weight: 600;
}
.view-grid {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  align-items: center;
  gap: 12px 14px;
}
.view-label { color: var(--muted); font-size: 11px; font-weight: 600; letter-spacing: .03em; text-transform: uppercase; }
.secret-box {
  display: block;
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  overflow-wrap: anywhere;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: "Cascadia Code", Consolas, monospace;
  font-size: 13px;
}
.view-notes { white-space: pre-wrap; overflow-wrap: anywhere; }

/* Encrypted Notes workspace */
.notes-page { display: grid; gap: 16px; }
.notes-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.notes-security-line { margin: 6px 0 0; }
.notes-import-panel {
  display: grid;
  grid-template-columns: minmax(190px, .65fr) minmax(300px, 1.35fr);
  align-items: center;
  gap: 18px;
  padding: 14px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.notes-import-copy { display: grid; gap: 5px; }
.notes-toolbar { display: flex; gap: 10px; }
.notes-search { flex: 1; min-width: 220px; }
.notes-tag-filter { width: 190px; }
.notes-sections { display: grid; gap: 20px; }
.notes-section-title {
  margin: 0 0 9px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.note-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  align-items: start;
  gap: 14px;
}
.note-card {
  display: flex;
  min-width: 0;
  min-height: 210px;
  flex-direction: column;
  padding: 15px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,.12);
  transition: border-color .15s, transform .15s;
}
.note-card:hover { border-color: rgba(88,166,255,.55); transform: translateY(-1px); }
.note-color-yellow { background: linear-gradient(rgba(210,153,34,.13), rgba(210,153,34,.13)), var(--panel); }
.note-color-green { background: linear-gradient(rgba(63,185,80,.12), rgba(63,185,80,.12)), var(--panel); }
.note-color-blue { background: linear-gradient(rgba(88,166,255,.12), rgba(88,166,255,.12)), var(--panel); }
.note-color-pink { background: linear-gradient(rgba(219,97,162,.13), rgba(219,97,162,.13)), var(--panel); }
.note-color-purple { background: linear-gradient(rgba(163,113,247,.14), rgba(163,113,247,.14)), var(--panel); }
.note-color-gray { background: linear-gradient(rgba(139,148,158,.12), rgba(139,148,158,.12)), var(--panel); }
.note-card-header { display: flex; align-items: flex-start; gap: 8px; }
.note-title-button {
  flex: 1;
  padding: 0;
  overflow-wrap: anywhere;
  color: var(--text);
  background: transparent;
  border: 0;
  font: inherit;
  font-size: 15px;
  font-weight: 650;
  text-align: left;
}
.note-title-button:hover,
.note-title-button:focus-visible { color: var(--accent); outline: none; }
.note-pin-button {
  padding: 1px 2px;
  opacity: .35;
  background: transparent;
  border: 0;
  filter: grayscale(1);
}
.note-pin-button:hover,
.note-pin-button:focus-visible,
.note-pin-button.is-pinned { opacity: 1; filter: none; outline: none; }
.note-card-preview {
  flex: 1;
  max-height: 112px;
  margin-top: 9px;
  overflow: hidden;
  color: var(--muted);
  mask-image: linear-gradient(to bottom, #000 75%, transparent 100%);
}
.note-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
.note-tags .pill { font-size: 10px; }
.note-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 13px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.note-card-actions { display: flex; gap: 5px; }
.note-editor { display: grid; gap: 12px; }
.note-editor-title { font-size: 17px; font-weight: 600; }
.note-editor-toolbar { display: flex; align-items: center; gap: 5px; }
.note-source-chrome {
  overflow: hidden;
  margin-bottom: -12px;
  border: 1px solid var(--border);
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  background: #0d1117;
}
.note-source-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: min(100%, 520px);
  min-height: 35px;
  padding: 0 13px;
  color: #e6edf3;
  background: #161b22;
  border-right: 1px solid #30363d;
  border-top: 1px solid var(--accent);
  font: 12px/1.2 "Cascadia Code", Consolas, monospace;
}
.note-source-tab > span:nth-child(2) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.note-source-file-icon { color: #58a6ff; font-weight: 700; }
.note-source-dirty { margin-left: 3px; color: #e6edf3; font-size: 9px; }
.note-source-breadcrumb {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 32px;
  padding: 0 13px;
  overflow: hidden;
  color: #8b949e;
  border-top: 1px solid #21262d;
  font: 11px/1.2 "Cascadia Code", Consolas, monospace;
  white-space: nowrap;
}
.note-source-breadcrumb strong {
  overflow: hidden;
  color: #c9d1d9;
  font-weight: 500;
  text-overflow: ellipsis;
}
.note-editor-workspace {
  display: grid;
  min-height: 360px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.note-editor-workspace.mode-split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.note-source-editor {
  position: relative;
  min-width: 0;
  min-height: 360px;
  overflow: hidden;
  background: #0d1117;
}
.note-source-editor-host { height: 100%; min-height: inherit; }
.note-source-placeholder {
  position: absolute;
  top: 14px;
  left: 58px;
  z-index: 2;
  color: #6e7681;
  pointer-events: none;
  font: 14px/1.55 "Cascadia Code", Consolas, monospace;
  white-space: pre-wrap;
}
.note-source-editor .cm-runbook-section {
  color: #58a6ff;
  background: linear-gradient(90deg, rgba(56,139,253,.12), transparent 62%);
  font-weight: 800;
}
.note-source-editor .cm-runbook-label { color: #d2a8ff; font-weight: 650; }
.note-source-editor .cm-runbook-language {
  color: #ffa657;
  font-weight: 700;
  font-style: italic;
}
.note-source-editor .cm-runbook-command { color: #a5d6ff; }
.note-source-editor .cm-runbook-warning {
  color: #e3b341;
  background: linear-gradient(90deg, rgba(227,179,65,.10), transparent 75%);
  font-weight: 650;
}
.note-source-fallback {
  min-width: 0;
  min-height: 360px;
  overflow: auto;
  color: #c9d1d9;
  background: #0d1117;
}
.note-source-fallback > div {
  padding: 8px 12px;
  color: #e3b341;
  background: rgba(227,179,65,.1);
  border-bottom: 1px solid rgba(227,179,65,.28);
  font-size: 11px;
}
.note-source-fallback pre {
  margin: 0;
  padding: 14px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: 13px/1.55 "Cascadia Code", Consolas, monospace;
}
.note-editor-statusbar {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 25px;
  padding: 0 10px;
  color: #c9d1d9;
  background: #0969da;
  border-top: 1px solid rgba(255,255,255,.12);
  font: 10px/1 "Cascadia Code", Consolas, monospace;
}
.note-editor-statusbar .spacer { flex: 1; }
.note-markdown-input {
  width: 100%;
  min-height: 360px;
  padding: 14px;
  resize: vertical;
  border: 0;
  border-radius: 0;
  font-family: "Cascadia Code", Consolas, monospace;
  line-height: 1.55;
}
.note-preview-pane {
  min-width: 0;
  max-height: 54vh;
  padding: 14px 18px;
  overflow: auto;
  background: var(--bg);
}
.mode-split .note-preview-pane { border-left: 1px solid var(--border); }
.note-color-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.note-color-swatch {
  width: 25px;
  height: 25px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
}
.note-color-swatch.is-selected { border: 2px solid var(--accent); box-shadow: 0 0 0 2px rgba(88,166,255,.16); }
.note-backlinks { display: grid; gap: 7px; padding: 10px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; }
.note-backlinks > div { display: flex; flex-wrap: wrap; gap: 7px; }
.markdown-preview { color: var(--text); line-height: 1.55; overflow-wrap: anywhere; }
.markdown-preview > :first-child { margin-top: 0; }
.markdown-preview > :last-child { margin-bottom: 0; }
.markdown-preview h1,
.markdown-preview h2,
.markdown-preview h3,
.markdown-preview h4,
.markdown-preview h5,
.markdown-preview h6 { margin: 1em 0 .45em; line-height: 1.25; }
.markdown-preview h1 { font-size: 1.55em; }
.markdown-preview h2 { font-size: 1.32em; }
.markdown-preview h3 { font-size: 1.15em; }
.markdown-preview p { margin: .45em 0; }
.markdown-preview code { padding: 2px 5px; background: rgba(139,148,158,.14); border-radius: 4px; font-family: "Cascadia Code", Consolas, monospace; }
.markdown-preview pre { padding: 12px; overflow: auto; background: #090d12; border: 1px solid var(--border); border-radius: 7px; }
.markdown-preview pre code { padding: 0; background: transparent; }
.markdown-preview blockquote { margin: 9px 0; padding: 5px 12px; color: var(--muted); border-left: 3px solid var(--accent); }
.markdown-preview hr { border: 0; border-top: 1px solid var(--border); }
.markdown-list-item,
.markdown-task { display: flex; align-items: flex-start; gap: 7px; margin: 3px 0 3px 10px; }
.markdown-task input { margin-top: 4px; accent-color: var(--accent); }
.wiki-link { padding: 0; color: var(--accent); background: transparent; border: 0; font: inherit; text-align: left; }
.wiki-link:hover,
.wiki-link:focus-visible { text-decoration: underline; outline: none; }
.markdown-preview.is-compact { font-size: 12px; }
.markdown-preview.is-compact h1,
.markdown-preview.is-compact h2,
.markdown-preview.is-compact h3,
.markdown-preview.is-compact h4,
.markdown-preview.is-compact h5,
.markdown-preview.is-compact h6 { margin: .5em 0 .25em; font-size: 1em; }
.markdown-preview.is-compact pre { white-space: pre-wrap; }
.markdown-preview table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
.markdown-preview th { background: var(--panel-alt); font-weight: 600; }
.markdown-preview td, .markdown-preview th { padding: 6px 10px; border: 1px solid var(--border); vertical-align: top; }

/* ── Notes layout with sidebar ── */
.notes-layout { display: flex; gap: 14px; }
.notes-layout-nosidebar .notes-content { width: 100%; }
.notes-sidebar { width: 210px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; }
.notes-sidebar-section { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.notes-sidebar-header {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 8px 12px; font-size: 11px; font-weight: 600; color: var(--muted);
  text-transform: uppercase; letter-spacing: .04em;
  background: transparent; border: 0; cursor: pointer; text-align: left;
}
.notes-sidebar-header:hover { color: var(--text); }
.sidebar-chevron { margin-left: auto; }
.notes-sidebar-body { padding: 4px 4px 8px; }
.tag-tree-item {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 4px 10px; border-radius: 5px; cursor: pointer;
  font-size: 12px; color: var(--muted); background: transparent; border: 0; text-align: left;
}
.tag-tree-item:hover { color: var(--text); background: rgba(255,255,255,.04); }
.tag-tree-item.is-active { color: var(--accent); background: rgba(47,129,247,.1); }
.notes-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 14px; }

/* ── Controls row ── */
.notes-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.notes-controls .notes-search { flex: 1; min-width: 180px; }

/* ── List view ── */
.note-list { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.note-list-row {
  display: grid; grid-template-columns: 1fr auto auto;
  align-items: center; gap: 12px; padding: 10px 14px;
  border-bottom: 1px solid var(--border); transition: background .1s;
}
.note-list-row:last-child { border-bottom: 0; }
.note-list-row:hover { background: rgba(255,255,255,.025); }
.note-list-title { display: flex; align-items: center; gap: 7px; min-width: 0; overflow: hidden; }
.note-list-title button {
  font-size: 13px; font-weight: 500; color: var(--text);
  background: transparent; border: 0; padding: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 480px;
}
.note-list-title button:hover { color: var(--accent); }
.note-list-date { white-space: nowrap; }
.note-list-actions { display: flex; gap: 4px; flex-shrink: 0; }

/* ── Star button ── */
.note-star-button { padding: 1px 3px; opacity: .25; background: transparent; border: 0; font-size: 13px; flex-shrink: 0; }
.note-star-button:hover, .note-star-button.is-starred { opacity: 1; }

/* ── Graph view ── */
.graph-overlay { position: fixed; inset: 0; z-index: 90; background: var(--bg); display: flex; flex-direction: column; }
.graph-header {
  display: flex; align-items: center; gap: 12px; padding: 11px 16px;
  border-bottom: 1px solid var(--border); background: var(--panel); flex-shrink: 0;
}
.graph-canvas-wrap { flex: 1; overflow: hidden; position: relative; }
.graph-canvas { display: block; width: 100%; height: 100%; cursor: grab; }
.graph-canvas:active { cursor: grabbing; }

/* ── Markdown toolbar ── */
.md-toolbar {
  display: flex; align-items: center; gap: 2px; flex-wrap: wrap; padding: 5px 8px;
  background: var(--bg); border: 1px solid var(--border);
  border-bottom: 0; border-radius: 8px 8px 0 0;
}
.note-source-chrome + div .md-toolbar { border-radius: 0; }
.md-btn {
  padding: 3px 8px; font-size: 12px; color: var(--muted);
  background: transparent; border: 1px solid transparent; border-radius: 4px;
  min-width: 26px; font-family: inherit;
}
.md-btn:hover { background: var(--panel-alt); border-color: var(--border); color: var(--text); }
.md-btn-active { color: var(--accent) !important; }
.md-sep { width: 1px; height: 16px; background: var(--border); margin: 0 4px; flex-shrink: 0; }

/* ── Templates dropdown ── */
.templates-dropdown {
  position: absolute; top: 100%; left: 0; z-index: 60; min-width: 200px;
  background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
  padding: 4px; box-shadow: 0 8px 24px rgba(0,0,0,.45); margin-top: 2px;
}
.template-item {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 8px 10px; font-size: 13px; color: var(--text);
  background: transparent; border: 0; border-radius: 5px; text-align: left; font-family: inherit;
}
.template-item:hover { background: rgba(255,255,255,.05); }

/* ── Outline panel ── */
.outline-panel {
  padding: 8px 6px; border-left: 1px solid var(--border);
  background: var(--bg); overflow-y: auto;
}
.outline-label { font-size: 10px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; padding: 2px 6px 8px; }
.outline-heading {
  display: block; width: 100%; padding: 3px 6px; border-radius: 4px;
  font-size: 11px; color: var(--muted); background: transparent; border: 0;
  text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: inherit;
}
.outline-heading:hover { color: var(--text); background: rgba(255,255,255,.04); }
.outline-h1 { padding-left: 6px; font-weight: 600; }
.outline-h2 { padding-left: 14px; }
.outline-h3 { padding-left: 22px; }
.outline-h4, .outline-h5, .outline-h6 { padding-left: 30px; }
.outline-empty { display: block; font-size: 11px; color: var(--muted); padding: 4px 8px; }

/* ── Document Browser ── */
.doc-browser-layout {
  display: flex;
  height: calc(100vh - 200px);
  min-height: 500px;
  overflow: hidden;
  background: var(--bg);
}
.doc-browser-list {
  display: flex;
  width: 260px;
  flex-shrink: 0;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: #0f0f1a;
  overflow: hidden;
}
.doc-browser-toolbar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 9px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.doc-browser-toolbar-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  background: transparent;
  border: 0;
  border-radius: 5px;
  font-size: 18px;
  line-height: 1;
}
.doc-browser-toolbar-btn:hover,
.doc-browser-toolbar-btn:focus-visible {
  color: var(--text);
  background: rgba(255,255,255,.06);
  outline: none;
}
.doc-browser-menu-wrap { position: relative; margin-left: auto; }
.doc-browser-menu {
  position: absolute;
  top: 34px;
  right: 0;
  z-index: 70;
  min-width: 210px;
  padding: 5px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 10px 28px rgba(0,0,0,.45);
}
.doc-browser-menu-item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  color: var(--text);
  background: transparent;
  border: 0;
  border-radius: 5px;
  text-align: left;
  font-size: 12px;
}
.doc-browser-menu-item:hover { background: rgba(255,255,255,.06); color: var(--accent); }
.doc-browser-search { padding: 9px 10px 6px; flex-shrink: 0; }
.doc-browser-parent {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 7px 12px;
  color: var(--text);
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
}
.doc-browser-parent:hover { background: rgba(255,255,255,.04); }
.doc-browser-parent-icon { width: 12px; color: var(--muted); font-size: 11px; }
.doc-browser-items { overflow-y: auto; flex: 1; padding: 2px 0 10px; }
.doc-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  padding: 7px 11px;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
  font-family: inherit;
  transition: background .1s;
}
.doc-list-item:hover { background: rgba(255,255,255,.045); }
.doc-list-item.is-active { background: rgba(47,129,247,.12); box-shadow: inset 3px 0 0 var(--accent); }
.doc-list-note-icon { flex-shrink: 0; opacity: .72; font-size: 13px; }
.doc-list-copy { min-width: 0; flex: 1; }
.doc-list-title {
  display: block;
  color: var(--text);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.doc-list-tags {
  display: block;
  margin-top: 2px;
  color: var(--accent);
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.doc-list-health { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

.doc-browser-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
}
.doc-browser-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 10px;
  color: var(--muted);
}
.doc-browser-placeholder-icon { font-size: 42px; opacity: .22; }
.doc-browser-count {
  padding: 8px 12px;
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 11px;
  background: var(--bg);
}

/* ── Document Reader ── */
.document-reader {
  display: flex;
  min-height: 0;
  height: 100%;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
}
.document-reader-header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  flex-shrink: 0;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.document-reader-mode-toggle {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #161b22;
}
.document-reader-mode-btn {
  min-height: 25px;
  padding: 3px 9px;
  color: var(--muted);
  background: transparent;
  border: 0;
  border-radius: 4px;
  font: 10px/1 "Cascadia Code", Consolas, monospace;
}
.document-reader-mode-btn:hover { color: var(--text); background: rgba(255,255,255,.05); }
.document-reader-mode-btn.is-active { color: #fff; background: #1f6feb; }
.document-reader-icon-btn {
  width: 30px;
  height: 30px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  background: transparent;
  border: 0;
  border-radius: 5px;
  font-size: 17px;
  line-height: 1;
}
.document-reader-icon-btn:hover,
.document-reader-icon-btn:focus-visible {
  color: var(--text);
  background: rgba(255,255,255,.06);
  outline: none;
}
.document-reader-title-wrap { flex: 1; min-width: 0; }
.document-reader-title {
  margin: 0;
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.document-reader-meta { color: var(--muted); font-size: 10px; margin-top: 1px; }
.document-reader-tags {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  padding: 6px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  flex-shrink: 0;
}
.document-reader-tag {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 8px;
  border: 1px solid rgba(47,129,247,.32);
  border-radius: 999px;
  color: var(--accent);
  background: rgba(47,129,247,.1);
  font-size: 11px;
}
.document-reader-body {
  flex: 1;
  min-height: 0;
  padding: 24px;
  overflow-y: auto;
  background: transparent;
  line-height: 1.75;
}
.document-reader-source-chrome {
  flex-shrink: 0;
  margin: 0;
  border-width: 0 0 1px;
  border-radius: 0;
}
.document-reader-workspace {
  display: grid;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: #0d1117;
}
.document-reader-workspace.reader-mode-split {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}
.document-reader-source-pane {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.document-reader-source-pane .note-source-editor,
.document-reader-source-pane .note-source-editor-host {
  height: 100%;
  min-height: 0;
}
.document-reader-source-pane .cm-scroller { min-height: 0 !important; }
.document-reader-preview-pane {
  min-width: 0;
  height: 100%;
}
.reader-mode-split .document-reader-preview-pane {
  border-left: 1px solid var(--border);
}
.document-reader-statusbar { flex-shrink: 0; }

.code-block {
  margin: 14px 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: #1a1a2e;
}
.code-block-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 28px;
  padding: 0 10px;
  background: var(--panel-alt);
  border-bottom: 1px solid var(--border);
}
.code-block-label {
  font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace;
  font-size: 10px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: .04em;
}
.code-block-pre {
  margin: 0;
  padding: 16px;
  overflow: auto;
  font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace;
  font-size: .82rem;
  line-height: 1.6;
  tab-size: 2;
}
.code-block-pre > code { white-space: pre; }
.token-comment,
.token-prolog,
.token-doctype,
.token-cdata { color: #8b949e; font-style: italic; }
.token-punctuation { color: #c9d1d9; }
.token-property,
.token-tag,
.token-boolean,
.token-number,
.token-constant,
.token-symbol,
.token-deleted { color: #79c0ff; }
.token-selector,
.token-attr-name,
.token-string,
.token-char,
.token-builtin,
.token-inserted { color: #7ee787; }
.token-operator,
.token-entity,
.token-url { color: #79c0ff; }
.token-atrule,
.token-attr-value,
.token-keyword { color: #ff7b72; }
.token-function,
.token-function-name,
.token-class-name { color: #d2a8ff; }
.token-regex,
.token-important,
.token-variable { color: #ffa657; }
.token-parameter { color: #ffa657; }
.token-template-string { color: #7ee787; }
.token-namespace { color: #d2a8ff; }
.token-annotation,
.token-decorator { color: #e3b341; }
.reader-inline-code {
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(128,128,128,.15);
  font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace;
  font-size: .85em;
}
.reader-tag-chip {
  display: inline-block;
  padding: 1px 7px;
  margin: 0 2px;
  border: 1px solid rgba(47,129,247,.32);
  border-radius: 999px;
  color: var(--accent);
  background: rgba(47,129,247,.1);
  font-size: .82em;
  line-height: 1.5;
}

/* ── Obsidian Graph View ── */
.obsidian-graph {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg);
}
.obsidian-graph:fullscreen {
  width: 100vw;
  height: 100vh;
  background: var(--bg);
}
.obsidian-graph-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  flex-shrink: 0;
  padding: 0 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.obsidian-graph-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-size: 13px;
  font-weight: 700;
}
.obsidian-graph-title-icon { color: var(--accent); font-size: 18px; }
.obsidian-graph-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.obsidian-graph-drag-hint {
  color: var(--muted);
  font-size: 11px;
}
.obsidian-graph-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 16px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  flex-shrink: 0;
}
.obsidian-graph-legend-item,
.obsidian-graph-legend-key {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}
.obsidian-graph-legend-key { margin-left: auto; }
.obsidian-graph-legend-swatch {
  width: 10px;
  height: 10px;
  display: inline-block;
  flex-shrink: 0;
}
.obsidian-graph-legend-line {
  width: 20px;
  height: 0;
  display: inline-block;
  flex-shrink: 0;
  border-top: 2px solid;
}
.legend-line-wiki { border-color: #d2a8ff; }
.legend-line-tag { border-color: #3fb950; }
.legend-line-topic { border-color: #58a6ff; border-top-style: dashed; }
.obsidian-graph-legend-tag { border-radius: 2px; }
.obsidian-graph-legend-note {
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1 0 25%, #ec4899 25% 50%, #f59e0b 50% 75%, #10b981 75%);
}
.obsidian-graph-scroll {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--bg);
}
.obsidian-graph-svg {
  display: block;
  width: 100%;
  height: 100%;
  background: transparent;
  touch-action: none;
  user-select: none;
}
.obsidian-graph-note-node { cursor: grab; transition: opacity .1s; }
.obsidian-graph-note-node.is-dragging { cursor: grabbing; }
.obsidian-graph-note-heartbeat {
  transform-box: fill-box;
  transform-origin: center;
  animation: obsidian-graph-heartbeat 4.2s ease-in-out infinite;
  filter: drop-shadow(0 0 4px color-mix(in srgb, currentColor 55%, transparent));
}
.obsidian-graph-note-node:hover .obsidian-graph-note-heartbeat {
  animation-duration: 2.4s;
}
.obsidian-graph-note-node.is-dragging .obsidian-graph-note-heartbeat {
  animation-play-state: paused;
}
@keyframes obsidian-graph-heartbeat {
  0%, 68%, 100% { transform: scale(1); filter: brightness(1) drop-shadow(0 0 3px currentColor); }
  74% { transform: scale(1.16); filter: brightness(1.28) drop-shadow(0 0 9px currentColor); }
  80% { transform: scale(1); filter: brightness(1.04) drop-shadow(0 0 4px currentColor); }
  86% { transform: scale(1.09); filter: brightness(1.18) drop-shadow(0 0 7px currentColor); }
  92% { transform: scale(1); filter: brightness(1) drop-shadow(0 0 3px currentColor); }
}
@media (prefers-reduced-motion: reduce) {
  .obsidian-graph-note-heartbeat { animation: none; }
}
.obsidian-graph-tag-node { cursor: grab; transition: opacity .1s; }
.obsidian-graph-tag-node:active { cursor: grabbing; }
.obsidian-note-relationship { pointer-events: stroke; transition: stroke-opacity .12s, stroke-width .12s; }

/* ── Enhanced Graph modal ── */
.graph-modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.7); z-index: 100;
  display: flex; align-items: center; justify-content: center;
}
.graph-modal-panel {
  width: min(96vw, 1100px); height: min(90vh, 780px);
  background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
  display: flex; flex-direction: column; overflow: hidden;
}
.graph-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  flex-shrink: 0;
}
.graph-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}
.graph-legend-swatch {
  width: 10px;
  height: 10px;
  display: inline-block;
  flex-shrink: 0;
}
.graph-legend-hub { border-radius: 2px; }
.graph-legend-note { border-radius: 50%; background: var(--muted); }
.graph-legend-key { margin-left: auto; }

/* ── Post-import download banner ── */
.import-download-banner {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 10px 14px; border-radius: 8px;
  background: rgba(63,185,80,.1); border: 1px solid rgba(63,185,80,.35);
  font-size: 13px; color: var(--text);
}
.import-download-banner .btn { flex-shrink: 0; }

/* ── Auto-tag suggestions ── */
.autotag-row {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  padding: 6px 2px;
}
.autotag-label { font-size: 11px; color: var(--muted); flex-shrink: 0; }
.autotag-chip {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 8px; border-radius: 12px; font-size: 11px; font-family: inherit;
  color: var(--accent); background: rgba(47,129,247,.12);
  border: 1px solid rgba(47,129,247,.3); cursor: pointer;
  transition: background .1s, border-color .1s;
}
.autotag-chip:hover { background: rgba(47,129,247,.22); border-color: var(--accent); }
.autotag-plus { font-weight: 700; font-size: 13px; line-height: 1; }
.autotag-add-all {
  color: #3fb950; background: rgba(63,185,80,.1); border-color: rgba(63,185,80,.3);
}
.autotag-add-all:hover { background: rgba(63,185,80,.2); border-color: #3fb950; }

/* ── Duplicate import warning modal ── */
.dup-modal { max-width: 500px; width: 95vw; }
.dup-list {
  max-height: 240px; overflow-y: auto; border: 1px solid var(--border);
  border-radius: 7px; background: var(--bg);
}
.dup-row {
  padding: 8px 12px; border-bottom: 1px solid var(--border);
}
.dup-row:last-child { border-bottom: 0; }
.dup-filename { font-size: 13px; font-weight: 500; color: var(--text); }
.dup-match { font-size: 11px; margin-top: 2px; }
.dup-date { font-size: 10px; color: var(--muted); margin-top: 3px; }

/* ── Sidebar counts & badges ── */
.sidebar-count {
  margin-left: auto; font-size: 10px; color: var(--muted); flex-shrink: 0;
  background: rgba(255,255,255,.06); border-radius: 10px; padding: 1px 5px; min-width: 18px; text-align: center;
}
.sidebar-badge-red {
  margin-left: auto; font-size: 10px; font-weight: 700; color: #fff;
  background: var(--danger, #f85149); border-radius: 10px; padding: 1px 6px; flex-shrink: 0;
}

/* ── Issues panel ── */
.issues-group { margin: 6px 0; }
.issues-group-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
  padding: 4px 8px 3px; border-radius: 4px; margin-bottom: 2px;
}
.issues-label-broken { color: #f85149; background: rgba(248,81,73,.1); }
.issues-label-gap    { color: #d29922; background: rgba(210,153,34,.1); }

.issue-row {
  display: flex; flex-direction: column; gap: 1px; width: 100%;
  padding: 4px 8px; border-radius: 4px; border: 0; text-align: left; font-family: inherit;
  cursor: pointer; background: transparent; transition: background .1s;
}
.issue-row:hover { background: rgba(255,255,255,.05); }
.issue-row-broken { border-left: 2px solid #f85149; }
.issue-row-gap    { border-left: 2px solid #d29922; cursor: default; }
.issue-row-note { font-size: 11px; color: var(--text); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.issue-row-target { font-size: 10px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── Tag autocomplete ── */
.tag-input-wrap { position: relative; }
.tag-autocomplete {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 55;
  background: var(--panel); border: 1px solid var(--accent);
  border-top: 0; border-radius: 0 0 6px 6px; max-height: 180px; overflow-y: auto;
}
.tag-autocomplete button {
  display: block; width: 100%; padding: 6px 12px; font-size: 12px;
  color: var(--text); background: transparent; border: 0; text-align: left; font-family: inherit;
}
.tag-autocomplete button:hover { background: rgba(47,129,247,.12); color: var(--accent); }

@media (max-width: 768px) {
  .cred-page-header { align-items: flex-start; flex-direction: column; }
  .cred-toolbar input,
  .cred-toolbar select { width: 100%; min-width: 0; }
  .cred-toolbar .spacer { display: none; }
  .cred-view-toggle { display: none; }
  .cred-table-wrap { display: none; }
  .cred-mobile-cards { display: grid; }
  .cred-card-grid { grid-template-columns: 1fr; padding: 10px; }
  .view-grid { grid-template-columns: 1fr; gap: 5px; }
  .view-label { margin-top: 8px; }
  .view-value-actions { align-items: stretch; flex-direction: column; }
  .view-value-actions .btn { text-align: center; }
  .form-grid { grid-template-columns: 1fr; }
  .notes-page-header { align-items: stretch; flex-direction: column; }
  .notes-import-panel { grid-template-columns: 1fr; }
  .notes-toolbar { flex-direction: column; }
  .notes-tag-filter { width: 100%; }
  .note-card-grid { grid-template-columns: 1fr; }
  .note-editor-toolbar .subtle { display: none; }
  .note-editor-workspace.mode-split { grid-template-columns: 1fr; }
  .mode-split .note-preview-pane { border-top: 1px solid var(--border); border-left: 0; }
  .notes-layout { flex-direction: column; }
  .notes-sidebar { width: 100%; }
  .doc-browser-layout { height: auto; flex-direction: column; }
  .doc-browser-list {
    width: 100%;
    max-height: 260px;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }
  .doc-browser-content { min-height: 520px; }
  .document-reader-header { height: auto; min-height: 48px; flex-wrap: wrap; padding-top: 7px; padding-bottom: 7px; }
  .document-reader-title-wrap { min-width: 160px; }
  .document-reader-mode-toggle { order: 5; width: 100%; }
  .document-reader-mode-btn { flex: 1; }
  .document-reader-workspace.reader-mode-split { grid-template-columns: 1fr; overflow: auto; }
  .reader-mode-split .document-reader-source-pane { min-height: 360px; }
  .reader-mode-split .document-reader-preview-pane { min-height: 360px; border-top: 1px solid var(--border); border-left: 0; }
  .note-editor-statusbar { gap: 8px; }
  .note-editor-statusbar span:nth-last-child(-n+2) { display: none; }
  .obsidian-graph-header,
  .obsidian-graph-legend { padding-left: 12px; padding-right: 12px; }
  .obsidian-graph-scroll { padding: 10px; }
  .note-list-row { grid-template-columns: 1fr; gap: 6px; }
  .note-list-actions { justify-content: flex-end; }
  .md-toolbar { gap: 1px; }
}
`;
