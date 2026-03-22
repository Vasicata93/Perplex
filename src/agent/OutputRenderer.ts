// ============================================================
// LAYER 9 — OUTPUT RENDERER
// Transformă SynthesisOutput în RenderBlock[] pentru UI.
// Pure logic — fără dependențe React.
// Componentele React sunt în Layer 9B.
// ============================================================

import {
  RendererInput,
  RendererOutput,
  RenderBlock,
  RenderBlockType,
  StreamingState,
  SynthesisOutput,
  Citation,
  ResponseFormat,
} from './types';

// ─────────────────────────────────────────────────────────────
// FUNCȚIA PRINCIPALĂ
// ─────────────────────────────────────────────────────────────
export function buildRenderBlocks(input: RendererInput): RendererOutput {
  const { synthesisOutput } = input;
  const blocks: RenderBlock[] = [];
  let order = 0;

  // 1. Parsează și construiește blocurile principale din text
  const mainBlocks = parseMainContent(
    synthesisOutput.finalText,
    synthesisOutput.format,
    synthesisOutput.citations
  );
  blocks.push(...mainBlocks.map(b => ({ ...b, order: order++ })));

  // 2. Bloc PendingAction dacă există
  if (synthesisOutput.pendingAction) {
    blocks.push({
      id: `pending_action_${Date.now()}`,
      type: 'pending_action',
      content: '',
      metadata: {
        pendingAction: synthesisOutput.pendingAction,
      },
      order: order++,
    });
  }

  // 3. Lista de citări dacă există
  if (synthesisOutput.citations.length > 0) {
    blocks.push({
      id: `citations_${Date.now()}`,
      type: 'citation_list',
      content: formatCitationList(synthesisOutput.citations),
      metadata: {
        citations: synthesisOutput.citations,
      },
      order: order++,
    });
  }

  // 4. Related questions dacă există și nu e pending action
  if (
    synthesisOutput.relatedQuestions.length > 0 &&
    !synthesisOutput.pendingAction
  ) {
    blocks.push({
      id: `related_${Date.now()}`,
      type: 'related_questions',
      content: '',
      metadata: {
        relatedQuestions: synthesisOutput.relatedQuestions.map(q => q.text),
      },
      order: order++,
    });
  }

  const streamingState: StreamingState = {
    isStreaming: false,
    currentBlockId: null,
    bufferedText: '',
    lastUpdateMs: Date.now(),
  };

  console.log(
    `[Layer 9] Render blocks built: ${blocks.length} blocks · ` +
    `Format: ${synthesisOutput.format} · ` +
    `Has widget: ${blocks.some(b => b.type === 'widget')} · ` +
    `Has pending: ${blocks.some(b => b.type === 'pending_action')}`
  );

  return {
    blocks,
    streamingState,
    hasWidget: blocks.some(b => b.type === 'widget'),
    hasPendingAction: blocks.some(b => b.type === 'pending_action'),
    totalBlocks: blocks.length,
  };
}

// ─────────────────────────────────────────────────────────────
// 9.1 — PARSARE CONȚINUT PRINCIPAL
// Împarte textul în blocuri după tip
// ─────────────────────────────────────────────────────────────
function parseMainContent(
  text: string,
  format: ResponseFormat,
  citations: Citation[]
): Omit<RenderBlock, 'order'>[] {
  const blocks: Omit<RenderBlock, 'order'>[] = [];

  // Elimină secțiunea de related questions din text
  // (ele sunt gestionate ca bloc separat)
  const textWithoutRelated = text.replace(/\n---\n[\s\S]*$/m, '').trim();

  // Elimină secțiunea de pending action JSON din text dacă există
  const textClean = textWithoutRelated
    .replace(/```json[\s\S]*?"type"\s*:\s*"pending_action"[\s\S]*?```/gi, '')
    .trim();

  if (format === 'widget') {
    // Poate conține text + widget-uri mixate
    return parseWidgetAndText(textClean, citations);
  }

  if (format === 'code_block') {
    return parseCodeAndText(textClean, citations);
  }

  // Pentru plain_text și markdown — un singur bloc text
  blocks.push({
    id: `text_main_${Date.now()}`,
    type: 'text',
    content: textClean,
    metadata: { citations },
  });

  return blocks;
}

// ─────────────────────────────────────────────────────────────
// 9.2 — WIDGET PARSER
// Extrage sintaxa :::widget[Title]\n...\n::: din text
// ─────────────────────────────────────────────────────────────
function parseWidgetAndText(
  text: string,
  citations: Citation[]
): Omit<RenderBlock, 'order'>[] {
  const blocks: Omit<RenderBlock, 'order'>[] = [];

  // Pattern pentru sintaxa widget din Layer 1 Core Skill 4
  const widgetPattern = /:::widget(?:\[([^\]]*)\])?\n([\s\S]*?):::/g;
  let lastIndex = 0;
  let match;

  while ((match = widgetPattern.exec(text)) !== null) {
    // Text înainte de widget
    const textBefore = text.slice(lastIndex, match.index).trim();
    if (textBefore.length > 0) {
      blocks.push({
        id: `text_${Date.now()}_${blocks.length}`,
        type: 'text',
        content: textBefore,
        metadata: { citations },
      });
    }

    // Widget block
    const widgetTitle = match[1] || 'Interactive Widget';
    const widgetContent = match[2].trim();

    blocks.push({
      id: `widget_${Date.now()}_${blocks.length}`,
      type: 'widget',
      content: sanitizeWidgetContent(widgetContent),
      metadata: { title: widgetTitle },
    });

    lastIndex = match.index + match[0].length;
  }

  // Text după ultimul widget
  const textAfter = text.slice(lastIndex).trim();
  if (textAfter.length > 0) {
    blocks.push({
      id: `text_after_${Date.now()}`,
      type: 'text',
      content: textAfter,
      metadata: { citations },
    });
  }

  // Dacă nu s-a găsit niciun widget, tratăm ca text normal
  if (blocks.length === 0) {
    blocks.push({
      id: `text_fallback_${Date.now()}`,
      type: 'text',
      content: text,
      metadata: { citations },
    });
  }

  return blocks;
}

// ─────────────────────────────────────────────────────────────
// 9.3 — CODE BLOCK PARSER
// Extrage blocuri de cod cu language tag
// ─────────────────────────────────────────────────────────────
function parseCodeAndText(
  text: string,
  citations: Citation[]
): Omit<RenderBlock, 'order'>[] {
  const blocks: Omit<RenderBlock, 'order'>[] = [];
  const codePattern = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codePattern.exec(text)) !== null) {
    // Text înainte de cod
    const textBefore = text.slice(lastIndex, match.index).trim();
    if (textBefore.length > 0) {
      blocks.push({
        id: `text_${Date.now()}_${blocks.length}`,
        type: 'text',
        content: textBefore,
        metadata: { citations },
      });
    }

    // Cod block
    blocks.push({
      id: `code_${Date.now()}_${blocks.length}`,
      type: 'code',
      content: match[2].trim(),
      metadata: {
        language: match[1] || 'text',
      },
    });

    lastIndex = match.index + match[0].length;
  }

  // Text după ultimul bloc de cod
  const textAfter = text.slice(lastIndex).trim();
  if (textAfter.length > 0) {
    blocks.push({
      id: `text_after_${Date.now()}`,
      type: 'text',
      content: textAfter,
      metadata: { citations },
    });
  }

  if (blocks.length === 0) {
    blocks.push({
      id: `text_fallback_${Date.now()}`,
      type: 'text',
      content: text,
      metadata: { citations },
    });
  }

  return blocks;
}

// ─────────────────────────────────────────────────────────────
// 9.4 — WIDGET SANITIZER
// Curăță conținutul widget pentru randare sigură în iframe sandbox
// ─────────────────────────────────────────────────────────────
function sanitizeWidgetContent(html: string): string {
  let content = html;

  // Elimină DOCTYPE și html/head/body tags (nu sunt permise în widget)
  content = content.replace(/<!DOCTYPE[^>]*>/gi, '');
  content = content.replace(/<\/?html[^>]*>/gi, '');
  content = content.replace(/<\/?head[^>]*>/gi, '');
  content = content.replace(/<\/?body[^>]*>/gi, '');

  // Normalizează CSS variables (asigură că folosește var(--text-primary) etc.)
  // Nu modificăm conținutul — modelul ar trebui să fi respectat Layer 1 Skill 4
  // Doar loghăm un avertisment dacă detectăm culori hardcodate
  if (/#[0-9a-f]{3,6}\b/i.test(content) && !content.includes('var(--')) {
    console.warn('[Layer 9] Widget may contain hardcoded colors — dark mode issues possible');
  }

  return content.trim();
}

// ─────────────────────────────────────────────────────────────
// 9.5 — CITATION LIST FORMATTER
// ─────────────────────────────────────────────────────────────
function formatCitationList(citations: Citation[]): string {
  return citations
    .map(c => `[${c.index}] ${c.title} — ${c.uri}`)
    .join('\n');
}

// ─────────────────────────────────────────────────────────────
// 9.6 — STREAMING HELPERS
// Gestionează actualizarea blocurilor în timp real
// ─────────────────────────────────────────────────────────────

/**
 * Actualizează un bloc text existent cu content nou în streaming.
 * Imutabil — returnează un nou array de blocuri.
 */
export function updateStreamingBlock(
  blocks: RenderBlock[],
  blockId: string,
  newContent: string
): RenderBlock[] {
  return blocks.map(block =>
    block.id === blockId
      ? {
          ...block,
          content: newContent,
          metadata: { ...block.metadata, isStreaming: true },
        }
      : block
  );
}

/**
 * Marchează un bloc ca finalizat (streaming done).
 */
export function finalizeStreamingBlock(
  blocks: RenderBlock[],
  blockId: string
): RenderBlock[] {
  return blocks.map(block =>
    block.id === blockId
      ? {
          ...block,
          metadata: { ...block.metadata, isStreaming: false },
        }
      : block
  );
}

/**
 * Creează un bloc text inițial pentru streaming.
 */
export function createStreamingBlock(initialText: string = ''): RenderBlock {
  return {
    id: `streaming_${Date.now()}`,
    type: 'text',
    content: initialText,
    metadata: { isStreaming: true },
    order: 0,
  };
}

// ─────────────────────────────────────────────────────────────
// 9.7 — EXPORT: Construiește blocuri de eroare
// Folosit când generarea eșuează complet
// ─────────────────────────────────────────────────────────────
export function buildErrorBlock(errorMessage: string): RenderBlock {
  return {
    id: `error_${Date.now()}`,
    type: 'error',
    content: errorMessage,
    order: 0,
  };
}