// ============================================================
// CITATION LIST — Lista de surse la finalul răspunsului
// ============================================================
import React, { useState } from 'react';
import type { Citation } from './types';

interface CitationListProps {
  citations: Citation[];
}

export const CitationList: React.FC<CitationListProps> = ({ citations }) => {
  const [expanded, setExpanded] = useState(false);

  if (citations.length === 0) return null;

  // Afișăm primele 3 implicit, restul la expand
  const visible = expanded ? citations : citations.slice(0, 3);
  const hasMore = citations.length > 3;

  return (
    <div style={{
      marginTop: '12px',
      paddingTop: '10px',
      borderTop: '1px solid var(--border-color)',
    }}>
      <div style={{
        fontSize: '11px',
        color: 'var(--text-muted)',
        marginBottom: '6px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        Sources
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {visible.map(citation => (
          <a
            key={citation.index}
            href={citation.uri}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--accent)',
              textDecoration: 'none',
              lineHeight: '1.4',
            }}
          >
            <span style={{
              minWidth: '18px',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}>
              [{citation.index}]
            </span>
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '400px',
            }}>
              {citation.title || citation.uri}
            </span>
          </a>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: '6px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {expanded
            ? '↑ Show less'
            : `↓ Show ${citations.length - 3} more sources`}
        </button>
      )}
    </div>
  );
};