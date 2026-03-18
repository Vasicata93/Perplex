/**
 * widgetHtmlBuilder.ts
 * Single source of truth for iframe HTML generation used by
 * WidgetRenderer (chat) and WidgetBlock (notes).
 * Handles dark/light mode CSS variables, SVG overrides, Chart.js defaults.
 */

const DARK_VARS = `
  --bg-primary: transparent; --bg-secondary: transparent;
  --bg-hover: #2d2d2d; --border-color: rgba(255, 255, 255, 0.2);
  --text-primary: #ffffff; --text-muted: #d4d4d4; --accent: #20B8CD;
`;
const LIGHT_VARS = `
  --bg-primary: transparent; --bg-secondary: transparent;
  --bg-hover: #E0E0DE; --border-color: #D6D6D4;
  --text-primary: #2D2B26; --text-muted: #6E6D6A; --accent: #20B8CD;
`;

// CSS variable aliases so agent-generated code using Claude's naming also works
const COMPAT_VARS = `
  --color-background-primary: var(--bg-primary);
  --color-background-secondary: var(--bg-secondary);
  --color-background-tertiary: var(--bg-hover);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-muted);
  --color-text-tertiary: var(--text-muted);
  --color-border-primary: var(--border-color);
  --color-border-secondary: var(--border-color);
  --color-border-tertiary: var(--border-color);
  --color-background-info: rgba(32,184,205,0.12);
  --color-text-info: var(--accent);
  --color-background-success: rgba(34,197,94,0.12);
  --color-text-success: #22c55e;
  --color-background-warning: rgba(245,158,11,0.12);
  --color-text-warning: #f59e0b;
  --color-background-danger: rgba(239,68,68,0.12);
  --color-text-danger: #ef4444;
  --font-sans: Inter, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --border-radius-md: 8px; --border-radius-lg: 12px; --border-radius-xl: 16px;
`;

// SVG color ramps — light variants
const SVG_RAMPS_LIGHT = `
  .c-blue   rect,.c-blue   circle,.c-blue   ellipse{fill:#E6F1FB;stroke:#185FA5}
  .c-blue   .t,.c-blue   .th{fill:#0C447C} .c-blue   .ts{fill:#185FA5}
  .c-teal   rect,.c-teal   circle,.c-teal   ellipse{fill:#E1F5EE;stroke:#0F6E56}
  .c-teal   .t,.c-teal   .th{fill:#085041} .c-teal   .ts{fill:#0F6E56}
  .c-purple rect,.c-purple circle,.c-purple ellipse{fill:#EEEDFE;stroke:#534AB7}
  .c-purple .t,.c-purple .th{fill:#3C3489} .c-purple .ts{fill:#534AB7}
  .c-coral  rect,.c-coral  circle,.c-coral  ellipse{fill:#FAECE7;stroke:#993C1D}
  .c-coral  .t,.c-coral  .th{fill:#712B13} .c-coral  .ts{fill:#993C1D}
  .c-amber  rect,.c-amber  circle,.c-amber  ellipse{fill:#FAEEDA;stroke:#854F0B}
  .c-amber  .t,.c-amber  .th{fill:#633806} .c-amber  .ts{fill:#854F0B}
  .c-green  rect,.c-green  circle,.c-green  ellipse{fill:#EAF3DE;stroke:#3B6D11}
  .c-green  .t,.c-green  .th{fill:#27500A} .c-green  .ts{fill:#3B6D11}
  .c-gray   rect,.c-gray   circle,.c-gray   ellipse{fill:#F1EFE8;stroke:#5F5E5A}
  .c-gray   .t,.c-gray   .th{fill:#444441} .c-gray   .ts{fill:#5F5E5A}
  .c-red    rect,.c-red    circle,.c-red    ellipse{fill:#FCEBEB;stroke:#A32D2D}
  .c-red    .t,.c-red    .th{fill:#791F1F} .c-red    .ts{fill:#A32D2D}
  .c-pink   rect,.c-pink   circle,.c-pink   ellipse{fill:#FBEAF0;stroke:#993556}
  .c-pink   .t,.c-pink   .th{fill:#72243E} .c-pink   .ts{fill:#993556}
`;

// SVG color ramps — dark variants
const SVG_RAMPS_DARK = `
  .dark .c-blue   rect,.dark .c-blue   circle,.dark .c-blue   ellipse{fill:#0C447C;stroke:#85B7EB}
  .dark .c-blue   .t,.dark .c-blue   .th{fill:#B5D4F4} .dark .c-blue   .ts{fill:#85B7EB}
  .dark .c-teal   rect,.dark .c-teal   circle,.dark .c-teal   ellipse{fill:#085041;stroke:#5DCAA5}
  .dark .c-teal   .t,.dark .c-teal   .th{fill:#9FE1CB} .dark .c-teal   .ts{fill:#5DCAA5}
  .dark .c-purple rect,.dark .c-purple circle,.dark .c-purple ellipse{fill:#3C3489;stroke:#AFA9EC}
  .dark .c-purple .t,.dark .c-purple .th{fill:#CECBF6} .dark .c-purple .ts{fill:#AFA9EC}
  .dark .c-coral  rect,.dark .c-coral  circle,.dark .c-coral  ellipse{fill:#712B13;stroke:#F0997B}
  .dark .c-coral  .t,.dark .c-coral  .th{fill:#F5C4B3} .dark .c-coral  .ts{fill:#F0997B}
  .dark .c-amber  rect,.dark .c-amber  circle,.dark .c-amber  ellipse{fill:#633806;stroke:#EF9F27}
  .dark .c-amber  .t,.dark .c-amber  .th{fill:#FAC775} .dark .c-amber  .ts{fill:#EF9F27}
  .dark .c-green  rect,.dark .c-green  circle,.dark .c-green  ellipse{fill:#27500A;stroke:#97C459}
  .dark .c-green  .t,.dark .c-green  .th{fill:#C0DD97} .dark .c-green  .ts{fill:#97C459}
  .dark .c-gray   rect,.dark .c-gray   circle,.dark .c-gray   ellipse{fill:#444441;stroke:#B4B2A9}
  .dark .c-gray   .t,.dark .c-gray   .th{fill:#D3D1C7} .dark .c-gray   .ts{fill:#B4B2A9}
  .dark .c-red    rect,.dark .c-red    circle,.dark .c-red    ellipse{fill:#791F1F;stroke:#F09595}
  .dark .c-red    .t,.dark .c-red    .th{fill:#F7C1C1} .dark .c-red    .ts{fill:#F09595}
`;

// Dark mode overrides: fix hardcoded black/dark colors in agent-generated content
// Covers SVG attributes, HTML elements, and inline styles
const DARK_OVERRIDES = `
  /* ── SVG: text with dark fill attributes ── */
  svg text:not([fill]):not([class])          { fill: var(--text-primary) !important; }
  svg text[fill="black"],svg text[fill="#000"],svg text[fill="#000000"],
  svg text[fill="#111"],svg text[fill="#111111"],
  svg text[fill="#1a1a1a"],svg text[fill="#222"],svg text[fill="#222222"],
  svg text[fill="#333"],svg text[fill="#333333"],
  svg text[fill="#444"],svg text[fill="#444444"]  { fill: var(--text-primary) !important; }
  svg tspan[fill="black"],svg tspan[fill="#000"],svg tspan[fill="#333"]
                                              { fill: var(--text-primary) !important; }

  /* ── SVG: paths/lines/shapes with dark strokes/fills ── */
  svg path[stroke="black"],svg path[stroke="#000"],svg path[stroke="#000000"],
  svg path[stroke="#333"],svg path[stroke="#1a1a1a"]  { stroke: var(--text-primary) !important; }
  svg path[fill="black"],svg path[fill="#000"],svg path[fill="#000000"],
  svg path[fill="#333"],svg path[fill="#1a1a1a"]      { fill: var(--text-primary) !important; }
  svg circle[stroke="black"],svg circle[stroke="#000"] { stroke: var(--text-primary) !important; }
  svg circle[stroke="#333"],svg circle[stroke="#444"] { stroke: var(--text-primary) !important; }
  
  svg circle[fill="black"],svg circle[fill="#000"],
  svg circle[fill="#333"]                             { fill: var(--text-primary) !important; }
  svg rect[fill="black"],svg rect[fill="#000"],
  svg rect[fill="#333"]                               { fill: var(--text-primary) !important; }
  svg line[stroke="black"],svg line[stroke="#000"],
  svg line[stroke="#333"]                             { stroke: var(--text-primary) !important; }
  svg polyline[stroke="black"],svg polyline[stroke="#000"] { stroke: var(--text-primary) !important; }
  svg polygon[fill="black"],svg polygon[fill="#000"]  { fill: var(--text-primary) !important; }

  /* ── HTML: elements that may have hardcoded dark color/background ── */
  *[style*="color:#000"],*[style*="color: #000"],
  *[style*="color:#333"],*[style*="color: #333"],
  *[style*="color:black"],*[style*="color: black"],
  *[style*="color:#111"],*[style*="color: #111"],
  *[style*="color:#1a1a1a"],*[style*="color: #1a1a1a"],
  *[style*="color:#222"],*[style*="color: #222"],
  *[style*="color:#444"],*[style*="color: #444"]      { color: var(--text-primary) !important; }

  *[style*="background:#fff"],*[style*="background: #fff"],
  *[style*="background:#ffffff"],*[style*="background: #ffffff"],
  *[style*="background:white"],*[style*="background: white"],
  *[style*="background-color:#fff"],*[style*="background-color: #fff"],
  *[style*="background-color:#ffffff"],*[style*="background-color: #ffffff"],
  *[style*="background-color:white"],*[style*="background-color: white"]
                                                      { background: var(--bg-hover) !important; }
`;

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Inter, system-ui, sans-serif; font-size: 14px;
    color: var(--text-primary); background: transparent;
    overflow-x: hidden; padding: 0; margin: 0; border: none;
  }
  /* Named SVG classes for agent diagrams */
  .t  { font: 400 14px/1.4 Inter,sans-serif; fill: var(--text-primary); }
  .ts { font: 400 12px/1.4 Inter,sans-serif; fill: var(--text-muted); }
  .th { font: 500 14px/1.4 Inter,sans-serif; fill: var(--text-primary); }
  .box   { fill: var(--bg-secondary); stroke: var(--border-color); }
  .arr   { stroke: var(--text-muted); stroke-width: 1.5; fill: none; }
  .leader{ stroke: var(--text-muted); stroke-width: 0.5; fill: none; stroke-dasharray: 4 3; }
  .node  { cursor: pointer; } .node:hover { opacity: 0.85; }
  /* Form controls */
  input[type=range] {
    -webkit-appearance: none; height: 4px; border-radius: 2px;
    background: var(--border-color); outline: none; width: 100%;
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none; width: 18px; height: 18px;
    border-radius: 50%; background: var(--accent); cursor: pointer;
  }
  button {
    font-family: inherit; cursor: pointer;
    border: 0.5px solid var(--border-color); border-radius: 8px;
    background: transparent; color: var(--text-primary);
    padding: 6px 14px; font-size: 13px; transition: background 0.15s;
  }
  button:hover { background: var(--bg-hover); }
  button:active { transform: scale(0.98); }
`;

// JavaScript injected into the iframe to fix Chart.js defaults + messaging
const IFRAME_SCRIPT = (dark: boolean) => `
const DARK = ${dark};
const textColor   = DARK ? '#ffffff' : '#2D2B26';
const mutedColor  = DARK ? '#e0e0e0' : '#6E6D6A';
const gridColor   = DARK ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)';
const borderColor = DARK ? 'rgba(255,255,255,0.3)'  : 'rgba(0,0,0,0.1)';

const applyChartDefaults = () => {
  if (!window.Chart) return;
  Chart.defaults.color = textColor;
  Chart.defaults.borderColor = borderColor;
  Chart.defaults.font = { family: 'Inter, system-ui, sans-serif', size: 12 };
  Chart.defaults.plugins.legend.labels.color = textColor;
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  if (Chart.defaults.plugins.tooltip) {
    Object.assign(Chart.defaults.plugins.tooltip, {
      backgroundColor: DARK ? '#2a2a2a' : '#ffffff',
      titleColor: textColor, bodyColor: mutedColor,
      borderColor, borderWidth: 1,
    });
  }
  const scaleOpts = { grid: { color: gridColor }, ticks: { color: mutedColor }, title: { color: textColor } };
  Chart.defaults.scales = Chart.defaults.scales || {};
  ['linear','logarithmic','category','time','radialLinear'].forEach(t => {
    Chart.defaults.scales[t] = Object.assign(Chart.defaults.scales[t] || {}, scaleOpts);
  });
};
applyChartDefaults();
window.addEventListener('load', applyChartDefaults);
setInterval(applyChartDefaults, 800);

function sendPrompt(text) { window.parent.postMessage({ type: 'PERPLEX_SEND_PROMPT', text }, '*'); }
function reportHeight() {
  const h = document.documentElement.scrollHeight || document.body.scrollHeight;
  window.parent.postMessage({ type: 'PERPLEX_WIDGET_HEIGHT', height: h }, '*');
}
new ResizeObserver(reportHeight).observe(document.body);
window.addEventListener('load', () => { reportHeight(); setTimeout(reportHeight, 500); });
`;

/**
 * Builds a complete HTML document for use inside a sandboxed iframe.
 * @param content  The HTML/SVG/JS content (agent output)
 * @param dark     Whether dark mode is active
 */
export function buildWidgetHtml(content: string, dark: boolean): string {
    const themeVars = dark ? DARK_VARS : LIGHT_VARS;
    const darkOverrides = dark ? DARK_OVERRIDES : '';

    return `<!DOCTYPE html>
<html class="${dark ? 'dark' : ''}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
:root { ${themeVars} ${COMPAT_VARS} }
${BASE_CSS}
${SVG_RAMPS_LIGHT}
${SVG_RAMPS_DARK}
${darkOverrides}
</style>
</head>
<body>
${content}
<script>${IFRAME_SCRIPT(dark)}</script>
</body>
</html>`;
}
