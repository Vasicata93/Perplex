

export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface Citation {
  uri: string;
  title: string;
}

export interface Attachment {
  type: 'image' | 'text';
  content: string; // Base64 or text content
  mimeType: string;
  name: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  citations?: Citation[];
  attachments?: Attachment[];
  relatedQuestions?: string[]; // Suggested follow-up questions
  timestamp: number;
  isThinking?: boolean; // UI State: Is currently generating?
  reasoning?: string;   // Content: The internal thought process
}

export interface Thread {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  spaceId?: string; // Link thread to a space
  metadata?: {
    linkedNoteId?: string;
    isSideChat?: boolean;
    [key: string]: any;
  };
}

export interface Space {
  id: string;
  title: string;
  emoji: string;
  description: string;
  systemInstructions: string;
  files: Attachment[]; // Knowledge base
  createdAt: number;
}

// Updated Interface for Library/Notes (Notion Style)
export interface Note {
  id: string;
  title: string;
  content: string;
  
  // Notion-like properties
  emoji?: string;
  cover?: string; // CSS gradient or image URL
  tags?: string[];
  status?: 'Idea' | 'In Progress' | 'Done';
  
  // New Page Properties
  isFavorite?: boolean;
  isLocked?: boolean;
  isOffline?: boolean;
  fontStyle?: 'sans' | 'serif' | 'mono';

  // Nesting support
  parentId?: string;

  category?: string;
  updatedAt: number;
}

// ENUM for Memory Categories
export type MemoryCategory = 
  | 'about_me' 
  | 'work' 
  | 'projects' 
  | 'relationships' 
  | 'preferences' 
  | 'health' 
  | 'diet'       
  | 'hobbies'    
  | 'entertainment' 
  | 'coding'     
  | 'goals'      
  | 'events'     
  | 'style'      
  | 'learning' 
  | 'travel' 
  | 'explicit_save' 
  | 'skills'     // New: Procedural rules
  | 'workflows'  // New: Recurring habits
  | 'finance'    // New: Added based on analysis
  | 'other';

export type MemoryType = 'fact' | 'goal' | 'skill' | 'project' | 'preference';

export interface MemoryItem {
  id: string;
  content: string; // The fact/preference
  category: MemoryCategory;
  type: MemoryType;
  confidence: number; // 0 to 1
  tags: string[];
  createdAt: number;
  updatedAt: number;
  
  // New Metadata for Scoring
  lastAccessedAt?: number;
  usageCount?: number;
  importance?: 1 | 2 | 3 | 4 | 5; 
}

// Structured Object for Memory Retrieval
export interface MemoryContext {
  core: MemoryItem[];      // Identity, Style, Preferences
  working: string[];       // Active Projects, Buffer Summary
  relevant: MemoryItem[];  // Facts filtered by Intent
  intent: string;          // Detected Intent (e.g. "Coding", "Health")
}

export interface MemoryBufferItem {
  role: 'user' | 'model' | 'tool';
  content: string;
  timestamp: number;
}

export interface Project {
  id: string;
  title: string;
  status: 'active' | 'on_hold' | 'completed';
  progress: string; // "30%" or "Drafting phase"
  nextStep: string;
  techStack: string[];
  lastUpdated: number;
}

export enum ModelProvider {
  GEMINI = 'gemini',
  LOCAL = 'local', // Renamed from OLLAMA/LMSTUDIO to generic LOCAL
  OPENROUTER = 'openrouter', // Cloud generic
  OPENAI = 'openai' // Cloud
}

export enum FocusMode {
  WEB_SEARCH = 'web_search',
  ALL = 'all',
  LIBRARY = 'library'
}

// New Pro Modes for "Reasoning/Thinking" area
export enum ProMode {
  STANDARD = 'standard', // Default - Fast, no heavy reasoning
  REASONING = 'reasoning', // Heavy thinking budget
  THINKING = 'thinking',   // Moderate thinking, logical steps
  RESEARCH = 'research',   // Search heavy, deep dive
  LEARNING = 'learning',   // Educational tone
  SHOPPING = 'shopping'    // Product search focus
}

export interface LocalModelConfig {
  id: string;
  name: string; // Friendly name (e.g., "Llama 3.2 1B")
  modelId: string; // Internal ID
  fileSize: string; // e.g. "1.2 GB"
  description: string;
  isDownloaded: boolean;
  downloadProgress?: number; // 0-100
  family: 'llama' | 'gemma' | 'mistral' | 'phi' | 'qwen';
}

export interface UserProfile {
  name: string;
  avatar?: string; // Base64 encoded image
  bio: string; // "About You"
  location: string;
}

export interface AiProfile {
  systemInstructions: string; // Global custom instructions
  language: string;
}

export interface AppSettings {
  // Model Configuration
  modelProvider: ModelProvider;
  geminiApiKey: string; // Specific key for Gemini (optional override)
  openRouterApiKey: string; // Specific key for OpenRouter
  openRouterModelId: string; // Specific model for OpenRouter
  openAiApiKey: string; // Specific key for OpenAI
  openAiModelId: string; // Specific model for OpenAI
  
  // Search Configuration
  searchProvider: 'tavily' | 'brave'; // Selector
  tavilyApiKey: string; 
  braveApiKey: string; // NEW: Key for Brave Search
  
  // Local/Custom Models Configuration
  localModels: LocalModelConfig[]; // Array of downloaded models
  activeLocalModelId: string;

  useSearch: boolean;
  defaultProMode: ProMode; // Default mode for the left button
  enableMemory: boolean; // Toggle for memory system
  
  // General Preferences
  theme: 'system' | 'dark' | 'light';
  textSize: 'small' | 'medium' | 'large';
  searchRegion: 'global' | 'us' | 'uk' | 'eu' | 'asia';
  interfaceLanguage: 'en' | 'ro'; // New setting for UI Language
  
  // Mobile Dock Settings
  enableMobileDock: boolean;
  dockShortcuts: string[]; // IDs of pages for the two custom slots

  // Perplexity-style Profiles
  userProfile: UserProfile;
  aiProfile: AiProfile;
}

export const DEFAULT_SETTINGS: AppSettings = {
  modelProvider: ModelProvider.GEMINI,
  geminiApiKey: '',
  openRouterApiKey: '',
  openRouterModelId: 'openai/gpt-4o', 
  openAiApiKey: '',
  openAiModelId: 'gpt-4o', 
  
  searchProvider: 'tavily',
  tavilyApiKey: '', 
  braveApiKey: '',

  localModels: [], // Starts empty, populated by downloads
  activeLocalModelId: '',
  useSearch: true,
  defaultProMode: ProMode.STANDARD,
  enableMemory: true,
  theme: 'dark',
  textSize: 'medium',
  searchRegion: 'global',
  interfaceLanguage: 'en',
  enableMobileDock: false,
  dockShortcuts: [],
  userProfile: {
    name: 'User',
    bio: '',
    location: ''
  },
  aiProfile: {
    systemInstructions: '',
    language: 'English'
  }
};

// --- New Type for Pending Actions ---
export interface PendingAction {
  type: 'create_page' | 'update_page' | 'block_operation' | 'calendar_event';
  data: any;
  originalToolCallId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: number; // Timestamp
  endDate: number;   // Timestamp
  allDay?: boolean;
  location?: string;
  color?: string;    // Hex code or Tailwind class
  category?: 'work' | 'personal' | 'meeting' | 'task' | 'other';
  attendees?: string[]; // Emails or names
}

export type PdfTemplate = 'report' | 'cv' | 'simple';