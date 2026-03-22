// ============================================================
// BLOCK RENDERER — Orchestratorul principal de randare
// Primește RenderBlock[] și randează fiecare bloc corect
// ============================================================
import React from 'react';
import type { RenderBlock } from './types';
import { WidgetBlock } from './WidgetBlock';
import { CodeBlock } from './CodeBlock';
import { CitationList } from './CitationList';
import { RelatedQuestions } from './RelatedQuestions';

interface BlockRendererProps {
  blocks: RenderBlock[];
  theme: 'light' | 'dark' | 'system';
  onPendingActionConfirm?: (data: any) => void;
  onPendingActionCancel?: () => void;
  onRelatedQuestionClick?: (question: string) => void;
  // Componenta existentă pentru markdown rendering
  MarkdownRenderer?: React.ComponentType<{ content: string }>;
}

export const BlockRenderer: React.FC<BlockRendererProps> = ({
  blocks,
  theme,
  onPendingActionConfirm,
  onPendingActionCancel,
  onRelatedQuestionClick,
  MarkdownRenderer,
}) => {
  return (
    <div style={{ width: '100%' }}>
      {blocks
        .sort((a, b) => a.order - b.order)
        .map(block => (
          <div
            key={block.id}
            style={{
              opacity: block.metadata?.isStreaming ? 0.85 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {renderBlock(block, {
              theme,
              onPendingActionConfirm,
              onPendingActionCancel,
              onRelatedQuestionClick,
              MarkdownRenderer,
            })}
          </div>
        ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// DISPATCH — Randare per tip de bloc
// ─────────────────────────────────────────────────────────────
function renderBlock(
  block: RenderBlock,
  ctx: {
    theme: 'light' | 'dark' | 'system';
    onPendingActionConfirm?: (data: any) => void;
    onPendingActionCancel?: () => void;
    onRelatedQuestionClick?: (question: string) => void;
    MarkdownRenderer?: React.ComponentType<{ content: string }>;
  }
): React.ReactNode {
  switch (block.type) {
    case 'text':
      if (ctx.MarkdownRenderer) {
        return <ctx.MarkdownRenderer content={block.content} />;
      }
      // Fallback simplu dacă nu există MarkdownRenderer
      return (
        <div style={{
          whiteSpace: 'pre-wrap',
          lineHeight: '1.65',
          fontSize: '14px',
          color: 'var(--text-primary)',
        }}>
          {block.content}
        </div>
      );

    case 'widget':
      return (
        <WidgetBlock
          content={block.content}
          title={block.metadata?.title}
          theme={ctx.theme}
        />
      );

    case 'code':
      return (
        <CodeBlock
          content={block.content}
          language={block.metadata?.language || 'text'}
        />
      );

    case 'citation_list':
      return (
        <CitationList citations={block.metadata?.citations || []} />
      );

    case 'related_questions':
      return (
        <RelatedQuestions
          questions={block.metadata?.relatedQuestions || []}
          onQuestionClick={ctx.onRelatedQuestionClick || (() => {})}
        />
      );

    case 'pending_action':
      // PendingAction UI-ul existent din aplicație — nu îl înlocuim
      // Returnăm null și lăsăm App.tsx să îl gestioneze prin state
      return null;

    case 'error':
      return (
        <div style={{
          padding: '10px 14px',
          borderRadius: '8px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--text-primary)',
          fontSize: '13px',
          lineHeight: '1.5',
        }}>
          ⚠ {block.content}
        </div>
      );

    default:
      return null;
  }
}