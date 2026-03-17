
import React, { useState, useEffect, useRef } from 'react';
import {
    Plus, FileText, X, ArrowUpRight, AtSign,
    MoreHorizontal, Edit3, MousePointerClick, CalendarDays,
    ChevronLeft, ChevronRight, BarChart3,
    ListOrdered, Sigma
} from 'lucide-react';
import { Note } from '../types';

// --- Types needed for blocks ---
export type BlockType =
    | 'text' | 'h1' | 'h2' | 'h3' | 'bullet' | 'number' | 'todo' | 'quote' | 'code' | 'divider'
    | 'image' | 'video' | 'audio' | 'file' | 'newpage'
    | 'table' | 'calendar'
    | 'chart_bar_v' | 'chart_bar_h' | 'chart_line' | 'chart_donut'
    | 'toc' | 'button' | 'block_synced' | 'equation'
    | 'mention_person' | 'mention_page' | 'widget';

export interface Block {
    id: string;
    type: BlockType;
    content: string;
    metadata?: {
        name?: string;
        mimeType?: string;
        pageId?: string;
        title?: string;
    };
    checked?: boolean;
}

// --- UTILS ---

export const AutoResizeTextarea = ({
    value, onChange, onEnter, onBackspace, onPaste, className, placeholder, autoFocus, onFocus, readOnly = false
}: {
    value: string, onChange: (val: string) => void, onEnter?: () => void, onBackspace?: () => void,
    onPaste?: (e: React.ClipboardEvent) => void, className: string, placeholder?: string,
    autoFocus?: boolean, onFocus?: () => void, readOnly?: boolean
}) => {
    const ref = useRef<HTMLTextAreaElement>(null);
    const previousWidth = useRef(0);

    const adjustHeight = () => {
        if (ref.current) {
            ref.current.style.height = 'auto';
            ref.current.style.height = ref.current.scrollHeight + 'px';
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [value]);

    useEffect(() => {
        const textarea = ref.current;
        if (!textarea) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width !== previousWidth.current) {
                    previousWidth.current = entry.contentRect.width;
                    adjustHeight();
                }
            }
        });

        observer.observe(textarea);

        // Initial adjustment
        adjustHeight();

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (autoFocus && ref.current) ref.current.focus();
    }, [autoFocus]);

    return (
        <textarea
            ref={ref}
            value={value}
            onChange={(e) => !readOnly && onChange(e.target.value)}
            onKeyDown={(e) => {
                if (readOnly) return;
                if (e.key === 'Enter' && !e.shiftKey && onEnter) {
                    e.preventDefault();
                    onEnter();
                }
                if (e.key === 'Backspace' && value === '' && onBackspace) {
                    onBackspace();
                }
            }}
            onPaste={onPaste}
            onFocus={onFocus}
            rows={1}
            placeholder={readOnly ? '' : placeholder}
            readOnly={readOnly}
            className={`w-full bg-transparent outline-none resize-none overflow-hidden ${className} ${readOnly ? 'cursor-default' : ''}`}
        />
    );
};

// --- COMPONENTS ---

export const MentionPageBlock = ({ content, metadata, notes, onUpdate, onNavigate, readOnly }: { content: string, metadata?: any, notes: Note[], onUpdate: (data: any) => void, onNavigate: (id: string) => void, readOnly?: boolean }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [search, setSearch] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredNotes = notes.filter(n => n.title.toLowerCase().includes(search.toLowerCase()));

    const handleSelect = (note: Note) => {
        onUpdate({
            content: note.title || 'Untitled',
            metadata: { ...metadata, pageId: note.id }
        });
        setIsMenuOpen(false);
    };

    if (!metadata?.pageId && !readOnly) {
        return (
            <div className="relative inline-block my-1">
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="inline-flex items-center gap-1 bg-pplx-secondary text-pplx-muted px-2 py-0.5 rounded text-sm hover:bg-pplx-hover cursor-pointer border border-dashed border-pplx-border hover:text-pplx-text"
                >
                    <ArrowUpRight size={12} /> Select a Page
                </button>

                {isMenuOpen && (
                    <div ref={menuRef} className="absolute top-full left-0 mt-1 w-64 bg-pplx-card border border-pplx-border rounded-lg shadow-xl z-50 p-2 max-h-60 overflow-y-auto">
                        <input
                            autoFocus
                            className="bg-transparent text-xs text-pplx-text outline-none w-full placeholder-gray-500 mb-2 border-b border-pplx-border/50 pb-1"
                            placeholder="Search pages..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {filteredNotes.map(note => (
                            <button
                                key={note.id}
                                onClick={() => handleSelect(note)}
                                className="w-full text-left px-2 py-1.5 text-xs text-pplx-text hover:bg-pplx-hover rounded flex items-center gap-2"
                            >
                                <span>{note.emoji || '📄'}</span>
                                <span className="truncate">{note.title || 'Untitled'}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="my-1 inline-flex items-center gap-1 bg-pplx-secondary text-pplx-text px-1.5 py-0.5 rounded text-sm hover:bg-pplx-hover border border-transparent hover:border-pplx-border group cursor-pointer">
            <div onClick={() => metadata?.pageId && onNavigate(metadata.pageId)} className="flex items-center gap-1">
                <FileText size={12} className="text-pplx-accent" />
                <span className="underline decoration-transparent hover:decoration-pplx-text underline-offset-2 transition-all">
                    {content || "Untitled Page"}
                </span>
            </div>
            {!readOnly && (
                <button
                    onClick={() => onUpdate({ metadata: { ...metadata, pageId: undefined } })}
                    className="w-0 overflow-hidden group-hover:w-auto pl-1 text-pplx-muted hover:text-red-400 transition-all"
                >
                    <X size={12} />
                </button>
            )}
        </div>
    );
};

export const MentionPersonBlock = ({ content, onChange, readOnly }: { content: string, onChange: (val: string) => void, readOnly?: boolean }) => {
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) inputRef.current.focus();
    }, [isEditing]);

    if (isEditing && !readOnly) {
        return (
            <div className="my-1 inline-flex items-center gap-1 bg-pplx-secondary text-pplx-text px-1.5 py-0.5 rounded text-sm border border-pplx-accent">
                <AtSign size={12} className="text-pplx-accent" />
                <input
                    ref={inputRef}
                    value={content}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={() => setIsEditing(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
                    className="bg-transparent border-none outline-none text-sm w-24 p-0"
                    placeholder="Name"
                />
            </div>
        );
    }

    return (
        <button
            onClick={() => !readOnly && setIsEditing(true)}
            className="my-1 inline-flex items-center gap-1 bg-pplx-secondary text-pplx-text px-1.5 py-0.5 rounded text-sm hover:bg-pplx-hover cursor-pointer border border-transparent hover:border-pplx-border transition-colors"
        >
            <AtSign size={12} className="text-pplx-accent" />
            <span>{content || "Person"}</span>
        </button>
    );
};

export const NewPageBlock = ({ content, metadata, onNavigate, notes }: { content: string, metadata?: any, onNavigate: (id: string) => void, notes?: Note[] }) => {
    const linkedNote = notes?.find(n => n.id === metadata?.pageId);
    const displayTitle = linkedNote?.title || content || "Untitled";
    const displayEmoji = linkedNote?.emoji || '📄';

    return (
        <div
            onClick={() => metadata?.pageId && onNavigate(metadata.pageId)}
            className="my-1 flex items-center gap-2 px-2 py-1.5 hover:bg-pplx-hover rounded-lg cursor-pointer transition-colors group/page w-max max-w-full"
        >
            <span className="text-lg leading-none">{displayEmoji}</span>
            <span className="text-pplx-text font-medium border-b border-transparent group-hover/page:border-pplx-muted transition-colors truncate">
                {displayTitle}
            </span>
        </div>
    );
};

export const TableBlock = ({ content, onChange, readOnly }: { content: string, onChange: (val: string) => void, readOnly?: boolean }) => {
    let data: string[][] = [['Header 1', 'Header 2'], ['Cell 1', 'Cell 2']];
    try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && Array.isArray(parsed[0])) data = parsed;
    } catch (e) { /* ignore */ }

    const updateCell = (r: number, c: number, val: string) => {
        const newData = [...data];
        newData[r][c] = val;
        onChange(JSON.stringify(newData));
    };

    const addRow = () => onChange(JSON.stringify([...data, new Array(data[0].length).fill('')]));
    const addCol = () => onChange(JSON.stringify(data.map(row => [...row, ''])));

    return (
        <div className="my-4 overflow-x-auto">
            <div className="inline-block min-w-full border border-pplx-border rounded-lg bg-pplx-card">
                <table className="min-w-full border-collapse">
                    <thead>
                        <tr>
                            {data[0].map((cell, i) => (
                                <th key={i} className="border-b border-r border-pplx-border last:border-r-0 bg-pplx-secondary/50 p-0 min-w-[120px]">
                                    <input
                                        className="w-full bg-transparent p-2 text-sm font-semibold text-pplx-text outline-none placeholder-gray-500"
                                        value={cell}
                                        onChange={(e) => !readOnly && updateCell(0, i, e.target.value)}
                                        readOnly={readOnly}
                                    />
                                </th>
                            ))}
                            {!readOnly && (
                                <th className="w-8 border-b border-pplx-border bg-pplx-secondary/50 p-0 text-center">
                                    <button onClick={addCol} className="w-full h-full flex items-center justify-center hover:bg-pplx-hover text-pplx-muted hover:text-pplx-text"><Plus size={14} /></button>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {data.slice(1).map((row, rIdx) => (
                            <tr key={rIdx}>
                                {row.map((cell, cIdx) => (
                                    <td key={cIdx} className="border-b border-r border-pplx-border last:border-r-0 p-0 min-w-[120px]">
                                        <input
                                            className="w-full bg-transparent p-2 text-sm text-pplx-text outline-none"
                                            value={cell}
                                            onChange={(e) => !readOnly && updateCell(rIdx + 1, cIdx, e.target.value)}
                                            readOnly={readOnly}
                                        />
                                    </td>
                                ))}
                                {!readOnly && <td className="border-b border-pplx-border bg-transparent"></td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!readOnly && (
                    <button onClick={addRow} className="w-full p-2 text-xs text-pplx-muted hover:bg-pplx-hover flex items-center gap-2 border-t border-transparent hover:border-pplx-border">
                        <Plus size={14} /> New Row
                    </button>
                )}
            </div>
        </div>
    );
};

export const CalendarBlock = ({ content, onChange, readOnly }: { content: string, onChange: (val: string) => void, readOnly?: boolean }) => {
    const now = new Date();
    let state = { month: now.getMonth(), year: now.getFullYear(), selected: [] as string[] };

    try {
        const parsed = JSON.parse(content);
        if (parsed && typeof parsed.month === 'number') state = { ...state, ...parsed };
    } catch (e) { /* init */ }

    const saveState = (newState: any) => onChange(JSON.stringify({ ...state, ...newState }));
    const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
    const firstDay = new Date(state.year, state.month, 1).getDay();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const toggleDate = (day: number) => {
        if (readOnly) return;
        const dateStr = new Date(state.year, state.month, day).toISOString().split('T')[0];
        const newSelected = state.selected.includes(dateStr)
            ? state.selected.filter(d => d !== dateStr)
            : [...state.selected, dateStr];
        saveState({ selected: newSelected });
    };

    return (
        <div className="my-6 border border-pplx-border rounded-xl overflow-hidden bg-pplx-card shadow-sm max-w-md">
            <div className="flex items-center justify-between p-3 bg-pplx-secondary/50 border-b border-pplx-border">
                <div className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-pplx-accent" />
                    <span className="font-semibold text-sm text-pplx-text">{monthNames[state.month]} {state.year}</span>
                </div>
                {!readOnly && (
                    <div className="flex items-center gap-1">
                        <button onClick={() => saveState(state.month === 0 ? { month: 11, year: state.year - 1 } : { month: state.month - 1 })} className="p-1 hover:bg-pplx-hover rounded text-pplx-muted hover:text-pplx-text"><ChevronLeft size={16} /></button>
                        <button onClick={() => saveState(state.month === 11 ? { month: 0, year: state.year + 1 } : { month: state.month + 1 })} className="p-1 hover:bg-pplx-hover rounded text-pplx-muted hover:text-pplx-text"><ChevronRight size={16} /></button>
                    </div>
                )}
            </div>
            <div className="p-4">
                <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="text-[10px] font-bold text-pplx-muted uppercase tracking-wider">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dateStr = new Date(state.year, state.month, day).toISOString().split('T')[0];
                        const isSelected = state.selected.includes(dateStr);
                        const isToday = new Date().toISOString().split('T')[0] === dateStr;
                        return (
                            <button
                                key={day}
                                onClick={() => toggleDate(day)}
                                disabled={readOnly}
                                className={`h-9 w-9 mx-auto rounded-full flex items-center justify-center text-sm transition-all duration-200
                                    ${isSelected ? 'bg-pplx-accent text-black font-bold shadow-sm scale-105' : 'hover:bg-pplx-hover text-pplx-text'}
                                    ${isToday && !isSelected ? 'border border-pplx-accent text-pplx-accent' : ''}`}
                            >
                                {day}
                            </button>
                        );
                    })}
                </div>
            </div>
            <div className="px-4 pb-3 text-[10px] text-pplx-muted text-center border-t border-pplx-border/50 pt-2">{state.selected.length} event{state.selected.length !== 1 ? 's' : ''} marked</div>
        </div>
    );
};

export const ChartBlock = ({ type, content, onChange, readOnly }: { type: 'chart_bar_v' | 'chart_bar_h' | 'chart_line' | 'chart_donut', content: string, onChange: (val: string) => void, readOnly?: boolean }) => {
    const [isEditing, setIsEditing] = useState(false);

    const parseData = (str: string) => str.split('\n').map(line => {
        const [label, val] = line.split(',');
        return { label: label || 'Item', value: parseFloat(val) || 0 };
    }).filter(d => d.label);

    let data = parseData(content);
    if (data.length === 0) data = [{ label: 'Jan', value: 10 }, { label: 'Feb', value: 25 }];

    const maxVal = Math.max(...data.map(d => d.value)) * 1.1 || 100;
    const colors = ['#20B8CD', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];

    return (
        <div className="my-6 p-6 border border-pplx-border rounded-2xl bg-pplx-card shadow-sm group/chart relative overflow-hidden">
            {!readOnly && (
                <div className="absolute top-3 right-3 z-20 opacity-0 group-hover/chart:opacity-100 transition-opacity">
                    <button onClick={() => setIsEditing(!isEditing)} className="p-1.5 bg-pplx-secondary/80 backdrop-blur hover:bg-pplx-hover rounded-lg border border-pplx-border text-xs flex items-center gap-1.5 font-medium shadow-sm">
                        <Edit3 size={12} /> {isEditing ? 'Done' : 'Edit Data'}
                    </button>
                </div>
            )}
            {isEditing ? (
                <div className="p-2">
                    <div className="text-xs text-pplx-muted mb-2 font-mono uppercase tracking-wide">CSV Data (Label,Value)</div>
                    <textarea className="w-full h-32 bg-pplx-input border border-pplx-border rounded-lg p-3 text-sm font-mono outline-none resize-none" value={content} onChange={(e) => onChange(e.target.value)} />
                </div>
            ) : (
                <div className="h-64 w-full flex items-center justify-center relative">
                    {/* Visualizations simplified for brevity but functional */}
                    {type === 'chart_bar_v' && (
                        <div className="flex items-end gap-3 h-full w-full pl-8 pb-6 pr-2 pt-4 relative z-10">
                            {data.map((d, i) => (
                                <div key={i} className="flex-1 flex flex-col justify-end items-center h-full group/bar relative">
                                    <div className="w-full rounded-t-lg transition-all min-w-[12px] hover:brightness-110 shadow-sm" style={{ height: `${(d.value / maxVal) * 100}%`, backgroundColor: colors[i % colors.length] }} />
                                    <span className="text-[10px] font-medium text-pplx-muted mt-3 truncate w-full text-center absolute -bottom-6">{d.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {(type === 'chart_bar_h' || type === 'chart_line' || type === 'chart_donut') && (
                        <div className="flex flex-col items-center justify-center text-pplx-muted">
                            <BarChart3 size={32} />
                            <span className="text-xs mt-2">Visualization enabled</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const TOCBlock = ({ allBlocks }: { allBlocks: Block[] }) => {
    const headings = allBlocks.filter(b => ['h1', 'h2', 'h3'].includes(b.type) && b.content.trim());
    const scrollToBlock = (id: string) => document.querySelector(`[data-block-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (headings.length === 0) return <div className="my-4 p-4 bg-pplx-secondary/20 rounded-lg border border-pplx-border border-dashed text-pplx-muted text-sm text-center">Add headings (H1, H2, H3) to see them here.</div>;

    return (
        <div className="my-4 p-4 bg-pplx-secondary/10 rounded-lg border border-pplx-border">
            <div className="text-xs font-bold text-pplx-muted uppercase mb-3 tracking-wider flex items-center gap-2"><ListOrdered size={14} /> Table of Contents</div>
            <div className="space-y-1">
                {headings.map(h => (
                    <button key={h.id} onClick={() => scrollToBlock(h.id)} className={`block w-full text-left text-sm hover:underline hover:text-pplx-accent transition-colors py-1 ${h.type === 'h1' ? 'font-medium text-pplx-text' : h.type === 'h2' ? 'text-pplx-text/80 pl-4' : 'text-pplx-muted pl-8'}`}>{h.content}</button>
                ))}
            </div>
        </div>
    );
};

export const ButtonBlock = ({ content, onChange, onAction, readOnly }: { content: string, onChange: (val: string) => void, onAction: () => void, readOnly?: boolean }) => {
    const [isEditing, setIsEditing] = useState(false);
    const handleClick = () => { if (!readOnly) onAction(); };

    return (
        <div className="my-4 flex items-center gap-2 group/btn">
            <button onClick={handleClick} className="px-6 py-2.5 rounded-lg shadow-sm transition-all duration-200 text-sm font-semibold flex items-center gap-2 bg-pplx-text text-pplx-primary hover:bg-pplx-text/90">
                <MousePointerClick size={16} />
                {isEditing ? <input className="bg-transparent border-none outline-none w-24 text-center" value={content} onChange={(e) => onChange(e.target.value)} onBlur={() => setIsEditing(false)} autoFocus /> : <span>{content || "Click Me"}</span>}
            </button>
            {!readOnly && <button onClick={() => setIsEditing(true)} className="p-1.5 text-pplx-muted hover:text-pplx-text opacity-0 group-hover/btn:opacity-100 transition-opacity"><Edit3 size={14} /></button>}
        </div>
    );
};

export const SyncedBlock = ({ content, onChange, readOnly }: { content: string, onChange: (val: string) => void, readOnly?: boolean }) => (
    <div className="my-4 p-0.5 border-2 border-orange-400/50 rounded-lg relative group/sync">
        <div className="absolute -top-3 left-3 bg-pplx-primary px-2 text-[10px] text-orange-400 flex items-center gap-1 font-medium z-10"><div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" /> Synced content</div>
        <div className="bg-pplx-secondary/10 p-4 rounded-md">
            <AutoResizeTextarea value={content} onChange={onChange} className="text-base text-pplx-text leading-relaxed w-full" placeholder="Type content to sync..." readOnly={readOnly} />
        </div>
        {!readOnly && <div className="absolute top-2 right-2 opacity-0 group-hover/sync:opacity-100 transition-opacity"><button className="p-1 hover:bg-pplx-hover rounded text-pplx-muted hover:text-pplx-text"><MoreHorizontal size={14} /></button></div>}
    </div>
);

export const EquationBlock = ({ content, onChange, readOnly }: { content: string, onChange: (val: string) => void, readOnly?: boolean }) => (
    <div className="my-2 p-3 bg-pplx-card border border-pplx-border rounded flex items-center font-mono text-lg text-pplx-text group/eq relative">
        <Sigma size={18} className="mr-3 text-pplx-muted shrink-0" />
        <AutoResizeTextarea value={content} onChange={onChange} className="text-center bg-transparent w-full outline-none" placeholder="E = mc^2" readOnly={readOnly} />
    </div>
);

// ── WidgetBlock ─────────────────────────────────────────────────────
// Randează cod HTML/SVG/JS într-un iframe sandbox, exact ca în chat.
// Reutilizează WidgetRenderer dacă există deja, altfel inline.

export const WidgetBlock: React.FC<{
    content: string;
    metadata?: { title?: string };
    readOnly?: boolean;
}> = ({ content, metadata }) => {
    const [height, setHeight] = React.useState(300);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [isInteracting, setIsInteracting] = React.useState(false);

    // Detectăm dark mode din clasa pe <html>
    const isDark = document.documentElement.classList.contains('dark');

    const cssVars = isDark ? `
        --bg-primary:#191919; --bg-secondary:#262626; --bg-hover:#2d2d2d;
        --border-color:#3a3a3a; --text-primary:#e8e6e0; --text-muted:#8a8880;
        --accent:#20B8CD;
    ` : `
        --bg-primary:#F9F9F9; --bg-secondary:#EBEBE9; --bg-hover:#E0E0DE;
        --border-color:#D6D6D4; --text-primary:#2D2B26; --text-muted:#6E6D6A;
        --accent:#20B8CD;
    `;

    const buildHtml = (code: string) => `<!DOCTYPE html>
<html class="${isDark ? 'dark' : ''}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root {
    ${cssVars}
    --color-background-primary:var(--bg-primary);
    --color-background-secondary:var(--bg-secondary);
    --color-text-primary:var(--text-primary);
    --color-text-secondary:var(--text-muted);
    --color-border-tertiary:var(--border-color);
    --color-border-secondary:var(--border-color);
    --color-background-info:rgba(32,184,205,0.12);
    --color-text-info:var(--accent);
    --font-sans:Inter,system-ui,sans-serif;
    --font-mono:'JetBrains Mono',monospace;
    --border-radius-md:8px; --border-radius-lg:12px;
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;font-size:14px;
     color:var(--text-primary);background:transparent;overflow-x:hidden;padding:8px}
.t  {font:400 14px/1.4 Inter,sans-serif;fill:var(--text-primary)}
.ts {font:400 12px/1.4 Inter,sans-serif;fill:var(--text-muted)}
.th {font:500 14px/1.4 Inter,sans-serif;fill:var(--text-primary)}
.box{fill:var(--bg-secondary);stroke:var(--border-color)}
.arr{stroke:var(--text-muted);stroke-width:1.5;fill:none}
.leader{stroke:var(--text-muted);stroke-width:0.5;fill:none;stroke-dasharray:4 3}
.node{cursor:pointer}.node:hover{opacity:0.85}
.c-blue   rect,.c-blue   circle{fill:#E6F1FB;stroke:#185FA5}
.c-blue   .t,.c-blue .th{fill:#0C447C}.c-blue .ts{fill:#185FA5}
.c-teal   rect,.c-teal   circle{fill:#E1F5EE;stroke:#0F6E56}
.c-teal   .t,.c-teal .th{fill:#085041}.c-teal .ts{fill:#0F6E56}
.c-purple rect,.c-purple circle{fill:#EEEDFE;stroke:#534AB7}
.c-purple .t,.c-purple .th{fill:#3C3489}.c-purple .ts{fill:#534AB7}
.c-coral  rect,.c-coral  circle{fill:#FAECE7;stroke:#993C1D}
.c-coral  .t,.c-coral .th{fill:#712B13}.c-coral .ts{fill:#993C1D}
.c-amber  rect,.c-amber  circle{fill:#FAEEDA;stroke:#854F0B}
.c-amber  .t,.c-amber .th{fill:#633806}.c-amber .ts{fill:#854F0B}
.c-green  rect,.c-green  circle{fill:#EAF3DE;stroke:#3B6D11}
.c-green  .t,.c-green .th{fill:#27500A}.c-green .ts{fill:#3B6D11}
.c-gray   rect,.c-gray   circle{fill:#F1EFE8;stroke:#5F5E5A}
.c-gray   .t,.c-gray .th{fill:#444441}.c-gray .ts{fill:#5F5E5A}
.dark .c-blue   rect,.dark .c-blue   circle{fill:#0C447C;stroke:#85B7EB}
.dark .c-blue   .t,.dark .c-blue .th{fill:#B5D4F4}.dark .c-blue .ts{fill:#85B7EB}
.dark .c-teal   rect,.dark .c-teal   circle{fill:#085041;stroke:#5DCAA5}
.dark .c-teal   .t,.dark .c-teal .th{fill:#9FE1CB}.dark .c-teal .ts{fill:#5DCAA5}
.dark .c-purple rect,.dark .c-purple circle{fill:#3C3489;stroke:#AFA9EC}
.dark .c-purple .t,.dark .c-purple .th{fill:#CECBF6}.dark .c-purple .ts{fill:#AFA9EC}
.dark .c-coral  rect,.dark .c-coral  circle{fill:#712B13;stroke:#F0997B}
.dark .c-coral  .t,.dark .c-coral .th{fill:#F5C4B3}.dark .c-coral .ts{fill:#F0997B}
.dark .c-amber  rect,.dark .c-amber  circle{fill:#633806;stroke:#EF9F27}
.dark .c-amber  .t,.dark .c-amber .th{fill:#FAC775}.dark .c-amber .ts{fill:#EF9F27}
.dark .c-green  rect,.dark .c-green  circle{fill:#27500A;stroke:#97C459}
.dark .c-green  .t,.dark .c-green .th{fill:#C0DD97}.dark .c-green .ts{fill:#97C459}
.dark .c-gray   rect,.dark .c-gray   circle{fill:#444441;stroke:#B4B2A9}
.dark .c-gray   .t,.dark .c-gray .th{fill:#D3D1C7}.dark .c-gray .ts{fill:#B4B2A9}
input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;
    background:var(--border-color);outline:none;width:100%}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;
    border-radius:50%;background:var(--accent);cursor:pointer}
button{font-family:inherit;cursor:pointer;border:0.5px solid var(--border-color);
    border-radius:8px;background:transparent;color:var(--text-primary);
    padding:6px 14px;font-size:13px;transition:background 0.15s}
button:hover{background:var(--bg-hover)}
</style>
</head>
<body>
${code}
<script>
function sendPrompt(text){window.parent.postMessage({type:'PERPLEX_SEND_PROMPT',text},'*')}
function reportHeight(){
    var h = document.documentElement.scrollHeight || document.body.scrollHeight;
    window.parent.postMessage({type:'PERPLEX_WIDGET_HEIGHT',height:h},'*');
}
window.addEventListener('load', function() {
    reportHeight();
    setTimeout(reportHeight, 500);
});
window.addEventListener('resize', reportHeight);
</script>
</body>
</html>`;

    // Listener pentru înălțime auto
    React.useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data?.type === 'PERPLEX_WIDGET_HEIGHT') {
                setHeight(h => {
                    const newH = Math.max(80, e.data.height + 20);
                    return Math.abs(newH - h) > 5 ? newH : h;
                });
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    const html = buildHtml(content);
    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);

    React.useEffect(() => () => URL.revokeObjectURL(blobUrl), [blobUrl]);

    return (
        <div
            ref={containerRef}
            className="my-3 rounded-xl overflow-hidden"
            onMouseEnter={() => setIsInteracting(true)}
            onMouseLeave={() => setIsInteracting(false)}
            onTouchStart={() => setIsInteracting(true)}
            onTouchEnd={() => setTimeout(() => setIsInteracting(false), 300)}
        >
            {metadata?.title && (
                <div className="px-3 py-1.5 text-xs text-pplx-muted font-medium flex items-center gap-2 bg-pplx-secondary/5">
                    <span className="w-2 h-2 rounded-full bg-pplx-accent inline-block" />
                    {metadata.title}
                </div>
            )}
            <iframe
                src={blobUrl}
                sandbox="allow-scripts"
                style={{
                    width: '100%',
                    height: `${height}px`,
                    border: 'none',
                    display: 'block',
                    background: 'transparent',
                    pointerEvents: isInteracting ? 'auto' : 'none'
                }}
                title={metadata?.title || 'Widget'}
            />
        </div>
    );
};
