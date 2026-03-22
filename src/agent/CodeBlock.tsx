// ============================================================
// CODE BLOCK — Syntax highlighted code cu copy button
// ============================================================
import React, { useState } from 'react';

interface CodeBlockProps {
  content: string;
  language: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ content, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback pentru browsere care nu suportă clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{
      position: 'relative',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid var(--border-color)',
      marginTop: '8px',
      marginBottom: '8px',
    }}>
      {/* Header bar cu language label și copy button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 12px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <span style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          fontFamily: 'monospace',
          textTransform: 'lowercase',
        }}>
          {language}
        </span>
        <button
          onClick={handleCopy}
          style={{
            fontSize: '11px',
            color: copied ? 'var(--accent)' : 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 6px',
            borderRadius: '4px',
            transition: 'color 0.15s',
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {/* Codul */}
      <pre style={{
        margin: 0,
        padding: '14px 16px',
        overflowX: 'auto',
        fontSize: '13px',
        lineHeight: '1.6',
        fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
        color: 'var(--text-primary)',
        background: 'var(--bg-secondary)',
      }}>
        <code>{content}</code>
      </pre>
    </div>
  );
};