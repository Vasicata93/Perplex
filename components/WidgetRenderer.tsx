import React, { useRef, useEffect, useState } from 'react';
import { buildWidgetHtml } from '../services/widgetHtmlBuilder';

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
    const html = buildWidgetHtml(code, isDark);
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [code, isDark]);

  useEffect(() => {
    return () => URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  return (
    <div
      className="my-2 bg-transparent"
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onTouchStart={() => setIsInteracting(true)}
      onTouchEnd={() => setTimeout(() => setIsInteracting(false), 300)}
    >
      <iframe
        ref={iframeRef}
        src={blobUrl}
        sandbox="allow-scripts"
        style={{
          width: '100%',
          height: `${height}px`,
          border: 'none',
          display: 'block',
          background: 'transparent',
          pointerEvents: isInteracting ? 'auto' : 'none'
        }}
        title={title || 'Widget interactiv'}
      />
    </div>
  );
};
