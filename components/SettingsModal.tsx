import React, { useState, useEffect, useRef } from 'react';
import {
    X, Plus, Trash2, Check, Brain, Cpu, Search, User,
    Settings as SettingsIcon, Briefcase, Heart, StickyNote,
    Globe, ChevronDown, Folder, Users, Activity, GraduationCap, Plane,
    Zap, Key, Utensils, Palette, Film, Code, Target, Calendar, Feather,
    Moon, Sun, Type, Laptop, Cloud, Sparkles, Camera,
    ChevronRight, ArrowLeft, Flame, Download, Smartphone
} from 'lucide-react';
import { AppSettings, ModelProvider, LocalModelConfig, MemoryCategory } from '../types';
import { SemanticMemoryEntry } from '../memory';
import { memoryManager } from '../memory';
import { UI_STRINGS, AVAILABLE_OFFLINE_MODELS } from '../constants';
import { E2BService } from '../services/e2bService';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    onSave: (newSettings: AppSettings) => void;
    onPreview: (newSettings: Partial<AppSettings>) => void;
}

type TabType = 'profile' | 'general' | 'models' | 'memory';

// --- CONSTANTS ---
const OPENROUTER_PRESETS = [
    "z-ai/glm-4.7-flash",
    "xiaomi/mimo-v2-flash",
    "mistralai/ministral-8b-2512",
    "google/gemini-3-flash-preview",
    "x-ai/grok-4.1-fast",
    "qwen/qwen3-vl-30b-a3b-thinking",
    "google/gemini-2.5-flash-lite-preview-09-2025",
    "deepseek/deepseek-v3.2",
    "openai/gpt-4o", // Ensuring typical defaults are available
    "anthropic/claude-3-opus"
];

// --- COMPONENTS ---

// Desktop Sidebar Item
const SidebarItem = ({ id, label, icon: Icon, activeTab, onSelect }: { id: TabType, label: string, icon: any, activeTab: TabType, onSelect: (id: TabType) => void }) => (
    <button
        onClick={() => onSelect(id)}
        className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl text-sm transition-all group ${activeTab === id
                ? 'bg-pplx-hover text-pplx-text shadow-sm'
                : 'text-pplx-muted hover:bg-pplx-secondary hover:text-pplx-text'
            }`}
    >
        <div className={`${activeTab === id ? 'text-pplx-accent' : 'text-pplx-muted group-hover:text-pplx-text opacity-70'}`}>
            <Icon size={20} />
        </div>
        <div className="flex flex-col items-start text-left">
            <span className="font-medium tracking-wide">{label}</span>
        </div>
    </button>
);

// Premium Mobile Menu Item
const MobileMenuItem = ({ icon: Icon, label, description, onClick, active }: { icon: any, label: string, description?: string, onClick: () => void, active?: boolean }) => (
    <button
        onClick={onClick}
        className="w-full flex items-center justify-between p-4 my-1 mx-0 md:mx-2 rounded-2xl active:scale-[0.98] transition-all duration-200 group bg-transparent hover:bg-pplx-hover/50"
    >
        <div className="flex items-center gap-5">
            <div className={`p-3 rounded-2xl transition-colors duration-300 ${active ? 'bg-pplx-accent text-black' : 'bg-pplx-secondary/50 text-pplx-muted group-hover:text-pplx-text'}`}>
                <Icon size={22} strokeWidth={1.5} />
            </div>
            <div className="flex flex-col text-left">
                <span className={`text-[17px] font-medium tracking-tight ${active ? 'text-pplx-text' : 'text-pplx-text/90'}`}>{label}</span>
                {description && <span className="text-[13px] text-pplx-muted font-normal opacity-60">{description}</span>}
            </div>
        </div>
        <ChevronRight size={18} className="text-pplx-muted/30" strokeWidth={2} />
    </button>
);

interface FilterPillProps {
    id: MemoryCategory | 'all';
    label: string;
    icon: any;
    isActive: boolean;
    onClick: (id: MemoryCategory | 'all') => void;
}

const FilterPill: React.FC<FilterPillProps> = ({ id, label, icon: Icon, isActive, onClick }) => (
    <button
        onClick={() => onClick(id)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${isActive
                ? 'bg-pplx-text text-pplx-primary shadow-lg ring-1 ring-pplx-text/10'
                : 'bg-pplx-secondary/50 text-pplx-muted hover:bg-pplx-hover hover:text-pplx-text'
            }`}
    >
        <Icon size={14} className={isActive ? "text-pplx-primary" : "opacity-70"} />
        {label}
    </button>
);

const SectionHeader = ({ title, desc }: { title: string, desc: string }) => (
    <div className="mb-8 pb-4">
        <h4 className="text-2xl font-semibold text-pplx-text mb-2 font-serif tracking-tight">{title}</h4>
        <p className="text-sm text-pplx-muted leading-relaxed max-w-2xl opacity-80">{desc}</p>
    </div>
);

const InputGroup = ({ label, children, description }: { label: string, children?: React.ReactNode, description?: string }) => (
    <div className="mb-6">
        <label className="block text-[11px] font-bold text-pplx-muted uppercase tracking-widest mb-3 ml-1 opacity-70">{label}</label>
        {children}
        {description && <p className="text-[11px] text-pplx-muted mt-2 ml-1 opacity-60 font-medium">{description}</p>}
    </div>
);

const ToggleRow = ({ label, description, checked, onChange, isBeta = false }: any) => (
    <div className="flex items-center justify-between py-4 group cursor-pointer" onClick={onChange}>
        <div className="pr-6">
            <h4 className="text-base font-medium text-pplx-text flex items-center gap-2 mb-1">
                {label}
                {isBeta && <span className="px-1.5 py-0.5 rounded text-[9px] bg-pplx-secondary text-pplx-muted font-bold tracking-wide uppercase border border-transparent">Beta</span>}
            </h4>
            <p className="text-xs text-pplx-muted max-w-md leading-relaxed opacity-70">{description}</p>
        </div>
        <button
            className={`flex-shrink-0 w-12 h-7 rounded-full relative transition-colors duration-300 ease-out ${checked ? 'bg-pplx-text' : 'bg-pplx-secondary'}`}
        >
            <div className={`absolute top-1 left-1 w-5 h-5 bg-pplx-primary rounded-full shadow-sm transition-transform duration-300 ease-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    </div>
);

interface OfflineModelCardProps {
    model: LocalModelConfig;
    isDownloaded: boolean;
    isActive: boolean;
    onDownload: () => void;
    onSelect: () => void;
    onDelete: () => void;
    progress: number;
}

// Offline Model Card Component
const OfflineModelCard: React.FC<OfflineModelCardProps> = ({ model, isDownloaded, isActive, onDownload, onSelect, onDelete, progress }) => {
    return (
        <div className={`p-4 rounded-2xl border transition-all duration-300 ${isActive ? 'bg-pplx-card border-pplx-accent shadow-md' : 'bg-pplx-secondary/20 border-pplx-border hover:bg-pplx-secondary/40'}`}>
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-pplx-text text-sm">{model.name}</span>
                    <span className="text-[10px] font-bold bg-pplx-secondary text-pplx-muted px-1.5 py-0.5 rounded uppercase tracking-wide">{model.family}</span>
                </div>
                {isDownloaded ? (
                    <div className="flex items-center gap-1 text-[10px] text-green-500 font-bold uppercase tracking-wider bg-green-500/10 px-2 py-0.5 rounded-full">
                        <Check size={10} strokeWidth={3} /> Ready
                    </div>
                ) : (
                    <span className="text-[10px] text-pplx-muted font-medium bg-pplx-secondary px-2 py-0.5 rounded-full">{model.fileSize}</span>
                )}
            </div>

            <p className="text-xs text-pplx-muted mb-4 leading-relaxed line-clamp-2 min-h-[32px]">{model.description}</p>

            {progress > 0 && progress < 100 ? (
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-pplx-muted font-bold uppercase tracking-wider">
                        <span>Downloading...</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-pplx-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-pplx-accent transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    {isDownloaded ? (
                        <>
                            <button
                                onClick={onSelect}
                                disabled={isActive}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${isActive
                                        ? 'bg-pplx-text text-pplx-primary cursor-default'
                                        : 'bg-pplx-secondary hover:bg-pplx-hover text-pplx-text'
                                    }`}
                            >
                                {isActive ? 'Selected' : 'Select'}
                            </button>
                            <button
                                onClick={onDelete}
                                className="p-2 rounded-xl bg-pplx-secondary/50 text-pplx-muted hover:text-red-400 hover:bg-pplx-hover transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onDownload}
                            className="w-full py-2 rounded-xl bg-pplx-text text-pplx-primary text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                        >
                            <Download size={14} /> Download
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave, onPreview }) => {
    const [formData, setFormData] = useState<AppSettings>(settings);
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [memories, setMemories] = useState<SemanticMemoryEntry[]>([]);
    const [modelType, setModelType] = useState<'cloud' | 'local'>('cloud');

    // Mobile Navigation State
    const [isMobileDetail, setIsMobileDetail] = useState(false);
    const [isCategoriesCollapsed, setIsCategoriesCollapsed] = useState(false);

    const [memorySearch, setMemorySearch] = useState('');
    const [memoryFilter, setMemoryFilter] = useState<MemoryCategory | 'all'>('all');
    const [isAddingMemory, setIsAddingMemory] = useState(false);

    // Helper to update both local state and app preview
    const updateFormData = (updates: Partial<AppSettings>) => {
        setFormData(prev => ({ ...prev, ...updates }));
        // Use setTimeout to defer the onPreview call to avoid the "Cannot update a component while rendering" warning
        setTimeout(() => onPreview(updates), 0);
    };
    const [newMemoryContent, setNewMemoryContent] = useState('');
    const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryCategory>('AboutUser');

    // Offline Model State
    const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: number }>({});

    const fileInputRef = useRef<HTMLInputElement>(null);

    const t = UI_STRINGS[formData.interfaceLanguage] || UI_STRINGS.en;

    const MEMORY_CATEGORIES: { id: MemoryCategory | 'all', label: string, icon: any }[] = [
        { id: 'all', label: 'All', icon: Brain },
        { id: 'AboutUser', label: 'About Me', icon: User },
        { id: 'Work', label: 'Work', icon: Briefcase },
        { id: 'Projects', label: 'Projects', icon: Folder },
        { id: 'Coding', label: 'Coding', icon: Code },
        { id: 'Learning', label: 'Learning', icon: GraduationCap },
        { id: 'Goals', label: 'Goals', icon: Target },
        { id: 'Finance', label: 'Finance', icon: Activity },
        { id: 'Preferences', label: 'Preferences', icon: Heart },
        { id: 'CommunicationStyle', label: 'Style', icon: Feather },
        { id: 'Relationships', label: 'Relationships', icon: Users },
        { id: 'Health', label: 'Health', icon: Activity },
        { id: 'Diet', label: 'Diet', icon: Utensils },
        { id: 'Hobbies', label: 'Hobbies', icon: Palette },
        { id: 'Entertainment', label: 'Entertainment', icon: Film },
        { id: 'Travel', label: 'Travel', icon: Plane },
        { id: 'Events', label: 'Events', icon: Calendar },
        { id: 'Notes', label: 'Notes', icon: StickyNote },
        { id: 'Another', label: 'Other', icon: Globe },
    ];

    useEffect(() => {
        setFormData(settings);
        // Only reset mobile view and other states when the modal is FIRST opened
        // or when settings are explicitly updated from outside.
        // We check if it was previously closed to avoid resetting on every preview update.
    }, [settings]);

    // Separate effect for opening logic
    const prevIsOpen = useRef(isOpen);
    useEffect(() => {
        if (isOpen && !prevIsOpen.current) {
            setIsMobileDetail(false);
            setIsCategoriesCollapsed(false);

            if (settings.modelProvider === ModelProvider.LOCAL) {
                setModelType('local');
            } else {
                setModelType('cloud');
            }
            memoryManager.init().then(() => setMemories(memoryManager.semanticMemory.getAllEntries()));
        }
        prevIsOpen.current = isOpen;
    }, [isOpen, settings.modelProvider]);

    if (!isOpen) return null;

    const handleSave = () => { onSave(formData); };

    const handleMobileNav = (tab: TabType) => {
        setActiveTab(tab);
        setIsMobileDetail(true);
    };

    const getUserInitials = (name: string) => {
        return name ? name.substring(0, 1).toUpperCase() : 'U';
    };

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                updateFormData({
                    userProfile: { ...formData.userProfile, avatar: reader.result as string }
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddMemory = async () => {
        if (!newMemoryContent.trim()) return;
        await memoryManager.saveExplicitMemory(newMemoryContent, newMemoryCategory as any);
        const updated = memoryManager.semanticMemory.getAllEntries();
        setMemories(updated);
        setNewMemoryContent('');
        setIsAddingMemory(false);
    };

    const handleDeleteMemory = async (id: string) => {
        memoryManager.semanticMemory.deleteEntry(id);
        await memoryManager.saveState();
        const updated = memoryManager.semanticMemory.getAllEntries();
        setMemories(updated);
    };

    const handleClearMemory = async () => {
        if (confirm('Are you sure you want to forget everything about you? This cannot be undone.')) {
            memoryManager.semanticMemory.clear();
            await memoryManager.saveState();
            setMemories([]);
        }
    };

    // --- Offline Model Logic ---
    const handleDownloadModel = (model: LocalModelConfig) => {
        // Simulate download
        let progress = 0;
        setDownloadProgress(prev => ({ ...prev, [model.id]: 0 }));

        const interval = setInterval(() => {
            progress += Math.floor(Math.random() * 15) + 5;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);

                // Add to "downloaded" list in settings
                const updatedLocalModels = [...formData.localModels];
                const existingIdx = updatedLocalModels.findIndex(m => m.id === model.id);

                const completedModel = { ...model, isDownloaded: true };

                if (existingIdx >= 0) {
                    updatedLocalModels[existingIdx] = completedModel;
                } else {
                    updatedLocalModels.push(completedModel);
                }

                updateFormData({
                    localModels: updatedLocalModels,
                    activeLocalModelId: formData.activeLocalModelId || model.id,
                    modelProvider: formData.modelProvider === ModelProvider.LOCAL ? formData.modelProvider : ModelProvider.LOCAL
                });

                // Clear progress after short delay
                setTimeout(() => {
                    setDownloadProgress(prev => {
                        const next = { ...prev };
                        delete next[model.id];
                        return next;
                    });
                }, 500);
            } else {
                setDownloadProgress(prev => ({ ...prev, [model.id]: progress }));
            }
        }, 400);
    };

    const handleDeleteModel = (id: string) => {
        const newModels = formData.localModels.filter(m => m.id !== id);
        let newActiveId = formData.activeLocalModelId;
        if (id === formData.activeLocalModelId) {
            newActiveId = newModels.length > 0 ? newModels[0].id : '';
        }
        updateFormData({ localModels: newModels, activeLocalModelId: newActiveId });
    };

    const filteredMemories = memories.filter(m => {
        const matchesSearch = m.content.toLowerCase().includes(memorySearch.toLowerCase());
        const matchesFilter = memoryFilter === 'all' || m.category === memoryFilter;
        return matchesSearch && matchesFilter;
    });

    const getCategoryIcon = (cat: MemoryCategory) => {
        const found = MEMORY_CATEGORIES.find(c => c.id === cat);
        return found ? found.icon : Globe;
    };

    const getTabTitle = (tab: TabType) => {
        switch (tab) {
            case 'general': return t.general;
            case 'models': return t.models;
            case 'profile': return t.profile;
            case 'memory': return t.memory;
            default: return 'Settings';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-6 transition-opacity duration-300">
            <div className="bg-pplx-primary w-full max-w-5xl md:rounded-3xl shadow-2xl border-none md:border border-pplx-border/50 overflow-hidden flex flex-col md:flex-row h-[100dvh] md:h-[85vh] max-h-[900px] text-pplx-text relative">

                {/* --- MOBILE ROOT MENU --- */}
                <div className={`md:hidden flex-col h-full bg-pplx-primary w-full absolute inset-0 z-20 ${!isMobileDetail ? 'flex' : 'hidden'}`}>

                    {/* Settings List - Scrollable Container */}
                    <div className="flex-1 overflow-y-auto bg-pplx-primary pb-20 custom-scrollbar">

                        {/* Header (Now Scrollable) */}
                        <div className="flex items-center justify-between p-6 pb-2 bg-transparent">
                            <h2 className="text-3xl font-serif font-medium text-pplx-text tracking-tight">{t.settings}</h2>
                            <button onClick={onClose} className="p-3 -ml-2 bg-pplx-secondary/50 text-pplx-text rounded-full hover:bg-pplx-hover transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Profile Hero Card (Now Scrollable) */}
                        <div className="px-4 py-6">
                            <div
                                className="bg-pplx-card rounded-3xl p-6 shadow-xl shadow-black/5 relative overflow-hidden group active:scale-[0.98] transition-transform duration-200"
                                onClick={() => handleMobileNav('profile')}
                            >
                                <div className="flex items-center gap-5 relative z-10">
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-full bg-pplx-secondary flex items-center justify-center text-pplx-muted overflow-hidden">
                                            {formData.userProfile.avatar ? (
                                                <img src={formData.userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-xl font-bold text-pplx-text">{getUserInitials(formData.userProfile.name)}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-xl font-bold text-pplx-text tracking-tight truncate font-serif">{formData.userProfile.name || 'User'}</h3>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className="px-2.5 py-0.5 bg-pplx-secondary text-pplx-text text-[10px] font-bold rounded-full uppercase tracking-wider">Pro</span>
                                            {formData.userProfile.location && (
                                                <span className="text-xs text-pplx-muted truncate flex items-center gap-1 opacity-70">
                                                    <Globe size={10} /> {formData.userProfile.location}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-2 bg-pplx-secondary/50 rounded-full">
                                        <ChevronRight size={18} className="text-pplx-muted" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Settings Items */}
                        <div className="px-4 flex flex-col gap-2">
                            <div className="px-2 py-3 text-[11px] font-bold text-pplx-muted uppercase tracking-widest opacity-50">General</div>
                            <MobileMenuItem
                                icon={SettingsIcon}
                                label={t.general}
                                description="Appearance & language"
                                onClick={() => handleMobileNav('general')}
                            />
                            <MobileMenuItem
                                icon={Cpu}
                                label={t.models}
                                description="AI models & providers"
                                onClick={() => handleMobileNav('models')}
                            />

                            <div className="px-2 py-3 mt-6 text-[11px] font-bold text-pplx-muted uppercase tracking-widest opacity-50">Personalization</div>
                            <MobileMenuItem
                                icon={Brain}
                                label={t.memory}
                                description="Long-term knowledge"
                                onClick={() => handleMobileNav('memory')}
                            />
                            <MobileMenuItem
                                icon={User}
                                label={t.profile}
                                description="Identity & instructions"
                                onClick={() => handleMobileNav('profile')}
                            />
                        </div>

                        <div className="mt-12 flex flex-col items-center justify-center text-center opacity-30 mb-6">
                            <span className="text-xl font-serif text-pplx-text font-bold italic tracking-tighter">Perplex</span>
                            <p className="text-[10px] text-pplx-muted mt-1">v1.0.2</p>
                        </div>
                    </div>
                </div>

                {/* --- DESKTOP SIDEBAR --- */}
                <div className="hidden md:flex w-64 border-r border-pplx-border/50 bg-pplx-primary flex-col p-6 flex-shrink-0">
                    <h2 className="text-xl font-medium text-pplx-text mb-8 px-2 font-serif tracking-tight">{t.settings}</h2>
                    <nav className="flex flex-col gap-2">
                        <SidebarItem id="general" label={t.general} icon={SettingsIcon} activeTab={activeTab} onSelect={setActiveTab} />
                        <SidebarItem id="models" label={t.models} icon={Cpu} activeTab={activeTab} onSelect={setActiveTab} />
                        <SidebarItem id="profile" label={t.profile} icon={User} activeTab={activeTab} onSelect={setActiveTab} />
                        <SidebarItem id="memory" label={t.memory} icon={Brain} activeTab={activeTab} onSelect={setActiveTab} />
                    </nav>
                    <div className="mt-auto pt-6 px-2 opacity-40">
                        <p className="text-xs text-pplx-muted">Perplex Clone v1.0</p>
                    </div>
                </div>

                {/* --- MAIN CONTENT AREA --- */}
                <div className={`${isMobileDetail ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0 bg-pplx-primary md:bg-pplx-sidebar/30 overflow-hidden w-full h-full absolute md:static inset-0 z-30`}>

                    {/* Mobile Header: Blurred & Clean (No Border) */}
                    <div className="md:hidden flex items-center gap-4 p-4 pt-safe pb-4 bg-pplx-primary/95 backdrop-blur-md sticky top-0 z-20">
                        <button
                            onClick={() => setIsMobileDetail(false)}
                            className="p-3 -ml-2 rounded-full hover:bg-pplx-secondary text-pplx-text transition-all active:scale-95"
                        >
                            <ArrowLeft size={22} />
                        </button>
                        <h3 className="text-xl font-serif font-medium text-pplx-text tracking-tight">{getTabTitle(activeTab)}</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar overscroll-contain bg-pplx-primary md:bg-transparent">
                        <div className="p-5 md:p-10 max-w-4xl mx-auto pb-32 md:pb-10">

                            {/* --- GENERAL TAB --- */}
                            {activeTab === 'general' && (
                                <div className="space-y-10 animate-fadeIn">
                                    <div className="hidden md:block"><SectionHeader title={t.general} desc="Customize your experience." /></div>

                                    <div className="space-y-8">
                                        <div>
                                            <h5 className="text-[11px] font-bold text-pplx-muted uppercase tracking-widest mb-4 ml-1 opacity-70">{t.appearance}</h5>
                                            <div className="grid grid-cols-3 gap-3">
                                                {[
                                                    { id: 'dark', label: 'Dark', icon: Moon },
                                                    { id: 'light', label: 'Light', icon: Sun },
                                                    { id: 'system', label: 'Auto', icon: Laptop },
                                                ].map((opt) => (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => updateFormData({ theme: opt.id as any })}
                                                        className={`flex flex-col items-center justify-center py-5 px-2 rounded-2xl transition-all duration-300 ${formData.theme === opt.id
                                                                ? 'bg-pplx-card text-pplx-text shadow-xl shadow-black/5 ring-1 ring-black/5 dark:ring-white/10'
                                                                : 'bg-pplx-secondary/30 text-pplx-muted hover:bg-pplx-secondary/60 hover:text-pplx-text'
                                                            }`}
                                                    >
                                                        <opt.icon size={22} className={`mb-3 ${formData.theme === opt.id ? 'text-pplx-text' : 'opacity-50'}`} strokeWidth={1.5} />
                                                        <span className="text-[11px] font-medium tracking-wide">{opt.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="bg-pplx-card p-6 rounded-3xl shadow-sm">
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 bg-pplx-secondary rounded-xl text-pplx-text"><Type size={18} /></div>
                                                    <span className="text-sm font-medium text-pplx-text">Text Size</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-pplx-muted bg-pplx-secondary px-3 py-1 rounded-lg uppercase tracking-wider">{formData.textSize}</span>
                                            </div>
                                            <div className="relative pt-2 pb-1 px-1">
                                                <input
                                                    type="range" min="0" max="2" step="1"
                                                    value={formData.textSize === 'small' ? 0 : formData.textSize === 'medium' ? 1 : 2}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        const size = val === 0 ? 'small' : val === 1 ? 'medium' : 'large';
                                                        updateFormData({ textSize: size });
                                                    }}
                                                    className="w-full h-1.5 bg-pplx-secondary rounded-lg appearance-none cursor-pointer accent-pplx-text"
                                                />
                                                <div className="flex justify-between mt-3 text-[10px] text-pplx-muted font-semibold uppercase tracking-widest opacity-60">
                                                    <span>Small</span><span>Default</span><span>Large</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-pplx-card rounded-3xl px-6 py-2 shadow-sm sm:hidden">
                                            <ToggleRow
                                                label="Mobile Dock"
                                                description="Show a persistent bottom navigation bar on mobile."
                                                checked={formData.enableMobileDock}
                                                onChange={() => updateFormData({ enableMobileDock: !formData.enableMobileDock })}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-6 pt-2">
                                        <h5 className="text-[11px] font-bold text-pplx-muted uppercase tracking-widest mb-2 ml-1 opacity-70">Language</h5>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <div className="relative group">
                                                    <select
                                                        value={formData.interfaceLanguage}
                                                        onChange={(e) => updateFormData({ interfaceLanguage: e.target.value as any })}
                                                        className="w-full bg-pplx-input text-pplx-text text-sm rounded-2xl px-5 py-4 outline-none appearance-none transition-all cursor-pointer hover:bg-pplx-secondary"
                                                    >
                                                        <option value="en">English (Interface)</option>
                                                        <option value="ro">Română (Interfață)</option>
                                                    </select>
                                                    <ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-pplx-muted pointer-events-none" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="relative group">
                                                    <select
                                                        value={formData.aiProfile.language}
                                                        onChange={(e) => updateFormData({ aiProfile: { ...formData.aiProfile, language: e.target.value } })}
                                                        className="w-full bg-pplx-input text-pplx-text text-sm rounded-2xl px-5 py-4 outline-none appearance-none transition-all cursor-pointer hover:bg-pplx-secondary"
                                                    >
                                                        <option value="English">English (AI Response)</option>
                                                        <option value="Romanian">Romanian (AI Response)</option>
                                                        <option value="Spanish">Spanish</option>
                                                        <option value="French">French</option>
                                                        <option value="German">German</option>
                                                        <option value="Japanese">Japanese</option>
                                                    </select>
                                                    <ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-pplx-muted pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-pplx-card rounded-3xl px-6 py-2 shadow-sm mt-6">
                                            <ToggleRow
                                                label="Pro Search"
                                                description="Enable real-time web grounding."
                                                checked={formData.useSearch}
                                                onChange={() => updateFormData({ useSearch: !formData.useSearch })}
                                                isBeta={true}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- MODELS TAB --- */}
                            {activeTab === 'models' && (
                                <div className="space-y-8 animate-fadeIn">
                                    <div className="hidden md:block"><SectionHeader title={t.models} desc="Configure AI sources." /></div>

                                    {/* Real-Time Data Search Configuration */}
                                    <div className="bg-pplx-card rounded-3xl p-6 mb-6 shadow-sm">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2.5 bg-pplx-secondary rounded-xl text-pplx-text"><Search size={18} /></div>
                                            <div><h4 className="text-sm font-bold text-pplx-text">Real Time Data Search</h4><p className="text-[11px] text-pplx-muted opacity-70">Select your real-time search provider</p></div>
                                        </div>

                                        <div className="flex gap-2 mb-4 bg-pplx-secondary/30 p-1 rounded-xl">
                                            <button
                                                onClick={() => updateFormData({ searchProvider: 'tavily' })}
                                                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${formData.searchProvider === 'tavily'
                                                        ? 'bg-pplx-text text-pplx-primary shadow-md transform scale-[1.02]'
                                                        : 'bg-transparent text-pplx-muted hover:text-pplx-text hover:bg-pplx-secondary/50'
                                                    }`}
                                            >
                                                Tavily
                                            </button>
                                            <button
                                                onClick={() => updateFormData({ searchProvider: 'brave' })}
                                                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${formData.searchProvider === 'brave'
                                                        ? 'bg-pplx-text text-pplx-primary shadow-md transform scale-[1.02]'
                                                        : 'bg-transparent text-pplx-muted hover:text-pplx-text hover:bg-pplx-secondary/50'
                                                    }`}
                                            >
                                                Brave
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {formData.searchProvider === 'tavily' ? (
                                                <div className="relative group/input animate-fadeIn">
                                                    <Key className="absolute left-4 top-4 text-pplx-muted opacity-50" size={16} />
                                                    <input type="password" value={formData.tavilyApiKey} onChange={(e) => updateFormData({ tavilyApiKey: e.target.value })} placeholder="tvly-..." className="w-full bg-pplx-input rounded-2xl pl-11 pr-4 py-3.5 text-sm text-pplx-text placeholder-pplx-muted/40 outline-none transition-all font-mono" />
                                                    <div className="absolute right-4 top-4 text-[10px] text-pplx-muted font-bold opacity-50 uppercase">Tavily Key</div>
                                                </div>
                                            ) : (
                                                <div className="relative group/input animate-fadeIn">
                                                    <Flame className="absolute left-4 top-4 text-pplx-muted opacity-50" size={16} />
                                                    <input type="password" value={formData.braveApiKey || ''} onChange={(e) => updateFormData({ braveApiKey: e.target.value })} placeholder="BSA-..." className="w-full bg-pplx-input rounded-2xl pl-11 pr-4 py-3.5 text-sm text-pplx-text placeholder-pplx-muted/40 outline-none transition-all font-mono" />
                                                    <div className="absolute right-4 top-4 text-[10px] text-pplx-muted font-bold opacity-50 uppercase">Brave Key</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-center mb-8">
                                        <div className="bg-pplx-input p-1.5 rounded-2xl flex w-full md:w-auto">
                                            <button
                                                onClick={() => setModelType('cloud')}
                                                className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${modelType === 'cloud'
                                                        ? 'bg-pplx-text text-pplx-primary shadow-lg transform scale-[1.02]'
                                                        : 'bg-transparent text-pplx-muted hover:text-pplx-text'
                                                    }`}
                                            >
                                                <Cloud size={16} /><span>Cloud</span>
                                            </button>
                                            <button
                                                onClick={() => setModelType('local')}
                                                className={`flex-1 md:flex-none px-8 py-3 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${modelType === 'local'
                                                        ? 'bg-pplx-text text-pplx-primary shadow-lg transform scale-[1.02]'
                                                        : 'bg-transparent text-pplx-muted hover:text-pplx-text'
                                                    }`}
                                            >
                                                <Smartphone size={16} /><span>Offline</span>
                                            </button>
                                        </div>
                                    </div>

                                    {modelType === 'cloud' && (
                                        <div className="space-y-4 animate-fadeIn">
                                            {/* Gemini Card */}
                                            <div className={`group rounded-3xl p-6 transition-all duration-300 cursor-pointer select-none ${formData.modelProvider === ModelProvider.GEMINI ? 'bg-pplx-card shadow-lg ring-1 ring-black/5 dark:ring-white/10' : 'bg-pplx-card/50 hover:bg-pplx-card'}`}>
                                                <div className="flex items-center justify-between" onClick={() => updateFormData({ modelProvider: ModelProvider.GEMINI })}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-2xl ${formData.modelProvider === ModelProvider.GEMINI ? 'bg-pplx-text text-pplx-primary' : 'bg-pplx-secondary text-pplx-muted'}`}><Sparkles size={20} /></div>
                                                        <div><h4 className="text-base font-semibold text-pplx-text">Google Gemini</h4><p className="text-xs text-pplx-muted mt-0.5">Gemini 1.5 Pro & Flash</p></div>
                                                    </div>
                                                    {formData.modelProvider === ModelProvider.GEMINI && <div className="w-6 h-6 rounded-full bg-pplx-text flex items-center justify-center"><Check size={14} className="text-pplx-primary" strokeWidth={3} /></div>}
                                                </div>

                                                {formData.modelProvider === ModelProvider.GEMINI && (
                                                    <div className="mt-5 pt-5 border-t border-pplx-border/50 animate-fadeIn">
                                                        <div className="relative">
                                                            <Key className="absolute left-4 top-4 text-pplx-muted opacity-50" size={16} />
                                                            <input type="password" value={formData.geminiApiKey || ''} onChange={(e) => updateFormData({ geminiApiKey: e.target.value })} placeholder="Override API Key (Optional)..." className="w-full bg-pplx-input rounded-2xl pl-11 pr-4 py-3.5 text-sm text-pplx-text outline-none font-mono" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* OpenRouter Card */}
                                            <div className={`group rounded-3xl p-6 transition-all duration-300 cursor-pointer select-none ${formData.modelProvider === ModelProvider.OPENROUTER ? 'bg-pplx-card shadow-lg ring-1 ring-black/5 dark:ring-white/10' : 'bg-pplx-card/50 hover:bg-pplx-card'}`}>
                                                <div className="flex items-center justify-between" onClick={() => updateFormData({ modelProvider: ModelProvider.OPENROUTER })}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-2xl ${formData.modelProvider === ModelProvider.OPENROUTER ? 'bg-pplx-text text-pplx-primary' : 'bg-pplx-secondary text-pplx-muted'}`}><Globe size={20} /></div>
                                                        <div><h4 className="text-base font-semibold text-pplx-text">OpenRouter</h4><p className="text-xs text-pplx-muted mt-0.5">Aggregated Models</p></div>
                                                    </div>
                                                    {formData.modelProvider === ModelProvider.OPENROUTER && <div className="w-6 h-6 rounded-full bg-pplx-text flex items-center justify-center"><Check size={14} className="text-pplx-primary" strokeWidth={3} /></div>}
                                                </div>

                                                {formData.modelProvider === ModelProvider.OPENROUTER && (
                                                    <div className="mt-5 pt-5 border-t border-pplx-border/50 space-y-3 animate-fadeIn">
                                                        <div className="relative">
                                                            <Key className="absolute left-4 top-4 text-pplx-muted opacity-50" size={16} />
                                                            <input type="password" value={formData.openRouterApiKey} onChange={(e) => updateFormData({ openRouterApiKey: e.target.value })} placeholder="sk-or-..." className="w-full bg-pplx-input rounded-2xl pl-11 pr-4 py-3.5 text-sm text-pplx-text outline-none font-mono" />
                                                        </div>
                                                        <div className="relative">
                                                            <Activity className="absolute left-4 top-4 text-pplx-muted opacity-50" size={16} />
                                                            <input
                                                                list="openrouter-models"
                                                                type="text"
                                                                value={formData.openRouterModelId}
                                                                onChange={(e) => updateFormData({ openRouterModelId: e.target.value })}
                                                                placeholder="Select or type model ID..."
                                                                className="w-full bg-pplx-input rounded-2xl pl-11 pr-4 py-3.5 text-sm text-pplx-text outline-none font-mono"
                                                            />
                                                            <datalist id="openrouter-models">
                                                                {OPENROUTER_PRESETS.map((model) => (
                                                                    <option key={model} value={model} />
                                                                ))}
                                                            </datalist>
                                                            <div className="absolute right-4 top-4 text-[10px] text-pplx-muted font-bold opacity-50 uppercase pointer-events-none">Model ID</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* OpenAI Card */}
                                            <div className={`group rounded-3xl p-6 transition-all duration-300 cursor-pointer select-none ${formData.modelProvider === ModelProvider.OPENAI ? 'bg-pplx-card shadow-lg ring-1 ring-black/5 dark:ring-white/10' : 'bg-pplx-card/50 hover:bg-pplx-card'}`}>
                                                <div className="flex items-center justify-between" onClick={() => updateFormData({ modelProvider: ModelProvider.OPENAI })}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-2xl ${formData.modelProvider === ModelProvider.OPENAI ? 'bg-pplx-text text-pplx-primary' : 'bg-pplx-secondary text-pplx-muted'}`}><Zap size={20} /></div>
                                                        <div><h4 className="text-base font-semibold text-pplx-text">OpenAI</h4><p className="text-xs text-pplx-muted mt-0.5">GPT-4o & GPT-3.5</p></div>
                                                    </div>
                                                    {formData.modelProvider === ModelProvider.OPENAI && <div className="w-6 h-6 rounded-full bg-pplx-text flex items-center justify-center"><Check size={14} className="text-pplx-primary" strokeWidth={3} /></div>}
                                                </div>

                                                {formData.modelProvider === ModelProvider.OPENAI && (
                                                    <div className="mt-5 pt-5 border-t border-pplx-border/50 space-y-3 animate-fadeIn">
                                                        <div className="relative">
                                                            <Key className="absolute left-4 top-4 text-pplx-muted opacity-50" size={16} />
                                                            <input type="password" value={formData.openAiApiKey} onChange={(e) => updateFormData({ openAiApiKey: e.target.value })} placeholder="sk-..." className="w-full bg-pplx-input rounded-2xl pl-11 pr-4 py-3.5 text-sm text-pplx-text outline-none font-mono" />
                                                        </div>
                                                        <div className="relative">
                                                            <Activity className="absolute left-4 top-4 text-pplx-muted opacity-50" size={16} />
                                                            <input type="text" value={formData.openAiModelId} onChange={(e) => updateFormData({ openAiModelId: e.target.value })} placeholder="gpt-4o" className="w-full bg-pplx-input rounded-2xl pl-11 pr-4 py-3.5 text-sm text-pplx-text outline-none font-mono" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* ─── Langflow Card ─── */}
                                            <div className={`group rounded-3xl p-6 transition-all duration-300 cursor-pointer select-none
                                  ${formData.langflowEnabled
                                                    ? 'bg-pplx-card shadow-lg ring-1 ring-black/5 dark:ring-white/10'
                                                    : 'bg-pplx-card/50 hover:bg-pplx-card'}`}
                                            >
                                                <div
                                                    className="flex items-center justify-between"
                                                    onClick={() => updateFormData({ langflowEnabled: !formData.langflowEnabled })}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-3 rounded-2xl ${formData.langflowEnabled
                                                            ? 'bg-pplx-text text-pplx-primary'
                                                            : 'bg-pplx-secondary text-pplx-muted'}`}
                                                        >
                                                            <Zap size={20} />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-base font-semibold text-pplx-text">Langflow Agent</h4>
                                                            <p className="text-xs text-pplx-muted mt-0.5">Agent local cu tool-uri</p>
                                                        </div>
                                                    </div>
                                                    {formData.langflowEnabled && (
                                                        <div className="w-6 h-6 rounded-full bg-pplx-text flex items-center justify-center">
                                                            <Check size={14} className="text-pplx-primary" strokeWidth={3} />
                                                        </div>
                                                    )}
                                                </div>

                                                {formData.langflowEnabled && (
                                                    <div className="mt-5 pt-5 border-t border-pplx-border/50 space-y-3 animate-fadeIn">

                                                        {/* URL */}
                                                        <div className="relative">
                                                            <Globe className="absolute left-4 top-4 text-pplx-muted opacity-50" size={16} />
                                                            <input
                                                                type="text"
                                                                value={formData.langflowUrl || 'http://localhost:7860'}
                                                                onChange={e => updateFormData({ langflowUrl: e.target.value })}
                                                                placeholder="http://localhost:7860"
                                                                className="w-full bg-pplx-input rounded-2xl pl-11 pr-4 py-3.5 text-sm text-pplx-text outline-none font-mono"
                                                            />
                                                        </div>

                                                        {/* Flow ID */}
                                                        <div className="relative">
                                                            <Activity className="absolute left-4 top-4 text-pplx-muted opacity-50" size={16} />
                                                            <input
                                                                type="text"
                                                                value={formData.langflowFlowId || ''}
                                                                onChange={e => updateFormData({ langflowFlowId: e.target.value })}
                                                                placeholder="Flow ID (ex: 276d06b9-...)"
                                                                className="w-full bg-pplx-input rounded-2xl pl-11 pr-4 py-3.5 text-sm text-pplx-text outline-none font-mono"
                                                            />
                                                        </div>

                                                        {/* API Key (opțional) */}
                                                        <div className="relative">
                                                            <Key className="absolute left-4 top-4 text-pplx-muted opacity-50" size={16} />
                                                            <input
                                                                type="password"
                                                                value={formData.langflowApiKey || ''}
                                                                onChange={e => updateFormData({ langflowApiKey: e.target.value })}
                                                                placeholder="API Key Langflow (opțional)"
                                                                className="w-full bg-pplx-input rounded-2xl pl-11 pr-4 py-3.5 text-sm text-pplx-text outline-none font-mono"
                                                            />
                                                        </div>

                                                        {/* Toggle sync OpenRouter */}
                                                        <div className="flex items-center justify-between px-1 py-2">
                                                            <div>
                                                                <p className="text-sm font-medium text-pplx-text">Sync OpenRouter</p>
                                                                <p className="text-xs text-pplx-muted mt-0.5">
                                                                    Folosește același model selectat în Perplex
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => updateFormData({ langflowSyncOpenRouter: !formData.langflowSyncOpenRouter })}
                                                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${formData.langflowSyncOpenRouter ? 'bg-pplx-accent' : 'bg-pplx-border'
                                                                    }`}
                                                            >
                                                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${formData.langflowSyncOpenRouter ? 'translate-x-5' : 'translate-x-0'
                                                                    }`} />
                                                            </button>
                                                        </div>

                                                        {/* Info model curent dacă sync e activ */}
                                                        {formData.langflowSyncOpenRouter && formData.openRouterModelId && (
                                                            <div className="px-3 py-2 bg-pplx-secondary/50 rounded-xl">
                                                                <p className="text-xs text-pplx-muted">
                                                                    Model activ:{' '}
                                                                    <span className="font-mono text-pplx-accent">{formData.openRouterModelId}</span>
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {modelType === 'local' && (
                                        <div className="animate-fadeIn pb-12">
                                            <div className="bg-pplx-card rounded-3xl p-6 mb-6 shadow-sm border border-pplx-border/50">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <Smartphone size={20} className="text-pplx-accent" />
                                                    <h3 className="text-lg font-bold text-pplx-text">Offline Model Store</h3>
                                                </div>
                                                <p className="text-sm text-pplx-muted leading-relaxed">
                                                    Download highly optimized small language models (1B-7B) to run locally on your device without internet.
                                                </p>
                                            </div>

                                            <div className="space-y-4">
                                                <h4 className="text-xs font-bold text-pplx-muted uppercase tracking-widest opacity-60 ml-1">Available Models</h4>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {AVAILABLE_OFFLINE_MODELS.map((model) => {
                                                        const downloadedModel = formData.localModels.find(m => m.id === model.id);
                                                        const isDownloaded = !!downloadedModel;
                                                        const isActive = formData.activeLocalModelId === model.id;
                                                        const progress = downloadProgress[model.id] || 0;

                                                        return (
                                                            <OfflineModelCard
                                                                key={model.id}
                                                                model={model}
                                                                isDownloaded={isDownloaded}
                                                                isActive={isActive}
                                                                progress={progress}
                                                                onDownload={() => handleDownloadModel(model)}
                                                                onSelect={() => updateFormData({ activeLocalModelId: model.id, modelProvider: ModelProvider.LOCAL })}
                                                                onDelete={() => handleDeleteModel(model.id)}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {formData.localModels.length === 0 && (
                                                <div className="mt-8 text-center p-6 border-2 border-dashed border-pplx-border/50 rounded-2xl opacity-60">
                                                    <Cloud size={32} className="mx-auto text-pplx-muted mb-2" />
                                                    <span className="text-xs font-medium text-pplx-muted">No models downloaded yet.</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* --- Local Sandbox Section --- */}
                                    <div className="bg-pplx-card rounded-3xl p-6 shadow-sm border border-pplx-border/50 animate-fadeIn mt-8">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Code size={20} className="text-pplx-accent" />
                                            <div>
                                                <h3 className="text-lg font-bold text-pplx-text">Code Execution</h3>
                                                <p className="text-xs text-pplx-muted opacity-80 mt-1">
                                                    Code runs locally in your browser. Python via Pyodide, TypeScript via Web Workers.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center gap-2">
                                            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-pplx-text text-pplx-primary">
                                                ✓ Local Sandbox — Active
                                            </span>
                                            <span className="text-xs text-pplx-muted">Python + TypeScript supported · No API key required</span>
                                        </div>
                                    </div>

                                </div>
                            )}

                            {/* --- MEMORY TAB --- */}

                            {activeTab === 'memory' && (
                                <div className="flex flex-col pb-4 animate-fadeIn">
                                    <div className="hidden md:block"><SectionHeader title={t.memory} desc="Manage what the AI remembers." /></div>
                                    <div className="bg-pplx-card rounded-3xl px-6 border-none shadow-sm mb-6">
                                        <ToggleRow label="Enable Memory" description="Allow the AI to recall facts about you." checked={formData.enableMemory} onChange={() => updateFormData({ enableMemory: !formData.enableMemory })} />
                                    </div>
                                    {formData.enableMemory ? (
                                        <div className="bg-pplx-card rounded-3xl border-none shadow-lg overflow-hidden">
                                            <div className="p-5 border-b border-pplx-border/30 bg-pplx-card/95 backdrop-blur-sm sticky top-0 z-20">
                                                <div className="relative"><Search className="absolute left-4 top-3.5 text-pplx-muted opacity-50" size={18} /><input className="w-full bg-pplx-input text-base text-pplx-text pl-12 pr-4 py-3 rounded-2xl outline-none placeholder-pplx-muted/50" placeholder="Search memories..." value={memorySearch} onChange={(e) => setMemorySearch(e.target.value)} /></div>
                                            </div>

                                            {/* Content Area - Expanded */}
                                            <div className="p-4 space-y-2 bg-pplx-card">
                                                {/* Categories */}
                                                <div className="mb-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-xs font-bold text-pplx-muted uppercase tracking-wider ml-1 opacity-70">Categories</span>
                                                        <button
                                                            onClick={() => setIsCategoriesCollapsed(!isCategoriesCollapsed)}
                                                            className={`px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 font-medium text-[10px] uppercase tracking-wide ${isCategoriesCollapsed ? 'bg-pplx-text text-pplx-primary' : 'bg-pplx-input text-pplx-muted hover:text-pplx-text'}`}
                                                        >
                                                            {isCategoriesCollapsed ? <span>Show</span> : <span>Hide</span>}
                                                            {isCategoriesCollapsed ? <ChevronDown size={14} /> : <X size={14} />}
                                                        </button>
                                                    </div>
                                                    {!isCategoriesCollapsed && (
                                                        <div className="flex flex-wrap items-center gap-2 animate-fadeIn">
                                                            {MEMORY_CATEGORIES.map(cat => (
                                                                <FilterPill key={cat.id} id={cat.id} label={cat.label} icon={cat.icon} isActive={memoryFilter === cat.id} onClick={setMemoryFilter} />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Manual Add Section */}
                                                {isAddingMemory ? (
                                                    <div className="p-4 md:p-5 bg-pplx-input/30 rounded-3xl mb-4 animate-in fade-in slide-in-from-top-2 shadow-sm">
                                                        <label className="block text-xs font-bold text-pplx-muted uppercase tracking-wider mb-2 opacity-70">New Memory</label>
                                                        <textarea
                                                            autoFocus
                                                            value={newMemoryContent}
                                                            onChange={(e) => setNewMemoryContent(e.target.value)}
                                                            placeholder="e.g. I prefer concise answers..."
                                                            className="w-full bg-pplx-card text-base text-pplx-text outline-none resize-none h-24 md:h-32 p-4 rounded-xl mb-4 shadow-sm placeholder-pplx-muted/40 border-none"
                                                        />
                                                        <div className="flex flex-col gap-3">
                                                            <div className="relative group">
                                                                <select
                                                                    value={newMemoryCategory}
                                                                    onChange={(e) => setNewMemoryCategory(e.target.value as MemoryCategory)}
                                                                    className="w-full bg-pplx-card text-sm font-bold text-pplx-text rounded-xl px-4 py-3.5 outline-none cursor-pointer hover:bg-pplx-secondary shadow-sm appearance-none border-none pr-10"
                                                                >
                                                                    {MEMORY_CATEGORIES.filter(c => c.id !== 'all').map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                                                                </select>
                                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-pplx-muted pointer-events-none" size={16} />
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => setIsAddingMemory(false)} className="flex-1 text-sm text-pplx-muted hover:text-pplx-text px-4 py-3 font-medium bg-transparent rounded-xl hover:bg-pplx-input/50 transition-colors border border-transparent">{t.cancel}</button>
                                                                <button onClick={handleAddMemory} className="flex-1 text-sm bg-pplx-text text-pplx-primary px-4 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-md">Save Memory</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => setIsAddingMemory(true)} className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-pplx-border/50 text-pplx-muted hover:text-pplx-text hover:bg-pplx-input/50 transition-all text-xs font-bold uppercase tracking-wide mb-6">
                                                        <Plus size={16} /> Add Memory
                                                    </button>
                                                )}

                                                {filteredMemories.length === 0 && !isAddingMemory && (
                                                    <div className="text-center py-20 text-pplx-muted opacity-40">
                                                        <Brain size={56} className="mx-auto mb-4 opacity-30" />
                                                        <p className="text-sm font-medium">No memories found.</p>
                                                    </div>
                                                )}

                                                {filteredMemories.map(mem => (
                                                    <div key={mem.id} className="group flex flex-col md:flex-row md:items-start justify-between p-4 rounded-2xl bg-pplx-secondary/20 hover:bg-pplx-secondary/40 transition-colors gap-3 md:gap-0">
                                                        <div className="flex items-start gap-4">
                                                            <div className="mt-0.5 text-pplx-text opacity-70 p-2 bg-pplx-card rounded-xl shadow-sm shrink-0">{React.createElement(getCategoryIcon(mem.category), { size: 16 })}</div>
                                                            <div className="flex flex-col gap-1.5 min-w-0">
                                                                <span className="text-sm text-pplx-text leading-relaxed font-medium break-words">{mem.content}</span>
                                                                <div className="flex items-center gap-2"><span className="text-[10px] font-bold text-pplx-muted uppercase tracking-widest opacity-60 bg-pplx-input px-2 py-0.5 rounded">{mem.category.replace('_', ' ')}</span></div>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-end md:block">
                                                            <button onClick={() => handleDeleteMemory(mem.id)} className="text-pplx-muted hover:text-red-400 p-2 rounded-xl hover:bg-pplx-card md:opacity-0 group-hover:opacity-100 transition-all bg-pplx-input/50 md:bg-transparent"><Trash2 size={16} /></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="p-5 bg-pplx-card border-t border-pplx-border/30 text-right"><button onClick={handleClearMemory} className="text-xs text-red-400 hover:text-red-300 hover:underline flex items-center justify-end gap-2 ml-auto font-medium transition-colors"><Trash2 size={14} /> Clear All Data</button></div>
                                        </div>
                                    ) : <div className="text-center py-20 text-pplx-muted"><div className="bg-pplx-secondary w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"><Brain size={48} className="opacity-30" /></div><p className="text-lg font-medium text-pplx-text">Memory Disabled</p><p className="text-sm opacity-50 mt-2 max-w-xs mx-auto">Turn on to personalize AI responses.</p></div>}
                                </div>
                            )}

                            {/* --- PROFILE TAB --- */}
                            {activeTab === 'profile' && (
                                <div className="space-y-10 animate-fadeIn">
                                    <div className="hidden md:block"><SectionHeader title={t.profile} desc="Identify yourself to the AI." /></div>

                                    <div className="flex flex-col md:flex-row items-center gap-8 pb-8">
                                        <div className="relative group">
                                            <div className="w-32 h-32 rounded-full overflow-hidden bg-pplx-secondary flex items-center justify-center shadow-2xl relative z-10">
                                                {formData.userProfile.avatar ? <img src={formData.userProfile.avatar} alt="Profile" className="w-full h-full object-cover" /> : <User size={56} className="text-pplx-muted opacity-50" />}
                                            </div>
                                            <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-1 right-1 p-3 bg-pplx-text text-pplx-primary rounded-full shadow-lg hover:scale-110 transition-transform z-20 border-4 border-pplx-primary"><Camera size={18} /></button>
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                                        </div>
                                        <div className="flex-1 text-center md:text-left space-y-2">
                                            <h5 className="text-xl font-bold text-pplx-text">Your Avatar</h5>
                                            <p className="text-sm text-pplx-muted max-w-sm mx-auto md:mx-0 opacity-70">Personalize your chat experience.</p>
                                            {formData.userProfile.avatar && <button onClick={() => updateFormData({ userProfile: { ...formData.userProfile, avatar: undefined } })} className="text-xs text-red-400 hover:text-red-300 hover:underline font-medium pt-2">Remove</button>}
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <InputGroup label="Name">
                                            <input className="w-full bg-pplx-input border-none rounded-2xl px-5 py-4 text-base text-pplx-text outline-none transition-all placeholder-pplx-muted/50" value={formData.userProfile.name} onChange={(e) => updateFormData({ userProfile: { ...formData.userProfile, name: e.target.value } })} placeholder="How should the AI call you?" />
                                        </InputGroup>
                                        <InputGroup label="Location" description="For weather & local news.">
                                            <input className="w-full bg-pplx-input border-none rounded-2xl px-5 py-4 text-base text-pplx-text outline-none transition-all placeholder-pplx-muted/50" value={formData.userProfile.location} onChange={(e) => updateFormData({ userProfile: { ...formData.userProfile, location: e.target.value } })} placeholder="City, Country" />
                                        </InputGroup>
                                        <InputGroup label="Bio">
                                            <textarea className="w-full bg-pplx-input border-none rounded-2xl px-5 py-4 text-base text-pplx-text outline-none h-32 resize-none transition-all placeholder-pplx-muted/50" value={formData.userProfile.bio} onChange={(e) => updateFormData({ userProfile: { ...formData.userProfile, bio: e.target.value } })} placeholder="Tell the AI about your profession and interests..." />
                                        </InputGroup>
                                    </div>
                                    <div className="pt-8">
                                        <h5 className="text-sm font-bold text-pplx-text mb-6 flex items-center gap-2"><Sparkles size={16} className="text-pplx-text opacity-70" /> System Persona</h5>
                                        <InputGroup label="Custom Instructions">
                                            <textarea className="w-full bg-pplx-input border-none rounded-2xl px-5 py-4 text-base text-pplx-text outline-none h-40 resize-none font-mono text-xs transition-all placeholder-pplx-muted/50" value={formData.aiProfile.systemInstructions} onChange={(e) => updateFormData({ aiProfile: { ...formData.aiProfile, systemInstructions: e.target.value } })} placeholder="You are a helpful assistant. Be concise..." />
                                        </InputGroup>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mobile Action Footer (Fixed Bottom inside the Flex container) */}
                    <div className={`md:hidden p-4 bg-pplx-primary/95 backdrop-blur-md flex gap-3 z-30 shrink-0 transition-all duration-300 ${formData.enableMobileDock ? 'pb-[80px]' : 'pb-8'}`}>
                        <button
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl text-xs font-medium text-pplx-text bg-pplx-secondary hover:bg-pplx-hover transition-colors"
                        >
                            {t.cancel}
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-pplx-text text-pplx-primary shadow-lg"
                        >
                            {t.save}
                        </button>
                    </div>

                    {/* Desktop Action Footer */}
                    <div className="hidden md:flex p-6 bg-pplx-primary justify-end gap-3 rounded-br-3xl rounded-bl-none shrink-0 z-20">
                        <button onClick={onClose} className="w-32 py-3 rounded-xl text-sm font-medium text-pplx-text hover:bg-pplx-secondary transition-colors">{t.cancel}</button>
                        <button onClick={handleSave} className="w-32 py-3 rounded-xl text-sm font-bold bg-pplx-text text-pplx-primary hover:opacity-90 transition-opacity shadow-lg">{t.save}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};