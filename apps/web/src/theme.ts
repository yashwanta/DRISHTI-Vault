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
`;
