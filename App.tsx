

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { InputArea } from './components/InputArea';
import { SettingsModal } from './components/SettingsModal';
import { SpacesModal } from './components/SpacesModal';
import { NotesView } from './components/NotesView';
import { ChatHeader } from './components/ChatHeader';
import { DashboardView } from './components/DashboardView';
import { CalendarView } from './components/CalendarView';
import { ActionConfirmation } from './components/ActionConfirmation';
import { SideChatPanel } from './components/SideChatPanel';
import { MobileDock } from './components/MobileDock';
import { TornadoIndicator } from './components/TornadoIndicator';
import { MessageRenderer } from './components/MessageRenderer';
import { PerplexityLogo } from './constants';
import { Role, Message, Thread, AppSettings, DEFAULT_SETTINGS, ModelProvider, FocusMode, Attachment, Space, Note, ProMode, PendingAction, CalendarEvent } from './types';
import { RAGService } from './services/ragService';
import { LLMService } from './services/geminiService';
import { askAgentMax } from './src/services/agentMaxService';
import { BlockService } from './services/blockService';
import { getMemoryContext, saveToMemory } from './src/services/mastraMemoryService';
import { Block } from './types/blockStructure';
import {
    User, BookOpen, FileText, Globe, Copy, ChevronLeft, ChevronRight, X,
    Star, MoreHorizontal, Download, Upload, Trash2, Wifi, Lock, FileEdit, ClipboardCopy,
    CopyPlus, Languages, FolderInput, Undo2, Brain, ArrowRight,
    RefreshCw, Share2, FolderPlus, Pencil, Check, ArrowDown, MessageSquare, Plus
} from 'lucide-react';
import { db, STORES } from './services/db';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

import { SpaceFilesModal } from './components/SpaceFilesModal';

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- Premium Tornado Thinking Component (Updated: Persistent Visibility) ---
function App() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isSpaceFilesModalOpen, setIsSpaceFilesModalOpen] = useState(false);
    // NEW: Lifted state from Sidebar to App to control expansion via Back button
    const [expandedSidebarSection, setExpandedSidebarSection] = useState<string | null>(null);

    // Data State
    const [threads, setThreads] = useState<Thread[]>([]);
    const [spaces, setSpaces] = useState<Space[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);

    // UI State - Initialize from SessionStorage to persist on refresh
    const [activeView, setActiveView] = useState<'chat' | 'library' | 'calendar'>(() =>
        (sessionStorage.getItem('pplx_activeView') as 'chat' | 'library' | 'calendar') || 'chat'
    );

    const [activeThreadId, setActiveThreadId] = useState<string | null>(() =>
        sessionStorage.getItem('pplx_activeThreadId') || null
    );

    const [activeSpaceId, setActiveSpaceId] = useState<string | null>(() =>
        sessionStorage.getItem('pplx_activeSpaceId') || null
    );

    const [activeNoteId, setActiveNoteId] = useState<string | null>(() =>
        sessionStorage.getItem('pplx_activeNoteId') || null
    );

    const [isThinking, setIsThinking] = useState(false);
    const [isLearning, setIsLearning] = useState(false);

    // Input State (Lifted from InputArea for persistence)
    const [inputProMode, setInputProMode] = useState<ProMode>(() =>
        (sessionStorage.getItem('pplx_inputProMode') as ProMode) || ProMode.STANDARD
    );
    const [inputIsAgentMode, setInputIsAgentMode] = useState(() =>
        sessionStorage.getItem('pplx_inputIsAgentMode') === 'true'
    );
    const [inputIsLongThinking, setInputIsLongThinking] = useState(() =>
        sessionStorage.getItem('pplx_inputIsLongThinking') === 'true'
    );
    const [inputIsAgentMax, setInputIsAgentMax] = useState(() =>
        sessionStorage.getItem('pplx_inputIsAgentMax') === 'true'
    );

    // Persist Input State
    useEffect(() => {
        sessionStorage.setItem('pplx_inputProMode', inputProMode);
    }, [inputProMode]);

    useEffect(() => {
        sessionStorage.setItem('pplx_inputIsAgentMode', String(inputIsAgentMode));
    }, [inputIsAgentMode]);

    useEffect(() => {
        sessionStorage.setItem('pplx_inputIsLongThinking', String(inputIsLongThinking));
    }, [inputIsLongThinking]);

    useEffect(() => {
        sessionStorage.setItem('pplx_inputIsAgentMax', String(inputIsAgentMax));
    }, [inputIsAgentMax]);

    // Scroll State
    const [showScrollButton, setShowScrollButton] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Message Interaction State
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [activeAddToSpaceId, setActiveAddToSpaceId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Tab & Navigation State
    const [openNoteIds, setOpenNoteIds] = useState<string[]>(() => {
        try {
            return JSON.parse(sessionStorage.getItem('pplx_openNoteIds') || '[]');
        } catch {
            return [];
        }
    });
    const [isPageMenuOpen, setIsPageMenuOpen] = useState(false);

    // Undo/Redo History Ref
    const noteHistoryRef = useRef<{ [key: string]: { stack: string[], pointer: number } }>({});
    const historyDebounceRef = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});

    // Data Loading State
    const [isLoaded, setIsLoaded] = useState(false);

    // Header UI State
    const [isDashboardMode, setIsDashboardMode] = useState(() =>
        sessionStorage.getItem('pplx_isDashboardMode') === 'true'
    );
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);

    // Pending Actions (Human in the loop)
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

    // NEW: Track focused message for Read Aloud and Dashboard
    const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);

    // Track visible messages to determine focus
    useEffect(() => {
        const activeThread = threads.find(t => t.id === activeThreadId);
        if (!activeThread?.messages.length || activeView !== 'chat') return;

        const observer = new IntersectionObserver(
            (entries) => {
                // Find the entry that is most visible or intersecting
                const visibleEntries = entries.filter(e => e.isIntersecting);
                if (visibleEntries.length > 0) {
                    // Sort by intersection ratio (most visible first)
                    visibleEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
                    const bestCandidate = visibleEntries[0];
                    const msgId = bestCandidate.target.getAttribute('data-message-id');
                    if (msgId) {
                        setFocusedMessageId(msgId);
                    }
                }
            },
            {
                root: chatContainerRef.current, // Use the chat container as root
                threshold: [0.1, 0.5, 0.9], // Check at different visibility levels
                rootMargin: '-10% 0px -50% 0px' // Focus area is top half of screen roughly
            }
        );

        // Wait for render
        setTimeout(() => {
            const messageElements = document.querySelectorAll('[data-message-id]');
            messageElements.forEach(el => observer.observe(el));
        }, 500);

        return () => observer.disconnect();
    }, [activeThreadId, threads, activeView]);

    // Audio Refs
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    // Modals
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [spacesModalOpen, setSpacesModalOpen] = useState(false);
    const [spaceModalInitialId, setSpaceModalInitialId] = useState<string | null>(null);

    // Side Chat State
    const [isSideChatOpen, setIsSideChatOpen] = useState(false);
    const [chatMode, setChatMode] = useState<'sidebar' | 'floating'>('sidebar');
    const [sideChatThreadId, setSideChatThreadId] = useState<string | null>(null);

    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [backupSettings, setBackupSettings] = useState<AppSettings | null>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    const handleUpdateSettings = (newSettings: Partial<AppSettings>, persist: boolean = true) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            if (persist && isLoaded) {
                db.set(STORES.SETTINGS, 'app_settings', updated);
            }
            return updated;
        });
    };

    const handleOpenSettings = () => {
        setBackupSettings(settings);
        setSettingsOpen(true);
    };

    const handleSaveSettings = (newSettings: AppSettings) => {
        setSettings(newSettings);
        db.set(STORES.SETTINGS, 'app_settings', newSettings);
        setSettingsOpen(false);
        setBackupSettings(null);
    };

    const handleCancelSettings = () => {
        if (backupSettings) {
            setSettings(backupSettings);
        }
        setSettingsOpen(false);
        setBackupSettings(null);
    };

    // Initialize Service
    const [llmService] = useState(() => new LLMService());

    const touchStartRef = useRef<number | null>(null);
    const touchYRef = useRef<number | null>(null);
    const isStoppedRef = useRef(false);

    // Persist State to SessionStorage (Refresh safety)
    useEffect(() => {
        sessionStorage.setItem('pplx_activeView', activeView);

        if (activeThreadId) sessionStorage.setItem('pplx_activeThreadId', activeThreadId);
        else sessionStorage.removeItem('pplx_activeThreadId');

        if (activeSpaceId) sessionStorage.setItem('pplx_activeSpaceId', activeSpaceId);
        else sessionStorage.removeItem('pplx_activeSpaceId');

        if (activeNoteId) sessionStorage.setItem('pplx_activeNoteId', activeNoteId);
        else sessionStorage.removeItem('pplx_activeNoteId');

        sessionStorage.setItem('pplx_openNoteIds', JSON.stringify(openNoteIds));
        sessionStorage.setItem('pplx_isDashboardMode', String(isDashboardMode));
    }, [activeView, activeThreadId, activeSpaceId, activeNoteId, openNoteIds, isDashboardMode]);

    // Subscribe to Learning State
    useEffect(() => {
        llmService.subscribeToLearningState((state) => {
            setIsLearning(state);
        });
    }, [llmService]);

    // Auto-close Side Chat when navigating away from a Note or opening modals
    useEffect(() => {
        if (activeView !== 'library' || !activeNoteId || settingsOpen || spacesModalOpen) {
            setIsSideChatOpen(false);
        }
    }, [activeView, activeNoteId, settingsOpen, spacesModalOpen]);

    // --- Scroll Logic ---
    const scrollToBottom = () => {
        if (chatContainerRef.current) {
            // Force scroll to bottom to ensure last token is visible
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    };

    const handleScroll = () => {
        if (chatContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
            // Show button if we are more than 300px away from the bottom
            const isBottom = scrollHeight - scrollTop - clientHeight < 300;
            setShowScrollButton(!isBottom);

            if (!isBottom) {
                if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
                scrollTimeoutRef.current = setTimeout(() => {
                    setShowScrollButton(false);
                }, 2000);
            } else if (isBottom) {
                if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            }
        }
    };

    // Auto-scroll when switching threads
    useEffect(() => {
        if (activeThreadId) {
            setTimeout(scrollToBottom, 50);
        }
    }, [activeThreadId]);

    // NEW: Auto-scroll during generation (streaming)
    // This effect runs whenever 'threads' updates (which happens on every chunk during generation)
    // OR when 'isThinking' status changes.
    useEffect(() => {
        if (isThinking) {
            scrollToBottom();
        }
    }, [threads, isThinking]);

    // --- THEME & TEXT SIZE APPLICATION ---
    useEffect(() => {
        const root = document.documentElement;
        if (settings.theme === 'system') {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (systemDark) root.classList.add('dark');
            else root.classList.remove('dark');
        } else if (settings.theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        if (settings.textSize === 'small') {
            root.style.fontSize = '14px';
        } else if (settings.textSize === 'large') {
            root.style.fontSize = '18px';
        } else {
            root.style.fontSize = '16px';
        }
    }, [settings.theme, settings.textSize]);

    // --- STATUS BAR & THEME COLOR DYNAMIC UPDATE ---
    useEffect(() => {
        const updateStatusBar = async () => {
            const isDark = document.documentElement.classList.contains('dark');

            // Determine the background color based on the current view
            // Default colors from index.html
            let bgColor = isDark ? '#191919' : '#FFFFFF';

            // Update meta tag for PWA
            let metaThemeColor = document.querySelector('meta[name="theme-color"]');
            if (!metaThemeColor) {
                metaThemeColor = document.createElement('meta');
                metaThemeColor.setAttribute('name', 'theme-color');
                document.head.appendChild(metaThemeColor);
            }
            metaThemeColor.setAttribute('content', bgColor);

            // Update Capacitor Status Bar
            if (Capacitor.isNativePlatform()) {
                try {
                    await StatusBar.setBackgroundColor({ color: bgColor });
                    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
                } catch (e) {
                    console.warn('StatusBar plugin not available or failed:', e);
                }
            }
        };

        // Run after a short delay to ensure DOM classes are updated
        const timeout = setTimeout(updateStatusBar, 100);
        return () => clearTimeout(timeout);
    }, [settings.theme, activeView, activeThreadId, activeNoteId]);

    // Load Data
    useEffect(() => {
        const loadData = async () => {
            try {
                const savedSettings = await db.get<AppSettings>(STORES.SETTINGS, 'app_settings');
                if (savedSettings) {
                    const mergedSettings = { ...DEFAULT_SETTINGS, ...savedSettings };
                    if (!mergedSettings.userProfile) mergedSettings.userProfile = DEFAULT_SETTINGS.userProfile;
                    if (!mergedSettings.aiProfile) mergedSettings.aiProfile = DEFAULT_SETTINGS.aiProfile;
                    // Migrate old local models if they exist in a weird format
                    if (!mergedSettings.localModels || !Array.isArray(mergedSettings.localModels)) {
                        mergedSettings.localModels = [];
                        mergedSettings.activeLocalModelId = '';
                    }
                    setSettings(mergedSettings);
                }
                const savedThreads = await db.get<Thread[]>(STORES.THREADS, 'all_threads');
                if (savedThreads) setThreads(savedThreads);
                const savedSpaces = await db.get<Space[]>(STORES.SPACES, 'all_spaces');
                if (savedSpaces) setSpaces(savedSpaces);
                const savedNotes = await db.get<Note[]>(STORES.NOTES, 'all_notes');
                if (savedNotes) setNotes(savedNotes);
                const savedEvents = await db.get<CalendarEvent[]>(STORES.CALENDAR, 'all_events');
                if (savedEvents) setEvents(savedEvents);

                const urlParams = new URLSearchParams(window.location.search);
                const noteIdParam = urlParams.get('noteId');
                if (noteIdParam && savedNotes) {
                    const targetNote = savedNotes.find(n => n.id === noteIdParam);
                    if (targetNote) {
                        setActiveView('library');
                        setActiveNoteId(noteIdParam);
                        setOpenNoteIds([noteIdParam]);
                        setExpandedSidebarSection('library'); // Ensure section is open
                        noteHistoryRef.current[noteIdParam] = { stack: [targetNote.content], pointer: 0 };
                    }
                }
            } catch (e) {
                console.error("Failed to load data from IndexedDB:", e);
            } finally {
                setIsLoaded(true);
            }
        };
        loadData();

        const handleCalendarUpdate = async () => {
            const savedEvents = await db.get<CalendarEvent[]>(STORES.CALENDAR, 'all_events');
            if (savedEvents) setEvents(savedEvents);
        };

        window.addEventListener('calendar-updated', handleCalendarUpdate);
        return () => window.removeEventListener('calendar-updated', handleCalendarUpdate);
    }, []);

    // --- Calendar Handlers ---
    const handleAddEvent = (eventData: Omit<CalendarEvent, 'id'>) => {
        const newEvent: CalendarEvent = {
            ...eventData,
            id: generateId()
        };
        const updatedEvents = [...events, newEvent];
        setEvents(updatedEvents);
        db.set(STORES.CALENDAR, 'all_events', updatedEvents);
        window.dispatchEvent(new CustomEvent('calendar-updated'));
    };

    const handleUpdateEvent = (id: string, updates: Partial<CalendarEvent>) => {
        const updatedEvents = events.map(e => e.id === id ? { ...e, ...updates } : e);
        setEvents(updatedEvents);
        db.set(STORES.CALENDAR, 'all_events', updatedEvents);
        window.dispatchEvent(new CustomEvent('calendar-updated'));
    };

    const handleDeleteEvent = (id: string) => {
        const updatedEvents = events.filter(e => e.id !== id);
        setEvents(updatedEvents);
        db.set(STORES.CALENDAR, 'all_events', updatedEvents);
        window.dispatchEvent(new CustomEvent('calendar-updated'));
    };

    // Save Data
    useEffect(() => { if (isLoaded) db.set(STORES.THREADS, 'all_threads', threads); }, [threads, isLoaded]);
    useEffect(() => { if (isLoaded) db.set(STORES.SPACES, 'all_spaces', spaces); }, [spaces, isLoaded]);
    useEffect(() => { if (isLoaded) db.set(STORES.NOTES, 'all_notes', notes); }, [notes, isLoaded]);

    const activeThread = threads.find(t => t.id === activeThreadId);
    const activeSpace = spaces.find(s => s.id === activeSpaceId);
    const activeNote = notes.find(n => n.id === activeNoteId);

    // --- Handlers (Identical to previous) ---
    const handleNewThread = () => { setActiveView('chat'); setActiveThreadId(null); setActiveNoteId(null); setIsDashboardMode(false); stopAudio(); };
    const handleBackToNewThread = () => { handleNewThread(); };

    const handleSaveSpace = async (space: Space) => {
        setSpaces(prev => {
            const exists = prev.find(s => s.id === space.id);
            if (exists) return prev.map(s => s.id === space.id ? space : s);
            return [...prev, space];
        });

        // Trigger RAG indexing for all text files in the space
        if (settings.geminiApiKey && space.files) {
            try {
                // 1. Index new/existing files
                for (const file of space.files) {
                    if (file.type === 'text' && file.content) {
                        // Create a pseudo-ID based on name and size to detect changes
                        const fileId = `${space.id}_${file.name}_${file.content.length}`;
                        await RAGService.indexDocument(space.id, fileId, file.name, file.content, settings.geminiApiKey);
                    }
                }
                // Note: We aren't cleaning up deleted files here yet for simplicity, 
                // but we should ideally remove chunks for files no longer in space.files.
            } catch (e) {
                console.error("[RAG] Error indexing space:", e);
            }
        }
    };

    const handleDeleteSpace = async (id: string) => {
        setSpaces(prev => prev.filter(s => s.id !== id));
        if (activeSpaceId === id) setActiveSpaceId(null);

        // Clean up RAG chunks
        try {
            await RAGService.deleteSpace(id);
        } catch (e) {
            console.error("[RAG] Error deleting space chunks:", e);
        }
    };
    const handleNewNote = (parentId?: string, initialContent: string = '', initialTags: string[] = []) => {
        const newNote: Note = {
            id: generateId(),
            title: '',
            content: initialContent,
            updatedAt: Date.now(),
            status: 'Idea',
            tags: initialTags,
            parentId
        };
        setNotes(prev => [newNote, ...prev]);
        navigateToNote(newNote.id);
        setExpandedSidebarSection('library');
    };

    // New: Delete Thread Handler
    const handleDeleteThread = (id: string) => {
        setThreads(prev => prev.filter(t => t.id !== id));
        if (activeThreadId === id) {
            handleNewThread();
        }
    };

    const handleSelectNote = (id: string) => {
        if (id === activeNoteId && activeView === 'library') return;
        navigateToNote(id);
        setExpandedSidebarSection('library');
    };

    const handleCloseTab = (e: React.MouseEvent, id: string) => { e.stopPropagation(); const newOpenIds = openNoteIds.filter(tid => tid !== id); setOpenNoteIds(newOpenIds); if (id === activeNoteId) { const closedIndex = openNoteIds.indexOf(id); if (newOpenIds.length > 0) { const nextId = newOpenIds[Math.max(0, closedIndex - 1)]; navigateToNote(nextId); } else { setActiveNoteId(null); } } };

    // --- Undo / Redo Logic ---
    const handleSaveNote = (note: Note, addToHistory = true, forceSnapshot = false) => {
        setNotes(prev => {
            const exists = prev.find(n => n.id === note.id);
            if (exists) {
                if (addToHistory) {
                    if (historyDebounceRef.current[note.id]) {
                        clearTimeout(historyDebounceRef.current[note.id]);
                    }
                    const pushToHistory = () => {
                        const history = noteHistoryRef.current[note.id] || { stack: [exists.content], pointer: 0 };
                        const currentStackContent = history.stack[history.pointer];
                        if (note.content !== currentStackContent) {
                            const newStack = history.stack.slice(0, history.pointer + 1);
                            newStack.push(note.content);
                            if (newStack.length > 50) newStack.shift();
                            noteHistoryRef.current[note.id] = {
                                stack: newStack,
                                pointer: newStack.length - 1
                            };
                        }
                    };
                    if (forceSnapshot) {
                        pushToHistory();
                    } else {
                        historyDebounceRef.current[note.id] = setTimeout(pushToHistory, 2000);
                    }
                }
                return prev.map(n => n.id === note.id ? note : n);
            }
            return [note, ...prev];
        });
    };

    const handleUndo = () => {
        if (!activeNote) return;
        const history = noteHistoryRef.current[activeNote.id];
        if (historyDebounceRef.current[activeNote.id]) clearTimeout(historyDebounceRef.current[activeNote.id]);
        if (history && history.pointer > 0) {
            const newPointer = history.pointer - 1;
            const prevContent = history.stack[newPointer];
            noteHistoryRef.current[activeNote.id].pointer = newPointer;
            handleSaveNote({ ...activeNote, content: prevContent }, false);
        }
    };

    const handleRedo = () => {
        if (!activeNote) return;
        const history = noteHistoryRef.current[activeNote.id];
        if (historyDebounceRef.current[activeNote.id]) clearTimeout(historyDebounceRef.current[activeNote.id]);
        if (history && history.pointer < history.stack.length - 1) {
            const newPointer = history.pointer + 1;
            const nextContent = history.stack[newPointer];
            noteHistoryRef.current[activeNote.id].pointer = newPointer;
            handleSaveNote({ ...activeNote, content: nextContent }, false);
        }
    };

    const canUndo = activeNote && noteHistoryRef.current[activeNote.id]?.pointer > 0;
    const canRedo = activeNote && noteHistoryRef.current[activeNote.id] && noteHistoryRef.current[activeNote.id].pointer < noteHistoryRef.current[activeNote.id].stack.length - 1;

    const handleDeleteNote = (id: string) => { setNotes(prev => prev.filter(n => n.id !== id)); setOpenNoteIds(prev => prev.filter(tid => tid !== id)); if (activeNoteId === id) setActiveNoteId(null); delete noteHistoryRef.current[id]; };

    // Refactored to accept optional ID for sidebar actions
    const handleDuplicateNote = (noteId?: string) => {
        const targetId = noteId || activeNoteId;
        if (!targetId) return;

        const targetNote = notes.find(n => n.id === targetId);
        if (!targetNote) return;

        const newNote: Note = { ...targetNote, id: generateId(), title: `${targetNote.title} (Copy)`, updatedAt: Date.now() };
        handleSaveNote(newNote);
        setIsPageMenuOpen(false);
    };

    const handleCopyNoteContent = () => { if (activeNote) { navigator.clipboard.writeText(activeNote.content); setIsPageMenuOpen(false); } };

    // --- Side Chat Logic ---

    const handleClearSideChat = () => {
        if (sideChatThreadId) {
            setThreads(prev => prev.map(t => t.id === sideChatThreadId ? { ...t, messages: [] } : t));
        }
    };

    const handleSideChatToggle = async () => {
        if (isSideChatOpen) {
            setIsSideChatOpen(false);
            return;
        }

        if (!activeNoteId) {
            // Should not happen if button is only visible in library mode
            return;
        }

        const currentNote = notes.find(n => n.id === activeNoteId);
        if (!currentNote) return;

        // 1. Check if there's an existing thread linked to this note
        // We can store a 'noteId' in the thread metadata or just search by title convention
        // For now, let's look for a thread that has metadata.linkedNoteId === activeNoteId
        let linkedThread = threads.find(t => t.metadata?.linkedNoteId === activeNoteId);

        if (!linkedThread) {
            // 2. Create a new thread for this note context
            const newThread: Thread = {
                id: generateId(),
                title: `Chat: ${currentNote.title}`,
                messages: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
                metadata: {
                    linkedNoteId: activeNoteId, // Link it!
                    isSideChat: true
                }
            } as Thread; // Cast to Thread to allow extra metadata properties if needed, or update Thread type

            // 3. Inject Context (Invisible System Message or just context)
            // We'll add a system message that sets the context
            const contextMessage: Message = {
                id: generateId(),
                role: Role.SYSTEM,
                content: `You are a helpful assistant analyzing the following note titled "${currentNote.title}".\n\nContent:\n${currentNote.content}`, // Pass raw content
                timestamp: Date.now(),
                attachments: []
            };

            newThread.messages.push(contextMessage);

            setThreads(prev => [newThread, ...prev]);
            setSideChatThreadId(newThread.id);

            // Persist
            await db.set(STORES.THREADS, newThread.id, newThread);
        } else {
            setSideChatThreadId(linkedThread.id);
        }

        setIsSideChatOpen(true);
    };

    // --- Handlers ---

    const handleTranslateNote = async () => { if (!activeNote) return; const targetLang = settings.interfaceLanguage === 'ro' ? 'Romanian' : 'English'; const instruction = `Translate the entire content of this note into ${targetLang}. Maintain all markdown formatting, tables, and code blocks exactly as they are. Only translate the text.`; try { const translated = await handleAiTextEdit(activeNote.content, instruction); handleSaveNote({ ...activeNote, content: translated }, true, true); } catch (e) { console.error("Translation failed", e); } setIsPageMenuOpen(false); };
    const handleSuggestEdits = async () => { if (!activeNote) return; const instruction = "Proofread this content. Fix grammar, spelling, and improve clarity/flow. Maintain the original tone and all markdown formatting."; try { const polished = await handleAiTextEdit(activeNote.content, instruction); handleSaveNote({ ...activeNote, content: polished }, true, true); } catch (e) { console.error("Editing failed", e); } setIsPageMenuOpen(false); };

    // Refactored to accept optional ID for sidebar actions
    const handleMoveTo = (noteId?: string) => {
        const targetId = noteId || activeNoteId;
        if (!targetId) return;

        const targetNote = notes.find(n => n.id === targetId);
        if (!targetNote) return;

        const category = prompt("Enter a category name to organize this note:", targetNote.category || "General");
        if (category) {
            handleSaveNote({ ...targetNote, category: category });
        }
        setIsPageMenuOpen(false);
    };

    const handleCopyLink = () => { if (!activeNote) return; const url = `${window.location.origin}${window.location.pathname}?noteId=${activeNote.id}`; navigator.clipboard.writeText(url); alert("Link copied to clipboard!"); setIsPageMenuOpen(false); };
    const handleExportNote = () => { if (!activeNote) return; const blob = new Blob([activeNote.content], { type: 'text/markdown' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${activeNote.title || 'Untitled'}.md`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); setIsPageMenuOpen(false); };
    const handleImportNote = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { const file = e.target.files[0]; const reader = new FileReader(); reader.onload = (ev) => { const content = ev.target?.result as string; if (content && activeNote) { const updatedNote = { ...activeNote, content: activeNote.content + '\n' + content }; handleSaveNote(updatedNote, true, true); } }; reader.readAsText(file); } e.target.value = ''; setIsPageMenuOpen(false); };

    const handleAiTextEdit = async (text: string, instruction: string): Promise<string> => {
        if (!text) return "";
        const prompt = `You are an AI editor. Task: ${instruction}\nOriginal Text: "${text}"\nReturn ONLY the modified text. Do not add quotes, explanations, or markdown fences unless requested.`;
        try {
            const response = await llmService.generateResponse([], prompt, [], settings.modelProvider, settings.openRouterApiKey, settings.openRouterModelId, settings.openAiApiKey, settings.openAiModelId, settings.localModels.find(m => m.id === settings.activeLocalModelId), false, ProMode.STANDARD, false, settings.userProfile, settings.aiProfile, undefined, settings.tavilyApiKey, settings.geminiApiKey, settings.searchProvider, settings.braveApiKey);
            return response.text.trim();
        } catch (e) { console.error("AI Edit Failed", e); return text; }
    };

    const stopAudio = () => { if (audioSourceRef.current) { try { audioSourceRef.current.stop(); } catch (e) { } audioSourceRef.current = null; } window.speechSynthesis.cancel(); setIsPlayingAudio(false); };
    const handleTTS = async (textToRead?: string) => {
        if (isPlayingAudio) { stopAudio(); return; }

        let text = textToRead;
        if (!text) {
            if (!activeThread || activeThread.messages.length === 0) return;
            const lastMsg = activeThread.messages[activeThread.messages.length - 1];
            if (lastMsg.role !== Role.MODEL) return;
            text = lastMsg.content;
        }

        setIsPlayingAudio(true);
        if (!audioContextRef.current) { audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 }); } else if (audioContextRef.current.state === 'suspended') { await audioContextRef.current.resume(); }
        const cleanText = text.replace(/[*#`]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\n\n/g, '. ').substring(0, 4000);
        try {
            const buffer = await llmService.generateSpeech(cleanText, audioContextRef.current, settings.geminiApiKey);
            if (buffer) { const source = audioContextRef.current.createBufferSource(); source.buffer = buffer; source.connect(audioContextRef.current.destination); source.onended = () => setIsPlayingAudio(false); audioSourceRef.current = source; source.start(); } else { const utterance = new SpeechSynthesisUtterance(cleanText); const voices = window.speechSynthesis.getVoices(); const langCode = settings.interfaceLanguage === 'ro' ? 'ro-RO' : 'en-US'; const preferredVoice = voices.find(v => v.lang === langCode) || voices[0]; if (preferredVoice) utterance.voice = preferredVoice; utterance.onend = () => setIsPlayingAudio(false); utterance.onerror = () => setIsPlayingAudio(false); window.speechSynthesis.speak(utterance); }
        } catch (e) { console.error("TTS failed", e); setIsPlayingAudio(false); }
    };

    // Navigation History
    const [navHistory, setNavHistory] = useState<{ view: string, threadId: string | null, noteId: string | null, spaceId: string | null }[]>([]);
    const [showFavorites, setShowFavorites] = useState(false);
    const [isHomeBackActive, setIsHomeBackActive] = useState(false);
    const lastNavAction = useRef<string | null>(null);

    // ... existing state ...

    // Helper to push history
    const pushToHistory = () => {
        setNavHistory(prev => {
            const current = { view: activeView, threadId: activeThreadId, noteId: activeNoteId, spaceId: activeSpaceId };
            // Avoid duplicates at the top of the stack
            if (prev.length > 0) {
                const last = prev[prev.length - 1];
                if (last.view === current.view && last.threadId === current.threadId && last.noteId === current.noteId) {
                    return prev;
                }
            }
            return [...prev, current].slice(-50); // Keep last 50
        });
        lastNavAction.current = 'navigate';
        setIsHomeBackActive(false);
    };

    // Determine Back Destination for Mobile Dock
    const backDestination = isHomeBackActive ? 'home' : (navHistory.length > 0 ? navHistory[navHistory.length - 1].view : 'home');

    // ... existing handlers ...

    const handleSelectThread = (id: string) => {
        pushToHistory();
        setActiveView('chat');
        setActiveThreadId(id);
        setActiveNoteId(null);
        setExpandedSidebarSection('chat');
        const thread = threads.find(t => t.id === id);
        if (thread?.spaceId) {
            setActiveSpaceId(thread.spaceId);
            setExpandedSidebarSection('spaces');
        } else {
            setActiveSpaceId(null);
        }
        setIsDashboardMode(false);
        stopAudio();
    };

    const handleSelectSpace = (id: string | null) => {
        pushToHistory();
        setActiveView('chat');
        setActiveSpaceId(id);
        setActiveThreadId(null);
        setActiveNoteId(null);
        setExpandedSidebarSection('spaces');
        stopAudio();
    };

    const navigateToNote = (id: string) => {
        pushToHistory();
        setActiveView('library'); setActiveNoteId(id);
        setOpenNoteIds(prev => { if (!prev.includes(id)) return [...prev, id]; return prev; });
        if (!noteHistoryRef.current[id]) {
            const note = notes.find(n => n.id === id);
            if (note) {
                noteHistoryRef.current[id] = { stack: [note.content], pointer: 0 };
            }
        }
    };

    // ...

    // --- Mobile Dock Handlers ---
    const handleMobileNavigate = (view: string) => {
        if (view === 'home') {
            // Home Button Logic:
            // 1. If we are in 'home_back' state, go straight to Home (Second press).
            // 2. If we have history, go back (Single press).
            // 3. Else go to Home.

            if (isHomeBackActive) {
                // Second press -> Go Home
                setNavHistory([]);
                handleNewThread();
                setIsHomeBackActive(false);
                lastNavAction.current = null;
                return;
            }

            if (navHistory.length > 0) {
                const lastState = navHistory[navHistory.length - 1];
                setNavHistory(prev => prev.slice(0, -1)); // Pop

                setActiveView(lastState.view as any);
                setActiveThreadId(lastState.threadId);
                setActiveNoteId(lastState.noteId);
                setActiveSpaceId(lastState.spaceId);

                if (lastState.view === 'library' && lastState.noteId) {
                    setExpandedSidebarSection('library');
                } else if (lastState.view === 'chat' && lastState.threadId) {
                    setExpandedSidebarSection('chat');
                }
                setIsHomeBackActive(true);
                lastNavAction.current = 'home_back';
            } else {
                // No history, go to Home (New Thread)
                handleNewThread();
                setIsHomeBackActive(false);
                lastNavAction.current = null;
            }
        } else if (view === 'favorites') {
            pushToHistory();
            setActiveView('library');
            setActiveNoteId(null);
            setShowFavorites(true);
            setExpandedSidebarSection('library');
            setIsHomeBackActive(false);
        } else if (view === 'calendar') {
            pushToHistory();
            setActiveView('calendar');
            setIsHomeBackActive(false);
        } else {
            // It's a note ID
            handleSelectNote(view);
            setIsHomeBackActive(false);
        }
    };

    const handleMobileNewPage = (type?: 'page' | 'todo' | 'shopping') => {
        let content = '';
        let tags: string[] = [];

        if (type === 'todo') {
            content = '# To-Do List\n\n- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3';
            tags = ['todo'];
        } else if (type === 'shopping') {
            content = '# Shopping List\n\n- [ ] Item 1\n- [ ] Item 2';
            tags = ['shopping'];
        }

        handleNewNote(undefined, content, tags);
    };

    // --- Interaction Handlers ---
    const handleCopyText = (id: string, text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleShare = async (text: string) => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Perplex Response',
                    text: text,
                });
            } catch (e) { console.log('Share cancelled'); }
        } else {
            handleCopyText('share', text);
            alert("Text copied to clipboard!");
        }
    };

    const handleAddToSpace = (spaceId: string, content: string) => {
        const space = spaces.find(s => s.id === spaceId);
        if (space) {
            // Create a new note in the library linked to this space implicitly (or just append as a file in space for now as requested)
            // Better UX: Create a new Note in Library with the content
            const newNote: Note = {
                id: generateId(),
                title: `Saved Response - ${new Date().toLocaleDateString()}`,
                content: content,
                updatedAt: Date.now(),
                status: 'Idea',
                tags: ['saved-response'],
                emoji: '💡'
            };
            setNotes(prev => [newNote, ...prev]);
            alert(`Added to library!`); // Subtle notification preferable
        }
        setActiveAddToSpaceId(null);
    };

    // --- CONFIRMATION ACTION HANDLERS ---
    const handleConfirmAction = (modifiedData?: any) => {
        if (!pendingAction) return;

        const titleToUse = modifiedData?.title || pendingAction.data.title;
        const contentToUse = modifiedData?.content || pendingAction.data.content;

        if (pendingAction.type === 'create_page') {
            // Create New Note
            const newNote: Note = {
                id: generateId(),
                title: titleToUse || 'Untitled',
                content: contentToUse || '',
                updatedAt: Date.now(),
                status: 'Idea',
                tags: ['ai-generated'],
                emoji: '✨'
            };
            setNotes(prev => [newNote, ...prev]);
            navigateToNote(newNote.id);
        } else if (pendingAction.type === 'block_operation') {
            const { operation, args } = pendingAction.data;
            const pageTitle = args.pageTitle;

            // Find the note
            const existingNote = notes.find(n => n.title.toLowerCase() === pageTitle.toLowerCase());

            if (existingNote) {
                try {
                    // Parse current content
                    let pageStructure = BlockService.fromMarkdown(existingNote.content, existingNote.title);

                    // Perform Operation
                    if (operation === 'insert_block') {
                        const newBlock: Block = {
                            id: generateId(),
                            type: args.type,
                            content: contentToUse // Use the edited content from modal
                        };
                        // Handle 'start' or specific ID
                        if (args.targetBlockId === 'start') {
                            pageStructure.blocks.unshift(newBlock);
                        } else {
                            pageStructure = BlockService.insertBlockAfter(pageStructure, args.targetBlockId, newBlock);
                        }
                    } else if (operation === 'replace_block') {
                        pageStructure = BlockService.replaceBlock(pageStructure, args.blockId, contentToUse);
                    } else if (operation === 'delete_block') {
                        pageStructure = BlockService.deleteBlock(pageStructure, args.blockId);
                    } else if (operation === 'update_table_cell') {
                        pageStructure = BlockService.updateTableCell(pageStructure, args.tableBlockId, args.rowIndex, args.colIndex, args.newValue);
                    }

                    // Convert back to Markdown
                    const newMarkdown = BlockService.toMarkdown(pageStructure);

                    // Save
                    const updatedNote = {
                        ...existingNote,
                        content: newMarkdown,
                        updatedAt: Date.now()
                    };
                    handleSaveNote(updatedNote);
                    navigateToNote(existingNote.id);

                } catch (e) {
                    console.error("Block Operation Failed", e);
                    alert(`Failed to update page: ${(e as any).message}`);
                }
            } else {
                alert(`Page "${pageTitle}" not found.`);
            }
        } else if (pendingAction.type === 'update_page') {
            // Find existing note by title (case-insensitive) or just append to active note if ambiguous?
            // For now, let's search by title logic
            const targetTitle = pendingAction.data.title.toLowerCase();
            const existingNote = notes.find(n => n.title.toLowerCase().includes(targetTitle));

            if (existingNote) {
                // Append content - BUT if user modified it in the modal, we might want to respect that override completely
                // For update_page, usually the AI appends. If user edited the modal, we assume the modal content IS the append payload.
                const updatedNote = {
                    ...existingNote,
                    content: existingNote.content + '\n\n' + contentToUse,
                    updatedAt: Date.now()
                };
                handleSaveNote(updatedNote);
                navigateToNote(existingNote.id);
            } else {
                // Fallback: Create new if not found
                const newNote: Note = {
                    id: generateId(),
                    title: titleToUse,
                    content: contentToUse,
                    updatedAt: Date.now(),
                    status: 'Idea',
                    tags: ['ai-generated'],
                    emoji: '✨'
                };
                setNotes(prev => [newNote, ...prev]);
                navigateToNote(newNote.id);
            }
        } else if (pendingAction.type === 'calendar_event') {
            const { operation, args } = pendingAction.data;

            if (operation === 'add') {
                const newEvent: CalendarEvent = {
                    id: generateId(),
                    title: modifiedData?.title || args.title,
                    startDate: new Date(modifiedData?.startDate || args.startDate).getTime(),
                    endDate: new Date(modifiedData?.endDate || args.endDate).getTime(),
                    description: modifiedData?.description || args.description,
                    location: modifiedData?.location || args.location,
                    allDay: args.allDay,
                    color: 'blue'
                };

                setEvents(prev => [...prev, newEvent]);
                db.set(STORES.CALENDAR, 'all_events', [...events, newEvent]);
                window.dispatchEvent(new CustomEvent('calendar-updated'));
            } else if (operation === 'update') {
                const id = args.id;
                const index = events.findIndex(e => e.id === id);

                if (index !== -1) {
                    const updatedEvent = {
                        ...events[index],
                        title: modifiedData?.title || args.title,
                        description: modifiedData?.description || args.description,
                        location: modifiedData?.location || args.location,
                        startDate: modifiedData?.startDate ? new Date(modifiedData.startDate).getTime() : events[index].startDate,
                        endDate: modifiedData?.endDate ? new Date(modifiedData.endDate).getTime() : events[index].endDate
                    };

                    const newEvents = [...events];
                    newEvents[index] = updatedEvent;
                    setEvents(newEvents);
                    db.set(STORES.CALENDAR, 'all_events', newEvents);
                    window.dispatchEvent(new CustomEvent('calendar-updated'));
                }
            } else if (operation === 'delete') {
                const id = args.id;
                const filteredEvents = events.filter(e => e.id !== id);
                setEvents(filteredEvents);
                db.set(STORES.CALENDAR, 'all_events', filteredEvents);
                window.dispatchEvent(new CustomEvent('calendar-updated'));
            }
        }

        // Add a system message to chat to confirm
        if (activeThreadId) {
            let confirmText = "";
            if (pendingAction.type === 'block_operation') {
                confirmText = `Action confirmed. I've updated the page "${titleToUse}".`;
            } else if (pendingAction.type === 'calendar_event') {
                const op = pendingAction.data.operation;
                confirmText = `Action confirmed. I've ${op === 'add' ? 'added' : op === 'update' ? 'updated' : 'deleted'} the event "${modifiedData?.title || pendingAction.data.args.title}".`;
            } else {
                confirmText = `Action confirmed. I've ${pendingAction.type === 'create_page' ? 'created' : 'updated'} the page "${titleToUse}".`;
            }

            const confirmMsg: Message = {
                id: generateId(),
                role: Role.MODEL,
                content: confirmText,
                timestamp: Date.now()
            };
            setThreads(prev => prev.map(t => t.id === activeThreadId ? { ...t, messages: [...t.messages, confirmMsg] } : t));
        }

        setPendingAction(null);
    };

    const handleCancelAction = () => {
        if (activeThreadId && pendingAction) {
            const cancelMsg: Message = {
                id: generateId(),
                role: Role.MODEL,
                content: "Action cancelled.",
                timestamp: Date.now()
            };
            setThreads(prev => prev.map(t => t.id === activeThreadId ? { ...t, messages: [...t.messages, cancelMsg] } : t));
        }
        setPendingAction(null);
    };

    const handleRegenerate = async (messageId: string, threadIdOverride?: string) => {
        const threadId = threadIdOverride || activeThreadId;
        const thread = threads.find(t => t.id === threadId);
        if (!thread) return;

        const msgIndex = thread.messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) return;

        // We need to regenerate the response for the *previous* user message
        // If the current message is AI, we act on the user message before it.
        // If we are regenerating a specific AI message, we effectively delete it and everything after, then re-trigger.

        const previousUserMsg = thread.messages[msgIndex - 1];
        if (!previousUserMsg || previousUserMsg.role !== Role.USER) return;

        // Slice thread up to the user message (exclusive of the current AI response)
        const newMessages = thread.messages.slice(0, msgIndex);

        // Update thread state immediately
        const updatedThread = { ...thread, messages: newMessages };
        setThreads(prev => prev.map(t => t.id === thread.id ? updatedThread : t));

        // Trigger Generation
        await triggerGeneration(updatedThread.id, previousUserMsg.content, previousUserMsg.attachments || [], newMessages);
    };

    const handleEditUserMessage = async (messageId: string, newContent: string, threadIdOverride?: string) => {
        setEditingMessageId(null);
        const threadId = threadIdOverride || activeThreadId;
        const thread = threads.find(t => t.id === threadId);
        if (!thread) return;

        const msgIndex = thread.messages.findIndex(m => m.id === messageId);
        if (msgIndex === -1) return;

        // Update the user message
        const updatedMessages = [...thread.messages];
        updatedMessages[msgIndex] = { ...updatedMessages[msgIndex], content: newContent };

        // Remove all subsequent messages (since context changed)
        const prunedMessages = updatedMessages.slice(0, msgIndex + 1);

        const updatedThread = { ...thread, messages: prunedMessages };
        setThreads(prev => prev.map(t => t.id === thread.id ? updatedThread : t));

        // Re-trigger AI response based on new context
        const attachments = prunedMessages[msgIndex].attachments || [];
        await triggerGeneration(updatedThread.id, newContent, attachments, prunedMessages);
    };

    const triggerGeneration = async (threadId: string, prompt: string, attachments: Attachment[], history: Message[]) => {
        setIsThinking(true);
        const tempBotId = generateId();
        const placeholderMsg: Message = { id: tempBotId, role: Role.MODEL, content: '', timestamp: Date.now(), isThinking: true };

        setThreads(prev => prev.map(t => t.id === threadId ? { ...t, messages: [...history, placeholderMsg], updatedAt: Date.now() } : t));

        let effectiveUseSearch = settings.useSearch;
        let modifiedPrompt = prompt;
        let combinedAttachments = [...attachments];
        let customSystemInstructions = undefined;

        // Logic duplicated from original handleSendMessage for consistency
        if (activeSpace) {
            if (activeSpace.systemInstructions) customSystemInstructions = activeSpace.systemInstructions;
            if (activeSpace.files && activeSpace.files.length > 0) { combinedAttachments = [...combinedAttachments, ...activeSpace.files]; modifiedPrompt += `\n\n[Context from Space '${activeSpace.title}': I have attached ${activeSpace.files.length} knowledge base files. Use them to answer.]`; }
        }

        // Default to standard params, assuming FocusMode.ALL/ProMode.STANDARD for re-gens unless we store that meta in msg
        // For simplicity, we use current settings defaults or infer.

        try {
            // Reuse logic from handleSendMessage (simplified here)
            let provider = settings.modelProvider;
            let activeLocalModel = settings.localModels.find(m => m.id === settings.activeLocalModelId);

            const onChunk = (textChunk: string, reasoningChunk?: string) => {
                setThreads(prev => prev.map(t => {
                    if (t.id !== threadId) return t;
                    return {
                        ...t,
                        messages: t.messages.map(m => {
                            if (m.id !== tempBotId) return m;
                            // MODIFICATION: Removed isThinking: false to keep processing animation active until done
                            return {
                                ...m,
                                content: m.content + (textChunk || ""),
                                reasoning: (m.reasoning || "") + (reasoningChunk || "")
                            };
                        })
                    };
                }));
            };

            const response = await llmService.generateResponse(
                history, modifiedPrompt, combinedAttachments, provider,
                settings.openRouterApiKey, settings.openRouterModelId,
                settings.openAiApiKey, settings.openAiModelId,
                activeLocalModel, effectiveUseSearch, ProMode.STANDARD,
                settings.enableMemory, settings.userProfile,
                settings.aiProfile, customSystemInstructions,
                settings.tavilyApiKey, settings.geminiApiKey,
                settings.searchProvider, settings.braveApiKey,
                onChunk
            );

            if (response.pendingAction) {
                setPendingAction(response.pendingAction);
                // Remove the placeholder or keep it? 
                // Keep it but mark done thinking.
                setThreads(prev => prev.map(t => t.id === threadId ? {
                    ...t,
                    messages: t.messages.map(m => m.id === tempBotId ? {
                        ...m,
                        content: "Please confirm the action above...",
                        isThinking: false
                    } : m),
                    updatedAt: Date.now()
                } : t));
            } else {
                setThreads(prev => prev.map(t => t.id === threadId ? {
                    ...t,
                    messages: t.messages.map(m => m.id === tempBotId ? {
                        ...m,
                        content: response.text,
                        citations: response.citations,
                        relatedQuestions: response.relatedQuestions,
                        isThinking: false,
                        reasoning: response.reasoning // Capture reasoning
                    } : m),
                    updatedAt: Date.now()
                } : t));
            }

        } catch (e) {
            console.error(e);
            setThreads(prev => prev.map(t => t.id === threadId ? {
                ...t,
                messages: t.messages.map(m => m.id === tempBotId ? {
                    ...m,
                    content: m.content + `\n\nConnection Error: ${(e as any).message}`,
                    isThinking: false
                } : m),
                updatedAt: Date.now()
            } : t));
        } finally {
            setIsThinking(false);
        }
    };


    const handleStopGeneration = () => {
        isStoppedRef.current = true;
        llmService.stopGeneration();
        setIsThinking(false);

        // Immediate UI update to stop the spinner/thinking indicator
        if (activeThreadId) {
            setThreads(prev => prev.map(t => {
                if (t.id !== activeThreadId) return t;
                // Find the last message (the bot message being generated)
                const lastMsg = t.messages[t.messages.length - 1];
                if (lastMsg && lastMsg.role === Role.MODEL && lastMsg.isThinking) {
                    return {
                        ...t,
                        messages: t.messages.map(m => m.id === lastMsg.id ? { ...m, isThinking: false } : m)
                    };
                }
                return t;
            }));
        }
    };

    const handleSendMessage = async (text: string, focusModes: FocusMode[], proMode: ProMode, attachments: Attachment[], modelId?: string, isAgentMode: boolean = false, threadIdOverride?: string, isAgentMax: boolean = false) => {
        isStoppedRef.current = false;
        setIsThinking(true);

        // Determine which thread to use: override (side chat) -> active -> new
        let threadId = threadIdOverride || activeThreadId;

        if (!threadId) {
            const displayTitle = text ? text.substring(0, 40) : (attachments.length ? `Analysis of ${attachments[0].name}` : 'New Thread');
            const newThread: Thread = {
                id: generateId(),
                title: displayTitle + (text.length > 40 ? '...' : ''),
                messages: [],
                updatedAt: Date.now(),
                spaceId: activeSpaceId || undefined
            };
            setThreads(prev => [newThread, ...prev]);
            threadId = newThread.id;
            setActiveThreadId(threadId);

            // Persist new thread
            db.set(STORES.THREADS, newThread.id, newThread);
        }

        const userMsg: Message = {
            id: generateId(),
            role: Role.USER,
            content: text,
            attachments: attachments,
            timestamp: Date.now()
        };

        // Optimistic Update
        const tempBotId = generateId();
        const placeholderMsg: Message = {
            id: tempBotId,
            role: Role.MODEL,
            content: '',
            timestamp: Date.now(),
            isThinking: true
        };

        // Get current messages to pass as history
        // If it's a new thread created above, it won't be in 'threads' state yet if we rely on closure
        // But we can construct history manually
        const thread = threads.find(t => t.id === threadId);
        const history = thread ? [...thread.messages, userMsg] : [userMsg];

        setThreads(prev => prev.map(t => t.id === threadId ? {
            ...t,
            messages: [...t.messages, userMsg, placeholderMsg],
            updatedAt: Date.now()
        } : t));

        let effectiveUseSearch = settings.useSearch;
        let modifiedPrompt = text;
        let combinedAttachments = [...attachments];
        let customSystemInstructions = undefined;

        // --- FOCUS MODE LOGIC UPDATE (Handle Library Mode) ---
        if (focusModes.includes(FocusMode.LIBRARY)) {
            const hasWebSearch = focusModes.includes(FocusMode.WEB_SEARCH) || focusModes.includes(FocusMode.ALL);

            if (!hasWebSearch) {
                effectiveUseSearch = false; // Disable web search when focusing ONLY on Library
                // STRICT INSTRUCTION: Enforce focus ONLY on the attached pages content.
                modifiedPrompt = `[STRICT LIBRARY FOCUS] User Query: ${text}
            
            INSTRUCTIONS:
            1. Answer ONLY using the content of the attached 'Library Pages' (markdown files attached to this request).
            2. Do not use outside knowledge, internet search, or your general training data unless explicitly asked to define general terms found in the text.
            3. Do not confuse these pages with your internal "Memory". These are specific documents the user has selected.
            4. If the answer is not found in the attached pages, state clearly that the information is missing from the selected library pages.`;
            } else {
                // COMBINED FOCUS: Use both Library and Web Search
                modifiedPrompt = `[LIBRARY + WEB SEARCH FOCUS] User Query: ${text}
            
            INSTRUCTIONS:
            1. Use the content of the attached 'Library Pages' (markdown files attached to this request) as your primary context.
            2. Supplement with information from the internet (web search) to provide a comprehensive answer.
            3. If there is a conflict between the library pages and the web, prioritize the library pages but mention the discrepancy.
            4. Clearly distinguish between information from the library pages and information from the web.`;
            }
        }

        if (activeSpace) {
            if (activeSpace.systemInstructions) customSystemInstructions = activeSpace.systemInstructions;
            if (activeSpace.files && activeSpace.files.length > 0) { combinedAttachments = [...combinedAttachments, ...activeSpace.files]; modifiedPrompt += `\n\n[Context from Space '${activeSpace.title}': I have attached ${activeSpace.files.length} knowledge base files. Use them to answer.]`; }
        }

        try {
            if (isAgentMax) {
                let agentMaxProvider = settings.modelProvider;
                let agentMaxApiKey = settings.geminiApiKey;
                let agentMaxModelId = 'gemini-1.5-pro-latest';

                if (agentMaxProvider === ModelProvider.OPENROUTER) {
                    agentMaxApiKey = settings.openRouterApiKey;
                    agentMaxModelId = settings.openRouterModelId || 'google/gemini-pro';
                }

                // Mastra Memory — rulează în browser, stochează local
                const resourceId = 'agent-max-user';
                const { contextString: memoryContext } = await getMemoryContext(
                    threadId, resourceId, modifiedPrompt
                );

                // Date locale
                const calendarEventsData = await db.get<any[]>(STORES.CALENDAR, 'all_events') || [];
                const workspaceFilesData = activeSpace?.files?.map(f => ({
                    name: f.name, content: (f.content || '').substring(0, 2000)
                })) || [];
                const notesData = notes.map(n => ({
                    id: n.id, title: n.title, content: (n.content || '').substring(0, 1000)
                }));

                const agentRes = await askAgentMax(
                    modifiedPrompt, threadId,
                    agentMaxProvider, agentMaxApiKey, agentMaxModelId,
                    settings.tavilyApiKey, settings.braveApiKey, settings.searchProvider,
                    memoryContext,
                    calendarEventsData, workspaceFilesData, notesData
                );

                // Salvează în Mastra Memory local — după ce primim răspunsul
                await saveToMemory(threadId, resourceId, modifiedPrompt, agentRes.text);

                // Execută acțiunile pending returnate de agent
                if (agentRes.pendingActions?.length > 0) {
                    for (const action of agentRes.pendingActions) {
                        if (action.type === 'save_to_library') {
                            const newNote: Note = {
                                id: generateId(), title: action.payload.title,
                                content: action.payload.content,
                                updatedAt: Date.now(),
                                status: 'Idea', tags: ['ai-generated']
                            };
                            const updatedNotes = [...notes, newNote];
                            setNotes(updatedNotes);
                            await db.set(STORES.NOTES, 'all_notes', updatedNotes);
                        }
                        if (action.type === 'add_calendar_event') {
                            handleAddEvent(action.payload);
                        }
                    }
                }

                setThreads(prev => prev.map(t => t.id === threadId ? {
                    ...t,
                    messages: t.messages.map(m => m.id === tempBotId ? {
                        ...m,
                        content: agentRes.text,
                        isThinking: false
                    } : m),
                    updatedAt: Date.now()
                } : t));
                setIsThinking(false);
                return;
            }

            let provider = settings.modelProvider;
            let activeLocalModel = settings.localModels.find(m => m.id === settings.activeLocalModelId);
            if (modelId) {
                if (modelId.startsWith('gemini')) { provider = ModelProvider.GEMINI; } else if (modelId === 'openrouter') { provider = ModelProvider.OPENROUTER; } else if (modelId === 'openai') { provider = ModelProvider.OPENAI; } else { const found = settings.localModels.find(m => m.id === modelId); if (found) { activeLocalModel = found; provider = ModelProvider.LOCAL; } }
            }

            const onChunk = (textChunk: string, reasoningChunk?: string) => {
                if (isStoppedRef.current) return;
                setThreads(prev => prev.map(t => {
                    if (t.id !== threadId) return t;
                    return {
                        ...t,
                        messages: t.messages.map(m => {
                            if (m.id !== tempBotId) return m;
                            // MODIFICATION: Removed isThinking: false to keep processing animation active until done
                            return {
                                ...m,
                                content: m.content + (textChunk || ""),
                                reasoning: (m.reasoning || "") + (reasoningChunk || "")
                            };
                        })
                    };
                }));
            };

            const response = await llmService.generateResponse(
                history.slice(0, -1), // History excluding current user message (handled by params)
                modifiedPrompt, combinedAttachments, provider,
                settings.openRouterApiKey, settings.openRouterModelId,
                settings.openAiApiKey, settings.openAiModelId,
                activeLocalModel, effectiveUseSearch, proMode,
                settings.enableMemory, settings.userProfile,
                settings.aiProfile, customSystemInstructions,
                settings.tavilyApiKey, settings.geminiApiKey,
                settings.searchProvider, settings.braveApiKey,
                onChunk, // Pass the streaming callback
                isAgentMode
            );

            if (isStoppedRef.current) return;

            if (response.pendingAction) {
                setPendingAction(response.pendingAction);
                setThreads(prev => prev.map(t => t.id === threadId ? {
                    ...t,
                    messages: t.messages.map(m => m.id === tempBotId ? {
                        ...m,
                        content: "Please confirm the action above...",
                        isThinking: false
                    } : m),
                    updatedAt: Date.now()
                } : t));
            } else {
                setThreads(prev => prev.map(t => t.id === threadId ? {
                    ...t,
                    messages: t.messages.map(m => m.id === tempBotId ? {
                        ...m,
                        content: response.text, // Final clean text (related questions json removed)
                        citations: response.citations,
                        relatedQuestions: response.relatedQuestions,
                        isThinking: false,
                        reasoning: response.reasoning // Capture reasoning
                    } : m),
                    updatedAt: Date.now()
                } : t));
            }

            if (navigator.vibrate) navigator.vibrate(20);
        } catch (e: any) {
            console.error(e);
            if (e.name === 'AbortError' || e.message?.includes('aborted') || isStoppedRef.current) {
                // User stopped manually - just mark as done
                setThreads(prev => prev.map(t => t.id === threadId ? {
                    ...t,
                    messages: t.messages.map(m => m.id === tempBotId ? {
                        ...m,
                        isThinking: false
                    } : m),
                    updatedAt: Date.now()
                } : t));
            } else {
                setThreads(prev => prev.map(t => t.id === threadId ? {
                    ...t,
                    messages: t.messages.map(m => m.id === tempBotId ? {
                        ...m,
                        content: m.content + `\n\nConnection Error: ${e.message}`,
                        isThinking: false
                    } : m),
                    updatedAt: Date.now()
                } : t));
            }
        } finally {
            setIsThinking(false);
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => { touchStartRef.current = e.targetTouches[0].clientX; touchYRef.current = e.targetTouches[0].clientY; };
    const handleTouchEnd = (e: React.TouchEvent) => { if (!touchStartRef.current || !touchYRef.current) return; const touchEnd = e.changedTouches[0].clientX; const touchEndY = e.changedTouches[0].clientY; const diffX = touchEnd - touchStartRef.current; const diffY = touchEndY - touchYRef.current; if (Math.abs(diffX) > Math.abs(diffY)) { if (diffX > 60 && touchStartRef.current < 40 && !sidebarOpen) { setSidebarOpen(true); if (navigator.vibrate) navigator.vibrate(10); } } touchStartRef.current = null; touchYRef.current = null; };

    // --- POPSTATE HANDLER (Back Button Logic) ---
    useEffect(() => {
        const handlePopState = () => {
            let handled = false;
            if (settingsOpen) { handleCancelSettings(); handled = true; }
            else if (spacesModalOpen) { setSpacesModalOpen(false); handled = true; }
            else if (sidebarOpen && window.innerWidth < 768) { setSidebarOpen(false); handled = true; }
            else if (isDashboardMode) { setIsDashboardMode(false); handled = true; }

            // --- Custom Back Logic for Mobile ---
            // 1. If viewing a Note -> Close Note, Open Sidebar, Expand Library
            else if (activeView === 'library' && activeNoteId) {
                setActiveNoteId(null);
                setActiveView('chat'); // Switch view to hide empty library state
                if (window.innerWidth < 768) {
                    setSidebarOpen(true);
                    setExpandedSidebarSection('library');
                }
                handled = true;
            }
            // 2. If viewing a Thread -> Close Thread, Open Sidebar, Expand Chats
            else if (activeView === 'chat' && activeThreadId) {
                setActiveThreadId(null);
                if (window.innerWidth < 768) {
                    setSidebarOpen(true);
                    setExpandedSidebarSection('chat');
                }
                handled = true;
            }
            else if (activeView === 'library' && !activeNoteId) { setActiveView('chat'); handled = true; }

            if (handled) window.history.pushState(null, '', window.location.href);
        };
        const isRoot = !settingsOpen && !spacesModalOpen && !isDashboardMode && (!sidebarOpen || window.innerWidth >= 768) && activeView === 'chat' && !activeThreadId;
        if (!isRoot) window.history.pushState(null, '', window.location.href);
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [settingsOpen, spacesModalOpen, sidebarOpen, isDashboardMode, activeView, activeNoteId, activeThreadId]);

    const showSidebarToggle = !sidebarOpen && !activeThreadId;

    useEffect(() => {
        if (settings.enableMobileDock) {
            document.body.classList.add('dock-active');
        } else {
            document.body.classList.remove('dock-active');
        }
    }, [settings.enableMobileDock]);

    return (
        <div className="flex h-[100dvh] w-full bg-pplx-primary text-pplx-text overflow-hidden font-sans transition-colors duration-150" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <Sidebar
                isOpen={sidebarOpen}
                toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                threads={threads}
                spaces={spaces}
                notes={notes}
                userProfile={settings.userProfile}
                activeThreadId={activeThreadId}
                activeSpaceId={activeSpaceId}
                activeNoteId={activeNoteId}
                activeView={activeView}
                onSelectThread={handleSelectThread}
                onSelectSpace={handleSelectSpace}
                onSelectNote={handleSelectNote}
                onChangeView={(view) => { pushToHistory(); setActiveView(view); }}
                onNewThread={handleNewThread}
                onNewNote={handleNewNote}
                onManageSpaces={() => setSpacesModalOpen(true)}
                openSettings={handleOpenSettings}
                onDeleteThread={handleDeleteThread}
                onDuplicateNote={handleDuplicateNote}
                onMoveNote={handleMoveTo}
                onDeleteNote={handleDeleteNote}
                // New Props for Back Logic
                expandedSection={expandedSidebarSection}
                setExpandedSection={setExpandedSidebarSection}
                showFavorites={showFavorites}
                setShowFavorites={setShowFavorites}
            />

            <main
                className={`flex-1 h-full flex flex-col relative overflow-hidden transition-all duration-150 bg-pplx-primary`}
                style={{
                    paddingBottom: settings.enableMobileDock && window.innerWidth < 640
                        ? 'calc(72px + env(safe-area-inset-bottom))'
                        : '0px'
                }}
            >
                {/* Premium Dark Background Effect for Home Page */}
                {!activeThreadId && activeView === 'chat' && (
                    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center bg-pplx-primary transition-colors duration-150">

                        {/* MOBILE BACKGROUND: Golden Glow Top-Left */}
                        <div className="absolute inset-0 md:hidden">
                            <div className="absolute top-[-20%] left-[-30%] w-[120%] h-[70%] bg-[radial-gradient(ellipse_at_center,_rgba(255,220,160,0.3)_0%,_rgba(0,0,0,0)_70%)] blur-[40px]" />
                        </div>

                        {/* DESKTOP BACKGROUND: Uniform color (glows removed as requested) */}
                        <div className="hidden md:block absolute inset-0" />

                        {/* Noise overlay for texture - Hidden on desktop for uniform color */}
                        <div className="absolute inset-0 dark:opacity-[0.02] opacity-[0.01] mix-blend-overlay md:hidden" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />
                    </div>
                )}

                {showSidebarToggle && activeView === 'chat' && (
                    <button onClick={() => setSidebarOpen(true)} className={`fixed top-4 left-4 z-50 text-pplx-muted hover:text-pplx-text p-2 rounded-lg hover:bg-pplx-hover transition-colors ${!activeThreadId && !activeSpace ? 'hidden md:block' : ''}`} title="Open Sidebar"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 18H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                )}

                {/* Workspace Files Modal */}
                {activeSpace && (
                    <SpaceFilesModal
                        isOpen={isSpaceFilesModalOpen}
                        onClose={() => setIsSpaceFilesModalOpen(false)}
                        space={activeSpace}
                        onUpdateSpace={(updatedSpace) => {
                            setSpaces(prev => prev.map(s => s.id === updatedSpace.id ? updatedSpace : s));
                        }}
                    />
                )}

                {isLearning && (
                    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-pplx-card border border-pplx-accent/30 rounded-full px-3 py-1.5 shadow-lg animate-pulse">
                        <Brain size={14} className="text-pplx-accent" />
                        <span className="text-xs font-medium text-pplx-accent">Learning...</span>
                    </div>
                )}

                {/* --- PENDING ACTION CONFIRMATION MODAL --- */}
                {pendingAction && (
                    <ActionConfirmation
                        action={pendingAction}
                        onConfirm={handleConfirmAction}
                        onCancel={handleCancelAction}
                    />
                )}

                {activeView === 'library' && (
                    <>
                        <div className="flex items-center h-auto px-3 py-2 select-none bg-pplx-primary border-none z-50 w-full relative border-b border-pplx-border/50 md:border-none pt-safe">
                            <div className="flex-1 flex items-center min-w-0">
                                {!sidebarOpen && (<button onClick={() => setSidebarOpen(true)} className="p-1 mr-2 text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover rounded transition-colors"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 12H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 18H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></button>)}

                                {/* UNDO / REDO BUTTONS */}
                                <div className="flex items-center gap-4 mr-2 shrink-0 -ml-2">
                                    <button onClick={handleUndo} disabled={!canUndo} className={`p-1 rounded transition-colors ${canUndo ? 'text-pplx-text hover:bg-pplx-hover cursor-pointer' : 'text-pplx-muted/30 cursor-default'}`} title="Undo (Back)"> <ChevronLeft size={22} /> </button>
                                    <button onClick={handleRedo} disabled={!canRedo} className={`p-1 rounded transition-colors ${canRedo ? 'text-pplx-text hover:bg-pplx-hover cursor-pointer' : 'text-pplx-muted/30 cursor-default'}`} title="Redo (Forward)"> <ChevronRight size={22} /> </button>
                                </div>

                                {openNoteIds.length > 0 && (<div className="hidden md:flex flex-1 items-center overflow-x-auto no-scrollbar gap-1 ml-1"> {openNoteIds.map(noteId => { const n = notes.find(note => note.id === noteId); if (!n) return null; const isActive = activeNoteId === noteId; return (<div key={noteId} onClick={() => navigateToNote(noteId)} className={` group flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-all max-w-[150px] ${isActive ? 'text-pplx-text font-medium' : 'text-pplx-muted hover:text-pplx-text hover:bg-pplx-secondary/50'} `} > <span className="truncate text-xs">{n.emoji || '📄'} {n.title || 'Untitled'}</span> <button onClick={(e) => handleCloseTab(e, noteId)} className="opacity-0 group-hover:opacity-100 hover:bg-pplx-hover rounded p-0.5 transition-opacity" > <X size={10} /> </button> </div>); })} </div>)}
                            </div>
                            {activeNote && (
                                <div className="flex items-center gap-1 ml-2 relative shrink-0">
                                    <button onClick={() => handleSaveNote({ ...activeNote, isFavorite: !activeNote.isFavorite })} className={`p-1.5 rounded transition-all duration-150 ${activeNote.isFavorite ? 'text-yellow-400 hover:text-yellow-500' : 'text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover'}`} title={activeNote.isFavorite ? "Remove from Favorites" : "Add to Favorites"} > <Star size={16} fill={activeNote.isFavorite ? "currentColor" : "none"} /> </button>
                                    <button onClick={() => setIsPageMenuOpen(!isPageMenuOpen)} className={`p-1.5 rounded transition-all duration-150 ${isPageMenuOpen ? 'text-pplx-text bg-pplx-hover' : 'text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover'}`} > <MoreHorizontal size={16} /> </button>
                                    {isPageMenuOpen && (<> <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsPageMenuOpen(false)} /> <div className="absolute top-8 right-0 z-50 w-64 bg-[#FFFFFF] dark:bg-[#202222] border border-pplx-border shadow-xl rounded-xl p-2 animate-fadeIn flex flex-col opacity-100"> <div className="flex bg-pplx-secondary/50 rounded-lg p-0.5 border border-pplx-border/50 mb-2"> <button onClick={() => handleSaveNote({ ...activeNote, fontStyle: 'sans' })} className={`flex-1 py-1.5 rounded text-xs font-medium font-sans ${activeNote.fontStyle !== 'serif' && activeNote.fontStyle !== 'mono' ? 'bg-pplx-card shadow-sm text-pplx-text' : 'text-pplx-muted hover:text-pplx-text'}`}>Sans</button> <button onClick={() => handleSaveNote({ ...activeNote, fontStyle: 'serif' })} className={`flex-1 py-1.5 rounded text-xs font-medium font-serif ${activeNote.fontStyle === 'serif' ? 'bg-pplx-card shadow-sm text-pplx-text' : 'text-pplx-muted hover:text-pplx-text'}`}>Serif</button> <button onClick={() => handleSaveNote({ ...activeNote, fontStyle: 'mono' })} className={`flex-1 py-1.5 rounded text-xs font-medium font-mono ${activeNote.fontStyle === 'mono' ? 'bg-pplx-card shadow-sm text-pplx-text' : 'text-pplx-muted hover:text-pplx-text'}`}>Mono</button> </div> <div className="grid grid-cols-4 gap-1 mb-2"> <button onClick={handleUndo} disabled={!canUndo} className={`p-2 flex flex-col items-center justify-center gap-1 rounded ${canUndo ? 'hover:bg-pplx-hover text-pplx-muted hover:text-pplx-text' : 'text-pplx-muted/30 cursor-default'} transition-colors`} title="Undo Last Change"> <Undo2 size={16} /> </button> <button onClick={handleTranslateNote} className="p-2 flex flex-col items-center justify-center gap-1 rounded hover:bg-pplx-hover text-pplx-muted hover:text-pplx-text transition-colors" title="Translate Note"> <Languages size={16} /> </button> <button onClick={() => handleMoveTo()} className="p-2 flex flex-col items-center justify-center gap-1 rounded hover:bg-pplx-hover text-pplx-muted hover:text-pplx-text transition-colors" title="Set Category"> <FolderInput size={16} /> </button> <button onClick={handleSuggestEdits} className="p-2 flex flex-col items-center justify-center gap-1 rounded hover:bg-pplx-hover text-pplx-muted hover:text-pplx-text transition-colors" title="Grammar & Fixes"> <FileEdit size={16} /> </button> </div> <div className="h-px bg-pplx-border/50 my-1" /> <button onClick={handleCopyNoteContent} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-pplx-text hover:bg-pplx-hover rounded transition-colors"> <ClipboardCopy size={14} className="text-pplx-muted" /> Copy Content </button> <button onClick={handleCopyLink} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-pplx-text hover:bg-pplx-hover rounded transition-colors"> <Copy size={14} className="text-pplx-muted" /> Copy Link </button> <button onClick={() => handleDuplicateNote()} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-pplx-text hover:bg-pplx-hover rounded transition-colors"> <CopyPlus size={14} className="text-pplx-muted" /> Duplicate </button> <div className="h-px bg-pplx-border/50 my-1" /> <button onClick={handleExportNote} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-pplx-text hover:bg-pplx-hover rounded transition-colors"> <Download size={14} className="text-pplx-muted" /> Export .md </button> <button onClick={() => importInputRef.current?.click()} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-pplx-text hover:bg-pplx-hover rounded transition-colors"> <Upload size={14} className="text-pplx-muted" /> Import </button> <input type="file" ref={importInputRef} className="hidden" accept=".md,.txt" onChange={handleImportNote} /> <div className="h-px bg-pplx-border/50 my-1" /> <div className="flex items-center justify-between px-2 py-1.5"> <div className="flex items-center gap-2"> <Wifi size={14} className="text-pplx-muted" /> <span className="text-xs font-medium">Offline</span> </div> <button onClick={() => handleSaveNote({ ...activeNote, isOffline: !activeNote.isOffline })} className={`w-8 h-4 rounded-full relative transition-colors ${activeNote.isOffline ? 'bg-pplx-accent' : 'bg-pplx-border'}`}> <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${activeNote.isOffline ? 'translate-x-4' : ''}`} /> </button> </div> <div className="flex items-center justify-between px-2 py-1.5"> <div className="flex items-center gap-2"> <Lock size={14} className="text-pplx-muted" /> <span className="text-xs font-medium">Lock</span> </div> <button onClick={() => handleSaveNote({ ...activeNote, isLocked: !activeNote.isLocked })} className={`w-8 h-4 rounded-full relative transition-colors ${activeNote.isLocked ? 'bg-pplx-accent' : 'bg-pplx-border'}`}> <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${activeNote.isLocked ? 'translate-x-4' : ''}`} /> </button> </div> <div className="h-px bg-pplx-border/50 my-1" /> <button onClick={() => { handleDeleteNote(activeNote.id); setIsPageMenuOpen(false); }} className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-red-400 hover:bg-pplx-hover rounded transition-colors"> <Trash2 size={14} /> Move to Trash </button> </div> </>)}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Home Header (Mobile Only) */}
                {!activeThreadId && activeView === 'chat' && !activeSpaceId && (
                    <div className="md:hidden absolute top-0 left-0 right-0 z-20 p-6 pt-10 flex flex-col items-start gap-4 pointer-events-none pt-safe">
                        {/* Profile Section (Click to Open Settings) */}
                        <div
                            onClick={handleOpenSettings}
                            className="flex items-center gap-4 pointer-events-auto cursor-pointer active:opacity-80 transition-opacity"
                        >
                            {/* Avatar (Larger) - Simple, no border/bg colors */}
                            <div className="w-[64px] h-[64px] rounded-full overflow-hidden shrink-0">
                                {settings.userProfile.avatar ? (
                                    <img src={settings.userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-800 text-2xl font-bold">
                                        {(settings.userProfile.name ? settings.userProfile.name.substring(0, 1).toUpperCase() : 'U')}
                                    </div>
                                )}
                            </div>

                            {/* Name & Subtitle (Larger Name, Smaller Subtitle) */}
                            <div className="flex flex-col">
                                <span className="text-[26px] font-semibold text-pplx-text leading-tight drop-shadow-md">
                                    {settings.userProfile.name || 'User'}
                                </span>
                                <span className="text-xs text-pplx-muted font-light tracking-wide opacity-90 drop-shadow-sm mt-0.5">
                                    Where knowledge begins
                                </span>
                            </div>
                        </div>

                        {/* Sidebar Toggle (Custom Icon: Shorter Bottom Line) */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="pointer-events-auto p-2 text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover rounded-lg transition-colors flex items-center gap-2 mt-1"
                        >
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="18" x2="15" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                {activeThreadId && activeView === 'chat' && (
                    <>
                        {/* TOP GRADIENT MASK */}
                        <div className="fixed top-0 left-0 right-0 h-14 md:h-32 bg-gradient-to-b from-pplx-primary md:from-pplx-primary via-pplx-primary/80 md:via-pplx-primary/80 to-transparent pointer-events-none z-30 pt-safe" />

                        <div className="absolute top-0 left-0 right-0 z-40 pointer-events-none [&>div]:!bg-transparent [&>div]:!backdrop-blur-none [&>div]:pointer-events-auto">
                            {(() => {
                                // Use focused message if available, otherwise fallback to last model message
                                const focusedMsg = activeThread?.messages.find(m => m.id === focusedMessageId);
                                const lastModelMessage = activeThread?.messages.filter(m => m.role === Role.MODEL).slice(-1)[0];
                                const targetMessage = (focusedMsg && focusedMsg.role === Role.MODEL) ? focusedMsg : lastModelMessage;

                                return (
                                    <ChatHeader
                                        title={activeThread?.title}
                                        onBack={handleBackToNewThread}
                                        shouldShowSidebarToggle={!sidebarOpen}
                                        onToggleSidebar={() => setSidebarOpen(true)}
                                        showActions={!!targetMessage && !targetMessage.isThinking}
                                        onTTS={() => targetMessage && handleTTS(targetMessage.content)}
                                        isPlayingAudio={isPlayingAudio}
                                        onDashboard={() => setIsDashboardMode(true)}
                                        onCopy={() => targetMessage && handleCopyText(targetMessage.id, targetMessage.content)}
                                        onShare={() => targetMessage && handleShare(targetMessage.content)}
                                        onSave={() => targetMessage && setActiveAddToSpaceId(targetMessage.id)}
                                        activeSpace={activeSpace}
                                    />
                                );
                            })()}
                        </div>
                    </>
                )}

                {activeView === 'library' ? (
                    <div className="flex-1 flex flex-col overflow-hidden bg-pplx-secondary/30">
                        <NotesView
                            activeNoteId={activeNoteId}
                            notes={notes}
                            onSaveNote={handleSaveNote}
                            onDeleteNote={handleDeleteNote}
                            onCreateNote={() => handleNewNote()}
                            onAiEdit={handleAiTextEdit}
                            onSelectNote={handleSelectNote}
                            isSideChatOpen={isSideChatOpen}
                        />
                    </div>
                ) : activeView === 'calendar' ? (
                    <div className="flex-1 overflow-hidden bg-pplx-secondary/30">
                        <CalendarView
                            events={events}
                            onAddEvent={handleAddEvent}
                            onUpdateEvent={handleUpdateEvent}
                            onDeleteEvent={handleDeleteEvent}
                            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                            isSidebarOpen={sidebarOpen}
                        />
                    </div>
                ) : (
                    <>
                        <div
                            ref={chatContainerRef}
                            onScroll={handleScroll}
                            className={`flex-1 overflow-y-auto overflow-x-hidden w-full p-2 md:p-0 scroll-smooth pt-24 pb-28 ${activeView === 'chat' && !activeThreadId ? 'md:pb-0' : 'md:pb-64'}`} // Reduced padding-bottom on mobile
                        >
                            {!activeThreadId || !activeThread ? (
                                <div className="flex flex-col min-h-full relative z-10">
                                    {activeSpace ? (
                                        <div className="flex flex-col min-h-full animate-fadeIn relative max-w-6xl mx-auto w-full">
                                            {/* Top Navigation (Desktop) */}
                                            <div className="hidden md:flex items-center gap-2 text-sm text-pplx-muted hover:text-pplx-text cursor-pointer mb-8 pt-8 px-8" onClick={() => setActiveSpaceId(null)}>
                                                <ChevronLeft size={16} />
                                                <span>All projects</span>
                                            </div>

                                            <div className="flex-1 no-scrollbar px-4 md:px-8 pb-4 md:pb-32">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">

                                                    {/* LEFT COLUMN: Info & Activity */}
                                                    <div className="md:col-span-2 flex flex-col gap-8">
                                                        {/* Header */}
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex items-center justify-between">
                                                                <h1 className="text-3xl md:text-4xl font-serif font-medium text-pplx-text tracking-tight flex items-center">
                                                                    {activeSpace.emoji && <span className="mr-3">{activeSpace.emoji}</span>}
                                                                    {activeSpace.title}
                                                                </h1>
                                                                <div className="flex items-center gap-2 md:hidden">
                                                                    {/* Mobile Actions if needed */}
                                                                </div>
                                                            </div>
                                                            <p className="text-pplx-muted text-base font-light leading-relaxed">
                                                                {activeSpace.description || 'No description provided.'}
                                                            </p>
                                                        </div>

                                                        {/* Mobile Actions (Instructions & Files) */}
                                                        <div className="grid grid-cols-2 gap-3 md:hidden">
                                                            <button
                                                                onClick={() => {
                                                                    setSpaceModalInitialId(activeSpace.id);
                                                                    setSpacesModalOpen(true);
                                                                }}
                                                                className="flex flex-col items-start gap-2 p-4 bg-pplx-card/40 border border-pplx-border/60 rounded-xl hover:bg-pplx-hover/30 transition-colors text-left"
                                                            >
                                                                <div className="p-2 bg-pplx-secondary/50 rounded-lg text-pplx-text">
                                                                    <FileEdit size={18} />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-medium text-pplx-text">Instructions</span>
                                                                    <span className="text-[10px] text-pplx-muted line-clamp-1">
                                                                        {activeSpace.systemInstructions ? 'Edit instructions' : 'Add instructions'}
                                                                    </span>
                                                                </div>
                                                            </button>

                                                            <button
                                                                onClick={() => setIsSpaceFilesModalOpen(true)}
                                                                className="flex flex-col items-start gap-2 p-4 bg-pplx-card/40 border border-pplx-border/60 rounded-xl hover:bg-pplx-hover/30 transition-colors text-left"
                                                            >
                                                                <div className="p-2 bg-pplx-secondary/50 rounded-lg text-pplx-text">
                                                                    <FolderInput size={18} />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-medium text-pplx-text">Files</span>
                                                                    <span className="text-[10px] text-pplx-muted">
                                                                        {activeSpace.files.length} files
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        </div>

                                                        {/* Recent Activity */}
                                                        <div className="flex flex-col gap-4">
                                                            <h2 className="text-sm font-medium text-pplx-text opacity-90">
                                                                Recent activity
                                                            </h2>
                                                            <div className="flex flex-col">
                                                                {threads
                                                                    .filter(t => t.spaceId === activeSpace.id)
                                                                    .slice(0, 5)
                                                                    .map(thread => (
                                                                        <div
                                                                            key={thread.id}
                                                                            onClick={() => setActiveThreadId(thread.id)}
                                                                            className="group flex items-center justify-between py-4 cursor-pointer hover:bg-pplx-hover/30 transition-colors px-2 -mx-2 rounded-lg"
                                                                        >
                                                                            <div className="flex flex-col gap-1">
                                                                                <span className="text-base font-medium text-pplx-text group-hover:text-pplx-accent transition-colors">
                                                                                    {thread.title || 'Untitled Conversation'}
                                                                                </span>
                                                                                <span className="text-xs text-pplx-muted">
                                                                                    Last message {new Date(thread.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                </span>
                                                                            </div>
                                                                            <ChevronRight size={16} className="text-pplx-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                        </div>
                                                                    ))
                                                                }
                                                                {threads.filter(t => t.spaceId === activeSpace.id).length === 0 && (
                                                                    <div className="py-8 text-pplx-muted text-sm italic">
                                                                        No recent activity. Start a new chat below.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* RIGHT COLUMN: Project Knowledge Panel */}
                                                    <div className="hidden md:flex md:col-span-1 flex-col gap-6">
                                                        <div className="bg-pplx-card/40 border border-pplx-border/60 rounded-xl p-5 flex flex-col gap-6 backdrop-blur-sm">

                                                            {/* Instructions Section */}
                                                            <div className="flex flex-col gap-3">
                                                                <div className="flex items-center justify-between">
                                                                    <h3 className="text-sm font-medium text-pplx-text">Instructions</h3>
                                                                    <button
                                                                        onClick={() => setSpacesModalOpen(true)} // Opens space settings where instructions are
                                                                        className="text-pplx-muted hover:text-pplx-text transition-colors p-1 hover:bg-pplx-hover rounded"
                                                                    >
                                                                        <Plus size={16} />
                                                                    </button>
                                                                </div>
                                                                <div className="text-xs text-pplx-muted leading-relaxed line-clamp-3">
                                                                    {activeSpace.systemInstructions
                                                                        ? activeSpace.systemInstructions
                                                                        : "Add instructions to tailor the assistant's responses for this project."
                                                                    }
                                                                </div>
                                                            </div>

                                                            <div className="h-px w-full bg-pplx-border/50" />

                                                            {/* Files Section */}
                                                            <div className="flex flex-col gap-3">
                                                                <div className="flex items-center justify-between">
                                                                    <h3 className="text-sm font-medium text-pplx-text">Files</h3>
                                                                    <button
                                                                        onClick={() => setIsSpaceFilesModalOpen(true)}
                                                                        className="text-pplx-muted hover:text-pplx-text transition-colors p-1 hover:bg-pplx-hover rounded"
                                                                    >
                                                                        <Plus size={16} />
                                                                    </button>
                                                                </div>

                                                                {/* File List Preview */}
                                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                                    {activeSpace.files.slice(0, 4).map((file, idx) => (
                                                                        <div key={idx} className="bg-pplx-primary/50 border border-pplx-border/50 rounded p-2 flex items-center gap-2 overflow-hidden">
                                                                            <div className="shrink-0 text-pplx-muted">
                                                                                <FileText size={14} />
                                                                            </div>
                                                                            <span className="text-[10px] text-pplx-text truncate">
                                                                                {file.name}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                    {activeSpace.files.length === 0 && (
                                                                        <div className="col-span-2 py-4 text-center text-[10px] text-pplx-muted border border-dashed border-pplx-border/50 rounded">
                                                                            No files uploaded
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                        </div>
                                                    </div>

                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`flex flex-col h-full items-center justify-center relative z-10 ${activeView === 'chat' && !activeThreadId ? 'md:mt-24 -mt-10' : '-mt-10'}`}>
                                            {/* ... existing default home view ... */}
                                            <div className="hidden md:flex flex-col items-center">
                                                <PerplexityLogo className="w-16 h-16 text-gray-800 dark:text-white/90 mb-8 drop-shadow-xl dark:drop-shadow-2xl" />
                                                <h1 className="text-4xl md:text-5xl font-light text-transparent bg-clip-text bg-gradient-to-b from-gray-900 to-gray-600 dark:from-white dark:to-white/60 mb-4 font-serif tracking-tight drop-shadow-sm">
                                                    Where knowledge begins
                                                </h1>
                                                <div className="h-px w-12 bg-gradient-to-r from-transparent via-gray-300 dark:via-white/20 to-transparent mb-4" />
                                                <p className="text-sm md:text-base text-gray-400 dark:text-white/40 font-light tracking-[0.2em] uppercase">
                                                    Ask anything
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                // ... existing active thread view ...
                                isDashboardMode ? (
                                    // ... existing dashboard view ...
                                    <DashboardView
                                        message={
                                            (activeThread.messages.find(m => m.id === focusedMessageId) ||
                                                activeThread.messages.filter(m => m.role === Role.MODEL).slice(-1)[0])
                                        }
                                        onClose={() => setIsDashboardMode(false)}
                                    />
                                ) : (
                                    <div className="max-w-3xl mx-auto w-full py-4 space-y-6 px-4 md:px-0 mt-4 md:mt-0 relative z-0">

                                        {activeThread.messages.map((msg) => (
                                            // ... existing message mapping ...
                                            <div key={msg.id} data-message-id={msg.id} className="flex flex-col space-y-3 animate-fadeIn">

                                                {/* Message Row Alignment: Left for Model, Right for User */}
                                                {/* UPDATED: Mobile uses flex-col for Model to put Avatar on top */}
                                                <div className={`flex ${msg.role === Role.USER ? 'justify-end' : 'justify-start flex-col'} w-full group items-start`}>

                                                    {/* Header Row for Model: Avatar + Status Text */}
                                                    {msg.role === Role.MODEL && (
                                                        <div className="flex items-center gap-3 mb-2 select-none">
                                                            {/* Avatar/Icon */}
                                                            <div className="w-8 h-8 rounded-full bg-pplx-accent/10 flex items-center justify-center border border-transparent shrink-0">
                                                                <PerplexityLogo className={`w-5 h-5 text-pplx-accent ${msg.isThinking ? 'animate-spin-y' : ''}`} />
                                                            </div>

                                                            {/* Reasoning Indicator (Now to the right of avatar) */}
                                                            <TornadoIndicator isThinking={!!msg.isThinking} reasoning={msg.reasoning} />
                                                        </div>
                                                    )}

                                                    {/* Content Container */}
                                                    <div className={`flex flex-col min-w-0 ${msg.role === Role.USER ? 'items-end max-w-[85%] md:max-w-[75%]' : 'items-start w-full md:max-w-[100%]'} group`}>

                                                        {/* USER HEADER (The "You" label) - Added Edit/Copy Actions on Hover */}
                                                        {msg.role === Role.USER && (
                                                            <div className="flex items-center gap-2 mb-2 mr-1 opacity-100 transition-opacity justify-end w-full group">
                                                                {/* Action Buttons (Visible on hover) */}
                                                                <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mr-2 ${editingMessageId === msg.id ? 'opacity-100' : ''}`}>
                                                                    <button
                                                                        onClick={() => { setEditingMessageId(msg.id); setEditValue(msg.content); }}
                                                                        className="p-1.5 text-pplx-muted hover:text-pplx-text rounded hover:bg-pplx-hover transition-colors"
                                                                        title="Edit"
                                                                    >
                                                                        <Pencil size={12} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleCopyText(msg.id, msg.content)}
                                                                        className="p-1.5 text-pplx-muted hover:text-pplx-text rounded hover:bg-pplx-hover transition-colors relative"
                                                                        title="Copy"
                                                                    >
                                                                        {copiedId === msg.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                                                                    </button>
                                                                </div>

                                                                <span className="text-xs font-semibold text-pplx-text/70 uppercase tracking-widest">You</span>
                                                                <div className="w-6 h-6 rounded-full bg-pplx-secondary border border-pplx-border flex items-center justify-center">
                                                                    <User size={12} className="text-pplx-text/70" />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Attachments */}
                                                        {msg.attachments && msg.attachments.length > 0 && (
                                                            <div className={`mt-2 mb-2 grid grid-cols-2 sm:grid-cols-3 gap-3 ${msg.role === Role.USER ? 'justify-items-end' : ''}`}>
                                                                {msg.attachments.map((att, i) => (
                                                                    <div key={i} className="group relative aspect-square rounded-xl border border-pplx-border overflow-hidden bg-pplx-secondary hover:border-pplx-muted transition-colors w-24 h-24">
                                                                        {att.type === 'image' ? (<img src={att.content} alt="attachment" className="w-full h-full object-cover" />) : (<div className="w-full h-full flex flex-col items-center justify-center p-3 text-center"> <FileText className="text-pplx-muted mb-2 group-hover:text-pplx-text transition-colors" size={24} /> <span className="text-xs text-pplx-text leading-tight line-clamp-2 w-full break-words">{att.name}</span> </div>)}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}



                                                        {/* Text Content Bubble OR Edit Mode */}
                                                        {editingMessageId === msg.id ? (
                                                            <div className="w-full bg-pplx-secondary border border-pplx-border rounded-2xl p-4 mt-1 animate-fadeIn">
                                                                <textarea
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    className="w-full bg-transparent text-pplx-text outline-none resize-none text-[16px] leading-7 font-sans min-h-[80px]"
                                                                    autoFocus
                                                                />
                                                                <div className="flex justify-end gap-2 mt-2">
                                                                    <button
                                                                        onClick={() => setEditingMessageId(null)}
                                                                        className="px-3 py-1.5 text-xs font-medium text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover rounded-lg transition-colors"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleEditUserMessage(msg.id, editValue)}
                                                                        className="px-4 py-1.5 text-xs font-bold text-black bg-pplx-accent hover:bg-cyan-400 rounded-lg transition-colors"
                                                                    >
                                                                        Save & Submit
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className={`font-normal text-[16px] leading-7 transition-all relative ${msg.role === Role.USER
                                                                ? 'bg-pplx-card border border-pplx-border/60 px-4 py-3 rounded-3xl rounded-tr-sm text-pplx-text text-right whitespace-pre-wrap shadow-md backdrop-blur-md'
                                                                : 'w-full text-pplx-text'
                                                                }`}>
                                                                {msg.role === Role.USER ? (
                                                                    msg.content
                                                                ) : (
                                                                    <MessageRenderer content={msg.content} />
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Sources - MODIFIED: Compact Grid instead of Flex List (30% Smaller) */}
                                                        {msg.role === Role.MODEL && msg.citations && msg.citations.length > 0 && (
                                                            <div className="mt-2 w-full pt-2">
                                                                <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-pplx-muted mb-1.5 tracking-widest opacity-80">
                                                                    <BookOpen size={9} /> <span>Sources</span>
                                                                </div>
                                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                                                                    {msg.citations.map((cit, idx) => (
                                                                        <a key={idx} href={cit.uri} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-1.5 py-1 bg-pplx-card hover:bg-pplx-hover border border-pplx-border/50 hover:border-pplx-muted/50 rounded-md transition-all group overflow-hidden" >
                                                                            <div className="bg-pplx-secondary p-0.5 rounded-full shrink-0"> <Globe size={8} className="text-pplx-muted" /> </div>
                                                                            <div className="flex flex-col overflow-hidden min-w-0">
                                                                                <span className="text-[9px] font-medium text-pplx-text truncate leading-none group-hover:text-pplx-accent transition-colors">{cit.title}</span>
                                                                                <span className="text-[8px] text-pplx-muted truncate leading-none opacity-70 mt-0.5">{new URL(cit.uri).hostname}</span>
                                                                            </div>
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* AI FOOTER ACTIONS (Regenerate, Copy, Share, Add to Workspace) */}
                                                        {msg.role === Role.MODEL && !msg.isThinking && (
                                                            // UPDATED: Added flex-nowrap and mobile optimizations for button layout
                                                            <div className="flex items-center justify-between md:justify-start gap-1 md:gap-2 mt-4 border-t border-pplx-border/30 pt-2 w-full flex-nowrap">
                                                                <button
                                                                    onClick={() => handleRegenerate(msg.id)}
                                                                    className="flex items-center justify-center gap-1.5 px-2 md:px-2.5 py-1.5 text-xs text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover rounded-lg transition-colors flex-1 md:flex-none"
                                                                    title="Regenerate Answer"
                                                                >
                                                                    <RefreshCw size={13} className="shrink-0" />
                                                                    <span className="font-medium text-[10px] md:text-xs truncate">Rewrite</span>
                                                                </button>

                                                                <button
                                                                    onClick={() => handleCopyText(msg.id, msg.content)}
                                                                    className="flex items-center justify-center gap-1.5 px-2 md:px-2.5 py-1.5 text-xs text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover rounded-lg transition-colors relative flex-1 md:flex-none"
                                                                    title="Copy Response"
                                                                >
                                                                    {copiedId === msg.id ? <Check size={13} className="text-green-400 shrink-0" /> : <Copy size={13} className="shrink-0" />}
                                                                    <span className="font-medium text-[10px] md:text-xs truncate">Copy</span>
                                                                </button>

                                                                <button
                                                                    onClick={() => handleShare(msg.content)}
                                                                    className="flex items-center justify-center gap-1.5 px-2 md:px-2.5 py-1.5 text-xs text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover rounded-lg transition-colors flex-1 md:flex-none"
                                                                    title="Share"
                                                                >
                                                                    <Share2 size={13} className="shrink-0" />
                                                                    <span className="font-medium text-[10px] md:text-xs truncate">Share</span>
                                                                </button>

                                                                <div className="relative flex-1 md:flex-none">
                                                                    <button
                                                                        onClick={() => setActiveAddToSpaceId(activeAddToSpaceId === msg.id ? null : msg.id)}
                                                                        className={`flex items-center justify-center gap-1.5 px-2 md:px-2.5 py-1.5 text-xs rounded-lg transition-colors w-full md:w-auto ${activeAddToSpaceId === msg.id ? 'bg-pplx-hover text-pplx-text' : 'text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover'}`}
                                                                        title="Add to Workspace"
                                                                    >
                                                                        <FolderPlus size={13} className="shrink-0" />
                                                                        <div className="flex flex-col items-start leading-[9px] md:flex-row md:items-center md:gap-1 md:leading-normal text-left">
                                                                            <span className="font-medium text-[9px] md:text-xs whitespace-nowrap">Add to</span>
                                                                            <span className="font-medium text-[9px] md:text-xs whitespace-nowrap">Workspace</span>
                                                                        </div>
                                                                    </button>

                                                                    {/* Workspace Picker Popup */}
                                                                    {activeAddToSpaceId === msg.id && (
                                                                        <>
                                                                            <div className="fixed inset-0 z-30" onClick={() => setActiveAddToSpaceId(null)} />
                                                                            <div className="absolute bottom-full right-0 mb-2 w-56 bg-pplx-card border border-pplx-border rounded-xl shadow-xl z-40 p-1 animate-in slide-in-from-bottom-2 fade-in duration-150 origin-bottom-right">
                                                                                <div className="px-3 py-2 text-[10px] font-bold text-pplx-muted uppercase tracking-wider">Select Space</div>
                                                                                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                                                    {spaces.length === 0 && (
                                                                                        <div className="px-3 py-2 text-xs text-pplx-muted italic">No spaces created yet.</div>
                                                                                    )}
                                                                                    {spaces.map(space => (
                                                                                        <button
                                                                                            key={space.id}
                                                                                            onClick={() => handleAddToSpace(space.id, msg.content)}
                                                                                            className="w-full text-left px-3 py-2 text-xs text-pplx-text hover:bg-pplx-hover rounded-lg flex items-center gap-2 truncate"
                                                                                        >
                                                                                            <span>{space.emoji}</span>
                                                                                            <span className="truncate">{space.title}</span>
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Compact Related Questions */}
                                                        {msg.role === Role.MODEL && msg.relatedQuestions && msg.relatedQuestions.length > 0 && (
                                                            <div className="mt-4 w-full pt-2">
                                                                <div className="flex flex-col gap-1">
                                                                    {msg.relatedQuestions.map((q, i) => (
                                                                        <button
                                                                            key={i}
                                                                            onClick={() => handleSendMessage(q, [FocusMode.ALL], ProMode.STANDARD, [])}
                                                                            className="flex items-center justify-between w-full py-1.5 px-1 text-left text-sm text-pplx-muted hover:text-pplx-text transition-colors group relative pl-3 border-l-2 border-transparent hover:border-pplx-accent/50"
                                                                        >
                                                                            <div className="flex items-center gap-2 truncate">
                                                                                <span className="truncate">{q}</span>
                                                                            </div>
                                                                            <ArrowRight size={14} className="text-pplx-muted opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-150" />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}

                            {/* Floating Scroll to Bottom Button */}
                            {showScrollButton && (
                                <button
                                    onClick={scrollToBottom}
                                    className={`fixed left-1/2 -translate-x-1/2 z-30 p-1.5 md:p-2 bg-pplx-card/60 md:bg-pplx-secondary/80 backdrop-blur-md border border-pplx-border/50 md:border-transparent rounded-full shadow-sm md:shadow-none text-pplx-muted md:text-pplx-text hover:text-pplx-text hover:bg-pplx-hover/50 md:hover:bg-pplx-hover transition-all duration-150 animate-in fade-in zoom-in group`}
                                    style={{
                                        bottom: window.innerWidth < 768
                                            ? (settings.enableMobileDock ? 'calc(220px + env(safe-area-inset-bottom))' : '160px')
                                            : '128px'
                                    }}
                                    title="Scroll to Bottom"
                                >
                                    <ArrowDown className="w-4 h-4 md:w-5 md:h-5 md:stroke-[2.2] transition-colors" />
                                </button>
                            )}

                        </div>

                        <div className={`w-full bg-pplx-primary pt-2 px-4 z-30 shrink-0 border-t border-transparent transition-all duration-500 relative ${settings.enableMobileDock ? 'sm:pb-6' : 'pb-0'} ${activeView === 'chat' && !activeThreadId && !activeSpace ? 'md:pb-[35vh]' : 'md:pb-0'}`}>
                            {/* BOTTOM GRADIENT MASK (Desktop) - Perfectly glued to input box */}
                            <div className="absolute bottom-[calc(100%-8px)] left-0 right-0 h-14 bg-gradient-to-t from-pplx-primary via-pplx-primary/80 to-transparent pointer-events-none z-10 hidden md:block" />

                            {/* Mobile version usually has input fixed differently, but this helps fade content on scroll */}
                            <div
                                className="fixed left-0 right-0 h-14 bg-gradient-to-t from-pplx-primary to-transparent pointer-events-none z-10 md:hidden"
                                style={{
                                    bottom: settings.enableMobileDock
                                        ? 'calc(120px + env(safe-area-inset-bottom))'
                                        : '120px'
                                }}
                            />
                            <div className="pointer-events-auto">
                                <InputArea
                                    key={activeThreadId || 'home'}
                                    onSendMessage={handleSendMessage}
                                    onStop={handleStopGeneration}
                                    isThinking={isThinking}
                                    settings={settings}
                                    notes={notes}
                                    spaces={spaces}
                                    activeSpaceId={activeSpaceId}
                                    onSelectSpace={handleSelectSpace}
                                    onNewSpace={() => setSpacesModalOpen(true)}
                                    proMode={inputProMode}
                                    setProMode={setInputProMode}
                                    isAgentMode={inputIsAgentMode}
                                    setIsAgentMode={setInputIsAgentMode}
                                    isAgentMax={inputIsAgentMax}
                                    setIsAgentMax={setInputIsAgentMax}
                                    isLongThinking={inputIsLongThinking}
                                    setIsLongThinking={setInputIsLongThinking}
                                />
                            </div>
                        </div>
                    </>
                )}

            </main>

            {/* Side Chat Panel */}
            <SideChatPanel
                isOpen={isSideChatOpen}
                onClose={() => setIsSideChatOpen(false)}
                messages={threads.find(t => t.id === sideChatThreadId)?.messages || []}
                isThinking={isThinking}
                onSendMessage={(text, focusModes, atts, iam) => handleSendMessage(text, focusModes, ProMode.STANDARD, atts, undefined, false, sideChatThreadId!, iam)}
                onStopGeneration={handleStopGeneration}
                onRegenerate={(msgId) => handleRegenerate(msgId, sideChatThreadId!)}
                onEditMessage={(msgId, newContent) => handleEditUserMessage(msgId, newContent, sideChatThreadId!)}
                onCopyText={handleCopyText}
                onShare={handleShare}
                onTTS={handleTTS}
                isPlayingAudio={isPlayingAudio}
                copiedId={copiedId}
                activeNote={notes.find(n => n.id === activeNoteId)}
                onNewChat={handleClearSideChat}
                mode={chatMode}
                onModeChange={setChatMode}
                isAgentMax={inputIsAgentMax}
                setIsAgentMax={setInputIsAgentMax}
            />

            {/* Floating Action Button for Side Chat (Only in Library Mode) */}
            {activeView === 'library' && activeNoteId && !isSideChatOpen && (
                <button
                    onClick={handleSideChatToggle}
                    className="fixed right-6 z-40 p-3 rounded-full bg-pplx-secondary border border-pplx-border text-pplx-muted shadow-md hover:bg-pplx-hover hover:text-pplx-text transition-all duration-150 animate-in zoom-in"
                    style={{
                        bottom: settings.enableMobileDock && window.innerWidth < 640
                            ? 'calc(24px + 72px + env(safe-area-inset-bottom))'
                            : '24px'
                    }}
                    title="Open Page Chat"
                >
                    <MessageSquare size={20} />
                </button>
            )}

            <SettingsModal
                isOpen={settingsOpen}
                onClose={handleCancelSettings}
                settings={settings}
                onSave={handleSaveSettings}
                onPreview={(newSettings) => handleUpdateSettings(newSettings, false)}
            />
            <SpacesModal
                isOpen={spacesModalOpen}
                onClose={() => {
                    setSpacesModalOpen(false);
                    setSpaceModalInitialId(null);
                }}
                spaces={spaces}
                onSaveSpace={handleSaveSpace}
                onDeleteSpace={handleDeleteSpace}
                initialSpaceId={spaceModalInitialId}
            />

            <MobileDock
                visible={settings.enableMobileDock}
                onNavigate={handleMobileNavigate}
                onNewPage={handleMobileNewPage}
                notes={notes}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                activeView={
                    activeView === 'chat' && !activeThreadId ? 'home' :
                        activeView === 'library' && !activeNoteId ? 'favorites' :
                            activeView === 'calendar' ? 'calendar' :
                                activeNoteId || ''
                }
                backDestination={backDestination}
                isHomeBackActive={isHomeBackActive}
            />
        </div>
    );
}

export default App;
