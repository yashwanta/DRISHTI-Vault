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
.note-editor-workspace {
  display: grid;
  min-height: 360px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.note-editor-workspace.mode-split { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
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
}
`;
