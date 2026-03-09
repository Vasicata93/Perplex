

import { GoogleGenAI, Tool, FunctionDeclaration, Type, Content, Modality, ThinkingLevel } from "@google/genai";
import { Message, Role, Citation, Attachment, UserProfile, AiProfile, ModelProvider, LocalModelConfig, ProMode, PendingAction, CalendarEvent } from "../types";
import { MemoryService } from "./memoryService";
import { TavilyService } from "./tavilyService";
import { db, STORES } from "./db";
import { getHolidays } from "../src/services/holidayService";

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
    'deepseek-v3.2',
    'deepseek-v3.1',
    'qwen/qwq-32b',
    'qwen/qwen3',
    'qwen/qwen3-max-thinking',
    'gemini-3-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-pro-preview',
    'gemini-2.5-flash',
    'grok-4-1',
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

  private async callLLMJson(
      prompt: string,
      systemInstruction: string,
      provider: ModelProvider,
      openRouterKey: string,
      openRouterModel: string,
      openAiKey: string,
      openAiModel: string,
      activeLocalModel: LocalModelConfig | undefined,
      geminiApiKey?: string
  ): Promise<any> {
      if (provider === ModelProvider.GEMINI) {
          const client = new GoogleGenAI({ apiKey: geminiApiKey || this.apiKey || '' });
          const response = await client.models.generateContent({
              model: "gemini-3-flash-preview", 
              contents: prompt,
              config: {
                  systemInstruction: systemInstruction,
                  responseMimeType: "application/json"
              }
          });
          let jsonText = "";
          try {
              jsonText = response.text || "";
          } catch (e) {
              if (response.candidates?.[0]?.content?.parts) {
                  for (const part of response.candidates[0].content.parts) {
                      if (part.text) jsonText += part.text;
                  }
              }
          }
          return this.extractJson(jsonText || "{}");
      } else {
          let endpoint = ""; let apiKey = ""; let modelName = "";
          if (provider === ModelProvider.OPENAI) { endpoint = "https://api.openai.com/v1/chat/completions"; apiKey = openAiKey; modelName = openAiModel || "gpt-4o-mini"; }
          else if (provider === ModelProvider.OPENROUTER) { endpoint = "https://openrouter.ai/api/v1/chat/completions"; apiKey = openRouterKey; modelName = openRouterModel || "openai/gpt-4o-mini"; }
          else { endpoint = "http://localhost:11434/v1/chat/completions"; modelName = activeLocalModel?.modelId || ""; apiKey = "not-needed"; }

          const headers: any = { 'Content-Type': 'application/json' };
          if (apiKey !== "not-needed") headers['Authorization'] = `Bearer ${apiKey}`;

          const body = {
              model: modelName,
              messages: [
                  { role: "system", content: systemInstruction },
                  { role: "user", content: prompt }
              ],
              response_format: { type: "json_object" }
          };

          const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
          const data = await res.json();
          return this.extractJson(data.choices[0].message.content);
      }
  }

  private async triggerMemoryConsolidation(prompt: string, responseText: string, enableMemory: boolean, geminiApiKey?: string) {
      if (enableMemory) {
          await MemoryService.addToBuffer('model', responseText);
          const buffer = await MemoryService.getBuffer();
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
  ): Promise<{ text: string; citations: Citation[]; relatedQuestions: string[]; searchImages: string[]; pendingAction?: PendingAction; reasoning?: string }> {
      
      this.abortController = new AbortController();
      const shortTermHistory = history.slice(-5); // 5 messages short-term memory

      if (enableMemory) {
          await MemoryService.addToBuffer('user', prompt);
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

      // Stage 1: Planner
      if (onChunk) customOnChunk("", "🧠 Etapa 1: Analizez cererea...\n");
      
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

      const plannerSys = `You are the Chief Researcher Agent expert in strategic planning. Analyze the user's request.
      CURRENT SYSTEM TIME: ${timeStr}

      If it is a simple greeting, casual conversation, or a direct question that does NOT require searching the internet, output: {"type": "direct"}
      
      CRITICAL: If the user asks about current events, news, "today", "recent", financial markets (crypto, stocks), or geopolitical conflicts, you MUST output "simple_research" or "complex_research" to trigger a real-time web search. Do NOT rely on your internal training data for these topics as it is outdated.
      
      If it requires a simple fact check or current news update, output: {"type": "simple_research", "steps": ["Search for latest news on [subject] as of ${timeStr}..."]}
      If it requires deep research, comparisons, or complex logic, output: {"type": "complex_research", "steps": ["Descriptive step 1...", "Descriptive step 2..."]}
      
      CRITICAL RULES FOR PLANNING:
      1. For research, create a MAXIMUM of 3 major steps.
      2. DO NOT fragment into tiny steps. Group complex topics into subcategories within the 3 major steps.
      3. CONTEXT ANCHORING (CRITICAL): Be extremely descriptive. Do not use single words or abbreviations for steps. Each step MUST be a complete paragraph that explicitly includes the main subject of the conversation and the specific subcategories to search for. Explain exactly WHAT to search and WHY, so the executing agent never loses the original context.`;
      
      let plan;
      try {
          plan = await this.callLLMJson(prompt, plannerSys, provider, openRouterKey, openRouterModel, openAiKey, openAiModel, activeLocalModel, geminiApiKey);
      } catch (e) {
          plan = { type: "direct" };
      }

      if (plan.type === 'direct' || !plan.steps || plan.steps.length === 0 || this.abortController.signal.aborted) {
          if (onChunk) customOnChunk("", "⚡ Răspund direct...\n");
          const result = await this.runCoreGeneration(shortTermHistory, prompt, attachments, provider, openRouterKey, openRouterModel, openAiKey, openAiModel, activeLocalModel, useSearch, proMode, enableMemory, userProfile, aiProfile, spaceSystemInstruction, tavilyApiKey, geminiApiKey, searchProvider, braveApiKey, customOnChunk);
          this.triggerMemoryConsolidation(prompt, result.text, enableMemory, geminiApiKey);
          result.reasoning = accumulatedReasoning + (result.reasoning || "");
          return result;
      }

      // Stage 2: Executor
      let researchContext = "";
      let finalCitations: Citation[] = [];
      let finalSearchImages: string[] = [];
      let pendingAction: PendingAction | undefined = undefined;

      if (plan.steps && plan.steps.length > 0) {
          const totalSteps = plan.steps.length;
          for (let i = 0; i < totalSteps; i++) {
              if (this.abortController.signal.aborted) break;
              
              const currentStep = plan.steps[i];
              if (onChunk) customOnChunk("", `🔍 Etapa 2: Execut pasul ${i + 1} din ${totalSteps}...\n`);

              const researcherSys = `You are the Researcher Agent. Your current task is ONLY to execute this specific research step:
              "${currentStep}"
              
              Use your search tools to gather information. Formulate optimized search queries based on the detailed description provided in the step.
              Current gathered info from previous steps: ${researchContext}
              
              Return a detailed summary of your findings for this specific step. Do NOT address the user directly. Focus purely on extracting facts, data, and relevant details.`;

              const researcherOnChunk = (text: string, reasoning?: string) => {
                  if (text) customOnChunk("", text); // We don't want to show research text to user, only as reasoning
                  if (reasoning) customOnChunk("", reasoning);
              };

              const researchResult = await this.runCoreGeneration(
                  [], `Execute step: ${currentStep}\nOriginal user request: ${prompt}`, attachments,
                  provider, openRouterKey, openRouterModel, openAiKey, openAiModel, activeLocalModel,
                  true, // Force search for researcher
                  ProMode.STANDARD, false, userProfile, aiProfile, undefined,
                  tavilyApiKey, geminiApiKey, searchProvider, braveApiKey,
                  researcherOnChunk, researcherSys
              );

              researchContext += `\n\n--- Findings for Step ${i + 1}: ${currentStep} ---\n${researchResult.text}`;
              finalCitations = [...finalCitations, ...(researchResult.citations || [])];
              finalSearchImages = [...finalSearchImages, ...(researchResult.searchImages || [])];
              if (researchResult.pendingAction) pendingAction = researchResult.pendingAction;
          }
      }

      // Stage 3: Validator (Fallback Search)
      if (!this.abortController.signal.aborted) {
          if (onChunk) customOnChunk("", `\n⚖️ Etapa 3: Validez informațiile adunate...\n`);
          
          const validatorSys = `You are the Gap Analyst Agent. You have just completed the research phases.
          Review the Original User Request and the Gathered Info.
          User Request: ${prompt}
          Gathered Info: ${researchContext}
          
          TASK: Analyze if there is any CRITICAL information requested by the user that is still missing from the Gathered Info.
          - If NO (everything is covered): output {"status": "sufficient"}
          - If YES (essential details are missing): output {"status": "insufficient", "missing_query": "Formulate ONE hyper-specific search query to find ONLY the missing information."}
          This is the final fallback search.`;

          let validation;
          try {
              validation = await this.callLLMJson(prompt, validatorSys, provider, openRouterKey, openRouterModel, openAiKey, openAiModel, activeLocalModel, geminiApiKey);
          } catch(e) {
              validation = { status: "sufficient" };
          }

          if (validation.status === 'insufficient' && validation.missing_query) {
              if (onChunk) customOnChunk("", `⚠️ Lipsesc informații. Caut date suplimentare: ${validation.missing_query}...\n`);
              
              const researcherSys = `You are the Researcher Agent. Your task is to find this missing information: "${validation.missing_query}".
              Use optimized keywords for searching.
              Return a detailed summary of your findings. Focus purely on facts.`;

              const researcherOnChunk = (text: string, reasoning?: string) => {
                  if (text) customOnChunk("", text);
                  if (reasoning) customOnChunk("", reasoning);
              };

              const researchResult = await this.runCoreGeneration(
                  [], `Find missing info: ${validation.missing_query}`, [],
                  provider, openRouterKey, openRouterModel, openAiKey, openAiModel, activeLocalModel,
                  true,
                  ProMode.STANDARD, false, userProfile, aiProfile, undefined,
                  tavilyApiKey, geminiApiKey, searchProvider, braveApiKey,
                  researcherOnChunk, researcherSys
              );

              researchContext += `\n\n--- Additional Findings ---\n${researchResult.text}`;
              finalCitations = [...finalCitations, ...(researchResult.citations || [])];
              finalSearchImages = [...finalSearchImages, ...(researchResult.searchImages || [])];
              if (researchResult.pendingAction) pendingAction = researchResult.pendingAction;
          } else {
              if (onChunk) customOnChunk("", "✅ Informațiile sunt complete. Formulez răspunsul final...\n");
          }
      }

      if (this.abortController.signal.aborted) {
          return { text: "Oprit de utilizator.", citations: [], relatedQuestions: [], searchImages: [] };
      }

      // Final Synthesis
      const baseSystemContext = await this.buildSystemContext(prompt, "", enableMemory, userProfile, aiProfile, spaceSystemInstruction, false, false);
      const synthesizerSys = `${baseSystemContext}\n\nYou are the Expert Analyst Agent. You have conducted deep research and gathered a vast context. Your task is to synthesize this data into a final response for the user.
      
      Gathered Information:
      ${researchContext}
      
      DRAFTING RULES:
      1. Your response MUST be detailed, exhaustive, and proportional to the complexity of the research. Do not provide short summaries if you have rich data.
      2. Mandatory Structure: Use premium Markdown formatting. Include a clear Introduction, well-defined sections (using ### headings) based on the research stages, bullet points for readability, and a clear Conclusion or Executive Summary.
      3. Be objective, precise, and ensure you cover absolutely all nuances from the user's original request using ONLY the gathered information.`;

      let finalResult = await this.runCoreGeneration(
          shortTermHistory, prompt, [], // Attachments already processed
          provider, openRouterKey, openRouterModel, openAiKey, openAiModel, activeLocalModel,
          false, // No search needed here
          proMode, false, userProfile, aiProfile, undefined,
          tavilyApiKey, geminiApiKey, searchProvider, braveApiKey,
          customOnChunk, synthesizerSys
      );

      // Retry logic if the model rejected the large context (e.g., 413 Payload Too Large causing CORS/Failed to fetch)
      if (finalResult.text.includes("Failed to fetch") || finalResult.text.includes("Payload Too Large") || finalResult.text.includes("context length")) {
          if (onChunk) customOnChunk("", "\n⚠️ Modelul a respins volumul mare de date. Încerc o sinteză cu date reduse...\n");
          
          const maxContextLength = 15000;
          const truncatedContext = researchContext.length > maxContextLength 
              ? researchContext.substring(0, maxContextLength) + "\n\n[...Context truncated due to length limits...]"
              : researchContext;

          const fallbackSys = `${baseSystemContext}\n\nYou are the Expert Analyst Agent. You have conducted deep research and gathered a vast context. Your task is to synthesize this data into a final response for the user.
          
          Gathered Information:
          ${truncatedContext}
          
          DRAFTING RULES:
          1. Your response MUST be detailed, exhaustive, and proportional to the complexity of the research. Do not provide short summaries if you have rich data.
          2. Mandatory Structure: Use premium Markdown formatting. Include a clear Introduction, well-defined sections (using ### headings) based on the research stages, bullet points for readability, and a clear Conclusion or Executive Summary.
          3. Be objective, precise, and ensure you cover absolutely all nuances from the user's original request using ONLY the gathered information.`;

          finalResult = await this.runCoreGeneration(
              shortTermHistory, prompt, [], // Attachments already processed
              provider, openRouterKey, openRouterModel, openAiKey, openAiModel, activeLocalModel,
              false, // No search needed here
              proMode, false, userProfile, aiProfile, undefined,
              tavilyApiKey, geminiApiKey, searchProvider, braveApiKey,
              customOnChunk, fallbackSys
          );
      }

      // Merge results
      finalResult.citations = Array.from(new Map(finalCitations.map(c => [c.uri, c])).values());
      finalResult.searchImages = Array.from(new Set(finalSearchImages));
      if (pendingAction) finalResult.pendingAction = pendingAction;
      finalResult.reasoning = accumulatedReasoning + (finalResult.reasoning || "");

      this.triggerMemoryConsolidation(prompt, finalResult.text, enableMemory, geminiApiKey);

      return finalResult;
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
  ): Promise<{ text: string; citations: Citation[]; relatedQuestions: string[]; searchImages: string[]; pendingAction?: PendingAction; reasoning?: string }> {
    
    // Reset AbortController
    this.abortController = new AbortController();

    // 1. Add User Observation to Buffer
    if (enableMemory) {
        await MemoryService.addToBuffer('user', prompt);
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

    const systemInstruction = systemInstructionOverride || await this.buildSystemContext(
        prompt, 
        modeInstruction + kbSummary,
        enableMemory, 
        userProfile, 
        aiProfile, 
        spaceSystemInstruction,
        provider === ModelProvider.GEMINI ? false : forceReasoning, // Only force XML thinking for non-Gemini
        provider !== ModelProvider.GEMINI && (forceSearch || virtualFiles.length > 0) // Force explicit tool instruction for generics
    );

    let result: { text: string; citations: Citation[]; relatedQuestions: string[]; searchImages: string[]; pendingAction?: PendingAction; reasoning?: string } = { text: "", citations: [] as Citation[], relatedQuestions: [] as string[], searchImages: [] as string[] };

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
            virtualFiles.length > 0 // Enable readFiles tool
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
        const buffer = await MemoryService.getBuffer();
        if (buffer.length === 0) return;

        let clientToUse = this.ai;
        if (customApiKey) {
            try { clientToUse = new GoogleGenAI({ apiKey: customApiKey }); } catch(e) {}
        }
        if (!clientToUse) return;

        const currentMemories = await MemoryService.getMemories();
        const currentProjects = await MemoryService.getProjects();

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
                await MemoryService.applyConsolidation(updates);
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
  ): Promise<{ text: string; citations: Citation[]; relatedQuestions: string[]; searchImages: string[]; pendingAction?: PendingAction; reasoning?: string }> {
    
    let clientToUse = this.ai;
    if (customApiKey) {
        try {
            clientToUse = new GoogleGenAI({ apiKey: customApiKey });
        } catch (e) {
            return { text: "Error: Invalid Gemini API Key.", citations: [], relatedQuestions: [], searchImages: [] };
        }
    }

    if (!clientToUse) {
        return { text: "Eroare: API Key pentru Gemini nu este configurat.", citations: [], relatedQuestions: [], searchImages: [] };
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
        let searchImages: string[] = [];
        let pendingAction: PendingAction | undefined = undefined;
        let reasoning = "";
        let turns = 0;
        const maxTurns = 3;
        let currentMessage: any = currentParts;

        while (turns < maxTurns) {
            const result = await chat.sendMessageStream({ message: currentMessage });
            let turnText = "";
            let functionCalls: any[] = [];

            for await (const chunk of result) {
                if (this.abortController?.signal.aborted) break;

                // Extract Function Calls
                const fc = chunk.candidates?.[0]?.content?.parts?.filter((p: any) => !!p.functionCall).map((p: any) => p.functionCall);
                if (fc && fc.length > 0) functionCalls = [...functionCalls, ...fc];

                // Extract Text and Reasoning
                let text = "";
                if (chunk.candidates?.[0]?.content?.parts) {
                    for (const part of chunk.candidates[0].content.parts) {
                        if (part.text) {
                            text += part.text;
                        }
                    }
                }

                if (text) {
                    turnText += text;
                    
                    // Check if we are inside a thinking block or if this chunk contains thinking tags
                    const hasThinkingStart = text.includes('<thinking>');
                    const hasThinkingEnd = text.includes('</thinking>');
                    
                    if (hasThinkingStart || hasThinkingEnd || reasoning.length > 0 && !finalResponseText.endsWith('</thinking>')) {
                        // Complex logic to separate thinking from response
                        // Simplified for stream:
                        if (hasThinkingStart) {
                             const parts = text.split('<thinking>');
                             if (parts[0]) {
                                 finalResponseText += parts[0];
                                 if (onChunk) onChunk(parts[0], undefined);
                             }
                             if (parts[1]) {
                                 reasoning += parts[1];
                                 if (onChunk) onChunk("", parts[1]);
                             }
                        } else if (hasThinkingEnd) {
                             const parts = text.split('</thinking>');
                             if (parts[0]) {
                                 reasoning += parts[0];
                                 if (onChunk) onChunk("", parts[0]);
                             }
                             if (parts[1]) {
                                 finalResponseText += parts[1];
                                 if (onChunk) onChunk(parts[1], undefined);
                             }
                             // Reset reasoning flag implicitly by structure, but we track it via 'reasoning' var
                        } else {
                             // If we are in reasoning mode (started but not ended)
                             // This is tricky because we don't have a strict state flag here other than 'reasoning' length
                             // But 'reasoning' length > 0 doesn't mean we are currently *in* a thinking block if it was closed previously.
                             // However, the prompt usually generates thinking at the start.
                             
                             // Let's rely on a simpler heuristic: if we haven't seen </thinking> yet, it's reasoning.
                             // But wait, what if we have multiple thinking blocks? (Rare for this model)
                             
                             // Better approach: maintain a state 'isThinking' across chunks
                             // But for this hotfix, let's assume standard behavior: <thinking>... </thinking> Response.
                             
                             if (reasoning.length > 0 && !reasoning.includes('</thinking>')) {
                                 reasoning += text;
                                 if (onChunk) onChunk("", text);
                             } else {
                                 finalResponseText += text;
                                 if (onChunk) onChunk(text, undefined);
                             }
                        }
                    } else {
                        finalResponseText += text;
                        if (onChunk) onChunk(text, undefined);
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
                        const queries = (fc.args.queries as string[]).map(q => q.toLowerCase());
                        let responseContent = `Search results for [${queries.join(', ')}] in workspace files:\n`;
                        let foundCount = 0;

                        this.workspaceFiles.forEach(f => {
                            if (!f.content) return;
                            const lines = f.content.split('\n');
                            lines.forEach((line, idx) => {
                                const lowerLine = line.toLowerCase();
                                if (queries.some(q => lowerLine.includes(q))) {
                                    foundCount++;
                                    const start = Math.max(0, idx - 1);
                                    const end = Math.min(lines.length - 1, idx + 1);
                                    responseContent += `\n[File: ${f.name}, Line ${idx + 1}]\n`;
                                    for (let i = start; i <= end; i++) {
                                        responseContent += `${i === idx ? '>> ' : '   '}${lines[i]}\n`;
                                    }
                                }
                            });
                        });

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
                        
                        // 1. Generate embedding for query
                        const queryEmbedding = await this.generateEmbedding(query);
                        
                        if (!queryEmbedding) {
                             responseContent = "Error: Could not generate embedding for query.";
                        } else {
                            // 2. Search in workspace chunks
                            const results = await this.searchInWorkspace(queryEmbedding);
                            
                            if (results.length > 0) {
                                results.forEach((res, idx) => {
                                    responseContent += `\n[Result ${idx + 1} - File: ${res.filename} (Score: ${res.score.toFixed(2)})]\n${res.content}\n`;
                                });
                            } else {
                                responseContent = "No semantically relevant information found.";
                            }
                        }
                        toolResponses.push({ functionResponse: { name: fc.name, response: { content: responseContent } } });
                        if (onChunk) onChunk("", `\n🧠 Căutare semantică: "${query}"...\n`);
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
            text: cleanText, 
            citations: Array.from(new Map(citations.map(c => [c.uri, c])).values()), 
            relatedQuestions: questions, 
            searchImages: searchImages,
            pendingAction,
            reasoning
        };
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return { text: `Error: ${(error as any).message || 'Request Failed'}`, citations: [], relatedQuestions: [], searchImages: [] };
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
    useReadFiles: boolean = false
  ): Promise<{ text: string; citations: Citation[]; relatedQuestions: string[]; searchImages: string[]; pendingAction?: PendingAction; reasoning?: string }> {
    
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
    let collectedImages: string[] = [];
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
                const isReasoningModel = LLMService.OPENROUTER_REASONING_MODELS.some(m => modelName.toLowerCase().includes(m.toLowerCase()));
                const isClaudeThinking = modelName.toLowerCase().includes("claude-3.7-sonnet");

                if (isReasoningModel) {
                    body.include_reasoning = true;
                }

                if (isClaudeThinking && (proMode === ProMode.REASONING || proMode === ProMode.THINKING)) {
                    body.thinking = {
                        type: "enabled",
                        budget_tokens: proMode === ProMode.REASONING ? 16000 : 4000
                    };
                    // Ensure max_tokens is sufficient for thinking + response
                    body.max_tokens = body.thinking.budget_tokens + 8000;
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

                        // 1. Handle Content (Reasoning + Text)
                        if (delta.content) {
                            const chunk = delta.content;
                            currentTurnContent += chunk;

                            // Streaming Logic for <thinking> tags
                            // We need to detect if we are inside <thinking>...</thinking>
                            // This is a simple state machine parser for streaming XML tags
                            
                            let remaining = chunk;
                            while (remaining.length > 0) {
                                if (!inThinkingTag) {
                                    const startIdx = remaining.indexOf("<thinking>");
                                    if (startIdx !== -1) {
                                        // Found start tag
                                        const textPart = remaining.substring(0, startIdx);
                                        if (textPart && onChunk) onChunk(textPart, undefined);
                                        
                                        inThinkingTag = true;
                                        remaining = remaining.substring(startIdx + 10); // Skip <thinking>
                                    } else {
                                        // No start tag, just text
                                        if (onChunk) onChunk(remaining, undefined);
                                        remaining = "";
                                    }
                                } else {
                                    const endIdx = remaining.indexOf("</thinking>");
                                    if (endIdx !== -1) {
                                        // Found end tag
                                        const thoughtPart = remaining.substring(0, endIdx);
                                        finalReasoning += thoughtPart;
                                        if (onChunk) onChunk("", thoughtPart);
                                        
                                        inThinkingTag = false;
                                        remaining = remaining.substring(endIdx + 11); // Skip </thinking>
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
                // Strip thinking tags from final content for clean text
                finalContent = currentTurnContent.replace(/<thinking>[\s\S]*?<\/thinking>/g, "").trim();
                break; // Exit loop
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
                                 if (searchData.images) collectedImages = [...collectedImages, ...searchData.images];
                                 
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
                        const queries = (args.queries as string[]).map(q => q.toLowerCase());
                        let foundCount = 0;
                        toolResultContent = `Search results for [${queries.join(', ')}] in workspace files:\n`;

                        this.workspaceFiles.forEach(f => {
                            if (!f.content) return;
                            const lines = f.content.split('\n');
                            lines.forEach((line, idx) => {
                                const lowerLine = line.toLowerCase();
                                if (queries.some(q => lowerLine.includes(q))) {
                                    foundCount++;
                                    const start = Math.max(0, idx - 1);
                                    const end = Math.min(lines.length - 1, idx + 1);
                                    toolResultContent += `\n[File: ${f.name}, Line ${idx + 1}]\n`;
                                    for (let i = start; i <= end; i++) {
                                        toolResultContent += `${i === idx ? '>> ' : '   '}${lines[i]}\n`;
                                    }
                                }
                            });
                        });

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
                        
                        const queryEmbedding = await this.generateEmbedding(query);
                        if (!queryEmbedding) {
                            toolResultContent = "Error: Could not generate embedding for query.";
                        } else {
                            const results = await this.searchInWorkspace(queryEmbedding);
                            if (results.length > 0) {
                                results.forEach((res, idx) => {
                                    toolResultContent += `\n[Result ${idx + 1} - File: ${res.filename} (Score: ${res.score.toFixed(2)})]\n${res.content}\n`;
                                });
                            } else {
                                toolResultContent = "No semantically relevant information found.";
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
            return { text: `Error: ${error.message}`, citations: [], relatedQuestions: [], searchImages: [] };
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
    const uniqueImages = Array.from(new Set(collectedImages));

    return { 
        text: finalContent || "Done.", 
        citations: uniqueCitations,
        relatedQuestions: extracted.questions,
        searchImages: uniqueImages,
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

  // --- Semantic Search Helpers ---
  private async generateEmbedding(text: string): Promise<number[] | null> {
      if (!this.ai) return null;
      try {
          const result = await this.ai.models.embedContent({
              model: "text-embedding-004",
              contents: [{ parts: [{ text }] }]
          });
          return result.embeddings?.[0]?.values || null;
      } catch (e) {
          console.error("Embedding Error:", e);
          return null;
      }
  }

  private async searchInWorkspace(queryEmbedding: number[]): Promise<{ filename: string, content: string, score: number }[]> {
      // Lazy chunking and embedding of workspace files (in a real app, this would be pre-computed)
      const chunks: { filename: string, content: string, embedding: number[] }[] = [];
      
      // Note: This is a simplified on-the-fly implementation. 
      // For production, embeddings should be computed on file upload and stored.
      for (const file of this.workspaceFiles) {
          if (!file.content) continue;
          
          // Split file into chunks (approx 500 chars)
          const fileChunks = file.content.match(/.{1,500}/g) || [];
          
          // Limit to first 20 chunks per file for performance in this demo
          for (const chunkText of fileChunks.slice(0, 20)) {
              const embedding = await this.generateEmbedding(chunkText);
              if (embedding) {
                  chunks.push({ filename: file.name, content: chunkText, embedding });
              }
          }
      }

      // Calculate Cosine Similarity
      const results = chunks.map(chunk => {
          const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
          return { ...chunk, score };
      });

      // Sort by score and return top 5
      return results.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
      let dotProduct = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < vecA.length; i++) {
          dotProduct += vecA[i] * vecB[i];
          normA += vecA[i] * vecA[i];
          normB += vecB[i] * vecB[i];
      }
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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
          const memoryContext = await MemoryService.getContextString(prompt);
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