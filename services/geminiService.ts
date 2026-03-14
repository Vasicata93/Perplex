

import { GoogleGenAI, Tool, FunctionDeclaration, Type, Content, Modality, ThinkingLevel } from "@google/genai";
import { Message, Role, Citation, Attachment, UserProfile, AiProfile, ModelProvider, LocalModelConfig, ProMode, PendingAction, CalendarEvent } from "../types";
import { memoryManager } from "../memory";
import { TavilyService } from "./tavilyService";
import { db, STORES } from "./db";
import { getHolidays } from "../src/services/holidayService";
import { RAGService } from "./ragService";

// --- Tool Definitions ---

const searchToolGeneric = {
  type: "function",
  function: {
    name: "perform_search",
    description: "Searches the web for real-time information. REQUIRED for current events, news, weather, or specific facts not in your training data.",
    parameters: {
      type: "object",
      properties: {
        query: {
            type: "string",
            description: "The optimal search query to find the information."
        }
      },
      required: ["query"],
      additionalProperties: false
    },
    strict: true
  }
};

const saveToolGeneric = {
    type: "function",
    function: {
        name: "save_to_library",
        description: "CRITICAL: ONLY call this tool if the user explicitly types 'save this', 'create a page', or 'remember this'. DO NOT call this automatically after answering a question or doing research.",
        parameters: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "Title of the page."
                },
                content: {
                    type: "string",
                    description: "Markdown content."
                },
                action: {
                    type: "string",
                    enum: ["create", "update"],
                    description: "Action type."
                }
            },
            required: ["title", "content", "action"],
            additionalProperties: false
        },
        strict: true
    }
};

const saveToolGemini: FunctionDeclaration = {
    name: "save_to_library",
    description: "CRITICAL: ONLY call this tool if the user explicitly types 'save this', 'create a page', or 'remember this'. DO NOT call this automatically after answering a question or doing research.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: {
                type: Type.STRING,
                description: "The title of the page to create or update. If updating, try to match an existing topic."
            },
            content: {
                type: Type.STRING,
                description: "The full markdown content to save."
            },
            action: {
                type: Type.STRING,
                enum: ["create", "update"],
                description: "Whether to create a completely new page or update an existing one."
            }
        },
        required: ["title", "content", "action"]
    }
};

const readFilesToolGemini: FunctionDeclaration = {
    name: "read_workspace_files",
    description: "Reads the full content of specific files from the workspace knowledge base. Use this when you need detailed information from one or more files listed in the context. DO NOT use this if you already have the content.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            filenames: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "The exact names of the files to read as listed in the context."
            }
        },
        required: ["filenames"]
    }
};

const readFilesToolGeneric = {
    type: "function",
    function: {
        name: "read_workspace_files",
        description: "Reads the full content of specific files from the workspace knowledge base. Use this when you need detailed information from one or more files listed in the context. DO NOT use this if you already have the content.",
        parameters: {
            type: "object",
            properties: {
                filenames: {
                    type: "array",
                    items: { type: "string" },
                    description: "The exact names of the files to read as listed in the context."
                }
            },
            required: ["filenames"],
            additionalProperties: false
        },
        strict: true
    }
};

const searchFilesToolGemini: FunctionDeclaration = {
    name: "search_workspace_files",
    description: "Searches for specific keywords, phrases, or synonyms within the workspace knowledge base files. Returns snippets of text containing the matches. Use multiple synonyms to ensure semantic coverage (e.g., ['Steuer', 'Tax ID', 'Fiscal Code']).",
    parameters: {
        type: Type.OBJECT,
        properties: {
            queries: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "A list of keywords or synonyms to search for."
            }
        },
        required: ["queries"]
    }
};

const searchFilesToolGeneric = {
    type: "function",
    function: {
        name: "search_workspace_files",
        description: "Searches for specific keywords, phrases, or synonyms within the workspace knowledge base files. Returns snippets of text containing the matches. Use multiple synonyms to ensure semantic coverage (e.g., ['Steuer', 'Tax ID', 'Fiscal Code']).",
        parameters: {
            type: "object",
            properties: {
                queries: {
                    type: "array",
                    items: { type: "string" },
                    description: "A list of keywords or synonyms to search for."
                }
            },
            required: ["queries"],
            additionalProperties: false
        },
        strict: true
    }
};

const getWorkspaceMapToolGemini: FunctionDeclaration = {
    name: "get_workspace_map",
    description: "Provides a high-level semantic map of the workspace knowledge base. Returns a summary of each file's purpose, main topics, and key entities (names, dates, document types). Use this first to understand where specific information might be located based on context.",
    parameters: {
        type: Type.OBJECT,
        properties: {},
        required: []
    }
};

const getWorkspaceMapToolGeneric = {
    type: "function",
    function: {
        name: "get_workspace_map",
        description: "Provides a high-level semantic map of the workspace knowledge base. Returns a summary of each file's purpose, main topics, and key entities (names, dates, document types). Use this first to understand where specific information might be located based on context.",
        parameters: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: false
        },
        strict: true
    }
};

const semanticSearchToolGemini: FunctionDeclaration = {
    name: "semantic_search_workspace",
    description: "Performs a deep semantic search across the workspace knowledge base. Unlike keyword search, this finds information based on meaning and context. Use this for complex questions where exact keywords might not match (e.g., 'What are my financial obligations?' to find tax documents).",
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: {
                type: Type.STRING,
                description: "The natural language query describing the information you need."
            }
        },
        required: ["query"]
    }
};

const semanticSearchToolGeneric = {
    type: "function",
    function: {
        name: "semantic_search_workspace",
        description: "Performs a deep semantic search across the workspace knowledge base. Unlike keyword search, this finds information based on meaning and context. Use this for complex questions where exact keywords might not match (e.g., 'What are my financial obligations?' to find tax documents).",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The natural language query describing the information you need."
                }
            },
            required: ["query"],
            additionalProperties: false
        },
        strict: true
    }
};

const insertBlockToolGeneric = {
    type: "function",
    function: {
        name: "insert_block",
        description: "Inserts a new content block (paragraph, heading, list item, code block) into a page at a specific position. Use this to add new sections or ideas without rewriting the whole page.",
        parameters: {
            type: "object",
            properties: {
                pageTitle: { type: "string", description: "The exact title of the page to modify." },
                targetBlockId: { type: "string", description: "The ID of the block AFTER which to insert the new content. Use 'start' to insert at the top." },
                content: { type: "string", description: "The text content of the new block." },
                type: { 
                    type: "string", 
                    enum: ["paragraph", "heading_1", "heading_2", "heading_3", "bullet_list", "numbered_list", "todo_list", "code", "quote", "callout", "divider"],
                    description: "The type of block to insert." 
                }
            },
            required: ["pageTitle", "targetBlockId", "content", "type"],
            additionalProperties: false
        },
        strict: true
    }
};

const insertBlockToolGemini: FunctionDeclaration = {
    name: "insert_block",
    description: "Inserts a new content block (paragraph, heading, list item, code block) into a page at a specific position. Use this to add new sections or ideas without rewriting the whole page.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            pageTitle: { type: Type.STRING, description: "The exact title of the page to modify." },
            targetBlockId: { type: Type.STRING, description: "The ID of the block AFTER which to insert the new content. Use 'start' to insert at the top." },
            content: { type: Type.STRING, description: "The text content of the new block." },
            type: { 
                type: Type.STRING, 
                enum: ["paragraph", "heading_1", "heading_2", "heading_3", "bullet_list", "numbered_list", "todo_list", "code", "quote", "callout", "divider"],
                description: "The type of block to insert." 
            }
        },
        required: ["pageTitle", "targetBlockId", "content", "type"]
    }
};

const replaceBlockToolGeneric = {
    type: "function",
    function: {
        name: "replace_block",
        description: "Updates the content of a specific block. Use this to correct typos, update facts, or rewrite a specific paragraph.",
        parameters: {
            type: "object",
            properties: {
                pageTitle: { type: "string", description: "The exact title of the page to modify." },
                blockId: { type: "string", description: "The ID of the block to update." },
                newContent: { type: "string", description: "The new text content for the block." }
            },
            required: ["pageTitle", "blockId", "newContent"],
            additionalProperties: false
        },
        strict: true
    }
};

const replaceBlockToolGemini: FunctionDeclaration = {
    name: "replace_block",
    description: "Updates the content of a specific block. Use this to correct typos, update facts, or rewrite a specific paragraph.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            pageTitle: { type: Type.STRING, description: "The exact title of the page to modify." },
            blockId: { type: Type.STRING, description: "The ID of the block to update." },
            newContent: { type: Type.STRING, description: "The new text content for the block." }
        },
        required: ["pageTitle", "blockId", "newContent"]
    }
};

const deleteBlockToolGeneric = {
    type: "function",
    function: {
        name: "delete_block",
        description: "Removes a specific block from a page. Use this to delete outdated information or empty sections.",
        parameters: {
            type: "object",
            properties: {
                pageTitle: { type: "string", description: "The exact title of the page to modify." },
                blockId: { type: "string", description: "The ID of the block to delete." }
            },
            required: ["pageTitle", "blockId"],
            additionalProperties: false
        },
        strict: true
    }
};

const deleteBlockToolGemini: FunctionDeclaration = {
    name: "delete_block",
    description: "Removes a specific block from a page. Use this to delete outdated information or empty sections.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            pageTitle: { type: Type.STRING, description: "The exact title of the page to modify." },
            blockId: { type: Type.STRING, description: "The ID of the block to delete." }
        },
        required: ["pageTitle", "blockId"]
    }
};

const getPageStructureToolGeneric = {
    type: "function",
    function: {
        name: "get_page_structure",
        description: "Retrieves the structured block representation of a page, including Block IDs. YOU MUST CALL THIS before using insert_block, replace_block, or delete_block to get the correct IDs. Returns a detailed map of the page content.",
        parameters: {
            type: "object",
            properties: {
                pageTitle: { type: "string", description: "The exact title of the page to read." }
            },
            required: ["pageTitle"],
            additionalProperties: false
        },
        strict: true
    }
};

const getPageStructureToolGemini: FunctionDeclaration = {
    name: "get_page_structure",
    description: "Retrieves the structured block representation of a page, including Block IDs. YOU MUST CALL THIS before using insert_block, replace_block, or delete_block to get the correct IDs. Returns a detailed map of the page content.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            pageTitle: { type: Type.STRING, description: "The exact title of the page to read." }
        },
        required: ["pageTitle"]
    }
};

const updateTableToolGeneric = {
    type: "function",
    function: {
        name: "update_table_cell",
        description: "Updates a specific cell in a markdown table within a page. Use this to modify data in tables without rewriting the whole table.",
        parameters: {
            type: "object",
            properties: {
                pageTitle: { type: "string", description: "The exact title of the page containing the table." },
                tableBlockId: { type: "string", description: "The ID of the table block (get this from get_page_structure)." },
                rowIndex: { type: "number", description: "The 0-based index of the row to update (excluding header)." },
                colIndex: { type: "number", description: "The 0-based index of the column to update." },
                newValue: { type: "string", description: "The new value for the cell." }
            },
            required: ["pageTitle", "tableBlockId", "rowIndex", "colIndex", "newValue"],
            additionalProperties: false
        },
        strict: true
    }
};

const updateTableToolGemini: FunctionDeclaration = {
    name: "update_table_cell",
    description: "Updates a specific cell in a markdown table within a page. Use this to modify data in tables without rewriting the whole table.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            pageTitle: { type: Type.STRING, description: "The exact title of the page containing the table." },
            tableBlockId: { type: Type.STRING, description: "The ID of the table block (get this from get_page_structure)." },
            rowIndex: { type: Type.NUMBER, description: "The 0-based index of the row to update (excluding header)." },
            colIndex: { type: Type.NUMBER, description: "The 0-based index of the column to update." },
            newValue: { type: Type.STRING, description: "The new value for the cell." }
        },
        required: ["pageTitle", "tableBlockId", "rowIndex", "colIndex", "newValue"]
    }
};

const getCalendarHolidaysToolGemini: FunctionDeclaration = {
    name: "get_calendar_holidays",
    description: "Get official holidays and non-working days for Romania (RO) and Germany (DE). Use this to check for holidays, religious celebrations, or public non-working days.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            year: { type: Type.NUMBER, description: "The year to get holidays for (e.g., 2024)." }
        },
        required: ["year"]
    }
};

const getCalendarHolidaysToolGeneric = {
    type: "function",
    function: {
        name: "get_calendar_holidays",
        description: "Get official holidays and non-working days for Romania (RO) and Germany (DE). Use this to check for holidays, religious celebrations, or public non-working days.",
        parameters: {
            type: "object",
            properties: {
                year: { type: "number", description: "The year to get holidays for (e.g., 2024)." }
            },
            required: ["year"],
            additionalProperties: false
        },
        strict: true
    }
};

const listCalendarEventsTool: FunctionDeclaration = {
    name: "list_calendar_events",
    description: "List calendar events for a specific date range. Use this to check the user's schedule. REQUIRED before any update/move operation.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            startDate: { type: Type.STRING, description: "Start date in ISO format (YYYY-MM-DD). If checking 'today', use the current date." },
            endDate: { type: Type.STRING, description: "End date in ISO format (YYYY-MM-DD)." }
        },
        required: ["startDate", "endDate"]
    }
};

const addCalendarEventTool: FunctionDeclaration = {
    name: "add_calendar_event",
    description: "Add a new event to the calendar.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "Title of the event." },
            startDate: { type: Type.STRING, description: "Start date/time in ISO 8601 format (YYYY-MM-DDTHH:mm:ss)." },
            endDate: { type: Type.STRING, description: "End date/time in ISO 8601 format (YYYY-MM-DDTHH:mm:ss)." },
            description: { type: Type.STRING, description: "Description of the event." },
            location: { type: Type.STRING, description: "Location of the event." },
            allDay: { type: Type.BOOLEAN, description: "Whether it is an all-day event." }
        },
        required: ["title", "startDate", "endDate"]
    }
};

const updateCalendarEventTool: FunctionDeclaration = {
    name: "update_calendar_event",
    description: "Update an existing calendar event. You MUST provide the event ID retrieved from list_calendar_events.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING, description: "The ID of the event to update." },
            title: { type: Type.STRING, description: "New title." },
            startDate: { type: Type.STRING, description: "New start date/time in ISO 8601 format (YYYY-MM-DDTHH:mm:ss)." },
            endDate: { type: Type.STRING, description: "New end date/time in ISO 8601 format (YYYY-MM-DDTHH:mm:ss)." },
            description: { type: Type.STRING, description: "New description." },
            location: { type: Type.STRING, description: "New location." }
        },
        required: ["id"]
    }
};

const deleteCalendarEventTool: FunctionDeclaration = {
    name: "delete_calendar_event",
    description: "Delete a calendar event.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING, description: "The ID of the event to delete." }
        },
        required: ["id"]
    }
};

// --- Generic Calendar Tools ---

const listCalendarEventsToolGeneric = {
    type: "function",
    function: {
        name: "list_calendar_events",
        description: "List calendar events for a specific date range. Use this to check the user's schedule.",
        parameters: {
            type: "object",
            properties: {
                startDate: { type: "string", description: "Start date in ISO format (YYYY-MM-DD)." },
                endDate: { type: "string", description: "End date in ISO format (YYYY-MM-DD)." }
            },
            required: ["startDate", "endDate"],
            additionalProperties: false
        },
        strict: true
    }
};

const addCalendarEventToolGeneric = {
    type: "function",
    function: {
        name: "add_calendar_event",
        description: "Add a new event to the calendar.",
        parameters: {
            type: "object",
            properties: {
                title: { type: "string", description: "Title of the event." },
                startDate: { type: "string", description: "Start date/time in ISO format." },
                endDate: { type: "string", description: "End date/time in ISO format." },
                description: { type: "string", description: "Description of the event." },
                location: { type: "string", description: "Location of the event." },
                allDay: { type: "boolean", description: "Whether it is an all-day event." }
            },
            required: ["title", "startDate", "endDate"],
            additionalProperties: false
        },
        strict: true
    }
};

const updateCalendarEventToolGeneric = {
    type: "function",
    function: {
        name: "update_calendar_event",
        description: "Update an existing calendar event.",
        parameters: {
            type: "object",
            properties: {
                id: { type: "string", description: "The ID of the event to update." },
                title: { type: "string", description: "New title." },
                startDate: { type: "string", description: "New start date/time." },
                endDate: { type: "string", description: "New end date/time." },
                description: { type: "string", description: "New description." },
                location: { type: "string", description: "New location." }
            },
            required: ["id"],
            additionalProperties: false
        },
        strict: true
    }
};

const deleteCalendarEventToolGeneric = {
    type: "function",
    function: {
        name: "delete_calendar_event",
        description: "Delete a calendar event.",
        parameters: {
            type: "object",
            properties: {
                id: { type: "string", description: "The ID of the event to delete." }
            },
            required: ["id"],
            additionalProperties: false
        },
        strict: true
    }
};

const getCurrentTimeToolGeneric = {
    type: "function",
    function: {
        name: "get_current_time",
        description: "Get the current system date and time. Use this to orient yourself temporally before checking the calendar.",
        parameters: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: false
        },
        strict: true
    }
};

const getCurrentTimeToolGemini: FunctionDeclaration = {
    name: "get_current_time",
    description: "Get the current system date and time. Use this to orient yourself temporally before checking the calendar.",
    parameters: {
        type: Type.OBJECT,
        properties: {},
        required: []
    }
};

import { BlockService } from "./blockService";

export class LLMService {
  private ai: GoogleGenAI | null = null;
  private apiKey: string | undefined;
  
  // Track listeners for "learning" state (brain pulse in UI)
  private learningListeners: ((isLearning: boolean) => void)[] = [];

  // Virtual Knowledge Base for Tool-based Retrieval
  private workspaceFiles: Attachment[] = [];

  // Models that support internal reasoning via OpenRouter
  private static readonly OPENROUTER_REASONING_MODELS = [
    'deepseek-r1',
    'deepseek-r1-0528',
    'deepseek-v3.2',
    'deepseek-v3.2-exp',
    'deepseek-v3.2-speciale',
    'deepseek-v3.1-terminus',
    'deepseek-v3.1',
    'qwen/qwq-32b',
    'qwen/qwen3-235b-a22b',
    'qwen/qwen3-30b-a3b',
    'qwen/qwen3-14b',
    'qwen/qwen3-8b',
    'qwen/qwen3-max-thinking',
    'claude-3.7-sonnet:thinking',
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-pro-preview',
    'gemini-2.5-flash',
    'grok-4-1',
    'grok-4-1-fast',
    'minimax-m2.5',
    'minimax-m1',
    'glm-4-7',
    'magistral-medium',
    'magistral-small'
  ];

  constructor() {
    this.apiKey = process.env.API_KEY;
    if (this.apiKey) {
        try {
            this.ai = new GoogleGenAI({ apiKey: this.apiKey });
        } catch (e) {
            console.error("Failed to initialize GoogleGenAI client:", e);
        }
    }
  }

  // --- Observer for UI ---
  public subscribeToLearningState(callback: (isLearning: boolean) => void) {
      this.learningListeners.push(callback);
  }

  private notifyLearningState(isLearning: boolean) {
      this.learningListeners.forEach(cb => cb(isLearning));
  }

  private abortController: AbortController | null = null;

  public stopGeneration() {
      if (this.abortController) {
          this.abortController.abort();
          this.abortController = null;
      }
  }

  private async triggerMemoryConsolidation(prompt: string, responseText: string, enableMemory: boolean, geminiApiKey?: string) {
      if (enableMemory) {
          await memoryManager.processNewMessage({ id: crypto.randomUUID(), role: Role.MODEL, content: responseText, timestamp: Date.now() }, 'current_session');
          const buffer = memoryManager.workingMemory.getMessages();
          const shouldConsolidate = buffer.length >= 5 || prompt.toLowerCase().includes("remember this") || prompt.toLowerCase().includes("salvează");
          if (shouldConsolidate) {
              this.runConsolidation(geminiApiKey);
          }
      }
  }

  /**
   * Orchestrator function that implements the 3-stage agent architecture
   */
  async generateResponse(
      history: Message[],
      prompt: string,
      attachments: Attachment[],
      provider: ModelProvider,
      openRouterKey: string,
      openRouterModel: string,
      openAiKey: string, 
      openAiModel: string,
      activeLocalModel: LocalModelConfig | undefined,
      useSearch: boolean,
      proMode: ProMode,
      enableMemory: boolean,
      userProfile: UserProfile,
      aiProfile: AiProfile,
      spaceSystemInstruction?: string,
      tavilyApiKey?: string, 
      geminiApiKey?: string,
      searchProvider: 'tavily' | 'brave' = 'tavily',
      braveApiKey?: string,
      onChunk?: (text: string, reasoning?: string) => void,
      useAgenticResearch: boolean = false
  ): Promise<{ text: string; citations: Citation[]; relatedQuestions: string[]; pendingAction?: PendingAction; reasoning?: string }> {
      
      this.abortController = new AbortController();
      const shortTermHistory = history.slice(-5); // 5 messages short-term memory

      if (enableMemory) {
          await memoryManager.processNewMessage({ id: crypto.randomUUID(), role: Role.USER, content: prompt, timestamp: Date.now() }, 'current_session');
      }

      let accumulatedReasoning = "";
      const customOnChunk = (text: string, reasoning?: string) => {
          if (reasoning) accumulatedReasoning += reasoning;
          if (onChunk) onChunk(text, reasoning);
      };

      // If Agentic Research is disabled, bypass the planner and execute directly
      if (!useAgenticResearch) {
          if (onChunk) customOnChunk("", "⚡ Mod Chat Simplu (Fără etape)...\n");
          const result = await this.runCoreGeneration(shortTermHistory, prompt, attachments, provider, openRouterKey, openRouterModel, openAiKey, openAiModel, activeLocalModel, useSearch, proMode, enableMemory, userProfile, aiProfile, spaceSystemInstruction, tavilyApiKey, geminiApiKey, searchProvider, braveApiKey, customOnChunk);
          this.triggerMemoryConsolidation(prompt, result.text, enableMemory, geminiApiKey);
          result.reasoning = accumulatedReasoning + (result.reasoning || "");
          return result;
      }

      const now = new Date();
      const timeStr = now.toLocaleString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          timeZoneName: 'short'
      });

      const agentSystemPrompt = `CURRENT SYSTEM TIME: ${timeStr}

You are an advanced reasoning agent. You MUST execute all 7 stages below internally.
If you have a native 'thought' or 'reasoning' capability (like Gemini 3.1 Pro), use it for Stages 0-5.
If you do NOT have a native reasoning capability, you MUST wrap your internal thoughts for Stages 0-5 inside <thinking>...</thinking> tags.

The final synthesized response from Stage 6 MUST be provided as your final output text, OUTSIDE of any thinking or reasoning block. Never show the stage names, numbers, or internal process to the user in the final text.

You operate as a single agent that can:
- Plan multi-step work,
- Call tools when needed,
- Reflect on its own reasoning,
- Verify information against multiple sources,
- Synthesize clear, structured answers.

--------------------------------
STAGE 0 — ROUTER (MODE SELECTION)
--------------------------------
Before doing anything else, classify the user request into ONE of these modes:

1) DIRECT REPLY
   - Use this only when:
     - The user greets you, thanks you, or asks for a simple confirmation.
     - The answer is fully determined by the current conversation context or your system instructions.
   - If classified as DIRECT REPLY:
     - Skip Stages 1–5.
     - Go directly to Stage 6 and produce a concise answer.
     - Do NOT call any tools unless the user explicitly asks for a side-effect (e.g., “create event”, “save note”).

2) STANDARD
   - Use this when:
     - The request has a clear, narrow scope.
     - It can be solved with 0–3 simple tool calls and minimal research.
     - Examples: basic factual lookups, simple calendar operations, small document edits.

3) DEEP RESEARCH
   - Use this when:
     - The task involves multi-source research, financial/crypto/stock data, complex comparisons, or open-ended analysis.
     - The answer requires combining several pieces of evidence or tools.
   - Whenever you are unsure between STANDARD and DEEP RESEARCH, ALWAYS choose DEEP RESEARCH.

Internally record:
- The selected mode (DIRECT REPLY / STANDARD / DEEP RESEARCH).
- A one-sentence justification for the selected mode.

Do NOT expose this classification to the user.

--------------------------------
STAGE 1 — MEMORY AND CONTEXT SCAN
--------------------------------
Before calling any external tool:

1) Scan persistent memory (if available):
   - Retrieve known preferences, past decisions, ongoing projects, or user configurations that are relevant to this request.
   - Prefer specific, recent, and task-related memories over generic history.

2) Scan recent conversation context:
   - Identify prior messages that define:
     - Current topic,
     - Constraints (budget, time, risk level, tools allowed),
     - Partial answers or previous attempts for the same task.

3) Decide what you ALREADY know:
   - Identify facts from memory and context that directly help answer the question.
   - Note explicitly (internally) which parts of the task you can solve without any new tool calls.

Internally produce:
- A short internal summary:
  - What is already known (from memory/context),
  - What is still missing and will require tools or external search.

Do NOT show this summary to the user.

--------------------------------
STAGE 2 — INTENT DECOMPOSITION
--------------------------------
Separate what the user wrote from what the user actually needs.

1) Explicit intent:
   - Restate (internally) the literal request in one or two clear sentences.

2) Implicit intent:
   - Infer the underlying goal or “why” behind the request.
   - Consider:
     - Is the user trying to decide, to compare, to learn basics, or to optimize something?
     - Are they more likely to care about safety, speed, cost, accuracy, or simplicity?

3) Task decomposition:
   - Break the request into all sub-questions and sub-tasks required for a complete answer.
   - For analytical or financial requests, think in terms of:
     - Data you must fetch (prices, volumes, fundamentals, news, regulations, etc.),
     - Transformations you must perform (comparisons, ratios, scenarios),
     - Judgments you must make (risks, trade-offs, recommendations),
     - Explanations needed for a non-expert user.

4) Definition of “done”:
   - Write internally a checklist of what the final response MUST include to fully satisfy the user.
   - This checklist will be used again in Stage 5 to verify completeness.

Do NOT reveal this decomposition or checklist to the user.

-----------------------------------------------
STAGE 3 — DOMAIN CLASSIFICATION AND TOOL PLANNING
-----------------------------------------------
Decide which domains and tools are relevant and plan the route.

1) Domain classification:
   - Classify the request into one or more domains such as:
     - General knowledge / web search,
     - Financial & markets (stocks, crypto, macro),
     - Calendars & scheduling,
     - Notes, documents, and workspace edits,
     - Code / data analysis,
     - Other specialized tools available in your environment.

2) Minimal tool set:
   - Select ONLY the tools that are actually needed to satisfy the checklist from Stage 2.
   - Avoid “tool bloat”: do not load or call irrelevant tools.

3) Plan the sequence:
   - Design an ordered action plan, for example:
     - Step A: Quick web or data lookup to get core facts.
     - Step B: Follow-up search for missing pieces or conflicting information.
     - Step C: Optional deeper research (e.g., news, reports, documentation).
   - Specify which steps:
     - Must happen first,
     - Can run in parallel,
     - Are optional fallbacks if a main step fails.

4) Effort scaling:
   - For STANDARD mode:
     - Keep the number of tool calls low and focused.
   - For DEEP RESEARCH mode:
     - Allow more extensive tool usage,
     - But still favor high-quality, diverse sources over brute-force calls.

Internally produce:
- A brief step-by-step plan listing:
  - Which tools to call,
  - In what order,
  - For what specific sub-questions.

Do NOT execute tools in this stage. Planning only.

------------------------
STAGE 4 — EXECUTION LOOP
------------------------
Execute the plan from Stage 3 as faithfully as possible.

1) Follow the planned order:
   - Call tools in the planned sequence.
   - Where the plan allows, parallelize independent steps, but keep the logic consistent with the plan.

2) Collect results without concluding:
   - For each tool call, store:
     - Raw result,
     - Its source (URL, dataset, system),
     - How it connects to the sub-question it was meant to answer.

3) Adaptive fallback:
   - If a tool fails, is unavailable, or returns clearly insufficient data:
     - Decide immediately whether the missing information is critical.
     - If critical:
       - Attempt ONE reasonable fallback (alternative tool, different query, different data source).
     - If fallback also fails:
       - Mark that specific gap for Stage 5 as “unresolved”.

4) Avoid over-searching:
   - Stop additional tool calls once:
     - All items in the Stage 2 checklist are satisfied with adequate evidence,
     - Or it becomes clear that some items cannot be resolved with available tools.

Internally produce:
- A structured set of findings:
  - For each sub-question:
    - What you found,
    - From which sources,
    - Where information is missing or uncertain.

Do NOT start writing the user-facing answer yet.

---------------------------------
STAGE 5 — VERIFICATION AND CONFIDENCE
---------------------------------
Check your work against the intent and evidence.

1) Completeness check:
   - Compare the findings from Stage 4 against the Stage 2 checklist.
   - Mark each item as:
     - Fully covered,
     - Partially covered,
     - Not covered (with reason).

2) Consistency and conflict resolution:
   - Look for contradictions between sources.
   - If two sources disagree:
     - Prefer more authoritative, recent, or primary sources (e.g., official docs, recognized institutions) over weaker ones.
     - If conflict cannot be resolved, treat that part as uncertain.

3) Confidence assessment:
   - Assign an internal confidence level to your overall answer:
     - HIGH: Data is recent enough, cross-checked, and consistent.
     - MEDIUM: Some parts rely on limited or indirect evidence.
     - LOW: Important pieces are missing or conflicting.

4) Extra search (optional):
   - If confidence is MEDIUM or LOW and a single focused search is likely to resolve the doubt:
     - Perform ONE additional targeted search/tool call now.
     - Update the confidence level if appropriate.

5) Transparency rule:
   - If confidence is LOW on any critical data (especially financial, legal, medical, or safety-related):
     - You MUST mention this limitation explicitly in the final answer in Stage 6.

Internally produce:
- A short diagnostic note:
  - Main strengths of your evidence,
  - Main gaps or uncertainties,
  - Final confidence level.

------------------------------------
STAGE 6 — CALIBRATION AND SYNTHESIS
------------------------------------
Now you MUST write the final answer for the user. This content MUST be outside of any thinking block.

1) Choose response format:
   - Simple confirmations (DIRECT REPLY):
     - Give a short, direct answer.
   - Analytical or research answers:
     - Use clear headings, short paragraphs, and bullet points where useful.
     - Present numbers, dates, and key facts clearly and with their sources when relevant.

2) Synthesize, don’t dump:
   - Distill the information into:
     - Direct answers to the explicit question,
     - Context and reasoning at the right level of detail for a non-expert user,
     - Concrete, actionable recommendations or next steps where appropriate.
   - Do NOT paste raw tool outputs.
   - Do NOT expose your internal notes, plans, or stage descriptions.

3) Source and time awareness:
   - For factual or financial data, mention:
     - The type of source (e.g., official docs, major news outlet, exchange API),
     - The approximate recency of the data (e.g., “as of March 2026”),
     - Any major limitations discovered in Stage 5.

4) User alignment:
   - Respect any user-stated constraints (budget, risk level, time horizon).
   - If the user’s request conflicts with safety, law, or platform policies:
     - Provide a safe alternative or partial answer rather than refusing without explanation.

5) Follow-up questions:
   - At the very end of your response, propose exactly THREE useful follow-up questions that could help the user go deeper or clarify next steps.
   - Output these three follow-up questions as a JSON array inside a Markdown code block, for example:
     \`\`\`json
     [
       "Example follow-up question 1?",
       "Example follow-up question 2?",
       "Example follow-up question 3?"
     ]
     \`\`\`

Important Rules for Tool Execution and Multi-Turn:
- If you need to call a tool, do so during Stage 4.
- When you receive the tool's result in the next turn, DO NOT restart from Stage 0. You are still in Stage 4.
- Evaluate the tool results. If you have enough information to answer the user's request, proceed IMMEDIATELY to Stage 5 (Verification) and Stage 6 (Synthesis).
- Do NOT repeat the planning stages (0, 1, 2, 3) once you have started executing tools.

Important Formatting Rules:
- Never mention the existence of these stages.
- Never show internal thoughts, checklists, or confidence scores in the final text.
- The user should only see the final, polished answer and the JSON array of follow-up questions.
- YOUR FINAL ANSWER MUST BE OUTSIDE OF ANY <thinking> OR <thought> TAGS.`;

      const result = await this.runCoreGeneration(
          shortTermHistory, 
          prompt, 
          attachments, 
          provider, 
          openRouterKey, 
          openRouterModel, 
          openAiKey, 
          openAiModel, 
          activeLocalModel, 
          true, // useSearch
          proMode, 
          enableMemory, 
          userProfile, 
          aiProfile, 
          spaceSystemInstruction, 
          tavilyApiKey, 
          geminiApiKey, 
          searchProvider, 
          braveApiKey, 
          customOnChunk, 
          agentSystemPrompt
      );

      this.triggerMemoryConsolidation(prompt, result.text, enableMemory, geminiApiKey);
      result.reasoning = accumulatedReasoning + (result.reasoning || "");
      
      return result;
  }

  /**
   * Internal generation function that routes to the correct provider
   */
  async runCoreGeneration(
    history: Message[],
    prompt: string,
    attachments: Attachment[],
    provider: ModelProvider,
    openRouterKey: string,
    openRouterModel: string,
    openAiKey: string, 
    openAiModel: string,
    activeLocalModel: LocalModelConfig | undefined,
    useSearch: boolean,
    proMode: ProMode,
    enableMemory: boolean,
    userProfile: UserProfile,
    aiProfile: AiProfile,
    spaceSystemInstruction?: string,
    tavilyApiKey?: string, 
    geminiApiKey?: string,
    searchProvider: 'tavily' | 'brave' = 'tavily',
    braveApiKey?: string,
    onChunk?: (text: string, reasoning?: string) => void,
    systemInstructionOverride?: string
  ): Promise<{ text: string; citations: Citation[]; relatedQuestions: string[]; pendingAction?: PendingAction; reasoning?: string }> {
    
    // Reset AbortController
    this.abortController = new AbortController();

    // 1. Add User Observation to Buffer
    if (enableMemory) {
        await memoryManager.processNewMessage({ id: crypto.randomUUID(), role: Role.USER, content: prompt, timestamp: Date.now() }, 'current_session');
    }

    // 2. Determine System Logic based on ProMode
    let modeInstruction = "";
    let forceReasoning = false;
    let forceSearch = useSearch;

    switch (proMode) {
        case ProMode.STANDARD:
            break;
        case ProMode.REASONING:
            forceReasoning = true;
            modeInstruction = "You are in DEEP REASONING mode. Think deeply, analyze the problem step-by-step before answering.";
            break;
        case ProMode.THINKING:
            forceReasoning = true; 
            modeInstruction = "You are in THINKING mode. Break down the user's query into logical components.";
            break;
        case ProMode.RESEARCH:
            forceSearch = true;
            modeInstruction = "You are in RESEARCH mode. Provide a highly detailed report with extensive citations.";
            break;
        case ProMode.LEARNING:
            modeInstruction = "You are in LEARNING mode. Act as a Socratic tutor. Guide the user.";
            break;
        case ProMode.SHOPPING:
            forceSearch = true;
            modeInstruction = "You are in SHOPPING RESEARCH mode. Find products, compare prices, and look for reviews.";
            break;
    }

    // 3. Build the System Context (Used by all providers)
    // We pass the provider type so we can inject specific instructions (like <thinking> tags for Generic models)
    
    // --- SMART CONTEXT RETRIEVAL: Handle large workspace files ---
    const MAX_DIRECT_FILES = 3;
    const MAX_DIRECT_SIZE = 15000; // characters
    
    let directAttachments = [...attachments];
    let virtualFiles: Attachment[] = [];
    let kbSummary = "";

    // Identify text files that are part of the workspace
    const textFiles = attachments.filter(a => a.type === 'text');
    
    // Always populate workspaceFiles for tool usage, even if they are also in direct context
    this.workspaceFiles = textFiles;

    const totalSize = textFiles.reduce((sum, a) => sum + (a.content?.length || 0), 0);

    if (textFiles.length > MAX_DIRECT_FILES || totalSize > MAX_DIRECT_SIZE) {
        // Move large/many files to virtual storage
        virtualFiles = textFiles;
        
        // Keep only images and non-text attachments in direct
        directAttachments = attachments.filter(a => a.type !== 'text');
        
        // Build a summary for the model
        kbSummary = "\n\n**AVAILABLE WORKSPACE FILES (Knowledge Base):**\n";
        virtualFiles.forEach(f => {
            const sizeKb = Math.round((f.content?.length || 0) / 1024);
            kbSummary += `- ${f.name} (${sizeKb} KB)\n`;
        });
        kbSummary += "\n**IMPORTANT:** The full content of these files is NOT currently in your context to save tokens. If you need to read a specific file to answer the user's question accurately, you **MUST** use the `read_workspace_files` tool. Do not guess the content.";
    } else {
        // Keep files in direct context, but also available in workspaceFiles for tools
    }

    const systemInstruction = await this.buildSystemContext(
        prompt, 
        (systemInstructionOverride ? systemInstructionOverride + "\n\n" : "") + modeInstruction + kbSummary,
        enableMemory, 
        userProfile, 
        aiProfile, 
        spaceSystemInstruction,
        provider === ModelProvider.GEMINI ? false : forceReasoning, // Only force XML thinking for non-Gemini
        provider !== ModelProvider.GEMINI && (forceSearch || virtualFiles.length > 0) // Force explicit tool instruction for generics
    );

    let result: { text: string; citations: Citation[]; relatedQuestions: string[]; pendingAction?: PendingAction; reasoning?: string } = { text: "", citations: [] as Citation[], relatedQuestions: [] as string[] };

    // 4. Route to Provider
    if (provider === ModelProvider.GEMINI) {
        result = await this.generateGeminiResponse(
            history,
            prompt, 
            directAttachments, 
            forceSearch, 
            forceReasoning, 
            proMode,
            enableMemory, 
            systemInstruction,
            geminiApiKey,
            onChunk,
            virtualFiles.length > 0 // Enable readFiles tool
        );
    } else {
        // Generic Providers (OpenAI, OpenRouter, Local)
        let endpoint = "";
        let apiKey = "";
        let modelName = "";

        if (provider === ModelProvider.OPENAI) {
            endpoint = "https://api.openai.com/v1/chat/completions";
            apiKey = openAiKey;
            modelName = openAiModel || "gpt-4o"; 
        } else if (provider === ModelProvider.OPENROUTER) {
            endpoint = "https://openrouter.ai/api/v1/chat/completions";
            apiKey = openRouterKey;
            modelName = openRouterModel || "openai/gpt-4o"; 
        } else {
            if (!activeLocalModel) throw new Error("No local model configured.");
            // Default to standard Ollama port if not specified
            endpoint = "http://localhost:11434/v1/chat/completions";
            modelName = activeLocalModel.modelId;
            apiKey = "not-needed"; 
        }

        // Determine correct search key
        const activeSearchKey = searchProvider === 'brave' ? braveApiKey : tavilyApiKey;

        result = await this.generateGenericResponse(
            history,
            prompt,
            directAttachments,
            endpoint,
            apiKey,
            modelName,
            systemInstruction,
            enableMemory,
            forceSearch,
            searchProvider,
            activeSearchKey,
            onChunk,
            virtualFiles.length > 0, // Enable readFiles tool
            proMode
        );
    }

    return result;
  }

  // --- Helper: Extract JSON content ---
  private extractJson(text: string): any {
    try {
        return JSON.parse(text);
    } catch (e) {
        let clean = text.trim();
        clean = clean.replace(/^```[a-z]*\s*/i, '');
        clean = clean.replace(/\s*```$/, '');
        try { 
          return JSON.parse(clean); 
        } catch (e2) {
           const firstOpen = text.indexOf('{');
           const lastClose = text.lastIndexOf('}');
           if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
               const candidate = text.substring(firstOpen, lastClose + 1);
               try { return JSON.parse(candidate); } catch (e3) {}
           }
           throw e;
        }
    }
  }

  // --- Helper: Extract Related Questions ---
  private extractRelatedQuestions(text: string): { cleanText: string, questions: string[] } {
      const jsonBlockRegex = /```json\s*(\[\s*".*?"\s*(?:,\s*".*?"\s*)*\])\s*```$/s;
      const match = text.match(jsonBlockRegex);
      let questions: string[] = [];
      let cleanText = text;

      if (match) {
          try {
              questions = JSON.parse(match[1]);
              cleanText = text.replace(match[0], '').trim();
          } catch (e) {
              // Failed to parse
          }
      }
      return { cleanText, questions };
  }

  // --- Helper: Extract XML Reasoning (For Generic Models) ---
  private extractXmlThinking(text: string): { cleanText: string, reasoning?: string } {
      const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/i;
      const match = text.match(thinkingRegex);
      
      if (match && match[1]) {
          const reasoning = match[1].trim();
          const cleanText = text.replace(thinkingRegex, '').trim();
          return { cleanText, reasoning };
      }
      
      return { cleanText: text };
  }

  // --- Synthesis Engine (Consolidation) ---
  private async runConsolidation(customApiKey?: string) {
      console.log("[Memory] Starting Consolidation...");
      this.notifyLearningState(true);
      
      try {
        const buffer = memoryManager.workingMemory.getMessages();
        if (buffer.length === 0) return;

        let clientToUse = this.ai;
        if (customApiKey) {
            try { clientToUse = new GoogleGenAI({ apiKey: customApiKey }); } catch(e) {}
        }
        if (!clientToUse) return;

        const currentMemories = memoryManager.semanticMemory.getAllEntries();
        const currentProjects = await db.get<any[]>(STORES.PROJECTS, 'all') || [];

        const consolidationPrompt = `
        You are the Memory Manager. Your goal is to keep the Long-Term Memory clean, concise, and useful.
        
        RULES:
        1. IGNORE casual conversation, greetings, simple questions, and transient thoughts.
        2. ONLY extract *permanent* facts: User preferences, specific project details/status, learned skills, or important life events.
        3. DO NOT save "User asked about..." or "User wants to know...". Save the underlying interest ONLY if it seems like a long-term hobby/goal.
        4. If the buffer contains only noise, return empty arrays.
        
        BUFFER (Recent Conversation):
        ${buffer.map(b => `${b.role.toUpperCase()}: ${b.content}`).join('\n')}

        EXISTING CONTEXT (Do not duplicate these):
        - Projects: ${currentProjects.map(p => p.title).join(', ')}
        - Facts: ${currentMemories.slice(0, 20).map(m => m.content).join(', ')}...

        Return JSON ONLY:
        {
            "new_facts": [{ "category": "string", "content": "string", "type": "fact|goal" }],
            "new_skills": ["string"],
            "project_updates": [{ "title": "string", "status": "active|completed", "progress": "string", "nextStep": "string", "techStack": ["string"] }]
        }
        `;

        const response = await clientToUse.models.generateContent({
            model: "gemini-3-flash-preview", 
            contents: [{ parts: [{ text: consolidationPrompt }] }],
            config: { responseMimeType: "application/json" }
        });

        let jsonText = "";
        try {
            jsonText = response.text || "";
        } catch (e) {
            // Fallback if text getter fails (e.g. mixed content warning)
            if (response.candidates?.[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.text) jsonText += part.text;
                }
            }
        }
        
        if (jsonText) {
            try {
                const updates = this.extractJson(jsonText);
                // memoryManager.memoryConsolidation.runConsolidation(); // Not exactly the same, but we can skip this or implement a custom update logic if needed. For now, let's just use the new manager.
                // The new memory system handles consolidation automatically based on message count.
                // If we need to explicitly save new facts from the LLM response:
                if (updates.new_facts && Array.isArray(updates.new_facts)) {
                    for (const fact of updates.new_facts) {
                        await memoryManager.saveExplicitMemory(fact.content, fact.category || 'other');
                    }
                }
                // Projects update
                if (updates.project_updates && Array.isArray(updates.project_updates)) {
                    const projects = await db.get<any[]>(STORES.PROJECTS, 'all') || [];
                    updates.project_updates.forEach((update: any) => {
                        const existing = projects.find(p => p.title.toLowerCase() === update.title.toLowerCase());
                        if (existing) {
                            if (update.progress) existing.progress = update.progress;
                            if (update.nextStep) existing.nextStep = update.nextStep;
                            if (update.status) existing.status = update.status;
                            existing.lastUpdated = Date.now();
                        } else {
                            projects.push({
                                id: crypto.randomUUID(),
                                title: update.title,
                                status: update.status || 'active',
                                progress: update.progress || 'Started',
                                nextStep: update.nextStep || 'Planning',
                                techStack: update.techStack || [],
                                lastUpdated: Date.now()
                            });
                        }
                    });
                    await db.set(STORES.PROJECTS, 'all', projects);
                }
                // Skills update
                if (updates.new_skills && Array.isArray(updates.new_skills)) {
                    for (const skill of updates.new_skills) {
                        await memoryManager.saveExplicitMemory(skill, 'skills' as any);
                    }
                }
            } catch (jsonError) {
                console.error("[Memory] JSON Parse failed during consolidation");
            }
        }

      } catch (e) {
          console.error("[Memory] Consolidation failed", e);
      } finally {
          this.notifyLearningState(false);
      }
  }

  // --- Gemini Implementation ---
  private async generateGeminiResponse(
    history: Message[],
    prompt: string,
    attachments: Attachment[],
    useSearch: boolean,
    enableReasoning: boolean,
    proMode: ProMode,
    _enableMemory: boolean,
    systemInstruction: string,
    customApiKey?: string,
    onChunk?: (text: string, reasoning?: string) => void,
    useReadFiles: boolean = false
  ): Promise<{ text: string; citations: Citation[]; relatedQuestions: string[]; pendingAction?: PendingAction; reasoning?: string }> {
    
    let clientToUse = this.ai;
    if (customApiKey) {
        try {
            clientToUse = new GoogleGenAI({ apiKey: customApiKey });
        } catch (e) {
            return { text: "Error: Invalid Gemini API Key.", citations: [], relatedQuestions: [] };
        }
    }

    if (!clientToUse) {
        return { text: "Eroare: API Key pentru Gemini nu este configurat.", citations: [], relatedQuestions: [] };
    }

    const modelId = (enableReasoning || proMode === ProMode.REASONING || proMode === ProMode.THINKING) 
        ? "gemini-3.1-pro-preview" 
        : "gemini-3-flash-preview"; 

    const tools: Tool[] = [];
    if (useSearch) {
        tools.push({ googleSearch: {} });
    }
    tools.push({ functionDeclarations: [saveToolGemini, insertBlockToolGemini, replaceBlockToolGemini, deleteBlockToolGemini, getPageStructureToolGemini, updateTableToolGemini, listCalendarEventsTool, addCalendarEventTool, updateCalendarEventTool, deleteCalendarEventTool, getCurrentTimeToolGemini, getCalendarHolidaysToolGemini] });
    if (useReadFiles) {
        tools.push({ functionDeclarations: [readFilesToolGemini, searchFilesToolGemini, getWorkspaceMapToolGemini, semanticSearchToolGemini] });
    }

    let thinkingConfig = undefined;
    if (enableReasoning || proMode === ProMode.REASONING || proMode === ProMode.THINKING) {
        thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH }; 
    } 

    const geminiHistory: Content[] = history.map(msg => {
        const parts: any[] = [{ text: msg.content }];
        if (msg.attachments && msg.attachments.length > 0) {
            msg.attachments.forEach(att => {
                if (att.type === 'image') {
                    const cleanBase64 = att.content.split(',')[1] || att.content;
                    parts.push({ inlineData: { mimeType: att.mimeType, data: cleanBase64 } });
                }
            });
        }
        return {
            role: msg.role === Role.USER ? 'user' : 'model',
            parts: parts
        };
    });

    const currentParts: any[] = [{ text: prompt }];
    if (attachments && attachments.length > 0) {
        attachments.forEach(att => {
            if (att.type === 'image') {
                const cleanBase64 = att.content.split(',')[1] || att.content;
                currentParts.push({ inlineData: { mimeType: att.mimeType, data: cleanBase64 } });
            } else if (att.type === 'text') {
                currentParts.push({ text: `\n[Attached File: ${att.name}]\n${att.content}\n` });
            }
        });
    }

    try {
        const chat = clientToUse.chats.create({
            model: modelId,
            history: geminiHistory,
            config: {
                tools: tools,
                thinkingConfig: thinkingConfig,
                systemInstruction: systemInstruction,
            }
        });
        
        let finalResponseText = "";
        let citations: Citation[] = [];
        let pendingAction: PendingAction | undefined = undefined;
        let reasoning = "";
        let turns = 0;
        const maxTurns = 5;
        let currentMessage: any = currentParts;
        let isThinking = false;

        while (turns < maxTurns) {
            const result = await chat.sendMessageStream({ message: currentMessage });
            let turnText = "";
            let functionCalls: any[] = [];

            for await (const chunk of result) {
                if (this.abortController?.signal.aborted) break;

                // Extract Function Calls
                const fc = chunk.functionCalls;
                if (fc && fc.length > 0) functionCalls = [...functionCalls, ...fc];

                // Extract Text and Reasoning
                let text = "";
                if (chunk.candidates?.[0]?.content?.parts) {
                    for (const part of chunk.candidates[0].content.parts) {
                        if (part.text) {
                            text += part.text;
                        }
                        // Handle Gemini 2.0/3.0 Thinking models
                        if ((part as any).thought) {
                            const thought = (part as any).thought;
                            reasoning += thought;
                            if (onChunk) onChunk("", thought);
                        }
                    }
                }

                if (text) {
                    turnText += text;
                    
                    let remainingText = text;
                    while (remainingText.length > 0) {
                        if (!isThinking) {
                            const startThinking = remainingText.indexOf('<thinking>');
                            const startThought = remainingText.indexOf('<thought>');
                            
                            // Find the earliest start tag
                            let startIndex = -1;
                            let tagLength = 0;
                            
                            if (startThinking !== -1 && (startThought === -1 || startThinking < startThought)) {
                                startIndex = startThinking;
                                tagLength = 10; // '<thinking>'.length
                            } else if (startThought !== -1) {
                                startIndex = startThought;
                                tagLength = 9; // '<thought>'.length
                            }

                            if (startIndex !== -1) {
                                const before = remainingText.substring(0, startIndex);
                                if (before) {
                                    finalResponseText += before;
                                    if (onChunk) onChunk(before, undefined);
                                }
                                isThinking = true;
                                remainingText = remainingText.substring(startIndex + tagLength);
                            } else {
                                finalResponseText += remainingText;
                                if (onChunk) onChunk(remainingText, undefined);
                                remainingText = "";
                            }
                        } else {
                            const endThinking = remainingText.indexOf('</thinking>');
                            const endThought = remainingText.indexOf('</thought>');
                            
                            // Find the earliest end tag
                            let endIndex = -1;
                            let tagLength = 0;
                            
                            if (endThinking !== -1 && (endThought === -1 || endThinking < endThought)) {
                                endIndex = endThinking;
                                tagLength = 11; // '</thinking>'.length
                            } else if (endThought !== -1) {
                                endIndex = endThought;
                                tagLength = 10; // '</thought>'.length
                            }

                            if (endIndex !== -1) {
                                const thought = remainingText.substring(0, endIndex);
                                if (thought) {
                                    reasoning += thought;
                                    if (onChunk) onChunk("", thought);
                                }
                                isThinking = false;
                                remainingText = remainingText.substring(endIndex + tagLength);
                            } else {
                                reasoning += remainingText;
                                if (onChunk) onChunk("", remainingText);
                                remainingText = "";
                            }
                        }
                    }
                }

                // Grounding Metadata
                const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                if (chunks) {
                    chunks.forEach((c: any) => {
                        if (c.web?.uri && c.web?.title) {
                            citations.push({ title: c.web.title, uri: c.web.uri });
                        }
                    });
                }
            }

            if (functionCalls.length > 0) {
                const toolResponses: any[] = [];

                for (const fc of functionCalls) {
                    if (fc.name === 'save_to_library') {
                        pendingAction = {
                            type: fc.args.action === 'update' ? 'update_page' : 'create_page',
                            data: { title: fc.args.title as string, content: fc.args.content as string },
                            originalToolCallId: "gemini-fc"
                        };
                        toolResponses.push({ functionResponse: { name: fc.name, response: { content: "Action pending user confirmation." } } });
                    } else if (fc.name === 'get_page_structure') {
                        const title = fc.args.pageTitle as string;
                        const pageAttachment = attachments.find(a => a.name === title || a.name === title + ".md");
                        if (pageAttachment && pageAttachment.content) {
                            const page = BlockService.fromMarkdown(pageAttachment.content, title);
                            // Enhanced Structure View: Include context snippet for better identification
                            const structure = page.blocks.map((b, idx) => {
                                let context = "";
                                if (b.type === 'table') {
                                    context = `[TABLE] Rows: ${b.content.split('\n').length}`;
                                } else {
                                    context = b.content.length > 60 ? b.content.substring(0, 60) + "..." : b.content;
                                }
                                return `Block ${idx + 1}: [ID: ${b.id}] (${b.type}) -> ${context}`;
                            }).join('\n');
                            toolResponses.push({ functionResponse: { name: fc.name, response: { content: `STRUCTURE OF PAGE "${title}":\n${structure}` } } });
                        } else {
                             toolResponses.push({ functionResponse: { name: fc.name, response: { content: "Error: Page not found in current context. Please ask user to open the page first." } } });
                        }
                    } else if (fc.name === 'insert_block' || fc.name === 'replace_block' || fc.name === 'delete_block' || fc.name === 'update_table_cell') {
                         pendingAction = {
                            type: 'block_operation',
                            data: { 
                                operation: fc.name,
                                args: fc.args
                            },
                            originalToolCallId: "gemini-fc"
                        };
                        toolResponses.push({ functionResponse: { name: fc.name, response: { content: "Block operation pending user confirmation." } } });
                    } else if (fc.name === 'list_calendar_events') {
                        const allEvents = await db.get<CalendarEvent[]>(STORES.CALENDAR, 'all_events') || [];
                        
                        // Default: Start from beginning of today, End 7 days from now
                        let startDate = new Date();
                        startDate.setHours(0, 0, 0, 0);
                        
                        let endDate = new Date(startDate);
                        endDate.setDate(endDate.getDate() + 7);
                        endDate.setHours(23, 59, 59, 999);

                        if (fc.args.startDate) {
                            const parsedStart = new Date(fc.args.startDate as string);
                            if (!isNaN(parsedStart.getTime())) {
                                startDate = parsedStart;
                            }
                        }
                        if (fc.args.endDate) {
                            const parsedEnd = new Date(fc.args.endDate as string);
                            if (!isNaN(parsedEnd.getTime())) {
                                endDate = parsedEnd;
                                // If startDate and endDate are the same day (or close), expand endDate to end of day
                                if (endDate.getTime() <= startDate.getTime() + 86400000 && endDate.getHours() === 0) {
                                    endDate.setHours(23, 59, 59, 999);
                                }
                            }
                        }

                        const relevantEvents = allEvents.filter(e => {
                             const eStart = new Date(e.startDate);
                             const eEnd = new Date(e.endDate);
                             return eStart <= endDate && eEnd >= startDate;
                        }).sort((a, b) => a.startDate - b.startDate);
                        
                        let responseContent = `CALENDAR EVENTS (Range: ${startDate.toLocaleString()} - ${endDate.toLocaleString()}):\n`;
                        if (relevantEvents.length === 0) {
                            responseContent += "No events found in this range.";
                        } else {
                            relevantEvents.forEach(e => {
                                const startObj = new Date(e.startDate);
                                const endObj = new Date(e.endDate);
                                
                                if (e.allDay) {
                                    // For all-day events, show just the date
                                    const dateStr = startObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                    responseContent += `\n- [ID: ${e.id}] "${e.title}"\n  TYPE: All-day Event\n  DATE: ${dateStr}\n  Location: ${e.location || 'N/A'}\n  Description: ${e.description || 'N/A'}`;
                                } else {
                                    const startStr = startObj.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
                                    const endStr = endObj.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
                                    responseContent += `\n- [ID: ${e.id}] "${e.title}"\n  SCHEDULED START: ${startStr}\n  SCHEDULED END: ${endStr}\n  Location: ${e.location || 'N/A'}\n  Description: ${e.description || 'N/A'}`;
                                }
                            });
                        }
                        toolResponses.push({ functionResponse: { name: fc.name, response: { content: responseContent } } });
                        if (onChunk) onChunk("", `\n📅 Checked calendar: ${relevantEvents.length} events found.\n`);

                    } else if (fc.name === 'add_calendar_event' || fc.name === 'update_calendar_event' || fc.name === 'delete_calendar_event') {
                         pendingAction = {
                            type: 'calendar_event',
                            data: { 
                                operation: fc.name.replace('_calendar_event', ''),
                                args: fc.args
                            },
                            originalToolCallId: "gemini-fc"
                        };
                        toolResponses.push({ functionResponse: { name: fc.name, response: { content: "Calendar action pending user confirmation." } } });
                    } else if (fc.name === 'get_calendar_holidays') {
                        const year = fc.args.year as number || new Date().getFullYear();
                        const holidays = getHolidays(year);
                        let responseContent = `HOLIDAYS FOR ${year} (RO & DE):\n`;
                        holidays.forEach(h => {
                            responseContent += `- ${h.date}: ${h.name} (${h.country}) [${h.isPublic ? 'Non-working' : 'Observance'}]\n`;
                        });
                        toolResponses.push({ functionResponse: { name: fc.name, response: { content: responseContent } } });
                        if (onChunk) onChunk("", `\n📅 Checked holidays for ${year}...\n`);
                    } else if (fc.name === 'get_current_time') {
                        const now = new Date();
                        const timeString = now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        toolResponses.push({ functionResponse: { name: fc.name, response: { content: timeString } } });
                        if (onChunk) onChunk("", `\n🕒 Time: ${timeString}...\n`);
                    } else if (fc.name === 'read_workspace_files') {
                        const filenames = fc.args.filenames as string[];
                        const requestedFiles = this.workspaceFiles.filter(f => filenames.includes(f.name));
                        
                        let responseContent = "";
                        if (requestedFiles.length > 0) {
                            requestedFiles.forEach(f => {
                                responseContent += `\n[File: ${f.name}]\n${f.content}\n`;
                            });
                        } else {
                            responseContent = "Error: Requested files not found in workspace.";
                        }
                        toolResponses.push({ functionResponse: { name: fc.name, response: { content: responseContent } } });
                    } else if (fc.name === 'search_workspace_files') {
                        const queries = fc.args.queries as string[];
                        let responseContent = `Search results for [${queries.join(', ')}] in workspace files:\n`;
                        let foundCount = 0;
                        const apiKeyToUse = customApiKey || this.apiKey;
                        
                        if (apiKeyToUse) {
                            const filenames = this.workspaceFiles.map(f => f.name);
                            for (const query of queries) {
                                try {
                                    const results = await RAGService.search(query, undefined, apiKeyToUse, 3, filenames);
                                    if (results.length > 0) {
                                        foundCount += results.length;
                                        responseContent += `\n--- Results for "${query}" ---\n`;
                                        results.forEach((res, idx) => {
                                            responseContent += `\n[Result ${idx + 1} - File: ${res.chunk.filename} (Score: ${res.score.toFixed(2)})]\n${res.chunk.content}\n`;
                                        });
                                    }
                                } catch (e) {
                                    console.error("[RAG] Search error in tool:", e);
                                }
                            }
                        }

                        // Fallback to basic search if RAG fails or no API key (or no results?)
                        // Actually, if RAG finds nothing, we could fallback, but let's just use RAG if key exists.
                        if (!apiKeyToUse || foundCount === 0) {
                            // Basic string match fallback
                            let fallbackFound = 0;
                            const lowerQueries = queries.map(q => q.toLowerCase());
                            this.workspaceFiles.forEach(f => {
                                if (!f.content) return;
                                const lines = f.content.split('\n');
                                lines.forEach((line, idx) => {
                                    const lowerLine = line.toLowerCase();
                                    if (lowerQueries.some(q => lowerLine.includes(q))) {
                                        fallbackFound++;
                                        const start = Math.max(0, idx - 1);
                                        const end = Math.min(lines.length - 1, idx + 1);
                                        responseContent += `\n[File: ${f.name}, Line ${idx + 1}]\n`;
                                        for (let i = start; i <= end; i++) {
                                            responseContent += `${i === idx ? '>> ' : '   '}${lines[i]}\n`;
                                        }
                                    }
                                });
                            });
                            foundCount += fallbackFound;
                        }

                        if (foundCount === 0) responseContent = `No matches found for any of the queries in workspace files.`;
                        toolResponses.push({ functionResponse: { name: fc.name, response: { content: responseContent } } });
                        if (onChunk) onChunk("", `\n🔍 Căutat ${queries.length} termeni în workspace...\n`);
                    } else if (fc.name === 'get_workspace_map') {
                        let responseContent = "WORKSPACE KNOWLEDGE BASE MAP:\n";
                        
                        this.workspaceFiles.forEach(f => {
                            // Extract a semantic snippet (first 500 chars) and key terms
                            const snippet = (f.content || "").substring(0, 500).replace(/\n/g, ' ');
                            const sizeKb = Math.round((f.content?.length || 0) / 1024);
                            
                            // Simple heuristic for "topics" - could be improved with another LLM call but let's keep it local for now
                            responseContent += `\n- FILE: ${f.name} (${sizeKb} KB)\n`;
                            responseContent += `  PREVIEW: ${snippet}...\n`;
                            responseContent += `  CONTEXT: This file appears to contain ${f.mimeType || 'text'} data. Use search to find specific entities.\n`;
                        });

                        toolResponses.push({ functionResponse: { name: fc.name, response: { content: responseContent } } });
                        if (onChunk) onChunk("", `\n🗺️ Mapat structura workspace-ului...\n`);
                    } else if (fc.name === 'semantic_search_workspace') {
                        const query = fc.args.query as string;
                        let responseContent = `Semantic search results for "${query}":\n`;
                        const apiKeyToUse = customApiKey || this.apiKey;
                        
                        if (!apiKeyToUse) {
                             responseContent = "Error: API key required for semantic search.";
                        } else {
                            try {
                                const filenames = this.workspaceFiles.map(f => f.name);
                                const results = await RAGService.search(query, undefined, apiKeyToUse, 5, filenames);
                                
                                if (results.length > 0) {
                                    results.forEach((res, idx) => {
                                        responseContent += `\n[Result ${idx + 1} - File: ${res.chunk.filename} (Score: ${res.score.toFixed(2)})]\n${res.chunk.content}\n`;
                                    });
                                } else {
                                    responseContent = "No semantically relevant information found.";
                                }
                            } catch (e) {
                                console.error("[RAG] Semantic search error:", e);
                                responseContent = "Error: Failed to perform semantic search.";
                            }
                        }
                        toolResponses.push({ functionResponse: { name: fc.name, response: { content: responseContent } } });
                        if (onChunk) onChunk("", `\n🧠 Căutare semantică: "${query}"...\n`);
                    } else {
                        toolResponses.push({ functionResponse: { name: fc.name, response: { content: "Error: Unknown tool." } } });
                    }
                }

                if (pendingAction) {
                    break;
                }

                currentMessage = toolResponses;
                turns++;
                if (onChunk) onChunk("", `\n⚙️ Executat ${functionCalls.length} operațiuni...\n`);
            } else {
                break;
            }
        }

        const { cleanText, questions } = this.extractRelatedQuestions(finalResponseText);
        return { 
            text: cleanText || "", 
            citations: Array.from(new Map(citations.map(c => [c.uri, c])).values()), 
            relatedQuestions: questions, 
            pendingAction,
            reasoning
        };
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return { text: `Error: ${(error as any).message || 'Request Failed'}`, citations: [], relatedQuestions: [] };
    }
  }

  // --- Generic Implementation (Unified Agent Loop) ---
  private async generateGenericResponse(
    history: Message[],
    prompt: string,
    attachments: Attachment[],
    endpoint: string,
    apiKey: string,
    modelName: string,
    systemInstruction: string,
    _enableMemory: boolean,
    useSearch: boolean,
    searchProvider: 'tavily' | 'brave',
    searchApiKey?: string,
    onChunk?: (text: string, reasoning?: string) => void,
    useReadFiles: boolean = false,
    _proMode: ProMode = ProMode.STANDARD
  ): Promise<{ text: string; citations: Citation[]; relatedQuestions: string[]; pendingAction?: PendingAction; reasoning?: string }> {
    
    // 1. Prepare Messages
    const messages: any[] = [];
    messages.push({ role: 'system', content: systemInstruction });

    // Format History
    history.slice(-15).forEach(msg => { // Increased context window
        // Remove reasoning from history sent to model to save tokens, or keep it if valuable context? 
        // Usually cleaner to strip old thoughts.
        const content = msg.content;
        messages.push({ 
            role: msg.role === Role.MODEL ? 'assistant' : 'user', 
            content: content 
        });
    });

    // Format Current Turn
    let finalPrompt = prompt;
    attachments.forEach(att => {
        if (att.type === 'text') {
            finalPrompt += `\n\n[Attached File: ${att.name}]\n${att.content}`;
        } else if (att.type === 'image') {
             // For generic models that support vision (gpt-4o, claude-3), we need specific formatting
             // For simplicity in this "generic" handler, we append text indication.
             // A robust implementation would construct the array content block for OpenAI specs.
             finalPrompt += `\n[Image Attached: ${att.name}]`; 
        }
    });

    // Handle Vision for OpenAI compatible endpoints properly
    const currentMessageContent: any[] = [{ type: "text", text: finalPrompt }];
    attachments.forEach(att => {
        if (att.type === 'image') {
             const cleanBase64 = att.content.split(',')[1] || att.content;
             currentMessageContent.push({
                 type: "image_url",
                 image_url: { url: `data:${att.mimeType};base64,${cleanBase64}` }
             });
        }
    });

    messages.push({ role: 'user', content: currentMessageContent });

    // 2. Prepare Tools
    const tools = [];
    if (useSearch && searchApiKey) tools.push(searchToolGeneric);
    tools.push(saveToolGeneric, insertBlockToolGeneric, replaceBlockToolGeneric, deleteBlockToolGeneric, getPageStructureToolGeneric, updateTableToolGeneric, listCalendarEventsToolGeneric, addCalendarEventToolGeneric, updateCalendarEventToolGeneric, deleteCalendarEventToolGeneric, getCurrentTimeToolGeneric, getCalendarHolidaysToolGeneric);
    if (useReadFiles) tools.push(readFilesToolGeneric, searchFilesToolGeneric, getWorkspaceMapToolGeneric, semanticSearchToolGeneric);

    let finalContent = "";
    let finalReasoning = "";
    let turns = 0;
    const maxTurns = 5; // Allow up to 5 tool-use hops
    const collectedCitations: Citation[] = [];
    let pendingAction: PendingAction | undefined = undefined;

    // --- MAIN AGENT LOOP ---
    while (turns < maxTurns) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey && apiKey !== "not-needed") {
            headers['Authorization'] = `Bearer ${apiKey}`;
            if (endpoint.includes("openrouter")) {
                headers['HTTP-Referer'] = window.location.origin;
                headers['X-Title'] = "Perplex Clone";
            }
        }

        try {
            const body: any = {
                model: modelName,
                messages: messages,
                stream: true,
                temperature: 0.7 
            };

            // Handle OpenRouter specific reasoning features
            if (endpoint.includes("openrouter.ai")) {
                const isReasoningModel = LLMService.OPENROUTER_REASONING_MODELS.some(
                    m => modelName.toLowerCase().includes(m.toLowerCase())
                );
                if (isReasoningModel) {
                    body.reasoning = { enabled: true };
                }
            }
            
            if (tools.length > 0) {
                body.tools = tools;
                body.tool_choice = "auto";
            }

            console.log(`[Generic] Turn ${turns + 1} Request:`, { model: modelName, toolCount: tools.length, useSearch, searchProvider });

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body),
                signal: this.abortController?.signal
            });

            if (!response.ok) {
                 const errText = await response.text();
                 throw new Error(`API Error ${response.status}: ${errText}`);
            }

            // Streaming Parser
            const reader = response.body!.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            let currentTurnContent = "";
            
            // Tool Call Accumulator
            let toolCallMap: Record<number, { id: string, name: string, args: string }> = {};

            // XML Parsing State for Reasoning
            let inThinkingTag = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; 

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed === "data: [DONE]") continue;
                    if (!trimmed.startsWith("data: ")) continue;

                    try {
                        const json = JSON.parse(trimmed.slice(6));
                        const choice = json.choices?.[0];
                        if (!choice) continue;
                        const delta = choice.delta;

                        // 1. Handle Reasoning (OpenRouter/OpenAI/DeepSeek)
                        const reasoningChunk = delta.reasoning || delta.thought || (delta as any).reasoning_content;
                        if (reasoningChunk) {
                            finalReasoning += reasoningChunk;
                            if (onChunk) onChunk("", reasoningChunk);
                        }

                        // 2. Handle Content (Text)
                        if (delta.content) {
                            const chunk = delta.content;
                            currentTurnContent += chunk;

                            // Streaming Logic for <thinking> tags
                            // We need to detect if we are inside <thinking>...</thinking>
                            // This is a simple state machine parser for streaming XML tags
                            
                            let remaining = chunk;
                            while (remaining.length > 0) {
                                if (!inThinkingTag) {
                                    const startThinking = remaining.indexOf("<thinking>");
                                    const startThought = remaining.indexOf("<thought>");
                                    
                                    let startIdx = -1;
                                    let tagLen = 0;
                                    
                                    if (startThinking !== -1 && (startThought === -1 || startThinking < startThought)) {
                                        startIdx = startThinking;
                                        tagLen = 10;
                                    } else if (startThought !== -1) {
                                        startIdx = startThought;
                                        tagLen = 9;
                                    }

                                    if (startIdx !== -1) {
                                        // Found start tag
                                        const textPart = remaining.substring(0, startIdx);
                                        if (textPart && onChunk) onChunk(textPart, undefined);
                                        
                                        inThinkingTag = true;
                                        remaining = remaining.substring(startIdx + tagLen);
                                    } else {
                                        // No start tag, just text
                                        if (onChunk) onChunk(remaining, undefined);
                                        remaining = "";
                                    }
                                } else {
                                    const endThinking = remaining.indexOf("</thinking>");
                                    const endThought = remaining.indexOf("</thought>");
                                    
                                    let endIdx = -1;
                                    let tagLen = 0;
                                    
                                    if (endThinking !== -1 && (endThought === -1 || endThinking < endThought)) {
                                        endIdx = endThinking;
                                        tagLen = 11;
                                    } else if (endThought !== -1) {
                                        endIdx = endThought;
                                        tagLen = 10;
                                    }

                                    if (endIdx !== -1) {
                                        // Found end tag
                                        const thoughtPart = remaining.substring(0, endIdx);
                                        finalReasoning += thoughtPart;
                                        if (onChunk) onChunk("", thoughtPart);
                                        
                                        inThinkingTag = false;
                                        remaining = remaining.substring(endIdx + tagLen);
                                    } else {
                                        // Still in thinking tag
                                        finalReasoning += remaining;
                                        if (onChunk) onChunk("", remaining);
                                        remaining = "";
                                    }
                                }
                            }
                        }

                        // 2. Handle Tool Calls (Streaming)
                        if (delta.tool_calls) {
                            for (const tc of delta.tool_calls) {
                                const idx = tc.index;
                                if (!toolCallMap[idx]) toolCallMap[idx] = { id: "", name: "", args: "" };
                                
                                if (tc.id) toolCallMap[idx].id = tc.id;
                                if (tc.function?.name) toolCallMap[idx].name += tc.function.name;
                                if (tc.function?.arguments) toolCallMap[idx].args += tc.function.arguments;
                            }
                        }
                    } catch (e) {
                        // Ignore partial JSON parse errors
                    }
                }
            }

            // Turn Complete
            const toolCalls = Object.values(toolCallMap).map(tc => ({
                id: tc.id,
                type: 'function',
                function: { name: tc.name, arguments: tc.args }
            }));

            // If no tool calls, we are done
            if (toolCalls.length === 0) {
                // Strip thinking/thought tags from final content for clean text
                const cleanContent = currentTurnContent.replace(/<(thinking|thought)>[\s\S]*?<\/\1>/g, "").trim();
                if (cleanContent) {
                    finalContent = cleanContent;
                } else if (!finalContent) {
                    // If this turn is empty but we have no previous content, use what we have
                    finalContent = currentTurnContent.trim();
                }
                break; // Exit loop
            }

            // If we have content in this turn but also tool calls, preserve it
            const turnCleanContent = currentTurnContent.replace(/<(thinking|thought)>[\s\S]*?<\/\1>/g, "").trim();
            if (turnCleanContent) {
                finalContent += (finalContent ? "\n\n" : "") + turnCleanContent;
            }

            // Process Tool Calls
            // Add Assistant Message with Tool Calls to history
            messages.push({
                role: 'assistant',
                content: currentTurnContent || null, // Some APIs require null if tool_calls present
                tool_calls: toolCalls
            });

            console.log(`[Generic] Executing ${toolCalls.length} tools...`);

            for (const toolCall of toolCalls) {
                let toolResultContent = "";
                
                try {
                    const args = JSON.parse(toolCall.function.arguments);
                    
                    if (toolCall.function.name === 'perform_search') {
                         if (!searchApiKey) {
                             toolResultContent = "Error: Search disabled (Missing API Key).";
                         } else {
                             // Execute Search
                             console.log(`[Generic] Invoking Search via ${searchProvider}...`);
                             const searchData = await TavilyService.search(args.query, searchApiKey, searchProvider);
                             
                             if (searchData && searchData.results.length > 0) {
                                 // Add to collections
                                 searchData.results.forEach(res => collectedCitations.push({ title: res.title, uri: res.url }));
                                 if (searchData.images) {
                                     // Images removed as requested
                                 }
                                 
                                 // Format for Model
                                 toolResultContent = TavilyService.formatContext(searchData);
                                 console.log(`[Generic] Search returned ${searchData.results.length} results.`);
                             } else {
                                 toolResultContent = "No results found for query: " + args.query;
                                 console.warn(`[Generic] Search returned no results.`);
                             }
                         }
                    } else if (toolCall.function.name === 'save_to_library') {
                        // Intercept Save
                        pendingAction = {
                            type: args.action === 'update' ? 'update_page' : 'create_page',
                            data: { title: args.title, content: args.content },
                            originalToolCallId: toolCall.id
                        };
                        toolResultContent = "Action pending user confirmation.";
                    } else if (toolCall.function.name === 'get_page_structure') {
                        const title = args.pageTitle as string;
                        const pageAttachment = attachments.find(a => a.name === title || a.name === title + ".md");
                        if (pageAttachment && pageAttachment.content) {
                            const page = BlockService.fromMarkdown(pageAttachment.content, title);
                            const structure = page.blocks.map((b, idx) => {
                                let context = "";
                                if (b.type === 'table') {
                                    context = `[TABLE] Rows: ${b.content.split('\n').length}`;
                                } else {
                                    context = b.content.length > 60 ? b.content.substring(0, 60) + "..." : b.content;
                                }
                                return `Block ${idx + 1}: [ID: ${b.id}] (${b.type}) -> ${context}`;
                            }).join('\n');
                            toolResultContent = `STRUCTURE OF PAGE "${title}":\n${structure}`;
                        } else {
                             toolResultContent = "Error: Page not found in current context. Please ask user to open the page first.";
                        }
                    } else if (toolCall.function.name === 'insert_block' || toolCall.function.name === 'replace_block' || toolCall.function.name === 'delete_block' || toolCall.function.name === 'update_table_cell') {
                         pendingAction = {
                            type: 'block_operation',
                            data: { 
                                operation: toolCall.function.name,
                                args: args
                            },
                            originalToolCallId: toolCall.id
                        };
                        toolResultContent = "Block operation pending user confirmation.";
                    } else if (toolCall.function.name === 'list_calendar_events') {
                        let startDate = new Date(args.startDate);
                        let endDate = new Date(args.endDate);
                        
                        // If startDate and endDate are the same day (00:00:00), expand endDate to end of day
                        if (endDate.getTime() === startDate.getTime()) {
                            endDate.setHours(23, 59, 59, 999);
                        }

                        const allEvents = await db.get<CalendarEvent[]>(STORES.CALENDAR, 'all_events') || [];
                        
                        const filteredEvents = allEvents.filter(e => {
                            const eStart = new Date(e.startDate);
                            const eEnd = new Date(e.endDate);
                            return eStart <= endDate && eEnd >= startDate;
                        });

                        // Format events to be human-readable and avoid raw timestamps
                        const formattedEvents = filteredEvents.map(e => ({
                            ...e,
                            startDate: new Date(e.startDate).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                            endDate: new Date(e.endDate).toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        }));
                        
                        toolResultContent = JSON.stringify(formattedEvents);
                        if (onChunk) onChunk("", `\n📅 Checking calendar for ${startDate.toLocaleString()} to ${endDate.toLocaleString()}...\n`);
                    } else if (toolCall.function.name === 'add_calendar_event') {
                        pendingAction = {
                            type: 'calendar_event',
                            data: {
                                operation: 'add',
                                args: args
                            },
                            originalToolCallId: toolCall.id
                        };
                        toolResultContent = "Action pending user confirmation.";
                    } else if (toolCall.function.name === 'update_calendar_event') {
                        pendingAction = {
                            type: 'calendar_event',
                            data: {
                                operation: 'update',
                                args: args
                            },
                            originalToolCallId: toolCall.id
                        };
                        toolResultContent = "Action pending user confirmation.";
                    } else if (toolCall.function.name === 'delete_calendar_event') {
                        pendingAction = {
                            type: 'calendar_event',
                            data: {
                                operation: 'delete',
                                args: args
                            },
                            originalToolCallId: toolCall.id
                        };
                        toolResultContent = "Action pending user confirmation.";
                    } else if (toolCall.function.name === 'get_current_time') {
                        const now = new Date();
                        const timeString = now.toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                        toolResultContent = timeString;
                        if (onChunk) onChunk("", `\n🕒 Time: ${timeString}...\n`);
                    } else if (toolCall.function.name === 'read_workspace_files') {
                        const filenames = args.filenames as string[];
                        const requestedFiles = this.workspaceFiles.filter(f => filenames.includes(f.name));
                        
                        if (requestedFiles.length > 0) {
                            requestedFiles.forEach(f => {
                                toolResultContent += `\n[File: ${f.name}]\n${f.content}\n`;
                            });
                        } else {
                            toolResultContent = "Error: Requested files not found in workspace.";
                        }
                        if (onChunk) onChunk("", `\n📖 Citit ${filenames.length} fișiere din workspace...\n`);
                    } else if (toolCall.function.name === 'search_workspace_files') {
                        const queries = args.queries as string[];
                        let foundCount = 0;
                        toolResultContent = `Search results for [${queries.join(', ')}] in workspace files:\n`;
                        const apiKeyToUse = apiKey || this.apiKey;

                        if (apiKeyToUse) {
                            const filenames = this.workspaceFiles.map(f => f.name);
                            for (const query of queries) {
                                try {
                                    const results = await RAGService.search(query, undefined, apiKeyToUse, 3, filenames);
                                    if (results.length > 0) {
                                        foundCount += results.length;
                                        toolResultContent += `\n--- Results for "${query}" ---\n`;
                                        results.forEach((res, idx) => {
                                            toolResultContent += `\n[Result ${idx + 1} - File: ${res.chunk.filename} (Score: ${res.score.toFixed(2)})]\n${res.chunk.content}\n`;
                                        });
                                    }
                                } catch (e) {
                                    console.error("[RAG] Search error in tool:", e);
                                }
                            }
                        }

                        if (!apiKeyToUse || foundCount === 0) {
                            let fallbackFound = 0;
                            const lowerQueries = queries.map(q => q.toLowerCase());
                            this.workspaceFiles.forEach(f => {
                                if (!f.content) return;
                                const lines = f.content.split('\n');
                                lines.forEach((line, idx) => {
                                    const lowerLine = line.toLowerCase();
                                    if (lowerQueries.some(q => lowerLine.includes(q))) {
                                        fallbackFound++;
                                        const start = Math.max(0, idx - 1);
                                        const end = Math.min(lines.length - 1, idx + 1);
                                        toolResultContent += `\n[File: ${f.name}, Line ${idx + 1}]\n`;
                                        for (let i = start; i <= end; i++) {
                                            toolResultContent += `${i === idx ? '>> ' : '   '}${lines[i]}\n`;
                                        }
                                    }
                                });
                            });
                            foundCount += fallbackFound;
                        }

                        if (foundCount === 0) toolResultContent = `No matches found for any of the queries in workspace files.`;
                        if (onChunk) onChunk("", `\n🔍 Căutat ${queries.length} termeni în workspace...\n`);
                    } else if (toolCall.function.name === 'get_workspace_map') {
                        toolResultContent = "WORKSPACE KNOWLEDGE BASE MAP:\n";
                        this.workspaceFiles.forEach(f => {
                            const snippet = (f.content || "").substring(0, 500).replace(/\n/g, ' ');
                            const sizeKb = Math.round((f.content?.length || 0) / 1024);
                            toolResultContent += `\n- FILE: ${f.name} (${sizeKb} KB)\n`;
                            toolResultContent += `  PREVIEW: ${snippet}...\n`;
                            toolResultContent += `  CONTEXT: This file appears to contain ${f.mimeType || 'text'} data. Use search to find specific entities.\n`;
                        });
                        if (onChunk) onChunk("", `\n🗺️ Mapat structura workspace-ului...\n`);
                    } else if (toolCall.function.name === 'semantic_search_workspace') {
                        const query = args.query as string;
                        let toolResultContent = `Semantic search results for "${query}":\n`;
                        const apiKeyToUse = apiKey || this.apiKey;
                        
                        if (!apiKeyToUse) {
                            toolResultContent = "Error: API key required for semantic search.";
                        } else {
                            try {
                                const filenames = this.workspaceFiles.map(f => f.name);
                                const results = await RAGService.search(query, undefined, apiKeyToUse, 5, filenames);
                                if (results.length > 0) {
                                    results.forEach((res, idx) => {
                                        toolResultContent += `\n[Result ${idx + 1} - File: ${res.chunk.filename} (Score: ${res.score.toFixed(2)})]\n${res.chunk.content}\n`;
                                    });
                                } else {
                                    toolResultContent = "No semantically relevant information found.";
                                }
                            } catch (e) {
                                console.error("[RAG] Semantic search error:", e);
                                toolResultContent = "Error: Failed to perform semantic search.";
                            }
                        }
                        if (onChunk) onChunk("", `\n🧠 Căutare semantică: "${query}"...\n`);
                    } else {
                        toolResultContent = "Unknown tool.";
                    }
                } catch (err: any) {
                    toolResultContent = `Error executing tool: ${err.message}`;
                    console.error(`[Generic] Tool Execution Error:`, err);
                }

                // Add Tool Result to History
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    name: toolCall.function.name,
                    content: toolResultContent
                });
            }

            // If we found a pending action, stop the loop and return immediately
            if (pendingAction) break;

            turns++;
            // Loop continues to generate the answer based on tool results

        } catch (error: any) {
            console.error("Generic API Loop Error:", error);
            return { text: `Error: ${error.message}`, citations: [], relatedQuestions: [] };
        }
    } // End While

    // --- Post-Processing ---

    // 1. Extract XML Thinking (Simulated Reasoning) - Fallback if streaming missed it
    if (!finalReasoning) {
        const { cleanText, reasoning } = this.extractXmlThinking(finalContent);
        finalContent = cleanText;
        finalReasoning = reasoning || "";
    } else {
        // Ensure final content is clean if we streamed reasoning
        finalContent = finalContent.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
    }

    // 2. Extract Related Questions (JSON)
    const extracted = this.extractRelatedQuestions(finalContent);
    finalContent = extracted.cleanText;

    // 3. Deduplicate Citations
    const uniqueCitations = Array.from(new Map(collectedCitations.map(item => [item.uri, item])).values());

    return { 
        text: finalContent || "", 
        citations: uniqueCitations,
        relatedQuestions: extracted.questions,
        pendingAction,
        reasoning: finalReasoning
    };
  }

  // --- TTS ---
  async generateSpeech(text: string, context: AudioContext, customApiKey?: string): Promise<AudioBuffer | null> {
    let clientToUse = this.ai;
    if (customApiKey) {
        try { clientToUse = new GoogleGenAI({ apiKey: customApiKey }); } catch (e) {}
    }
    if (!clientToUse || !text.trim()) return null;

    try {
        const response = await clientToUse.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: text.substring(0, 4000) }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) return null;
        return await this.decodeAudioData(this.decodeBase64(base64Audio), context, 24000, 1);

    } catch (e: any) {
        console.error("TTS Error:", e);
        return null;
    }
  }

  private decodeBase64(base64: string): Uint8Array {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
  }

  private async decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
  }



  // --- Context Builder ---
  private async buildSystemContext(
    prompt: string,
    modeInstruction: string,
    enableMemory: boolean,
    userProfile: UserProfile,
    aiProfile: AiProfile,
    spaceSystemInstruction?: string,
    forceXmlThinking: boolean = false,
    forceExplicitToolUse: boolean = false
  ): Promise<string> {
      const parts: string[] = [];

      const now = new Date();
      const timeStr = now.toLocaleString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit',
          timeZoneName: 'short'
      });

      parts.push(`\n**CURRENT SYSTEM TIME:** ${timeStr}`);
      parts.push(`**DATE INTERPRETATION RULES:**
1. Use the current system time above as your absolute reference.
2. Interpret "today", "tomorrow", "yesterday" relative to this date.
3. For dates without a year (e.g., "March 30th"):
   - If the date is in the future relative to today, use the current year.
   - If the date has already passed this year, use the NEXT year.
   - NEVER assume a past year unless explicitly stated.
4. ALWAYS confirm the calculated absolute date internally before calling a tool.
5. When adding events, if the user doesn't specify a year, apply the logic above.

**REAL-TIME INFORMATION PROTOCOL:**
1. If the user asks about "today", "recent", "news", "crypto", "stocks", or "current events", you **MUST** use the available search tool (e.g., \`perform_search\` or built-in Google Search).
2. Your internal knowledge is frozen in time. For any dynamic topic, the web is your source of truth.
3. When searching for "today's news", explicitly include the current date (${timeStr}) in your search queries to get the most relevant results.
4. If you are in a research loop, focus on gathering facts from the search results rather than your internal memory.`);

      parts.push(`\n**CALENDAR PROTOCOL (CRITICAL):**
1. **SOURCE OF TRUTH:** The user's calendar is the ONLY source of truth for events. Do NOT rely on your internal memory or previous conversation turns for event dates/times, as they may be outdated.
2. **ALWAYS VERIFY:** Before answering ANY question about the calendar (reading, updating, moving, deleting), you **MUST** first call \`list_calendar_events\` to get the current, real-time state of the calendar.
3. **SCHEDULED DATE VS CREATION DATE:** Users ALWAYS refer to the "Scheduled Date" (when the event happens), NEVER the "Creation Date". When you list events, pay attention to the \`startDate\` and \`endDate\` fields.
4. **RELATIVE DATES:** If the user says "tomorrow" or "next Friday", use \`get_current_time\` to calculate the exact date, then query \`list_calendar_events\` with that specific date range.
5. **MOVING EVENTS:** To move an event:
   a. Call \`list_calendar_events\` to find the event and its ID.
   b. Verify the *current* date of the event from the tool output.
   c. Calculate the *new* date based on the user's request.
   d. Call \`update_calendar_event\` with the event ID and the NEW start/end times.
   e. Do NOT ask the user to confirm if you have already verified the data. Just do it.
6. **CONFLICTS:** If a move creates a conflict, warn the user but proceed if they insisted, or ask for confirmation if ambiguous.`);

      parts.push(`\n**LIBRARY/SOURCE PROTOCOL (CRITICAL):**
1. **PRIORITY:** If the user has attached a file, page, or source (e.g., from the Library), this attachment is your **PRIMARY SOURCE OF TRUTH**.
2. **VERIFY FIRST:** Do NOT answer from your internal memory or assumptions about what the file *might* contain. You MUST read and analyze the actual content of the attachment provided in the context.
3. **NO HALLUCINATIONS:** If the attached file does not contain the answer, state that clearly. Do not invent information to fill the gap.
4. **TOOL USAGE:** If the file content is truncated or summarized (indicated by a system message), you **MUST** use the \`read_workspace_files\` tool to retrieve the full content before answering specific questions about it.
5. **ANALYSIS:** When asked about a source, first analyze its structure, key points, and details *before* formulating your response.`);

      if (aiProfile.systemInstructions) {
          parts.push(aiProfile.systemInstructions);
      } else {
          parts.push("You are a helpful AI assistant. Answer concisely and accurately. Use Markdown formatting.");
      }

      if (modeInstruction) {
          parts.push("\nMODE INSTRUCTION: " + modeInstruction);
      }
      
      // Simulate Reasoning via XML for non-Gemini models
      if (forceXmlThinking) {
          parts.push("\nIMPORTANT: Before answering, you must output your internal thought process inside <thinking>...</thinking> tags. Analyze the request, plan your search strategy, and critique your findings inside these tags. The user will see this as a 'Thought Process'. Then provide your final answer outside the tags.");
      }

      // Explicit Tool Usage Instruction (Crucial for generic OpenRouter/OpenAI models)
      if (forceExplicitToolUse) {
          parts.push(`\n**CRITICAL INSTRUCTION: REAL-TIME SEARCH & KNOWLEDGE BASE**
1. **Real-Time Search:** You have access to \`perform_search\`. If the user asks about current events, news, weather, or ANY information that might have changed since your training cutoff, you **MUST** use it.
2. **Workspace Knowledge Base:** You have access to workspace files. If the user asks for specific data (ID numbers, tax codes like 'Steuer number', IBAN, names, dates) that might be in these files, you **MUST** find it.
3. **Semantic Mapping:** Use \`get_workspace_map\` first if you are unsure which file contains the information. This gives you a high-level overview of the topics and context of each file.
4. **Semantic Search:** Use \`semantic_search_workspace\` for complex questions where keywords might fail (e.g., "What are my obligations?" instead of "Tax"). This finds information based on meaning.
5. **Query Expansion (Synonyms):** When using \`search_workspace_files\`, always include multiple synonyms and related terms in the \`queries\` array to ensure semantic coverage. For example, if searching for a tax ID, use \`["Steuer", "Tax ID", "Fiscal Code", "Steuernummer"]\`.
6. **Contextual Understanding:** Don't just look for exact matches. Analyze the snippets returned by search to understand the context. If a snippet mentions "the number assigned by the finance office", it might be the tax ID even if the word "tax" isn't there.
7. **Accuracy:** Never hallucinate or guess personal data. If you cannot find it after searching/reading, state that clearly.
8. **Form Filling:** If asked to fill a form or provide a list of personal details, use the tools to gather every single piece of information requested.
9. **Calendar Management:** You have full access to the user's calendar. You can list, add, update, and delete events. ALWAYS check the current time using \`get_current_time\` before making any date-relative assumptions (like "tomorrow" or "next week"). Check for conflicts using \`list_calendar_events\` before adding new events.`);
      } else {
          // For Gemini models, we still want to mention the calendar capability
          parts.push(`\n**CALENDAR CAPABILITY:** You have full access to the user's calendar. You can list, add, update, and delete events. ALWAYS check the current time using \`get_current_time\` before making any date-relative assumptions. Check for conflicts before adding events.`);
      }

      // GLOBAL PROCESS INSTRUCTION (Enforces the Plan -> Execute -> Analyze -> Answer loop)
      parts.push(`\n**OPERATIONAL PROTOCOL:**
1. **PLAN:** Understand the user's goal. If information is missing (from web or workspace), use tools (Search/Read) to find it.
2. **EXECUTE:** Call necessary tools.
3. **ANALYZE:** Critically evaluate the tool results. Are they relevant? Are they sufficient? If not, search again with a better query.
4. **SYNTHESIZE:** Formulate a clear, comprehensive answer based *only* on the verified information.
5. **CITE:** Support your claims with [1], [2] citations from the search results.`);

      // Explicit Citation Instruction for Generic Models
      parts.push("\nCITATION RULES: If you use the 'perform_search' tool, you must cite the results in your final answer. Use the format [1], [2], etc., corresponding to the order of the sources provided by the tool. Do NOT invent sources.");

      if (userProfile.bio || userProfile.location || userProfile.name) {
          let userStr = "\n\nUser Profile:";
          if (userProfile.name) userStr += `\n- Name: ${userProfile.name}`;
          if (userProfile.location) userStr += `\n- Location: ${userProfile.location}`;
          if (userProfile.bio) userStr += `\n- Bio: ${userProfile.bio}`;
          parts.push(userStr);
      }

      if (enableMemory) {
          const memoryContext = await memoryManager.formatContextString(prompt);
          if (memoryContext) {
              parts.push(memoryContext);
          }
      }

      if (spaceSystemInstruction) {
          parts.push(`\n\nCurrent Workspace Instructions:\n${spaceSystemInstruction}`);
      }

      if (aiProfile.language && aiProfile.language !== 'English') {
          parts.push(`\n\nPlease respond in ${aiProfile.language}.`);
      }

      // Add capabilities instruction for Saving
      parts.push("\n\nCAPABILITIES: You can save information to the user's library. CRITICAL RULE: ONLY use `save_to_library` if the user EXPLICITLY and DIRECTLY commands you to 'save this', 'create a page', or 'remember this'. DO NOT call this tool automatically at the end of a research task or conversation. If the user just asks a question or asks for research, DO NOT save it.");

      // Instruction to generate related questions
      parts.push("\n\nIMPORTANT: After your main response (and after </thinking> if applicable), generate 3 relevant follow-up questions. Return them as a JSON array in a markdown code block at the very end, e.g., ```json\n[\"Q1?\", \"Q2?\"]\n```.");

      return parts.join("\n");
  }
}