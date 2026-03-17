
import React, { useState, useEffect, useRef } from 'react';
import {
    Search, Library,
    Settings, PanelLeftClose, Box,
    ChevronRight, ChevronDown, LayoutGrid, MessageSquareText, Plus,
    Trash2, MoreHorizontal, Copy, FolderInput, ChevronLeft, CalendarDays, Star
} from 'lucide-react';
import { PerplexityLogo, UI_STRINGS } from '../constants';
import { Thread, Space, Note, UserProfile } from '../types';

interface SidebarProps {
    isOpen: boolean;
    toggleSidebar: () => void;
    threads: Thread[];
    spaces: Space[];
    notes: Note[];
    userProfile: UserProfile;
    activeThreadId: string | null;
    activeSpaceId: string | null;
    activeNoteId: string | null;
    activeView: 'chat' | 'library' | 'calendar';
    onSelectThread: (id: string) => void;
    onSelectSpace: (id: string | null) => void; // null = home/default
    onSelectNote: (id: string) => void;
    onChangeView: (view: 'chat' | 'library' | 'calendar') => void;
    onNewThread: () => void;
    onNewNote: (parentId?: string) => void;
    onManageSpaces: () => void;
    openSettings: () => void;
    onDeleteThread: (id: string) => void;
    onDuplicateNote: (id: string) => void;
    onMoveNote: (id: string) => void;
    onDeleteNote: (id: string) => void;
    expandedSection: string | null;
    setExpandedSection: (section: string | null) => void;
    showFavorites?: boolean;
    setShowFavorites?: (show: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    toggleSidebar,
    threads,
    spaces,
    notes,
    userProfile,
    activeThreadId,
    activeSpaceId,
    activeNoteId,
    activeView,
    onSelectThread,
    onSelectSpace,
    onSelectNote,
    onChangeView,
    onNewThread,
    onNewNote,
    onManageSpaces,
    openSettings,
    onDeleteThread,
    onDuplicateNote,
    onMoveNote,
    onDeleteNote,
    expandedSection,
    setExpandedSection,
    showFavorites,
    setShowFavorites
}) => {
    const [lang, setLang] = useState<'en' | 'ro'>('en');

    // State for Library Item Menu
    const [activeMenuNoteId, setActiveMenuNoteId] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // State for Sidebar Resizing
    const [sidebarWidth, setSidebarWidth] = useState(280);
    const [isResizing, setIsResizing] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // State for Mobile Library Full Screen
    const [isMobileLibraryOpen, setIsMobileLibraryOpen] = useState(false);
    const [mobileLibraryFilter, setMobileLibraryFilter] = useState<'all' | 'favorites'>('all');

    // Effect to handle showFavorites prop
    useEffect(() => {
        if (showFavorites && setShowFavorites) {
            if (window.innerWidth < 768) {
                setIsMobileLibraryOpen(true);
                setMobileLibraryFilter('favorites');
            } else {
                setExpandedSection('library');
            }
            // Reset the trigger after handling
            setShowFavorites(false);
        }
    }, [showFavorites, setShowFavorites, setExpandedSection]);

    // Close mobile library when navigating away from library view or to a specific note
    useEffect(() => {
        if (activeView !== 'library' || activeNoteId !== null) {
            setIsMobileLibraryOpen(false);
        }
    }, [activeView, activeNoteId]);

    // Swipe logic - Track X and Y to differentiate scroll from swipe
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);

    // Listen to settings changes for language (hacky way to update without full context)
    useEffect(() => {
        const saved = localStorage.getItem('pplx_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.interfaceLanguage) setLang(parsed.interfaceLanguage);
        }
    }, [isOpen]); // Update when sidebar opens/closes

    // Initialize mobile check and load saved width
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);

        const savedWidth = localStorage.getItem('pplx_sidebar_width');
        if (savedWidth) {
            setSidebarWidth(parseInt(savedWidth, 10));
        }

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Handle resizing logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            let newWidth = e.clientX;
            if (newWidth < 120) newWidth = 64; // Snap to collapsed
            else if (newWidth < 200) newWidth = 200; // Min expanded width
            else if (newWidth > 600) newWidth = 600; // Max width
            setSidebarWidth(newWidth);
        };

        const handleMouseUp = () => {
            if (isResizing) {
                setIsResizing(false);
                localStorage.setItem('pplx_sidebar_width', sidebarWidth.toString());
            }
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, sidebarWidth]);

    const t = UI_STRINGS[lang] || UI_STRINGS.en;

    const isCollapsed = !isMobile && sidebarWidth < 120;
    const currentWidth = isMobile ? 280 : sidebarWidth;

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenuNoteId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const sidebarClasses = `
    fixed inset-y-0 left-0 z-[150] bg-pplx-sidebar border-r border-pplx-border shadow-2xl h-full
    md:static md:shadow-none md:translate-x-0
    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    ${isOpen ? '' : 'md:border-r-0 md:overflow-hidden'}
    flex flex-col md:relative
    ${!isResizing && isMobile ? 'transition-all duration-150 ease-out' : ''}
    ${!isResizing && !isMobile && !isOpen ? 'transition-all duration-150 ease-out' : ''}
    transform-gpu will-change-transform
  `;

    const sidebarStyle = isMobile ? {
        width: '280px',
        transition: 'transform 150ms ease-out',
    } : {
        width: isOpen ? `${currentWidth}px` : '0px',
        transition: isResizing ? 'none' : 'transform 150ms ease-out, width 150ms ease-out',
    };

    const handleNavClick = (action?: () => void) => {
        if (action) action();
        // On mobile, close sidebar after navigation. On desktop, keep it open unless user closes it.
        if (window.innerWidth < 768) {
            toggleSidebar();
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = {
            x: e.targetTouches[0].clientX,
            y: e.targetTouches[0].clientY
        };
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const touchEnd = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const diffX = touchStartRef.current.x - touchEnd; // Positive if swiping left
        const diffY = Math.abs(touchStartRef.current.y - touchEndY);

        // Only close if horizontal swipe is dominant and significant
        // This prevents closing when scrolling vertically
        if (diffX > 50 && diffY < 50) {
            toggleSidebar();
            if (navigator.vibrate) navigator.vibrate(10);
        }
        touchStartRef.current = null;
    };

    // Generate User Initials
    const getUserInitials = (name: string) => {
        return name ? name.substring(0, 1).toUpperCase() : 'U';
    };

    return (
        <>
            {/* Backdrop for mobile only */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-[55] backdrop-blur-sm transition-opacity md:hidden"
                    onClick={toggleSidebar}
                />
            )}

            <div
                className={sidebarClasses}
                style={sidebarStyle}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            >
                {/* Resize Handle (Desktop only) */}
                {!isMobile && isOpen && (
                    <div
                        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-pplx-accent/50 active:bg-pplx-accent z-50 transition-colors"
                        onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
                    />
                )}

                <div className="w-full h-full flex flex-col overflow-hidden">
                    {/* Header - Fixed layout: Logo Left, Close Button Right */}
                    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} p-4 mb-2 pt-safe`}>
                        <div className="flex items-center cursor-pointer opacity-90 hover:opacity-100 transition-opacity" onClick={() => handleNavClick(() => { onChangeView('chat'); onNewThread(); })}>
                            <PerplexityLogo className="w-9 h-9 text-pplx-text shrink-0" />
                            {!isCollapsed && <span className="ml-2.5 text-xl font-medium tracking-tight text-pplx-text font-serif">perplex</span>}
                        </div>

                        {/* Close Button - Always visible inside the sidebar, positioned right */}
                        {!isCollapsed && (
                            <button
                                onClick={toggleSidebar}
                                className="text-pplx-muted hover:text-pplx-text p-2 rounded-lg hover:bg-pplx-hover transition-colors shrink-0"
                                title="Close Sidebar"
                            >
                                <PanelLeftClose size={24} />
                            </button>
                        )}
                    </div>

                    {/* Main Nav */}
                    <nav
                        className="flex-1 overflow-y-auto no-scrollbar py-2 px-3 space-y-1 overscroll-contain"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                    >

                        {/* Home */}
                        <NavItem
                            icon={<Search size={22} />}
                            label={t.home}
                            active={activeView === 'chat' && !activeThreadId && !activeSpaceId}
                            onClick={() => handleNavClick(() => { onChangeView('chat'); onSelectSpace(null); })}
                            isCollapsed={isCollapsed}
                        />

                        {/* Chat (History) */}
                        <div className="flex flex-col">
                            <NavItem
                                icon={<MessageSquareText size={22} />}
                                label={t.chat}
                                onClick={() => {
                                    if (isCollapsed) { setSidebarWidth(280); toggleSection('chat'); onChangeView('chat'); }
                                    else { toggleSection('chat'); onChangeView('chat'); }
                                }}
                                hasChevron={true}
                                isOpen={expandedSection === 'chat'}
                                active={activeView === 'chat' && (!!activeThreadId || expandedSection === 'chat')}
                                isCollapsed={isCollapsed}
                            />

                            {!isCollapsed && expandedSection === 'chat' && (
                                <div className="ml-4 pl-3 border-l border-pplx-border space-y-1 mt-1 animate-fadeIn duration-150">
                                    {threads.filter(t => !t.spaceId).length === 0 && (
                                        <div className="px-3 py-2 text-xs text-pplx-muted">{t.noHistory}</div>
                                    )}
                                    {threads.filter(t => !t.spaceId).slice(0, 10).map((thread) => (
                                        <div key={thread.id} className="relative group flex items-center">
                                            <button
                                                onClick={() => handleNavClick(() => { onChangeView('chat'); onSelectThread(thread.id); })}
                                                className={`w-full text-left flex items-start space-x-2 px-3 py-3 text-sm rounded-lg transition-colors leading-normal pr-8 ${activeThreadId === thread.id
                                                    ? 'bg-pplx-hover text-pplx-text font-medium'
                                                    : 'text-pplx-muted hover:bg-pplx-hover hover:text-pplx-text'
                                                    }`}
                                            >
                                                <span className="truncate text-base">{thread.title}</span>
                                            </button>
                                            {/* Discrete Delete Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteThread(thread.id);
                                                }}
                                                className="absolute right-2 p-1.5 text-pplx-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-pplx-hover"
                                                title="Delete chat"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Spaces Accordion (Moved above Library) */}
                        <div className="flex flex-col">
                            <NavItem
                                icon={<LayoutGrid size={22} />}
                                label={t.spaces}
                                onClick={() => {
                                    if (isCollapsed) { setSidebarWidth(280); toggleSection('spaces'); }
                                    else toggleSection('spaces');
                                }}
                                hasChevron={true}
                                isOpen={expandedSection === 'spaces'}
                                active={!!activeSpaceId}
                                isCollapsed={isCollapsed}
                            />

                            {!isCollapsed && expandedSection === 'spaces' && (
                                <div className="ml-4 pl-3 border-l border-pplx-border space-y-1 mt-1 animate-fadeIn duration-150">
                                    {spaces.map(space => (
                                        <button
                                            key={space.id}
                                            onClick={() => handleNavClick(() => { onChangeView('chat'); onSelectSpace(space.id); })}
                                            className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-sm transition-colors ${activeSpaceId === space.id
                                                ? 'bg-pplx-hover text-pplx-text font-medium'
                                                : 'text-pplx-muted hover:bg-pplx-hover hover:text-pplx-text'
                                                }`}
                                        >
                                            <span className="text-lg leading-none">{space.emoji}</span>
                                            <span className="truncate text-base">{space.title}</span>
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => { onManageSpaces(); toggleSidebar(); }}
                                        className="w-full flex items-center space-x-3 px-3 py-3 text-sm text-pplx-accent hover:text-pplx-text hover:bg-pplx-hover rounded-lg transition-colors"
                                    >
                                        <Box size={16} />
                                        <span className="text-base">{t.manageSpaces}</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Library (Pages/Notes) */}
                        <div className="flex flex-col">
                            <div className="flex items-center w-full group relative">
                                <NavItem
                                    icon={<Library size={22} />}
                                    label={t.library}
                                    onClick={() => {
                                        if (window.innerWidth < 768) {
                                            setIsMobileLibraryOpen(true);
                                            setMobileLibraryFilter('all');
                                        } else {
                                            if (isCollapsed) {
                                                setSidebarWidth(280);
                                                toggleSection('library');
                                            } else {
                                                toggleSection('library');
                                            }
                                        }
                                    }}
                                    onChevronClick={() => toggleSection('library')}
                                    hasChevron={true}
                                    isOpen={expandedSection === 'library'}
                                    active={activeView === 'library'}
                                    isCollapsed={isCollapsed}
                                />
                                {/* Inline Plus Button for New Page */}
                                {!isCollapsed && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onNewNote(); toggleSection('library'); }}
                                        className="p-2 text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover rounded-md transition-colors opacity-0 group-hover:opacity-100 absolute right-8"
                                        title="New Page"
                                    >
                                        <Plus size={18} />
                                    </button>
                                )}
                            </div>

                            {!isCollapsed && expandedSection === 'library' && (
                                <div className="ml-2 space-y-0.5 mt-1 animate-fadeIn duration-150 relative">
                                    {/* Favorites Section */}
                                    {notes.some(n => n.isFavorite) && (
                                        <div className="mb-3 mt-1">
                                            <div className="px-3 py-1 text-[10px] font-bold text-pplx-muted uppercase tracking-wider flex items-center gap-1.5 opacity-70">
                                                <Star size={10} className="text-yellow-400 fill-yellow-400" /> Favorites
                                            </div>
                                            {notes.filter(n => n.isFavorite).map(note => (
                                                <NoteItem
                                                    key={`fav-${note.id}`}
                                                    note={note}
                                                    allNotes={notes}
                                                    activeNoteId={activeNoteId}
                                                    onSelectNote={(id: string) => handleNavClick(() => onSelectNote(id))}
                                                    onDuplicateNote={onDuplicateNote}
                                                    onMoveNote={onMoveNote}
                                                    onDeleteNote={onDeleteNote}
                                                    onNewNote={onNewNote}
                                                    activeMenuNoteId={activeMenuNoteId}
                                                    setActiveMenuNoteId={setActiveMenuNoteId}
                                                    menuRef={menuRef}
                                                />
                                            ))}
                                            <div className="h-px bg-pplx-border/50 my-2 mx-3" />
                                        </div>
                                    )}

                                    {notes.filter(n => !n.parentId).length === 0 && (
                                        <div className="px-3 py-2 text-xs text-pplx-muted italic">{t.noPages}</div>
                                    )}
                                    {notes.filter(n => !n.parentId).map(note => (
                                        <NoteItem
                                            key={note.id}
                                            note={note}
                                            allNotes={notes}
                                            activeNoteId={activeNoteId}
                                            onSelectNote={(id: string) => handleNavClick(() => onSelectNote(id))}
                                            onDuplicateNote={onDuplicateNote}
                                            onMoveNote={onMoveNote}
                                            onDeleteNote={onDeleteNote}
                                            onNewNote={onNewNote}
                                            activeMenuNoteId={activeMenuNoteId}
                                            setActiveMenuNoteId={setActiveMenuNoteId}
                                            menuRef={menuRef}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                    </nav>

                    {/* Calendar Button - Positioned above user */}
                    <div className="px-3 pb-1">
                        <NavItem
                            icon={<CalendarDays size={22} />}
                            label="Calendar"
                            active={activeView === 'calendar'}
                            onClick={() => { onChangeView('calendar'); if (window.innerWidth < 768) toggleSidebar(); }}
                            isCollapsed={isCollapsed}
                        />
                    </div>

                    {/* Footer User Section - Hidden on Mobile */}
                    <div className="hidden md:block px-2 py-2 mt-2 bg-pplx-sidebar">
                        <div
                            onClick={(e) => { e.stopPropagation(); openSettings(); toggleSidebar(); }}
                            className={`text-sm text-pplx-muted hover:text-pplx-text flex items-center ${isCollapsed ? 'justify-center' : 'justify-between space-x-2'} px-2 py-3 cursor-pointer rounded-lg hover:bg-pplx-hover transition-colors group`}
                            title={isCollapsed ? t.settings : undefined}
                        >
                            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'}`}>
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold border border-white/10 overflow-hidden shrink-0">
                                    {userProfile.avatar ? (
                                        <img src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        getUserInitials(userProfile.name)
                                    )}
                                </div>
                                {!isCollapsed && (
                                    <div className="flex flex-col truncate">
                                        <span className="font-medium text-pplx-text group-hover:text-pplx-text leading-none text-base truncate max-w-[120px]">
                                            {userProfile.name || 'User'}
                                        </span>
                                    </div>
                                )}
                            </div>
                            {!isCollapsed && (
                                <Settings size={22} className="text-pplx-muted hover:text-pplx-text transition-colors shrink-0" />
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* Mobile Full-Screen Library Modal */}
            {isMobileLibraryOpen && (
                <div className="fixed inset-0 z-[100] bg-pplx-sidebar flex flex-col md:hidden animate-in slide-in-from-bottom-4 duration-150 overflow-x-hidden pt-safe">
                    <div className="flex items-center justify-between p-4 shrink-0">
                        <button
                            onClick={() => setIsMobileLibraryOpen(false)}
                            className="p-2 text-pplx-text hover:bg-pplx-hover rounded-full transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <h2 className="text-xl font-medium tracking-tight text-pplx-text font-serif">
                            {mobileLibraryFilter === 'favorites' ? 'Favorites' : 'Pages'}
                        </h2>
                        <button
                            onClick={() => { onNewNote(); setIsMobileLibraryOpen(false); toggleSidebar(); }}
                            className="p-2 text-pplx-text hover:bg-pplx-hover rounded-full transition-colors"
                        >
                            <Plus size={24} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                        {/* Recents Section */}
                        {mobileLibraryFilter === 'all' && (
                            <div className="px-4 py-4">
                                <h3 className="text-sm font-medium text-pplx-muted mb-3">Recents</h3>
                                <div className="flex space-x-3 overflow-x-auto pb-2 -mx-4 pl-8 pr-4 no-scrollbar snap-x">
                                    {[...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5).map(note => (
                                        <div
                                            key={note.id}
                                            onClick={() => { onSelectNote(note.id); setIsMobileLibraryOpen(false); toggleSidebar(); }}
                                            className="flex-shrink-0 w-24 h-24 bg-pplx-card border border-pplx-border rounded-xl overflow-hidden relative snap-start cursor-pointer active:scale-95 transition-transform"
                                        >
                                            <div className="h-1/2 w-full bg-gradient-to-br from-pplx-secondary to-pplx-border relative">
                                                {note.cover && <img src={note.cover} alt="" className="w-full h-full object-cover opacity-80" />}
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <span className="text-xl drop-shadow-md">{note.emoji || '📄'}</span>
                                                </div>
                                            </div>
                                            <div className="p-2 h-1/2 flex flex-col justify-between">
                                                <span className="text-xs font-medium text-pplx-text line-clamp-2 leading-tight">{note.title || 'Untitled'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Favorites Section Mobile */}
                        {notes.some(n => n.isFavorite) ? (
                            <div className="px-2 mb-4">
                                <div className="px-3 py-2 text-xs font-bold text-pplx-muted uppercase tracking-wider flex items-center gap-1.5 opacity-70">
                                    <Star size={12} className="text-yellow-400 fill-yellow-400" /> Favorites
                                </div>
                                {notes.filter(n => n.isFavorite).map(note => (
                                    <NoteItem
                                        key={`fav-mobile-${note.id}`}
                                        note={note}
                                        allNotes={notes}
                                        activeNoteId={activeNoteId}
                                        onSelectNote={(id: string) => { onSelectNote(id); setIsMobileLibraryOpen(false); toggleSidebar(); }}
                                        onDuplicateNote={onDuplicateNote}
                                        onMoveNote={onMoveNote}
                                        onDeleteNote={onDeleteNote}
                                        onNewNote={(parentId?: string) => { onNewNote(parentId); setIsMobileLibraryOpen(false); toggleSidebar(); }}
                                        activeMenuNoteId={activeMenuNoteId}
                                        setActiveMenuNoteId={setActiveMenuNoteId}
                                        menuRef={menuRef}
                                        isMobile={true}
                                    />
                                ))}
                                {mobileLibraryFilter === 'all' && <div className="h-px bg-pplx-border/50 my-2 mx-3" />}
                            </div>
                        ) : mobileLibraryFilter === 'favorites' && (
                            <div className="px-4 py-12 text-center animate-fadeIn">
                                <Star size={48} className="mx-auto text-pplx-muted/20 mb-4" />
                                <p className="text-pplx-muted text-sm">No favorite pages yet.</p>
                            </div>
                        )}

                        {/* All Pages Section */}
                        {mobileLibraryFilter === 'all' && (
                            <div className="px-2">
                                {notes.filter(n => !n.parentId).length === 0 && (
                                    <div className="px-3 py-4 text-sm text-pplx-muted italic text-center">No pages yet. Create one to get started!</div>
                                )}
                                {notes.filter(n => !n.parentId).map(note => (
                                    <NoteItem
                                        key={note.id}
                                        note={note}
                                        allNotes={notes}
                                        activeNoteId={activeNoteId}
                                        onSelectNote={(id: string) => { onSelectNote(id); setIsMobileLibraryOpen(false); toggleSidebar(); }}
                                        onDuplicateNote={onDuplicateNote}
                                        onMoveNote={onMoveNote}
                                        onDeleteNote={onDeleteNote}
                                        onNewNote={(parentId?: string) => { onNewNote(parentId); setIsMobileLibraryOpen(false); toggleSidebar(); }}
                                        activeMenuNoteId={activeMenuNoteId}
                                        setActiveMenuNoteId={setActiveMenuNoteId}
                                        menuRef={menuRef}
                                        isMobile={true}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

const NavItem = ({
    icon,
    label,
    active = false,
    onClick,
    onChevronClick,
    hasChevron = false,
    isOpen = false,
    isCollapsed = false
}: {
    icon: React.ReactNode,
    label: string,
    active?: boolean,
    onClick?: () => void,
    onChevronClick?: () => void,
    hasChevron?: boolean,
    isOpen?: boolean,
    isCollapsed?: boolean
}) => (
    <div className={`w-full flex items-center justify-between ${isCollapsed ? 'px-0 justify-center' : 'px-2'} py-1 rounded-lg text-sm transition-colors group relative ${active
        ? 'bg-pplx-hover'
        : 'hover:bg-pplx-hover'
        }`}
        title={isCollapsed ? label : undefined}
    >
        <button onClick={onClick} className={`flex items-center flex-1 text-left py-2.5 ${isCollapsed ? 'justify-center px-0' : 'space-x-3 px-1'}`}>
            <span className={active ? 'text-pplx-accent' : 'text-pplx-muted group-hover:text-pplx-text'}>{icon}</span>
            {!isCollapsed && <span className={`flex-1 text-base truncate ${active ? 'text-pplx-text font-medium' : 'text-pplx-muted group-hover:text-pplx-text'}`}>{label}</span>}
        </button>
        {!isCollapsed && hasChevron && (
            <button
                onClick={(e) => { e.stopPropagation(); if (onChevronClick) onChevronClick(); else if (onClick) onClick(); }}
                className="text-pplx-muted transition-opacity p-2 hover:bg-pplx-secondary rounded-md shrink-0"
            >
                {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
        )}
    </div>
);

const NoteItem = ({
    note,
    allNotes,
    level = 0,
    activeNoteId,
    onSelectNote,
    onDuplicateNote,
    onMoveNote,
    onDeleteNote,
    onNewNote,
    activeMenuNoteId,
    setActiveMenuNoteId,
    menuRef,
    isMobile = false
}: any) => {
    const children = allNotes.filter((n: Note) => n.parentId === note.id);
    const hasChildren = children.length > 0;
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="flex flex-col w-full">
            <div className="relative group flex items-center w-full">
                {/* Chevron */}
                <div className="w-6 flex justify-center shrink-0">
                    {hasChildren ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                            className="p-1.5 text-pplx-muted hover:text-pplx-text hover:bg-pplx-secondary rounded transition-colors"
                        >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                    ) : (
                        <div className="w-6" />
                    )}
                </div>

                <button
                    onClick={() => onSelectNote(note.id)}
                    className={`flex-1 min-w-0 flex items-center space-x-2 py-2.5 pr-16 rounded-lg text-sm transition-colors text-left ${activeNoteId === note.id
                        ? 'bg-pplx-hover text-pplx-text font-medium'
                        : 'text-pplx-muted hover:bg-pplx-hover hover:text-pplx-text'
                        }`}
                >
                    <span className="text-lg leading-none shrink-0">{note.emoji || '📄'}</span>
                    <span className="truncate text-base flex-1">{note.title || 'Untitled'}</span>
                </button>

                <div className={`absolute right-1 flex items-center ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                    {/* Plus Button for Nested Page */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onNewNote) onNewNote(note.id);
                            setIsExpanded(true);
                        }}
                        className="p-2 text-pplx-muted hover:text-pplx-text rounded-md hover:bg-pplx-hover shrink-0"
                    >
                        <Plus size={18} />
                    </button>

                    {/* Discrete More Options Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuNoteId(activeMenuNoteId === note.id ? null : note.id);
                        }}
                        className={`p-2 text-pplx-muted hover:text-pplx-text rounded-md hover:bg-pplx-hover shrink-0 ${activeMenuNoteId === note.id ? 'bg-pplx-hover text-pplx-text' : ''}`}
                    >
                        <MoreHorizontal size={18} />
                    </button>
                </div>

                {/* Popup Menu for Library Items */}
                {activeMenuNoteId === note.id && (
                    <div
                        ref={menuRef}
                        className="absolute right-8 top-8 z-50 w-36 bg-pplx-card border border-pplx-border shadow-xl rounded-lg overflow-hidden animate-fadeIn duration-150"
                    >
                        <div className="flex flex-col py-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); onDuplicateNote(note.id); setActiveMenuNoteId(null); }}
                                className="flex items-center gap-2 px-3 py-2 text-xs text-pplx-text hover:bg-pplx-hover text-left"
                            >
                                <Copy size={12} /> Duplicate
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onMoveNote(note.id); setActiveMenuNoteId(null); }}
                                className="flex items-center gap-2 px-3 py-2 text-xs text-pplx-text hover:bg-pplx-hover text-left"
                            >
                                <FolderInput size={12} /> Move
                            </button>
                            <div className="h-px bg-pplx-border/50 my-1" />
                            <button
                                onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); setActiveMenuNoteId(null); }}
                                className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-pplx-hover text-left"
                            >
                                <Trash2 size={12} /> Delete
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Render children if expanded */}
            {isExpanded && hasChildren && (
                <div className="ml-3 border-l border-pplx-border/50 pl-1 flex flex-col">
                    {children.map((child: Note) => (
                        <NoteItem
                            key={child.id}
                            note={child}
                            allNotes={allNotes}
                            level={level + 1}
                            activeNoteId={activeNoteId}
                            onSelectNote={onSelectNote}
                            onDuplicateNote={onDuplicateNote}
                            onMoveNote={onMoveNote}
                            onDeleteNote={onDeleteNote}
                            onNewNote={onNewNote}
                            activeMenuNoteId={activeMenuNoteId}
                            setActiveMenuNoteId={setActiveMenuNoteId}
                            menuRef={menuRef}
                            isMobile={isMobile}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
