import React, { useRef, useEffect, useState } from 'react';

interface WidgetRendererProps {
  code: string;
  title?: string;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({ code, title }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(300);
  const [isInteracting, setIsInteracting] = useState(false);
  // Detect dark mode changes to force update if theme changes
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'));
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    setIsDark(document.documentElement.classList.contains('dark'));
    return () => observer.disconnect();
  }, []);

  // Construim HTML complet pentru iframe
  const buildHtml = (content: string, dark: boolean): string => {
    const cssVars = isDark ? `
      --bg-primary: #191919;
      --bg-secondary: #262626;
      --bg-hover: #2d2d2d;
      --border-color: #3a3a3a;
      --text-primary: #e8e6e0;
      --text-muted: #8a8880;
      --accent: #20B8CD;
    ` : `
      --bg-primary: #F9F9F9;
      --bg-secondary: #EBEBE9;
      --bg-hover: #E0E0DE;
      --border-color: #D6D6D4;
      --text-primary: #2D2B26;
      --text-muted: #6E6D6A;
      --accent: #20B8CD;
    `;

    // Mapăm variabilele Claude → variabilele Perplex
    // Astfel codul generat de agent funcționează direct
    const claudeCompat = `
      --color-background-primary: var(--bg-primary);
      --color-background-secondary: var(--bg-secondary);
      --color-background-tertiary: var(--bg-hover);
      --color-text-primary: var(--text-primary);
      --color-text-secondary: var(--text-muted);
      --color-text-tertiary: var(--text-muted);
      --color-border-tertiary: var(--border-color);
      --color-border-secondary: var(--border-color);
      --color-border-primary: var(--border-color);
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
      --border-radius-md: 8px;
      --border-radius-lg: 12px;
      --border-radius-xl: 16px;
    `;

    return `<!DOCTYPE html>
<html class="${isDark ? 'dark' : ''}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  :root { ${cssVars} ${claudeCompat} }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Inter, system-ui, sans-serif;
    font-size: 14px;
    color: var(--text-primary);
    background: transparent;
    overflow-x: hidden;
    padding: 0;
  }
  /* Stiluri pre-built pentru SVG diagrame (compatibilitate Claude) */
  .t  { font: 400 14px/1.4 Inter, sans-serif; fill: var(--text-primary); }
  .ts { font: 400 12px/1.4 Inter, sans-serif; fill: var(--text-muted); }
  .th { font: 500 14px/1.4 Inter, sans-serif; fill: var(--text-primary); }
  .box { fill: var(--bg-secondary); stroke: var(--border-color); }
  .arr { stroke: var(--text-muted); stroke-width: 1.5; fill: none; }
  .leader { stroke: var(--text-muted); stroke-width: 0.5; fill: none; stroke-dasharray: 4 3; }
  .node { cursor: pointer; }
  .node:hover { opacity: 0.85; }

  /* Rampele de culori pentru diagrame SVG */
  .c-blue   rect, .c-blue   circle, .c-blue   ellipse { fill: #E6F1FB; stroke: #185FA5; }
  .c-blue   .t, .c-blue .th { fill: #0C447C; }
  .c-blue   .ts { fill: #185FA5; }
  .c-teal   rect, .c-teal   circle, .c-teal   ellipse { fill: #E1F5EE; stroke: #0F6E56; }
  .c-teal   .t, .c-teal .th { fill: #085041; }
  .c-teal   .ts { fill: #0F6E56; }
  .c-purple rect, .c-purple circle, .c-purple ellipse { fill: #EEEDFE; stroke: #534AB7; }
  .c-purple .t, .c-purple .th { fill: #3C3489; }
  .c-purple .ts { fill: #534AB7; }
  .c-coral  rect, .c-coral  circle, .c-coral  ellipse { fill: #FAECE7; stroke: #993C1D; }
  .c-coral  .t, .c-coral .th { fill: #712B13; }
  .c-coral  .ts { fill: #993C1D; }
  .c-amber  rect, .c-amber  circle, .c-amber  ellipse { fill: #FAEEDA; stroke: #854F0B; }
  .c-amber  .t, .c-amber .th { fill: #633806; }
  .c-amber  .ts { fill: #854F0B; }
  .c-green  rect, .c-green  circle, .c-green  ellipse { fill: #EAF3DE; stroke: #3B6D11; }
  .c-green  .t, .c-green .th { fill: #27500A; }
  .c-green  .ts { fill: #3B6D11; }
  .c-gray   rect, .c-gray   circle, .c-gray   ellipse { fill: #F1EFE8; stroke: #5F5E5A; }
  .c-gray   .t, .c-gray .th { fill: #444441; }
  .c-gray   .ts { fill: #5F5E5A; }
  .c-red    rect, .c-red    circle, .c-red    ellipse { fill: #FCEBEB; stroke: #A32D2D; }
  .c-red    .t, .c-red .th { fill: #791F1F; }
  .c-red    .ts { fill: #A32D2D; }
  .c-pink   rect, .c-pink   circle, .c-pink   ellipse { fill: #FBEAF0; stroke: #993556; }
  .c-pink   .t, .c-pink .th { fill: #72243E; }
  .c-pink   .ts { fill: #993556; }

  /* Dark mode pentru rampele SVG */
  .dark .c-blue   rect, .dark .c-blue   circle, .dark .c-blue   ellipse { fill: #0C447C; stroke: #85B7EB; }
  .dark .c-blue   .t, .dark .c-blue .th { fill: #B5D4F4; }
  .dark .c-blue   .ts { fill: #85B7EB; }
  .dark .c-teal   rect, .dark .c-teal   circle, .dark .c-teal   ellipse { fill: #085041; stroke: #5DCAA5; }
  .dark .c-teal   .t, .dark .c-teal .th { fill: #9FE1CB; }
  .dark .c-teal   .ts { fill: #5DCAA5; }
  .dark .c-purple rect, .dark .c-purple circle, .dark .c-purple ellipse { fill: #3C3489; stroke: #AFA9EC; }
  .dark .c-purple .t, .dark .c-purple .th { fill: #CECBF6; }
  .dark .c-purple .ts { fill: #AFA9EC; }
  .dark .c-coral  rect, .dark .c-coral  circle, .dark .c-coral  ellipse { fill: #712B13; stroke: #F0997B; }
  .dark .c-coral  .t, .dark .c-coral .th { fill: #F5C4B3; }
  .dark .c-coral  .ts { fill: #F0997B; }
  .dark .c-amber  rect, .dark .c-amber  circle, .dark .c-amber  ellipse { fill: #633806; stroke: #EF9F27; }
  .dark .c-amber  .t, .dark .c-amber .th { fill: #FAC775; }
  .dark .c-amber  .ts { fill: #EF9F27; }
  .dark .c-green  rect, .dark .c-green  circle, .dark .c-green  ellipse { fill: #27500A; stroke: #97C459; }
  .dark .c-green  .t, .dark .c-green .th { fill: #C0DD97; }
  .dark .c-green  .ts { fill: #97C459; }
  .dark .c-gray   rect, .dark .c-gray   circle, .dark .c-gray   ellipse { fill: #444441; stroke: #B4B2A9; }
  .dark .c-gray   .t, .dark .c-gray .th { fill: #D3D1C7; }
  .dark .c-gray   .ts { fill: #B4B2A9; }
  .dark .c-red    rect, .dark .c-red    circle, .dark .c-red    ellipse { fill: #791F1F; stroke: #F09595; }
  .dark .c-red    .t, .dark .c-red .th { fill: #F7C1C1; }
  .dark .c-red    .ts { fill: #F09595; }

  /* Form controls */
  input[type=range] {
    -webkit-appearance: none; height: 4px; border-radius: 2px;
    background: var(--border-color); outline: none; width: 100%;
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%;
    background: var(--accent); cursor: pointer;
  }
  button {
    font-family: inherit; cursor: pointer;
    border: 0.5px solid var(--border-color);
    border-radius: var(--border-radius-md);
    background: transparent; color: var(--text-primary);
    padding: 6px 14px; font-size: 13px; transition: background 0.15s;
  }
  button:hover { background: var(--bg-hover); }
  button:active { transform: scale(0.98); }
</style>
</head>
<body>
${content}
<script>
  // sendPrompt trimite mesaj în chat-ul principal
  function sendPrompt(text) {
    window.parent.postMessage({ type: 'PERPLEX_SEND_PROMPT', text }, '*');
  }
  // Auto-resize iframe la înălțimea conținutului
  function reportHeight() {
    const h = document.documentElement.scrollHeight || document.body.scrollHeight;
    window.parent.postMessage({ type: 'PERPLEX_WIDGET_HEIGHT', height: h }, '*');
  }
  const observer = new ResizeObserver(() => reportHeight());
  observer.observe(document.body);
  window.addEventListener('load', function() {
    reportHeight();
    setTimeout(reportHeight, 500);
  });
</script>
</body>
</html>`;
  };

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'PERPLEX_WIDGET_HEIGHT') {
        setHeight(h => {
          const newH = Math.max(100, e.data.height + 20);
          return Math.abs(newH - h) > 5 ? newH : h;
        });
      }
      // sendPrompt din widget → trimite în inputul de chat
      if (e.data?.type === 'PERPLEX_SEND_PROMPT') {
        const inputEl = document.querySelector('textarea') as HTMLTextAreaElement;
        if (inputEl) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          )?.set;
          nativeInputValueSetter?.call(inputEl, e.data.text);
          inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Memoize blobUrl to prevent iframe reloading (flashing) on every render
  const blobUrl = React.useMemo(() => {
    const html = buildHtml(code, isDark);
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [code, isDark]);

  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  return (
    <div
      className="my-4 rounded-xl overflow-hidden"
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onTouchStart={() => setIsInteracting(true)}
      onTouchEnd={() => setTimeout(() => setIsInteracting(false), 300)}
    >
      {title && (
        <div className="px-4 py-2 text-xs text-pplx-muted font-medium flex items-center gap-2 bg-pplx-secondary/5">
          <span className="w-2 h-2 rounded-full bg-pplx-accent inline-block" />
          {title}
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={blobUrl}
        sandbox="allow-scripts"
        style={{ width: '100%', height: `${height}px`, border: 'none', display: 'block', pointerEvents: isInteracting ? 'auto' : 'none' }}
        title={title || 'Widget interactiv'}
      />
    </div>
  );
};
