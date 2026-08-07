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
}
`;
