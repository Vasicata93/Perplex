// ============================================================
// RELATED QUESTIONS — Întrebări sugestive (Rule 8 Layer 1)
// ============================================================
import React from 'react';

interface RelatedQuestionsProps {
  questions: string[];
  onQuestionClick: (question: string) => void;
}

export const RelatedQuestions: React.FC<RelatedQuestionsProps> = ({
  questions,
  onQuestionClick,
}) => {
  if (questions.length === 0) return null;

  return (
    <div style={{
      marginTop: '14px',
      paddingTop: '10px',
      borderTop: '1px solid var(--border-color)',
    }}>
      <div style={{
        fontSize: '11px',
        color: 'var(--text-muted)',
        marginBottom: '8px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        Related
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {questions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => onQuestionClick(q)}
            style={{
              textAlign: 'left',
              padding: '7px 10px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '13px',
              cursor: 'pointer',
              lineHeight: '1.4',
              transition: 'background 0.1s, border-color 0.1s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'var(--bg-secondary)';
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                'var(--accent)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background =
                'transparent';
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                'var(--border-color)';
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
};