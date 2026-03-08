import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    DndContext, 
    closestCenter, 
    KeyboardSensor, 
    useSensor, 
    useSensors, 
    DragOverlay, 
    defaultDropAnimationSideEffects, 
    DragStartEvent, 
    DragEndEvent,
    TouchSensor,
    MouseSensor
} from '@dnd-kit/core';
import { 
    arrayMove, 
    SortableContext, 
    sortableKeyboardCoordinates, 
    verticalListSortingStrategy, 
    useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
    Plus, Trash2, FileText, 
    Heading1, Heading2, Heading3, Type, 
    Image as ImageIcon, Tag, X,
    Quote, GripVertical, CheckSquare, List, Minus, Code,
    Sparkles, Wand2, Smile, AlignLeft, Upload, Palette,
    Table as TableIcon, BarChart, TrendingUp,
    ListChecks, ArrowUpRight, Briefcase,
    CalendarDays, PieChart, MousePointerClick, Sigma, AtSign, Layers,
    ListOrdered
} from 'lucide-react';
import { Note } from '../types';
import { EMOJI_LIST } from '../constants';
import { 
    Block, BlockType, AutoResizeTextarea, 
    TableBlock, CalendarBlock, ChartBlock, TOCBlock, ButtonBlock, SyncedBlock, EquationBlock,
    MentionPageBlock, MentionPersonBlock, NewPageBlock 
} from './BlockRenderers';

interface NotesViewProps {
    activeNoteId: string | null;
    notes: Note[];
    onSaveNote: (note: Note, addToHistory?: boolean, forceSnapshot?: boolean) => void;
    onDeleteNote: (id: string) => void;
    onCreateNote: () => void;
    onAiEdit: (text: string, instruction: string) => Promise<string>;
    onSelectNote: (id: string) => void;
    isSideChatOpen?: boolean;
}

const COVERS = [
    'linear-gradient(to right, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)',
    'linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)',
    'linear-gradient(to top, #cfd9df 0%, #e2ebf0 100%)',
    'linear-gradient(to right, #434343 0%, black 100%)',
    'linear-gradient(to right, #0f2027, #203a43, #2c5364)',
    'linear-gradient(to right, #b92b27, #1565c0)',
];

const uid = () => Math.random().toString(36).substr(2, 9);

// --- Table of Contents Component (Floating Sidebar Notion Style) ---
const TableOfContents = ({ blocks }: { blocks: Block[] }) => {
    const headings = blocks.filter(b => ['h1', 'h2', 'h3'].includes(b.type) && b.content.trim().length > 0);

    if (headings.length < 2 && blocks.length < 15) return null;

    const scrollToBlock = (id: string) => {
        const el = document.querySelector(`[data-block-id="${id}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    return (
        <div className="absolute top-1/2 -translate-y-1/2 right-2 z-40 hidden md:flex flex-col gap-1 group/toc hover:bg-pplx-card hover:border hover:border-pplx-border hover:shadow-xl hover:py-8 hover:px-4 rounded-xl transition-all duration-150 max-h-[85vh] overflow-y-auto no-scrollbar w-8 hover:w-72 items-end">
            <div className="absolute right-0 top-0 bottom-0 flex flex-col items-center justify-center gap-4 pointer-events-none opacity-40 group-hover/toc:opacity-0 transition-opacity duration-150 py-8 w-full">
                {headings.map((h) => (
                    <div key={h.id + '_line'} className={`bg-pplx-text rounded-full transition-all duration-150 ${h.type === 'h1' ? 'w-4 h-0.5' : h.type === 'h2' ? 'w-3 h-0.5 opacity-70' : 'w-2 h-0.5 opacity-50'}`} />
                ))}
            </div>
            <div className="w-full opacity-0 group-hover/toc:opacity-100 transition-opacity duration-150 delay-0 flex flex-col gap-2">
                 <div className="text-[10px] font-bold text-pplx-muted uppercase tracking-wider mb-3 px-1 pb-2 border-b border-pplx-border/50">Table of Contents</div>
                 {headings.map((h) => (
                    <button 
                        key={h.id} 
                        onClick={() => scrollToBlock(h.id)} 
                        className={`text-left w-full py-2 px-3 rounded-lg hover:bg-pplx-hover transition-colors text-xs leading-relaxed flex flex-col justify-center min-h-[40px] ${
                            h.type === 'h1' ? 'font-bold text-pplx-text mt-1' : 
                            h.type === 'h2' ? 'font-medium text-pplx-text/90 pl-4' : 
                            'text-pplx-muted pl-7'
                        }`}
                    >
                        <span className="line-clamp-2">{h.content}</span>
                    </button>
                 ))}
            </div>
        </div>
    );
};

// Helper for Mobile List Items
const MobileBlockRow = ({ icon: Icon, label, onClick, isDestructive = false }: { icon: any, label: string, onClick: () => void, isDestructive?: boolean }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 active:bg-pplx-secondary/50 transition-colors text-left rounded-lg mx-1 ${isDestructive ? 'text-red-400' : 'text-pplx-text'}`}>
        <div className={`flex items-center justify-center ${isDestructive ? 'text-red-400' : 'text-pplx-muted'}`}><Icon size={18} strokeWidth={2} /></div>
        <span className="text-sm font-medium">{label}</span>
    </button>
);

const AddBlockMenu = ({ 
    onSelectType, onClose, isMobile = false, onAiAction, showAiOnly = false, onDeletePage, onAddTag, onDeleteBlock
}: { 
    onSelectType: (type: BlockType) => void, onClose: () => void, isMobile?: boolean,
    onAiAction?: (action: string) => void, showAiOnly?: boolean, onDeletePage?: () => void, onAddTag?: () => void, onDeleteBlock?: () => void
}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose();
        };
        if (!isMobile) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, isMobile]);

    if (showAiOnly && onAiAction) {
        if (isMobile) {
            return (
                <>
                    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" onClick={onClose} />
                    <div 
                        className="fixed left-0 right-0 z-[70] bg-pplx-card border-t border-pplx-border rounded-t-2xl shadow-2xl p-4 animate-in slide-in-from-bottom duration-150"
                        style={{ 
                            bottom: document.body.classList.contains('dock-active') && window.innerWidth < 640 
                                ? 'calc(72px + env(safe-area-inset-bottom))' 
                                : '0px' 
                        }}
                    >
                        <div className="px-3 py-2 text-xs font-bold text-pplx-muted uppercase tracking-wider mb-2">AI Assist</div>
                        <div className="space-y-1">
                            <button onClick={() => onAiAction('fix')} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-pplx-text hover:bg-pplx-hover rounded-xl text-left"><Wand2 size={18} className="text-pplx-accent" /> Fix Grammar & Spelling</button>
                            <button onClick={() => onAiAction('shorten')} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-pplx-text hover:bg-pplx-hover rounded-xl text-left"><Minus size={18} /> Shorten</button>
                            <button onClick={() => onAiAction('longer')} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-pplx-text hover:bg-pplx-hover rounded-xl text-left"><AlignLeft size={18} /> Make Longer</button>
                            <button onClick={() => onAiAction('professional')} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-pplx-text hover:bg-pplx-hover rounded-xl text-left"><Briefcase size={18} /> Professional Tone</button>
                        </div>
                    </div>
                </>
            );
        }
        return (
            <div ref={menuRef} className="absolute left-8 top-0 z-50 bg-pplx-card border border-pplx-border shadow-xl rounded-xl p-1 w-64 animate-fadeIn flex flex-col gap-1">
                <div className="px-3 py-2 text-xs font-bold text-pplx-muted uppercase tracking-wider border-b border-pplx-border/50 mb-1">AI Assist</div>
                <button onClick={() => onAiAction('fix')} className="flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><Wand2 size={16} className="text-pplx-accent" /> Fix Grammar & Spelling</button>
                <button onClick={() => onAiAction('shorten')} className="flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><Minus size={16} /> Shorten</button>
                <button onClick={() => onAiAction('longer')} className="flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><AlignLeft size={16} /> Make Longer</button>
                 <button onClick={() => onAiAction('professional')} className="flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><Briefcase size={16} /> Professional Tone</button>
            </div>
        );
    }

    if (isMobile) {
        return (
            <>
                <div className="fixed inset-0 z-50 bg-transparent" onClick={onClose} />
                <div 
                    className="fixed right-4 z-[60] w-64 bg-pplx-card border border-pplx-border rounded-2xl shadow-2xl animate-in slide-in-from-bottom duration-150 max-h-[65vh] overflow-y-auto custom-scrollbar flex flex-col p-2"
                    style={{ 
                        bottom: document.body.classList.contains('dock-active') && window.innerWidth < 640 
                            ? 'calc(16px + 72px + env(safe-area-inset-bottom))' 
                            : '16px' 
                    }}
                >
                    <div className="flex flex-col gap-0.5">
                        <MobileBlockRow icon={FileText} label="New Page" onClick={() => onSelectType('newpage')} />
                        <MobileBlockRow icon={Type} label="Text" onClick={() => onSelectType('text')} />
                        <MobileBlockRow icon={CheckSquare} label="To-do list" onClick={() => onSelectType('todo')} />
                        <MobileBlockRow icon={Heading1} label="Heading 1" onClick={() => onSelectType('h1')} />
                        <MobileBlockRow icon={Heading2} label="Heading 2" onClick={() => onSelectType('h2')} />
                        <MobileBlockRow icon={List} label="Bulleted List" onClick={() => onSelectType('bullet')} />
                        <MobileBlockRow icon={ListChecks} label="Numbered List" onClick={() => onSelectType('number')} />
                        <MobileBlockRow icon={ImageIcon} label="Image" onClick={() => onSelectType('image')} />
                        <MobileBlockRow icon={Upload} label="File" onClick={() => onSelectType('file')} />
                        <MobileBlockRow icon={Code} label="Code" onClick={() => onSelectType('code')} />
                        <MobileBlockRow icon={Quote} label="Quote" onClick={() => onSelectType('quote')} />
                        <MobileBlockRow icon={TableIcon} label="Table" onClick={() => onSelectType('table')} />
                        <MobileBlockRow icon={CalendarDays} label="Calendar" onClick={() => onSelectType('calendar')} />
                        <MobileBlockRow icon={BarChart} label="Chart" onClick={() => onSelectType('chart_bar_v')} />
                        <MobileBlockRow icon={ListOrdered} label="TOC" onClick={() => onSelectType('toc')} />
                        <MobileBlockRow icon={Layers} label="Synced Block" onClick={() => onSelectType('block_synced')} />
                        {onAddTag && <MobileBlockRow icon={Tag} label="Add Tag" onClick={onAddTag} />}
                        {onDeleteBlock && <MobileBlockRow icon={Trash2} label="Delete Block" onClick={onDeleteBlock} isDestructive />}
                    </div>
                </div>
            </>
        );
    }

    // Desktop Menu
    return (
        <div ref={menuRef} className="absolute left-8 top-0 z-50 bg-pplx-card border border-pplx-border shadow-xl rounded-xl p-1 w-72 animate-fadeIn max-h-96 overflow-y-auto custom-scrollbar">
            {onDeleteBlock && (
                <button onClick={onDeleteBlock} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-pplx-hover rounded-lg text-left mb-1">
                    <Trash2 size={16} /> Delete Block
                </button>
            )}
            <div className="px-3 py-1.5 text-[10px] font-bold text-pplx-muted uppercase tracking-wider bg-pplx-secondary/50 rounded mt-1 mb-1">Basic Blocks</div>
            <button onClick={() => onSelectType('newpage')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><FileText size={16} /> New Page</button>
            <button onClick={() => onSelectType('text')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><Type size={16} /> Text</button>
            <button onClick={() => onSelectType('h1')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><Heading1 size={16} /> Heading 1</button>
            <button onClick={() => onSelectType('h2')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><Heading2 size={16} /> Heading 2</button>
            <button onClick={() => onSelectType('h3')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><Heading3 size={16} /> Heading 3</button>
            
            <div className="px-3 py-1.5 text-[10px] font-bold text-pplx-muted uppercase tracking-wider bg-pplx-secondary/50 rounded mt-2 mb-1">Lists & Media</div>
            <button onClick={() => onSelectType('todo')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><CheckSquare size={16} /> To-do List</button>
            <button onClick={() => onSelectType('bullet')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><List size={16} /> Bullet List</button>
            <button onClick={() => onSelectType('number')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><ListChecks size={16} /> Numbered List</button>
            <button onClick={() => onSelectType('image')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><ImageIcon size={16} /> Image</button>
            <button onClick={() => onSelectType('file')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><Upload size={16} /> File / Video</button>
            <button onClick={() => onSelectType('quote')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><Quote size={16} /> Quote</button>
            <button onClick={() => onSelectType('code')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><Code size={16} /> Code Block</button>
            <button onClick={() => onSelectType('divider')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><Minus size={16} /> Divider</button>

            <div className="px-3 py-1.5 text-[10px] font-bold text-pplx-muted uppercase tracking-wider bg-pplx-secondary/50 rounded mt-2 mb-1">Data & Advanced</div>
            <button onClick={() => onSelectType('table')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><TableIcon size={16} /> Tabel</button>
            <button onClick={() => onSelectType('calendar')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><CalendarDays size={16} /> Calendar View</button>
            <button onClick={() => onSelectType('chart_bar_v')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><BarChart size={16} /> Vertical Bar Chart</button>
            <button onClick={() => onSelectType('chart_bar_h')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><BarChart size={16} className="transform rotate-90" /> Horizontal Bar Chart</button>
            <button onClick={() => onSelectType('chart_line')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><TrendingUp size={16} /> Line Chart</button>
            <button onClick={() => onSelectType('chart_donut')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><PieChart size={16} /> Donut Chart</button>
            <button onClick={() => onSelectType('toc')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><ListOrdered size={16} /> Table of Contents</button>
            <button onClick={() => onSelectType('button')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><MousePointerClick size={16} /> Button</button>
            <button onClick={() => onSelectType('block_synced')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><Layers size={16} /> Blocks</button>
            <button onClick={() => onSelectType('equation')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><Sigma size={16} /> Equation</button>
            <button onClick={() => onSelectType('mention_person')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><AtSign size={16} /> Mention Person</button>
            <button onClick={() => onSelectType('mention_page')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><ArrowUpRight size={16} /> Mention Page</button>

             {onAddTag && <button onClick={onAddTag} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pplx-text hover:bg-pplx-hover rounded-lg text-left"><Tag size={16} /> Add Tag</button>}
             {onDeletePage && <button onClick={onDeletePage} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-pplx-hover rounded-lg text-left mt-2 border-t border-pplx-border/50 pt-2"><Trash2 size={16} /> Delete Page</button>}
        </div>
    );
};

const renderBlockContent = (
    block: Block, 
    isPreviewMode: boolean, 
    onChange: (val: string) => void, 
    onCheck: (checked: boolean) => void, 
    onEnter: () => void, 
    onDelete: () => void,
    onPaste: (e: React.ClipboardEvent) => void,
    isFocused: boolean, 
    onFocus: () => void,
    onNavigatePage: (id: string) => void,
    allBlocks: Block[],
    readOnly: boolean = false,
    updateBlockMetadata?: (data: any) => void,
    allNotes?: Note[]
) => {
    // Shared text props
    const textProps = {
        value: block.content, onChange, onEnter, onBackspace: () => { if (block.content === '') onDelete(); },
        onPaste, autoFocus: isFocused, onFocus, readOnly, className: ""
    };

    switch (block.type) {
        case 'h1': return <div className="flex items-center mt-6 mb-2"><Heading1 size={24} className="mr-2 text-pplx-muted shrink-0 opacity-50" /><AutoResizeTextarea {...textProps} className="text-3xl font-bold text-pplx-text placeholder-gray-500/50" placeholder="Heading 1" /></div>;
        case 'h2': return <div className="flex items-center mt-5 mb-2"><Heading2 size={20} className="mr-2 text-pplx-muted shrink-0 opacity-50" /><AutoResizeTextarea {...textProps} className="text-2xl font-bold text-pplx-text placeholder-gray-500/50" placeholder="Heading 2" /></div>;
        case 'h3': return <div className="flex items-center mt-4 mb-2"><Heading3 size={18} className="mr-2 text-pplx-muted shrink-0 opacity-50" /><AutoResizeTextarea {...textProps} className="text-xl font-semibold text-pplx-text placeholder-gray-500/50" placeholder="Heading 3" /></div>;
        case 'bullet': return <div className="flex items-start my-1"><div className="mr-2 mt-2 w-1.5 h-1.5 bg-pplx-text rounded-full shrink-0" /><AutoResizeTextarea {...textProps} className="text-base text-pplx-text leading-relaxed" placeholder="List item" /></div>;
        case 'number': return <div className="flex items-start my-1"><div className="mr-2 mt-1 w-5 text-right text-pplx-muted shrink-0 font-mono text-sm">1.</div><AutoResizeTextarea {...textProps} className="text-base text-pplx-text leading-relaxed" placeholder="List item" /></div>;
        case 'todo':
            return (
                <div className="flex items-start my-1">
                    <button onClick={() => !readOnly && onCheck(!block.checked)} className={`mr-2 mt-1 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${block.checked ? 'bg-pplx-accent border-pplx-accent' : 'border-pplx-muted hover:border-pplx-text'}`}>
                        {block.checked && <CheckSquare size={10} className="text-black" />}
                    </button>
                    <AutoResizeTextarea {...textProps} className={`text-base leading-relaxed transition-opacity ${block.checked ? 'text-pplx-muted line-through opacity-50' : 'text-pplx-text'}`} placeholder="To-do" />
                </div>
            );
        case 'quote': return <div className="flex items-start my-2 pl-4 border-l-4 border-pplx-accent bg-pplx-secondary/20 rounded-r-lg p-2"><AutoResizeTextarea {...textProps} className="text-base italic text-pplx-text leading-relaxed" placeholder="Quote" /></div>;
        case 'code':
            return (
                <div className="my-2 bg-[#1e1e1e] border border-pplx-border rounded-lg overflow-hidden font-mono text-sm">
                    <div className="bg-[#2d2d2d] px-3 py-1 text-xs text-gray-400 flex justify-between border-b border-white/10"><span>Code</span></div>
                    <div className="p-3"><AutoResizeTextarea {...textProps} className="text-gray-200" placeholder="// Code snippet" /></div>
                </div>
            );
        case 'divider': return <div className="py-4 cursor-default" onClick={onFocus}><hr className="border-t border-pplx-border" /></div>;
        case 'image':
            return (
                <div className="my-4 relative group/media">
                    <img src={block.content} alt="Block Media" className="rounded-lg max-h-[500px] w-auto border border-pplx-border" />
                    {!readOnly && <button onClick={onDelete} className="absolute top-2 right-2 bg-black/60 p-1 rounded text-white opacity-0 group-hover/media:opacity-100 transition-opacity"><Trash2 size={16} /></button>}
                </div>
            );
        case 'file':
            return (
                 <div className="my-2 p-3 border border-pplx-border bg-pplx-secondary/30 rounded-lg flex items-center justify-between group/file">
                    <div className="flex items-center gap-3"><FileText size={24} className="text-pplx-accent" /><div className="flex flex-col"><span className="text-sm font-medium text-pplx-text truncate max-w-[200px]">{block.metadata?.name || 'File'}</span><span className="text-[10px] text-pplx-muted">{block.metadata?.mimeType || 'Unknown Type'}</span></div></div>
                    {!readOnly && <button onClick={onDelete} className="text-pplx-muted hover:text-red-400 opacity-0 group-hover/file:opacity-100 transition-opacity"><Trash2 size={16} /></button>}
                 </div>
            );
        case 'newpage': return <NewPageBlock content={block.content} metadata={block.metadata} onNavigate={onNavigatePage} notes={allNotes} />;
        case 'table': return <TableBlock content={block.content} onChange={onChange} readOnly={readOnly} />;
        case 'calendar': return <CalendarBlock content={block.content} onChange={onChange} readOnly={readOnly} />;
        case 'chart_bar_v':
        case 'chart_bar_h':
        case 'chart_line':
        case 'chart_donut': return <ChartBlock type={block.type} content={block.content} onChange={onChange} readOnly={readOnly} />;
        case 'toc': return <TOCBlock allBlocks={allBlocks} />;
        case 'button': return <ButtonBlock content={block.content} onChange={onChange} onAction={onEnter} readOnly={readOnly} />;
        case 'equation': return <EquationBlock content={block.content} onChange={onChange} readOnly={readOnly} />;
        case 'mention_person': return <MentionPersonBlock content={block.content} onChange={onChange} readOnly={readOnly} />;
        case 'mention_page': return <MentionPageBlock content={block.content} metadata={block.metadata} notes={allNotes || []} onUpdate={updateBlockMetadata || (() => {})} onNavigate={onNavigatePage} readOnly={readOnly} />;
        case 'block_synced': return <SyncedBlock content={block.content} onChange={onChange} readOnly={readOnly} />;
        default: return <div className="my-1"><AutoResizeTextarea {...textProps} className="text-base text-pplx-text leading-relaxed" placeholder={(isFocused && !isPreviewMode) ? "Type '/' for commands" : ""} /></div>;
    }
};

// --- Sortable Block Components ---

interface SortableBlockItemProps {
    id: string;
    children: (dragHandleProps: any, isDragging: boolean) => React.ReactNode;
}

const SortableBlockItem = ({ id, children }: SortableBlockItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 50 : 'auto',
        position: 'relative' as 'relative',
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            {children(listeners, isDragging)}
        </div>
    );
};

const BlockRow = ({
    block, activeNote, activeBlockId, setActiveBlockId,
    showAddMenu, setShowAddMenu, aiMenuBlockId, setAiMenuBlockId,
    thinkingBlockId, isPreviewMode,
    updateBlock, addBlock, deleteBlock, handlePaste, onSelectNote, notes,
    handleAiAction, onDeleteNote, setIsTagInputOpen,
    dragHandleProps, isOverlay,
    showBlockMenu, setShowBlockMenu
}: any) => {
    const isFocused = activeBlockId === block.id;
    const isWideBlock = ['table', 'chart_bar_v', 'chart_bar_h', 'chart_line', 'chart_donut', 'calendar', 'db_list', 'db_gallery'].includes(block.type);
    
    return (
        <div data-block-id={block.id} className={`group relative flex -mx-2 md:mx-0 group/row touch-manipulation min-h-[1.5rem] ${isWideBlock ? 'flex-col items-stretch' : 'items-start'} md:flex-row md:items-start ${isOverlay ? 'bg-pplx-card shadow-2xl border border-pplx-accent/50 rounded-lg opacity-90 scale-105' : ''}`} onMouseEnter={() => !isOverlay && setActiveBlockId(block.id)}>
            {!activeNote.isLocked && !isOverlay && (
                <div className="hidden md:flex items-center gap-1 pr-3 pt-1 opacity-0 group-hover/row:opacity-100 transition-opacity absolute -left-24 top-0.5 select-none h-6 justify-end w-24">
                    <div className="relative">
                        <button onClick={() => setAiMenuBlockId(aiMenuBlockId === block.id ? null : block.id)} className={`p-0.5 text-pplx-accent hover:text-white hover:bg-pplx-hover rounded transition-colors ${thinkingBlockId === block.id ? 'animate-pulse' : ''}`} title="AI Assist"><Sparkles size={16} /></button>
                        {aiMenuBlockId === block.id && <AddBlockMenu onSelectType={() => {}} onClose={() => setAiMenuBlockId(null)} isMobile={false} onAiAction={(action) => handleAiAction(block.id, action)} showAiOnly={true} />}
                    </div>
                    <div className="relative"><button onClick={() => setShowAddMenu(block.id)} className="p-0.5 text-gray-400 hover:text-white hover:bg-pplx-hover rounded transition-colors"><Plus size={16} /></button></div>
                    <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-0.5 text-gray-400 hover:text-white hover:bg-pplx-hover rounded transition-colors"><GripVertical size={16} /></div>
                </div>
            )}
            {!activeNote.isLocked && !isOverlay && (
                <div className={`md:hidden absolute right-0 top-0 z-20 flex items-center pl-4 bg-gradient-to-l from-pplx-primary via-pplx-primary/80 to-transparent transition-all duration-150 ${isWideBlock ? 'h-10 rounded-bl-xl pr-1' : 'h-full'} ${(isFocused || showAddMenu === block.id || aiMenuBlockId === block.id) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                    <button onClick={() => setAiMenuBlockId(aiMenuBlockId === block.id ? null : block.id)} className={`p-2 rounded hover:bg-pplx-hover mr-1 ${block.content.length > 0 ? 'text-pplx-accent' : 'text-pplx-muted opacity-50'}`}><Sparkles size={18} /></button>
                    <button onClick={() => setShowAddMenu(block.id)} className="p-2 text-pplx-muted hover:text-pplx-text rounded hover:bg-pplx-hover mr-1"><Plus size={20} /></button>
                    <div {...dragHandleProps} className="p-3 text-pplx-muted hover:text-pplx-text cursor-grab active:cursor-grabbing touch-none"><GripVertical size={22} /></div>
                    {aiMenuBlockId === block.id && <AddBlockMenu onSelectType={() => {}} onClose={() => setAiMenuBlockId(null)} isMobile={true} onAiAction={(action) => handleAiAction(block.id, action)} showAiOnly={true} />}
                </div>
            )}
            {(showAddMenu === block.id || showBlockMenu === block.id) && <AddBlockMenu onSelectType={(type) => addBlock(block.id, type)} onClose={() => { setShowAddMenu(null); setShowBlockMenu(null); }} isMobile={showBlockMenu === block.id || window.innerWidth < 768} onDeletePage={() => onDeleteNote(activeNote.id)} onAddTag={() => setIsTagInputOpen(true)} onDeleteBlock={() => deleteBlock(block.id)} />}
            <div className={`flex-1 min-w-0 px-2 md:px-0 ${isWideBlock ? 'pr-0 w-full' : ((isFocused || showAddMenu === block.id || aiMenuBlockId === block.id) ? 'pr-[140px]' : 'pr-2')} md:pr-0 transition-all duration-150 ${thinkingBlockId === block.id ? 'opacity-50 pointer-events-none' : 'opacity-100'} ${isOverlay ? 'max-h-[60px] overflow-hidden mask-image-b-fade' : ''}`}>
                {renderBlockContent(block, isPreviewMode, (content) => updateBlock(block.id, { content }), (checked) => updateBlock(block.id, { checked }), () => { if(activeNote.isLocked) return; const listTypes = ['bullet', 'number', 'todo']; const nextType = listTypes.includes(block.type) ? block.type : 'text'; addBlock(block.id, nextType); }, () => deleteBlock(block.id), (e) => handlePaste(e, block.id), isFocused, () => setActiveBlockId(block.id), (pageId) => onSelectNote(pageId), notes, activeNote.isLocked, (updates) => updateBlock(block.id, updates), notes)}
            </div>
        </div>
    );
};

export const NotesView: React.FC<NotesViewProps> = ({ activeNoteId, notes, onSaveNote, onDeleteNote, onAiEdit, onSelectNote }) => {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [isPreviewMode] = useState(false);
    const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
    const [showBlockMenu, setShowBlockMenu] = useState<string | null>(null); 
    const [showAddMenu, setShowAddMenu] = useState<string | null>(null); 
    const [isTagInputOpen, setIsTagInputOpen] = useState(false);
    const [tagInputValue, setTagInputValue] = useState("");
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [aiMenuBlockId, setAiMenuBlockId] = useState<string | null>(null);
    const [thinkingBlockId, setThinkingBlockId] = useState<string | null>(null);
    const [pendingFileBlockId, setPendingFileBlockId] = useState<string | null>(null);
    const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);

    // Refs for synchronization and undo/redo handling
    const lastSavedContentRef = useRef<string | null>(null);
    const lastNoteIdRef = useRef<string | null>(null);

    const coverInputRef = useRef<HTMLInputElement>(null);
    const blockFileInputRef = useRef<HTMLInputElement>(null);
    // const draggingTouchRef = useRef<string | null>(null); // Removed

    const activeNote = notes.find(n => n.id === activeNoteId);

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 10,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setDraggedBlockId(null);
        
        if (over && active.id !== over.id) {
            setBlocks((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                const newItems = arrayMove(items, oldIndex, newIndex);
                saveBlocks(newItems, true); 
                return newItems;
            });
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        if (activeNote?.isLocked) return;
        if (window.navigator.vibrate) window.navigator.vibrate(10);
        setDraggedBlockId(event.active.id as string);
    };
    useEffect(() => {
        if (activeNote) {
            // Only re-parse if the note ID changed OR if the content is different from what we last saved.
            // This allows external updates (like Undo) to flow in, but prevents internal updates (Typing) from causing re-renders/cursor jumps.
            if (activeNote.id !== lastNoteIdRef.current || activeNote.content !== lastSavedContentRef.current) {
                
                const lines = activeNote.content ? activeNote.content.split('\n') : [''];
                const parsedBlocks: Block[] = lines.map(line => {
                    let type: BlockType = 'text';
                    let content = line;
                    let checked = false;
                    let metadata = undefined;

                    if (line.startsWith('# ')) { type = 'h1'; content = line.replace('# ', ''); }
                    else if (line.startsWith('## ')) { type = 'h2'; content = line.replace('## ', ''); }
                    else if (line.startsWith('### ')) { type = 'h3'; content = line.replace('### ', ''); }
                    else if (line.startsWith('- [ ] ')) { type = 'todo'; content = line.replace('- [ ] ', ''); checked = false; }
                    else if (line.startsWith('- [x] ')) { type = 'todo'; content = line.replace('- [x] ', ''); checked = true; }
                    else if (line.startsWith('- ')) { type = 'bullet'; content = line.replace('- ', ''); }
                    else if (line.match(/^\d+\. /)) { type = 'number'; content = line.replace(/^\d+\. /, ''); }
                    else if (line.startsWith('> ')) { type = 'quote'; content = line.replace('> ', ''); }
                    else if (line.startsWith('```')) { type = 'code'; content = line.replace(/```/g, ''); }
                    else if (line === '---') { type = 'divider'; content = ''; }
                    else if (line.startsWith('[FILE:')) { type = 'file'; content = line.replace('[FILE:', '').replace(']', ''); } 
                    else if (line.startsWith('[PAGE:')) { const parts = line.match(/\[PAGE:(.*?):(.*?)\]/); if (parts) { content = parts[2]; metadata = { pageId: parts[1] }; } else { content = "Untitled Page"; } type = 'newpage'; }
                    else if (line.startsWith('[TABLE]')) { type = 'table'; content = line.replace('[TABLE]', ''); }
                    else if (line.startsWith('[CALENDAR]')) { type = 'calendar'; content = line.replace('[CALENDAR]', ''); }
                    else if (line.startsWith('[CHART_V]')) { type = 'chart_bar_v'; content = line.replace('[CHART_V]', ''); }
                    else if (line.startsWith('[CHART_H]')) { type = 'chart_bar_h'; content = line.replace('[CHART_H]', ''); }
                    else if (line.startsWith('[CHART_L]')) { type = 'chart_line'; content = line.replace('[CHART_L]', ''); }
                    else if (line.startsWith('[CHART_D]')) { type = 'chart_donut'; content = line.replace('[CHART_D]', ''); }
                    else if (line.startsWith('[TOC]')) { type = 'toc'; content = ''; }
                    else if (line.startsWith('[BUTTON]')) { type = 'button'; content = line.replace('[BUTTON]', ''); }
                    else if (line.startsWith('[EQUATION]')) { type = 'equation'; content = line.replace('[EQUATION]', ''); }
                    else if (line.startsWith('[SYNC]')) { type = 'block_synced'; content = line.replace('[SYNC]', ''); }
                    else if (line.startsWith('[MENTION_P]')) { type = 'mention_person'; content = line.replace('[MENTION_P]', ''); }
                    else if (line.startsWith('[MENTION_D]')) { type = 'mention_page'; const complexMatch = line.match(/\[MENTION_D:(.*?)\](.*)/); if (complexMatch) { metadata = { pageId: complexMatch[1] }; content = complexMatch[2]; } else { content = line.replace('[MENTION_D]', ''); } }
                    
                    return { id: uid(), type, content, checked, metadata };
                });
                
                if (parsedBlocks.length === 0) parsedBlocks.push({ id: uid(), type: 'text', content: '' });
                
                setBlocks(parsedBlocks);
                setThinkingBlockId(null);
                setIsTagInputOpen(false);

                // Sync refs to current state
                lastNoteIdRef.current = activeNote.id;
                lastSavedContentRef.current = activeNote.content;
            }
        }
    }, [activeNote?.id, activeNote?.content]);

    const saveBlocks = useCallback((currentBlocks: Block[], forceSnapshot: boolean = false) => {
        if (!activeNote) return;
        const contentString = currentBlocks.map(b => {
            switch(b.type) {
                case 'h1': return `# ${b.content}`;
                case 'h2': return `## ${b.content}`;
                case 'h3': return `### ${b.content}`;
                case 'bullet': return `- ${b.content}`;
                case 'number': return `1. ${b.content}`;
                case 'todo': return `- [${b.checked ? 'x' : ' '}] ${b.content}`;
                case 'quote': return `> ${b.content}`;
                case 'code': return `\`\`\`${b.content}\`\`\``;
                case 'divider': return `---`;
                case 'file': return `[FILE:${b.content}]`;
                case 'newpage': return `[PAGE:${b.metadata?.pageId || ''}:${b.content}]`;
                case 'table': return `[TABLE]${b.content}`;
                case 'calendar': return `[CALENDAR]${b.content}`;
                case 'chart_bar_v': return `[CHART_V]${b.content}`;
                case 'chart_bar_h': return `[CHART_H]${b.content}`;
                case 'chart_line': return `[CHART_L]${b.content}`;
                case 'chart_donut': return `[CHART_D]${b.content}`;
                case 'toc': return `[TOC]`;
                case 'button': return `[BUTTON]${b.content}`;
                case 'equation': return `[EQUATION]${b.content}`;
                case 'block_synced': return `[SYNC]${b.content}`;
                case 'mention_person': return `[MENTION_P]${b.content}`;
                case 'mention_page': if (b.metadata?.pageId) return `[MENTION_D:${b.metadata.pageId}]${b.content}`; return `[MENTION_D]${b.content}`;
                default: return b.content;
            }
        }).join('\n');
        
        // Update the ref *before* calling onSaveNote. 
        // This ensures that when the parent component updates and passes back the new content,
        // the useEffect knows that *we* caused this update, so it doesn't re-parse blocks.
        lastSavedContentRef.current = contentString;
        onSaveNote({ ...activeNote, content: contentString }, true, forceSnapshot);
    }, [activeNote, onSaveNote]);

    const handlePaste = (e: React.ClipboardEvent, currentBlockId: string) => {
        if (activeNote?.isLocked) return;
        const text = e.clipboardData.getData('text/plain');
        if (text.includes('\n') || text.includes('\r')) {
            e.preventDefault();
            const lines = text.split(/\r?\n/);
            const newBlocks: Block[] = lines.map(line => {
                 let type: BlockType = 'text';
                 let content = line.trim();
                 if (line.startsWith('# ')) { type = 'h1'; content = line.replace('# ', ''); }
                 else if (line.startsWith('- ')) { type = 'bullet'; content = line.replace('- ', ''); }
                 return { id: uid(), type, content, checked: false };
            });

             setBlocks(prev => {
                 const index = prev.findIndex(b => b.id === currentBlockId);
                 const finalBlocks = [...prev];
                 const currentBlock = prev[index];
                 if (currentBlock && currentBlock.content.trim() === '') finalBlocks.splice(index, 1, ...newBlocks);
                 else finalBlocks.splice(index + 1, 0, ...newBlocks);
                 saveBlocks(finalBlocks, true); // Force snapshot for big pastes
                 return finalBlocks;
             });
        }
    };

    const updateBlock = (id: string, updates: Partial<Block>) => {
        if (activeNote?.isLocked) return;
        setBlocks(prev => {
            const newBlocks = prev.map(b => b.id === id ? { ...b, ...updates } : b);
            // Typing updates use default debounce (false for forceSnapshot)
            saveBlocks(newBlocks, false);
            return newBlocks;
        });
    };

    const addBlock = (afterId: string, type: BlockType = 'text') => {
        if (activeNote?.isLocked) return;
        if (['image', 'video', 'audio', 'file'].includes(type)) {
            setPendingFileBlockId(afterId);
            if (blockFileInputRef.current) blockFileInputRef.current.click();
            setShowAddMenu(null);
            return;
        }
        if (type === 'newpage') {
            const newPageId = uid();
            const newPageNote: Note = { id: newPageId, title: 'Untitled', content: '', updatedAt: Date.now(), status: 'Idea', tags: [], parentId: activeNoteId || undefined };
            onSaveNote(newPageNote, true, true);
            setBlocks(prev => {
                const index = prev.findIndex(b => b.id === afterId);
                const newBlock: Block = { id: uid(), type: 'newpage', content: 'Untitled', checked: false, metadata: { pageId: newPageId } };
                const newBlocks = [...prev];
                newBlocks.splice(index + 1, 0, newBlock);
                saveBlocks(newBlocks, true); // Force snapshot for structural change
                return newBlocks;
            });
            setShowAddMenu(null);
            onSelectNote(newPageId);
            return;
        }

        const newId = uid();
        let initialContent = '';
        if (type === 'table') initialContent = JSON.stringify([['Header 1', 'Header 2'], ['Cell 1', 'Cell 2']]);
        if (type === 'chart_bar_v' || type === 'chart_bar_h' || type === 'chart_line' || type === 'chart_donut') initialContent = "Label,10\nLabel,20\nLabel,15";
        
        setBlocks(prev => {
            const index = prev.findIndex(b => b.id === afterId);
            const newBlock: Block = { id: newId, type, content: initialContent, checked: false };
            const newBlocks = [...prev];
            newBlocks.splice(index + 1, 0, newBlock);
            saveBlocks(newBlocks, true); // Force snapshot for structural change
            return newBlocks;
        });
        setActiveBlockId(newId);
        setShowAddMenu(null);
        setShowBlockMenu(null);
    };

    const handleFileBlockUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (activeNote?.isLocked) return;
        if (e.target.files && e.target.files[0] && pendingFileBlockId) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                const newId = uid();
                let blockType: BlockType = 'file';
                if (file.type.startsWith('image/')) blockType = 'image';
                const newBlock: Block = { id: newId, type: blockType, content: reader.result as string, metadata: { name: file.name, mimeType: file.type } };
                setBlocks(prev => {
                    const index = prev.findIndex(b => b.id === pendingFileBlockId);
                    const newBlocks = [...prev];
                    newBlocks.splice(index + 1, 0, newBlock);
                    newBlocks.splice(index + 2, 0, { id: uid(), type: 'text', content: '' });
                    saveBlocks(newBlocks, true); // Force snapshot for file upload
                    return newBlocks;
                });
                setActiveBlockId(newId);
                setPendingFileBlockId(null);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const deleteBlock = (id: string) => {
        if (activeNote?.isLocked) return;
        setBlocks(prev => {
            if (prev.length <= 1) { const reset = prev.map(b => b.id === id ? { ...b, content: '', type: 'text' as BlockType } : b); saveBlocks(reset, true); return reset; }
            const newBlocks = prev.filter(b => b.id !== id);
            saveBlocks(newBlocks, true); // Force snapshot for deletion
            return newBlocks;
        });
        setShowBlockMenu(null);
    };

    const handleAddTag = () => { if (tagInputValue.trim() && activeNote) { onSaveNote({ ...activeNote, tags: [...(activeNote.tags || []), tagInputValue.trim()] }, true, true); setTagInputValue(""); setIsTagInputOpen(false); } };
    const removeTag = (tag: string) => { if (activeNote) onSaveNote({ ...activeNote, tags: activeNote.tags?.filter(t => t !== tag) }, true, true); };
    
    const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && activeNote) {
            const reader = new FileReader();
            reader.onload = () => onSaveNote({ ...activeNote, cover: reader.result as string }, true, true);
            reader.readAsDataURL(e.target.files[0]);
        }
        e.target.value = '';
    };

    const handleRandomCover = () => { if (!activeNote) return; const available = COVERS.filter(c => c !== activeNote.cover); onSaveNote({ ...activeNote, cover: available[Math.floor(Math.random() * available.length)] || COVERS[0] }, true, true); };

    const handleAiAction = async (blockId: string, action: string) => {
        const block = blocks.find(b => b.id === blockId);
        if (!block || !block.content.trim()) return;
        setThinkingBlockId(blockId); setAiMenuBlockId(null); setShowBlockMenu(null);
        let instruction = "";
        switch (action) {
            case 'fix': instruction = "Fix grammar and spelling, maintain tone."; break;
            case 'shorten': instruction = "Make this shorter and more concise."; break;
            case 'longer': instruction = "Expand on this idea, make it longer."; break;
            case 'professional': instruction = "Rewrite in a professional, business tone."; break;
            default: instruction = action;
        }
        try { const newText = await onAiEdit(block.content, instruction); if (newText) updateBlock(blockId, { content: newText }); } catch (e) { console.error("AI Edit Failed", e); } finally { setThinkingBlockId(null); }
    };

    const getFontClass = (style?: 'sans' | 'serif' | 'mono') => { switch(style) { case 'serif': return 'font-serif'; case 'mono': return 'font-mono'; default: return 'font-sans'; } };

    if (!activeNote) return null;

    return (
        <div className="flex flex-col flex-1 bg-pplx-primary text-pplx-text overflow-hidden relative">
            <TableOfContents blocks={blocks} />
            <div className={`flex-1 overflow-y-auto custom-scrollbar relative ${getFontClass(activeNote.fontStyle)}`}>
                {activeNote.cover && (
                    <div className="group relative w-full h-32 md:h-64 bg-pplx-secondary border-b border-pplx-border transition-all duration-150 animate-fadeIn">
                         <div className="w-full h-full bg-cover bg-center" style={{ background: activeNote.cover.includes('gradient') ? activeNote.cover : `url(${activeNote.cover})` }} />
                        {!activeNote.isLocked && (
                            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                <button onClick={handleRandomCover} className="px-3 py-1 bg-black/50 backdrop-blur rounded text-xs text-white hover:bg-black/70 border border-white/10 flex items-center gap-1.5"><Palette size={12} /> Change</button>
                                <button onClick={() => coverInputRef.current?.click()} className="px-3 py-1 bg-black/50 backdrop-blur rounded text-xs text-white hover:bg-black/70 border border-white/10 flex items-center gap-1.5"><Upload size={12} /> Upload</button>
                                <button onClick={() => onSaveNote({ ...activeNote, cover: undefined }, true, true)} className="px-2 py-1 bg-black/50 backdrop-blur rounded text-white hover:bg-red-500/80 border border-white/10"><X size={12} /></button>
                            </div>
                        )}
                    </div>
                )}
                <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={handleCoverUpload} />
                <input type="file" ref={blockFileInputRef} className="hidden" onChange={handleFileBlockUpload} />

                <div className="max-w-4xl mx-auto px-4 md:px-12 pb-32 pt-12 relative z-10">
                    <div className="group relative mb-8">
                        {!activeNote.isLocked && (
                            <div className={`flex gap-4 text-xs font-medium text-pplx-muted opacity-0 group-hover:opacity-100 transition-opacity duration-150 mb-2`}>
                                 {!activeNote.emoji && <button onClick={() => { onSaveNote({ ...activeNote, emoji: '📄' }, true, true); }} className="hover:text-pplx-text flex items-center gap-1 transition-colors"><Smile size={14} /> Add Icon</button>}
                                 {!activeNote.cover && <button onClick={handleRandomCover} className="hover:text-pplx-text flex items-center gap-1 transition-colors"><ImageIcon size={14} /> Add Cover</button>}
                            </div>
                        )}

                        {activeNote.emoji && (
                            <div className="relative mb-4 group/icon inline-block">
                                <button disabled={activeNote.isLocked} className={`text-6xl md:text-7xl flex items-center justify-center select-none rounded-xl p-2 transition-colors -ml-2 ${activeNote.isLocked ? 'cursor-default' : 'cursor-pointer hover:bg-pplx-hover'}`} onClick={() => !activeNote.isLocked && setShowIconPicker(!showIconPicker)}>{activeNote.emoji}</button>
                                {!activeNote.isLocked && <button onClick={(e) => { e.stopPropagation(); onSaveNote({ ...activeNote, emoji: '' }, true, true); }} className="absolute -top-1 -right-1 bg-pplx-card rounded-full p-1 text-pplx-muted hover:text-red-500 border border-pplx-border opacity-0 group-hover/icon:opacity-100 transition-opacity shadow-sm"><X size={10} /></button>}
                                {showIconPicker && (
                                    <>
                                        <div className="absolute top-full left-0 mt-2 p-3 bg-pplx-card border border-pplx-border rounded-xl shadow-2xl z-50 w-72 h-64 overflow-y-auto custom-scrollbar">
                                            <div className="grid grid-cols-6 gap-2">
                                                {EMOJI_LIST.map(emoji => <button key={emoji} onClick={() => { onSaveNote({ ...activeNote, emoji }, true, true); setShowIconPicker(false); }} className="w-9 h-9 flex items-center justify-center hover:bg-pplx-hover rounded text-xl">{emoji}</button>)}
                                            </div>
                                        </div>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowIconPicker(false)} />
                                    </>
                                )}
                            </div>
                        )}

                        <div className="relative mb-3">
                            <input type="text" placeholder="Untitled" value={activeNote.title} readOnly={activeNote.isLocked} onChange={(e) => onSaveNote({ ...activeNote, title: e.target.value }, false, false)} className={`w-full text-4xl md:text-5xl font-bold bg-transparent text-pplx-text placeholder-gray-500/50 outline-none font-serif leading-tight break-words border-none p-0 focus:ring-0 ${activeNote.isLocked ? 'cursor-default' : ''}`} />
                        </div>

                        <div className="flex items-center gap-2 overflow-hidden flex-wrap min-h-[28px]">
                            {activeNote.tags?.map(tag => (
                                <span key={tag} className="flex items-center gap-1.5 text-xs font-medium bg-pplx-accent/10 text-pplx-accent px-2.5 py-1 rounded-full whitespace-nowrap border border-pplx-accent/20 hover:border-pplx-accent/50 transition-colors group/tag">
                                    <Tag size={10} />{tag}
                                    {!activeNote.isLocked && <button onClick={() => removeTag(tag)} className="w-0 overflow-hidden group-hover/tag:w-auto hover:text-white transition-all pl-1"><X size={12} /></button>}
                                </span>
                            ))}
                            {!activeNote.isLocked && (
                                isTagInputOpen ? (
                                    <div className="flex items-center animate-fadeIn"><input autoFocus value={tagInputValue} onChange={(e) => setTagInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); if (e.key === 'Escape') setIsTagInputOpen(false); }} onBlur={() => setIsTagInputOpen(false)} placeholder="Type tag name..." className="bg-transparent border-b border-pplx-accent text-sm text-pplx-text px-1 py-0.5 w-32 outline-none placeholder-gray-500" /></div>
                                ) : <button onClick={() => setIsTagInputOpen(true)} className="text-xs text-pplx-muted hover:text-pplx-accent flex items-center gap-1 px-2 py-1 rounded-full hover:bg-pplx-hover transition-colors opacity-0 group-hover:opacity-100 duration-150"><Plus size={12} /> Add Tag</button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <DndContext 
                            sensors={sensors} 
                            collisionDetection={closestCenter} 
                            onDragEnd={handleDragEnd}
                            onDragStart={handleDragStart}
                        >
                            <SortableContext 
                                items={blocks.map(b => b.id)} 
                                strategy={verticalListSortingStrategy}
                            >
                                {blocks.map((block) => (
                                    <SortableBlockItem key={block.id} id={block.id}>
                                        {(dragHandleProps, isDragging) => (
                                            <BlockRow 
                                                block={block}
                                                activeNote={activeNote}
                                                activeBlockId={activeBlockId}
                                                setActiveBlockId={setActiveBlockId}
                                                showAddMenu={showAddMenu}
                                                setShowAddMenu={setShowAddMenu}
                                                aiMenuBlockId={aiMenuBlockId}
                                                setAiMenuBlockId={setAiMenuBlockId}
                                                thinkingBlockId={thinkingBlockId}
                                                isPreviewMode={isPreviewMode}
                                                updateBlock={updateBlock}
                                                addBlock={addBlock}
                                                deleteBlock={deleteBlock}
                                                handlePaste={handlePaste}
                                                onSelectNote={onSelectNote}
                                                notes={notes}
                                                handleAiAction={handleAiAction}
                                                onDeleteNote={onDeleteNote}
                                                setIsTagInputOpen={setIsTagInputOpen}
                                                dragHandleProps={dragHandleProps}
                                                isDragging={isDragging}
                                                showBlockMenu={showBlockMenu}
                                                setShowBlockMenu={setShowBlockMenu}
                                            />
                                        )}
                                    </SortableBlockItem>
                                ))}
                            </SortableContext>
                            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
                                {draggedBlockId ? (
                                    <BlockRow 
                                        block={blocks.find(b => b.id === draggedBlockId)}
                                        activeNote={activeNote}
                                        activeBlockId={activeBlockId}
                                        setActiveBlockId={setActiveBlockId}
                                        showAddMenu={showAddMenu}
                                        setShowAddMenu={setShowAddMenu}
                                        aiMenuBlockId={aiMenuBlockId}
                                        setAiMenuBlockId={setAiMenuBlockId}
                                        thinkingBlockId={thinkingBlockId}
                                        isPreviewMode={isPreviewMode}
                                        updateBlock={updateBlock}
                                        addBlock={addBlock}
                                        deleteBlock={deleteBlock}
                                        handlePaste={handlePaste}
                                        onSelectNote={onSelectNote}
                                        notes={notes}
                                        handleAiAction={handleAiAction}
                                        onDeleteNote={onDeleteNote}
                                        setIsTagInputOpen={setIsTagInputOpen}
                                        dragHandleProps={{}}
                                        isDragging={true}
                                        isOverlay={true}
                                        showBlockMenu={showBlockMenu}
                                        setShowBlockMenu={setShowBlockMenu}
                                    />
                                ) : null}
                            </DragOverlay>
                        </DndContext>
                        {!activeNote.isLocked && <div className="h-32 w-full cursor-text" onClick={() => { const lastBlock = blocks[blocks.length - 1]; if (lastBlock && lastBlock.content === '') setActiveBlockId(lastBlock.id); else addBlock(lastBlock?.id || uid()); }} />}
                    </div>
                </div>
            </div>
        </div>
    );
};