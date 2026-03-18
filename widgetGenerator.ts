export const generateWidgetHtml = (code: string, dark: boolean) => {
    const cssVars = dark ? `
    --bg-primary:transparent; --bg-secondary:transparent; --bg-hover:#2d2d2d;
    --border-color:#3a3a3a; --text-primary:#e8e6e0; --text-muted:#8a8880;
    --accent:#20B8CD;
` : `
    --bg-primary:transparent; --bg-secondary:transparent; --bg-hover:#E0E0DE;
    --border-color:#D6D6D4; --text-primary:#2D2B26; --text-muted:#6E6D6A;
    --accent:#20B8CD;
`;

    return `<!DOCTYPE html>
<html class="${dark ? 'dark' : ''}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root {
    ${cssVars}
    --color-background-primary:var(--bg-primary);
    --color-background-secondary:var(--bg-secondary);
    --color-text-primary:var(--text-primary);
    --color-text-secondary:var(--text-muted);
    --color-border-tertiary:var(--border-color);
    --color-border-secondary:var(--border-color);
    --color-background-info:rgba(32,184,205,0.12);
    --color-text-info:var(--accent);
    --font-sans:Inter,system-ui,sans-serif;
    --font-mono:'JetBrains Mono',monospace;
    --border-radius-md:8px; --border-radius-lg:12px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;font-size:14px;
     color:var(--text-primary);background:transparent;overflow-x:hidden;padding:8px}
.t  {font:400 14px/1.4 Inter,sans-serif;fill:var(--text-primary)}
.ts {font:400 12px/1.4 Inter,sans-serif;fill:var(--text-muted)}
.th {font:500 14px/1.4 Inter,sans-serif;fill:var(--text-primary)}
.box{fill:var(--bg-secondary);stroke:var(--border-color)}
.arr{stroke:var(--text-muted);stroke-width:1.5;fill:none}
.leader{stroke:var(--text-muted);stroke-width:0.5;fill:none;stroke-dasharray:4 3}
.node{cursor:pointer}.node:hover{opacity:0.85}

/* Chart Colors */
.c-blue rect,.c-blue circle{fill:#E6F1FB;stroke:#185FA5}.c-blue .t,.c-blue .th{fill:#0C447C}.c-blue .ts{fill:#185FA5}
.c-teal rect,.c-teal circle{fill:#E1F5EE;stroke:#0F6E56}.c-teal .t,.c-teal .th{fill:#085041}.c-teal .ts{fill:#0F6E56}
.c-purple rect,.c-purple circle{fill:#EEEDFE;stroke:#534AB7}.c-purple .t,.c-purple .th{fill:#3C3489}.c-purple .ts{fill:#534AB7}
.c-coral rect,.c-coral circle{fill:#FAECE7;stroke:#993C1D}.c-coral .t,.c-coral .th{fill:#712B13}.c-coral .ts{fill:#993C1D}
.c-amber rect,.c-amber circle{fill:#FAEEDA;stroke:#854F0B}.c-amber .t,.c-amber .th{fill:#633806}.c-amber .ts{fill:#854F0B}
.c-green rect,.c-green circle{fill:#EAF3DE;stroke:#3B6D11}.c-green .t,.c-green .th{fill:#27500A}.c-green .ts{fill:#3B6D11}
.c-gray rect,.c-gray circle{fill:#F1EFE8;stroke:#5F5E5A}.c-gray .t,.c-gray .th{fill:#444441}.c-gray .ts{fill:#5F5E5A}
.dark .c-blue rect,.dark .c-blue circle{fill:#0C447C;stroke:#85B7EB}.dark .c-blue .t,.dark .c-blue .th{fill:#B5D4F4}.dark .c-blue .ts{fill:#85B7EB}
.dark .c-teal rect,.dark .c-teal circle{fill:#085041;stroke:#5DCAA5}.dark .c-teal .t,.dark .c-teal .th{fill:#9FE1CB}.dark .c-teal .ts{fill:#5DCAA5}
.dark .c-purple rect,.dark .c-purple circle{fill:#3C3489;stroke:#AFA9EC}.dark .c-purple .t,.dark .c-purple .th{fill:#CECBF6}.dark .c-purple .ts{fill:#AFA9EC}
.dark .c-coral rect,.dark .c-coral circle{fill:#712B13;stroke:#F0997B}.dark .c-coral .t,.dark .c-coral .th{fill:#F5C4B3}.dark .c-coral .ts{fill:#F0997B}
.dark .c-amber rect,.dark .c-amber circle{fill:#633806;stroke:#EF9F27}.dark .c-amber .t,.dark .c-amber .th{fill:#FAC775}.dark .c-amber .ts{fill:#EF9F27}
.dark .c-green rect,.dark .c-green circle{fill:#27500A;stroke:#97C459}.dark .c-green .t,.dark .c-green .th{fill:#C0DD97}.dark .c-green .ts{fill:#97C459}
.dark .c-gray rect,.dark .c-gray circle{fill:#444441;stroke:#B4B2A9}.dark .c-gray .t,.dark .c-gray .th{fill:#D3D1C7}.dark .c-gray .ts{fill:#B4B2A9}

input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;background:var(--border-color);outline:none;width:100%}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:var(--accent);cursor:pointer}
button{font-family:inherit;cursor:pointer;border:0.5px solid var(--border-color);border-radius:8px;background:transparent;color:var(--text-primary);padding:6px 14px;font-size:13px;transition:background 0.15s}
button:hover{background:var(--bg-hover)}

/* FIX COMPLET DARK MODE: SVG & HTML Styles */
.dark body { color: var(--text-primary); }
.dark [style*="color: black"], .dark [style*="color:black"], .dark [style*="color: #000"], .dark [style*="color:#000"] { color: var(--text-primary) !important; }

/* SVG Overrides - Extended for all black variants (#000, #333, #111, #222, #444) */
svg text:not([fill]):not([class]) { fill: var(--text-primary); }
svg text[fill="black"], svg text[fill="#000"], svg text[fill="#000000"], svg text[fill="#333"], svg text[fill="#333333"], svg text[fill="#1a1a1a"], svg text[fill="#222"], svg text[fill="#111"], svg text[fill="#444"] { fill: var(--text-primary); }
svg path[stroke="black"], svg path[stroke="#000"], svg path[stroke="#000000"], svg path[stroke="#333"], svg path[stroke="#1a1a1a"], svg path[stroke="#333333"], svg path[stroke="#222"], svg path[stroke="#111"], svg path[stroke="#444"] { stroke: var(--text-primary); }
svg path[fill="black"], svg path[fill="#000"], svg path[fill="#000000"], svg path[fill="#333"], svg path[fill="#1a1a1a"], svg path[fill="#333333"], svg path[fill="#222"], svg path[fill="#111"], svg path[fill="#444"] { fill: var(--text-primary); }
svg circle[stroke="black"], svg circle[stroke="#000"], svg circle[stroke="#333"] { stroke: var(--text-primary); }
svg circle[fill="black"], svg circle[fill="#000"], svg circle[fill="#333"], svg circle[fill="#111"] { fill: var(--text-primary); }
svg rect[fill="black"], svg rect[fill="#000"], svg rect[fill="#333"], svg rect[fill="#111"] { fill: var(--text-primary); }
svg line[stroke="black"], svg line[stroke="#000"], svg line[stroke="#333"], svg line[stroke="#111"] { stroke: var(--text-primary); }
svg polyline[stroke="black"], svg polyline[stroke="#000"], svg polyline[stroke="#333"] { stroke: var(--text-primary); }
svg polygon[fill="black"], svg polygon[fill="#000"], svg polygon[fill="#333"] { fill: var(--text-primary); }
svg tspan[fill="black"], svg tspan[fill="#000"], svg tspan[fill="#333"] { fill: var(--text-primary); }
</style>
</head>
<body>
${code}
<script>
const DARK = ${dark ? 'true' : 'false'};
const textColor   = DARK ? '#e8e6e0' : '#2D2B26';
const mutedColor  = DARK ? '#8a8880' : '#6E6D6A';
const gridColor   = DARK ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
const borderColor = DARK ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

const setupCharts = () => {
    if (!window.Chart) return;
    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = borderColor;
    Chart.defaults.font = { family: 'Inter, system-ui, sans-serif', size: 12 };
    Chart.defaults.plugins.legend.labels.color = textColor;
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    if (Chart.defaults.plugins.tooltip) {
        Chart.defaults.plugins.tooltip.backgroundColor = DARK ? '#2a2a2a' : '#ffffff';
        Chart.defaults.plugins.tooltip.titleColor = textColor;
        Chart.defaults.plugins.tooltip.bodyColor = mutedColor;
        Chart.defaults.plugins.tooltip.borderColor = borderColor;
        Chart.defaults.plugins.tooltip.borderWidth = 1;
    }
    const scaleDefaults = {
        grid: { color: gridColor },
        ticks: { color: mutedColor },
        title: { color: textColor }
    };
    Chart.defaults.scales = Chart.defaults.scales || {};
    ['linear','logarithmic','category','time','radialLinear'].forEach(t => {
        Chart.defaults.scales[t] = Chart.defaults.scales[t] || {};
        Object.assign(Chart.defaults.scales[t], scaleDefaults);
    });
};
setupCharts();
window.addEventListener('load', setupCharts);
setInterval(setupCharts, 800);

function sendPrompt(text){window.parent.postMessage({type:'PERPLEX_SEND_PROMPT',text},'*')}
function reportHeight(){
    var h = document.documentElement.scrollHeight || document.body.scrollHeight;
    window.parent.postMessage({type:'PERPLEX_WIDGET_HEIGHT',height:h},'*');
}
var observer = new ResizeObserver(() => reportHeight());
observer.observe(document.body);
window.addEventListener('load', function() {
    reportHeight();
    setTimeout(reportHeight, 500);
});
</script>
</body>
</html>`;
};