// ============================================================
// WIDGET BLOCK — Randează widget-uri HTML/JS în iframe sandbox
// Izolat complet de DOM-ul principal
// ============================================================
import React, { useRef, useEffect, useState } from 'react';

interface WidgetBlockProps {
  content: string;
  title?: string;
  theme: 'light' | 'dark' | 'system';
}

export const WidgetBlock: React.FC<WidgetBlockProps> = ({
  content,
  title,
  theme,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(350);
  const [error, setError] = useState<string | null>(null);

  // Rezolvă tema efectivă
  const effectiveTheme =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;

  // CSS variables injectate în iframe pentru dark/light mode
  const cssVariables =
    effectiveTheme === 'dark'
      ? `
        --text-primary: #f1f1f1;
        --text-muted: #a0a0a0;
        --bg-secondary: #1e1e1e;
        --border-color: #333;
        --accent: #7c6af7;
      `
      : `
        --text-primary: #1a1a1a;
        --text-muted: #666;
        --bg-secondary: #f5f5f5;
        --border-color: #e0e0e0;
        --accent: #5b4fcf;
      `;

  const iframeContent = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  :root { ${cssVariables} }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    color: var(--text-primary);
    background: transparent;
    overflow-x: hidden;
    padding: 8px;
  }
</style>
</head>
<body>
${content}
<script>
  // Notifică părintele de înălțimea reală după randare
  function notifyHeight() {
    const h = document.body.scrollHeight;
    window.parent.postMessage({ type: 'widget-height', height: h }, '*');
  }
  window.addEventListener('load', notifyHeight);
  // Re-notifică după 500ms (pentru Chart.js și animații)
  setTimeout(notifyHeight, 600);
</script>
</body>
</html>`;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'widget-height' && event.data.height) {
        const newHeight = Math.min(
          Math.max(event.data.height + 24, 150),
          600 // maxim 600px
        );
        setHeight(newHeight);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  if (error) {
    return (
      <div style={{
        padding: '12px',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        color: 'var(--text-muted)',
        fontSize: '13px',
      }}>
        ⚠ Widget failed to render: {error}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', marginTop: '8px', marginBottom: '8px' }}>
      {title && (
        <div style={{
          fontSize: '12px',
          color: 'var(--text-muted)',
          marginBottom: '6px',
          fontWeight: 500,
        }}>
          {title}
        </div>
      )}
      <iframe
        ref={iframeRef}
        srcDoc={iframeContent}
        sandbox="allow-scripts"
        style={{
          width: '100%',
          height: `${height}px`,
          border: 'none',
          borderRadius: '8px',
          display: 'block',
          transition: 'height 0.2s ease',
        }}
        title={title || 'Interactive widget'}
        onError={() => setError('iframe failed to load')}
      />
    </div>
  );
};