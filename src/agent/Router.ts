// ============================================================
// LAYER 4 — ROUTING
// Decision engine: Complexity → Mode → Tool State → Skills
// Does NOT execute anything. Pure decision layer.
// ============================================================

import {
  RoutingDecision,
  RoutingInput,
  ComplexityLevel,
  OperationMode,
  ToolState,
  PriorityLevel,
  SituationalSkill,
  DEFAULT_COST_GUARD,
} from './types';

// ─────────────────────────────────────────────────────────────
// 4.1 — COMPLEXITY ASSESSMENT
// Determină complexitatea requestului curent
// ─────────────────────────────────────────────────────────────

const SIMPLE_PATTERNS: RegExp[] = [
  /^(salut|hello|hi|hey|bună|buna|ciao)\b/i,
  /^(mulțumesc|multumesc|thanks|thank you|merci)\b/i,
  /^(da|nu|ok|okay|yes|no|good|great|perfect)\b/i,
  /^ce (este|e|înseamnă|inseamna)\s+\w+\??$/i,
  /^(cine|who|what|ce)\s+.{0,40}\?$/i,
  /^(când|cand|when|where|unde)\s+.{0,40}\?$/i,
  /definiție|definition|meaning|înțeles/i,
];

const AGENT_PATTERNS: RegExp[] = [
  /cercetează|cerceteaza|research|investighează|investiga/i,
  /analizează|analizeaza|analyze|analiza completă|full analysis/i,
  /creează.+(pagină|page|raport|report|document)/i,
  /compară|compara|compare.+și.+/i,
  /planifică|planifica|plan.+(proiect|project|strategie|strategy)/i,
  /scrie.+(cod|code|script|funcție|function|clasă|class)/i,
  /execută|executa|run|rulează|ruleaza/i,
  /adaugă.+în calendar|add.+to calendar|programează|programeaza/i,
  /actualizează pagina|update page|modifică pagina|modifica pagina/i,
  /mai mulți pași|multiple steps|pas cu pas|step by step/i,
];

const CLARIFICATION_PATTERNS: RegExp[] = [
  /^(asta|this|acesta|aceasta|it)\s*$/i,
  /^(fă|fa|do|make|create)\s+(asta|this|it)\s*$/i,
  /referitor la|regarding|despre ce|what about/i,
];

function assessComplexity(input: RoutingInput): ComplexityLevel {
  const msg = input.currentMessage.trim().toLowerCase();
  const wordCount = msg.split(/\s+/).length;

  // Verifică clarificare necesară (mesaj ambiguu)
  if (wordCount < 4) {
    for (const pattern of CLARIFICATION_PATTERNS) {
      if (pattern.test(msg)) return 'ambiguous';
    }
  }

  // Verifică patterns simple
  for (const pattern of SIMPLE_PATTERNS) {
    if (pattern.test(msg)) return 'simple';
  }

  // Verifică patterns agent
  for (const pattern of AGENT_PATTERNS) {
    if (pattern.test(msg)) return 'complex';
  }

  // Heuristici suplimentare
  const hasMultipleRequests = (msg.match(/\bși\b|\band\b|\bthen\b|\bapoi\b|\bthen\b/gi) || []).length >= 2;
  const hasCodeRequest = /```|cod|code|script|funcție|function|class|import|def |async /i.test(msg);
  const hasResearchRequest = /surse|sources|articole|articles|studii|studies|cercetare|research/i.test(msg);
  const hasFileOperation = /pagină|page|document|fișier|file|calendar|eveniment|event/i.test(msg);
  const isLongRequest = wordCount > 30;

  const complexityScore =
    (hasMultipleRequests ? 2 : 0) +
    (hasCodeRequest ? 2 : 0) +
    (hasResearchRequest ? 2 : 0) +
    (hasFileOperation ? 1 : 0) +
    (input.hasAttachments ? 1 : 0) +
    (input.hasWorkspaceFiles ? 1 : 0) +
    (isLongRequest ? 1 : 0);

  if (complexityScore >= 4) return 'complex';
  if (complexityScore >= 2) return 'medium';
  return 'simple';
}

// ─────────────────────────────────────────────────────────────
// 4.2 — TOOL STATE MACHINE
// Determină ce tools sunt active în momentul curent
// ─────────────────────────────────────────────────────────────

export const READ_TOOLS = new Set([
  'perform_search',
  'get_current_time',
  'get_calendar_holidays',
  'list_calendar_events',
  'get_page_structure',
  'get_workspace_map',
  'search_workspace_files',
  'read_workspace_files',
  'semantic_search_workspace',
  'search_memory',
  'rag_search',
]);

export const WRITE_TOOLS = new Set([
  'add_calendar_event',
  'update_calendar_event',
  'delete_calendar_event',
  'save_to_library',
  'create_page',
  'update_page',
  'insert_block',
  'replace_block',
  'delete_block',
  'update_table_cell',
  'save_memory',
  'execute_code',
]);

/**
 * Determină starea Tool State Machine bazat pe contextul curent.
 * Tools sunt mereu DEFINITE (Layer 1). Această funcție decide care sunt ACTIVE.
 */
function determineToolState(input: RoutingInput): ToolState {
  // Dacă suntem la limita de iterații → error (Cost Guard)
  if (input.iterationCount >= DEFAULT_COST_GUARD.maxIterationsAgentMode) return 'error';

  // Dacă mesajul curent pare o confirmare → idle (deblocăm toate tools)
  const isConfirmation = /^(da|yes|ok|okay|confirm|confirmă|confirma|proceed|continuă|continua)\b/i
    .test(input.currentMessage.trim());
  if (isConfirmation && input.activeToolState === 'confirming') return 'idle';

  // Dacă există deja o PendingAction în așteptare → confirming
  if (input.activeToolState === 'confirming') return 'confirming';

  // Stare normală → idle (toate tools disponibile)
  return 'idle';
}

/**
 * Returnează lista tool-urilor ACTIVE pentru starea curentă.
 * Folosit pentru a construi lista de tools trimisă la API.
 */
export function getActiveTools(toolState: ToolState): {
  readToolsActive: boolean;
  writeToolsActive: boolean;
  allowedTools: Set<string>;
} {
  switch (toolState) {
    case 'idle':
      return {
        readToolsActive: true,
        writeToolsActive: true,
        allowedTools: new Set([...READ_TOOLS, ...WRITE_TOOLS]),
      };
    case 'writing':
      // În timpul unui write — read tools blocate
      return {
        readToolsActive: false,
        writeToolsActive: true,
        allowedTools: new Set([...WRITE_TOOLS]),
      };
    case 'confirming':
      // Așteptăm confirmare — toate tools blocate
      return {
        readToolsActive: false,
        writeToolsActive: false,
        allowedTools: new Set(),
      };
    case 'error':
      // Error state — doar read tools disponibile pentru recovery
      return {
        readToolsActive: true,
        writeToolsActive: false,
        allowedTools: new Set([...READ_TOOLS]),
      };
    default:
      return {
        readToolsActive: true,
        writeToolsActive: true,
        allowedTools: new Set([...READ_TOOLS, ...WRITE_TOOLS]),
      };
  }
}

// ─────────────────────────────────────────────────────────────
// 4.3 — PRIORITY ENGINE
// ─────────────────────────────────────────────────────────────

function assessPriority(input: RoutingInput, complexity: ComplexityLevel): PriorityLevel {
  const msg = input.currentMessage.toLowerCase();

  const urgentKeywords = /urgent|urgentă|urgenta|imediat|immediately|asap|acum|now|emergency|critica|critical/i;
  const importantKeywords = /important|trebuie|must|need to|deadline|termen|client|meeting|întâlnire/i;
  const optionalKeywords = /poate|maybe|dacă ai timp|if you have time|when possible|eventually|cândva/i;

  const isUrgent = urgentKeywords.test(msg);
  const isImportant = importantKeywords.test(msg);
  const isOptional = optionalKeywords.test(msg);

  if (isUrgent && isImportant) return 'urgent_important';
  if (isUrgent || isImportant) return 'important';
  if (isOptional) return 'optional';
  if (complexity === 'complex') return 'important';
  return 'routine';
}

// ─────────────────────────────────────────────────────────────
// 4.4 — SKILL INJECTION
// Skill-uri situaționale injectate dinamic în context
// CORE skills sunt în Layer 1 (cached). Acestea sunt SITUATIONAL.
// ─────────────────────────────────────────────────────────────

interface RouteSkillDefinition {
  id: string;
  triggerKeywords: string[];
  triggerPatterns: RegExp[];
  instructions: string;
}

export const SKILL_DEFINITIONS: RouteSkillDefinition[] = [
  {
    id: 'coding_skill',
    triggerKeywords: ['cod', 'code', 'script', 'function', 'funcție', 'clasă', 'class', 'bug', 'error', 'python', 'javascript', 'typescript', 'react', 'api', 'debug', 'test', 'refactor'],
    triggerPatterns: [
      /scrie.*(cod|function|class|script)/i,
      /fix.*(bug|error|issue)/i,
      /implement.*(feature|functionality)/i,
      /```[\s\S]/,
    ],
    instructions: `### Active Skill: Software Development
- Prefer working, complete code over partial snippets
- Always include error handling in production code
- Add brief inline comments for non-obvious logic
- When fixing bugs: identify root cause first, then fix
- Always execute code via execute_code tool to verify it works before presenting
- For Python: prefer standard library; list pip packages explicitly
- For TypeScript/React: use functional components, hooks, TypeScript strict types`,
  },
  {
    id: 'research_skill',
    triggerKeywords: ['cercetează', 'research', 'analizează', 'analyze', 'surse', 'sources', 'articole', 'articles', 'studii', 'studies', 'raport', 'report', 'compară', 'compare'],
    triggerPatterns: [
      /cercetează.+și.+/i,
      /compară.+cu.+/i,
      /analizează.+din.+perspective/i,
      /ce spun.+despre/i,
    ],
    instructions: `### Active Skill: Research and Analysis
- Minimum 3 independent sources for factual claims
- Clearly distinguish between: confirmed fact / expert opinion / speculation
- When sources contradict: present both positions with their evidence
- Structure: Executive Summary → Key Findings → Supporting Evidence → Limitations
- Cite every factual claim with [source number]
- Declare confidence level explicitly for each major claim`,
  },
  {
    id: 'finance_skill',
    triggerKeywords: ['buget', 'budget', 'cheltuieli', 'expenses', 'venit', 'income', 'investiție', 'investment', 'cost', 'profit', 'pierdere', 'loss', 'financiar', 'financial', 'taxe', 'taxes', 'impozit'],
    triggerPatterns: [
      /câ(t|tă).+costă/i,
      /buget.+pentru/i,
      /profit.+și.+pierdere/i,
      /analiză.+financiară/i,
    ],
    instructions: `### Active Skill: Financial Analysis
- Always clarify currency and time period when presenting numbers
- Distinguish between gross and net values explicitly
- For projections: state assumptions clearly, mark as estimates
- Include relevant tax implications when discussing income/expenses
- Use tables for comparative financial data
- Round numbers appropriately: €1,234 not €1,234.17 for estimates`,
  },
  {
    id: 'writing_skill',
    triggerKeywords: ['scrie', 'write', 'redactează', 'draft', 'email', 'mesaj', 'message', 'articol', 'article', 'post', 'blog', 'prezentare', 'presentation', 'propunere', 'proposal'],
    triggerPatterns: [
      /scrie.+(email|mesaj|articol|post)/i,
      /redactează.+pentru/i,
      /ton.+(formal|informal|profesional)/i,
      /în stilul/i,
    ],
    instructions: `### Active Skill: Writing and Communication
- Match tone to context: formal for business, conversational for personal
- Structure: clear opening → core message → clear call to action
- Avoid filler phrases and corporate speak
- For emails: subject line that summarizes the ask, body under 150 words when possible
- For long-form: use headers, bullet points for scannability
- Always present the draft first, then ask if adjustments are needed`,
  },
  {
    id: 'data_analysis_skill',
    triggerKeywords: ['date', 'data', 'statistici', 'statistics', 'trend', 'pattern', 'grafic', 'chart', 'tabel', 'table', 'csv', 'excel', 'vizualizare', 'visualization', 'medie', 'average', 'sumă', 'total'],
    triggerPatterns: [
      /analizează.+(date|data|numere)/i,
      /grafic.+pentru/i,
      /tabel.+cu/i,
      /calculează.+(media|suma|totalul)/i,
    ],
    instructions: `### Active Skill: Data Analysis
- For numerical data: always use execute_code (Python) to calculate, never mental math
- Present results as interactive widget (chart/table) when data has 3+ data points
- State clearly: sample size, time period, data source
- Identify outliers and note them explicitly
- For trends: calculate percentage change, not just absolute difference
- Validate calculations by running code — show the output`,
  },
];

function detectSkills(input: RoutingInput): SituationalSkill[] {
  const msg = input.currentMessage.toLowerCase();
  const activeSkills: SituationalSkill[] = [];

  for (const skill of SKILL_DEFINITIONS) {
    // Check keywords
    const hasKeyword = skill.triggerKeywords.some(kw => msg.includes(kw.toLowerCase()));

    // Check patterns
    const hasPattern = skill.triggerPatterns.some((pattern: RegExp) => pattern.test(input.currentMessage));

    if (hasKeyword || hasPattern) {
      activeSkills.push(skill.id as SituationalSkill);
    }
  }

  return activeSkills;
}

/**
 * Construiește textul de injectat în context pentru skill-urile active.
 * Acesta se adaugă la Layer 3 output (Perception context), nu la Layer 1.
 */
export function buildSkillInjectionContext(skills: SituationalSkill[]): string {
  if (skills.length === 0) return '';

  const skillTexts = skills.map(skillId => {
    const def = SKILL_DEFINITIONS.find(s => s.id === skillId);
    return def ? def.instructions : '';
  }).filter(Boolean);

  if (skillTexts.length === 0) return '';

  return `\n\n---\n## SITUATIONAL SKILLS (Active for this request)\n\n${skillTexts.join('\n\n')}`;
}

// ─────────────────────────────────────────────────────────────
// FUNCȚIA PRINCIPALĂ — Layer 4 Router
// ─────────────────────────────────────────────────────────────

/**
 * LAYER 4 — route()
 * Receives perception output, returns routing decision.
 * Pure function — no side effects.
 */
export function route(input: RoutingInput): RoutingDecision {
  const complexity = assessComplexity(input);
  const toolState = determineToolState(input);
  const priority = assessPriority(input, complexity);
  const injectedSkills = detectSkills(input);

  // Determină modul de operare
  let operationMode: OperationMode;
  if (input.isAgentModeEnabled) {
    // Agent Mode forțat din UI
    operationMode = complexity === 'simple' ? 'chat' : 'agent';
  } else {
    // Auto-detect bazat pe complexitate
    operationMode = (complexity === 'complex') ? 'agent' : 'chat';
  }

  // Verifică dacă trebuie clarificare
  const needsClarification = complexity === 'ambiguous';
  let clarificationQuestion: string | undefined;

  if (needsClarification) {
    clarificationQuestion = buildClarificationQuestion(input.currentMessage);
  }

  // Estimare tool calls
  const estimatedToolCalls = estimateToolCalls(complexity, input);

  // Reasoning pentru debug și UI
  const reasoning = buildRoutingReasoning({
    complexity,
    operationMode,
    toolState,
    priority,
    injectedSkills,
    estimatedToolCalls,
  });

  return {
    complexity,
    operationMode,
    toolState,
    priority,
    injectedSkills,
    needsClarification,
    clarificationQuestion,
    reasoning,
    estimatedToolCalls,
  };
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function buildClarificationQuestion(message: string): string {
  // Întrebare generică pentru mesaje ambigue
  const msg = message.trim().toLowerCase();

  if (msg.length < 10) {
    return 'Poți să detaliezi puțin? La ce anume te referi?';
  }

  if (/asta|this|it|acesta/.test(msg)) {
    return 'La ce anume te referi — la ultima pagină, la evenimentul din calendar, sau la altceva?';
  }

  return 'Poți să oferi mai multe detalii despre ce ai nevoie?';
}

function estimateToolCalls(complexity: ComplexityLevel, input: RoutingInput): number {
  switch (complexity) {
    case 'simple': return 0;
    case 'medium': return input.hasWorkspaceFiles ? 2 : 1;
    case 'complex': return input.hasWorkspaceFiles ? 5 : 3;
    case 'ambiguous': return 0;
    default: return 1;
  }
}

function buildRoutingReasoning(decision: Omit<RoutingDecision, 'reasoning' | 'clarificationQuestion' | 'needsClarification'>): string {
  const parts = [
    `Complexity: ${decision.complexity}`,
    `Mode: ${decision.operationMode}`,
    `Tool State: ${decision.toolState}`,
    `Priority: ${decision.priority}`,
    `Skills: ${decision.injectedSkills.length > 0 ? decision.injectedSkills.join(', ') : 'none'}`,
    `Estimated tool calls: ${decision.estimatedToolCalls}`,
  ];
  return parts.join(' · ');
}