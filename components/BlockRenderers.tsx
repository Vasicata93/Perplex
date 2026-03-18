
import React, { useState, useEffect, useRef } from 'react';
import {
    Plus, FileText, X, ArrowUpRight, AtSign,
    MoreHorizontal, Edit3, MousePointerClick, CalendarDays,
    ChevronLeft, ChevronRight, BarChart3,
    ListOrdered, Sigma
} from 'lucide-react';
import { Note } from '../types';
import { buildWidgetHtml } from '../services/widgetHtmlBuilder';

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
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const parseData = (str: string) => str.split('\n').map(line => {
        const [label, val] = line.split(',');
        return { label: (label || 'Item').trim(), value: parseFloat(val) || 0 };
    }).filter(d => d.label);

    let data = parseData(content);
    if (data.length === 0) data = [{ label: 'Jan', value: 10 }, { label: 'Feb', value: 25 }, { label: 'Mar', value: 18 }];

    const COLORS = ['#20B8CD', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#F97316', '#14B8A6'];

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Citește culorile din CSS variables ale sistemului — se adaptează automat la dark/light mode
        const style = getComputedStyle(document.documentElement);
        const textColor = style.getPropertyValue('--text-primary').trim() || '#2D2B26';
        const mutedColor = style.getPropertyValue('--text-muted').trim() || '#6E6D6A';
        const borderColor = style.getPropertyValue('--border-color').trim() || '#D6D6D4';

        const dpr = window.devicePixelRatio || 1;
        const W = canvas.offsetWidth;
        const H = canvas.offsetHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, W, H);

        const maxVal = Math.max(...data.map(d => d.value)) * 1.15 || 100;

        if (type === 'chart_bar_v') {
            const padL = 40, padR = 16, padT = 16, padB = 40;
            const chartW = W - padL - padR;
            const chartH = H - padT - padB;
            const barW = Math.min((chartW / data.length) * 0.6, 60);
            const gap = chartW / data.length;

            // Grid lines
            const steps = 4;
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 0.5;
            ctx.setLineDash([3, 3]);
            for (let i = 0; i <= steps; i++) {
                const y = padT + (chartH / steps) * i;
                ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke();
                ctx.fillStyle = mutedColor;
                ctx.font = '10px Inter, system-ui, sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(String(Math.round(maxVal - (maxVal / steps) * i)), padL - 6, y + 3);
            }
            ctx.setLineDash([]);

            // Bars
            data.forEach((d, i) => {
                const x = padL + gap * i + gap / 2 - barW / 2;
                const barH = (d.value / maxVal) * chartH;
                const y = padT + chartH - barH;
                const color = COLORS[i % COLORS.length];
                const radius = Math.min(4, barW / 4);

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + barW - radius, y);
                ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
                ctx.lineTo(x + barW, y + barH);
                ctx.lineTo(x, y + barH);
                ctx.lineTo(x, y + radius);
                ctx.quadraticCurveTo(x, y, x + radius, y);
                ctx.closePath();
                ctx.fill();

                // Label
                ctx.fillStyle = mutedColor;
                ctx.font = '10px Inter, system-ui, sans-serif';
                ctx.textAlign = 'center';
                const label = d.label.length > 8 ? d.label.slice(0, 7) + '…' : d.label;
                ctx.fillText(label, x + barW / 2, padT + chartH + 16);
            });

        } else if (type === 'chart_bar_h') {
            const padL = 80, padR = 40, padT = 12, padB = 12;
            const chartW = W - padL - padR;
            const chartH = H - padT - padB;
            const barH = Math.min((chartH / data.length) * 0.6, 28);
            const gap = chartH / data.length;

            data.forEach((d, i) => {
                const y = padT + gap * i + gap / 2 - barH / 2;
                const barW = (d.value / maxVal) * chartW;
                const color = COLORS[i % COLORS.length];
                const radius = Math.min(4, barH / 4);

                // Label stânga
                ctx.fillStyle = mutedColor;
                ctx.font = '10px Inter, system-ui, sans-serif';
                ctx.textAlign = 'right';
                const label = d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label;
                ctx.fillText(label, padL - 8, y + barH / 2 + 3);

                // Bar
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(padL, y + radius);
                ctx.quadraticCurveTo(padL, y, padL + radius, y);
                ctx.lineTo(padL + barW - radius, y);
                ctx.quadraticCurveTo(padL + barW, y, padL + barW, y + radius);
                ctx.lineTo(padL + barW, y + barH - radius);
                ctx.quadraticCurveTo(padL + barW, y + barH, padL + barW - radius, y + barH);
                ctx.lineTo(padL + radius, y + barH);
                ctx.quadraticCurveTo(padL, y + barH, padL, y + barH - radius);
                ctx.closePath();
                ctx.fill();

                // Valoare dreapta
                ctx.fillStyle = mutedColor;
                ctx.textAlign = 'left';
                ctx.fillText(String(d.value), padL + barW + 6, y + barH / 2 + 3);
            });

        } else if (type === 'chart_line') {
            const padL = 44, padR = 16, padT = 16, padB = 40;
            const chartW = W - padL - padR;
            const chartH = H - padT - padB;
            const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW;

            // Grid
            const steps = 4;
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 0.5;
            ctx.setLineDash([3, 3]);
            for (let i = 0; i <= steps; i++) {
                const y = padT + (chartH / steps) * i;
                ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke();
                ctx.fillStyle = mutedColor;
                ctx.font = '10px Inter, system-ui, sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText(String(Math.round(maxVal - (maxVal / steps) * i)), padL - 6, y + 3);
            }
            ctx.setLineDash([]);

            const pts = data.map((d, i) => ({
                x: padL + i * stepX,
                y: padT + chartH - (d.value / maxVal) * chartH
            }));

            // Gradient fill sub linie
            const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
            grad.addColorStop(0, 'rgba(32,184,205,0.25)');
            grad.addColorStop(1, 'rgba(32,184,205,0)');
            ctx.beginPath();
            ctx.moveTo(pts[0].x, padT + chartH);
            pts.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(pts[pts.length - 1].x, padT + chartH);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();

            // Linie
            ctx.beginPath();
            ctx.strokeStyle = '#20B8CD';
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            ctx.stroke();

            // Puncte + labels
            pts.forEach((p, i) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
                ctx.fillStyle = '#20B8CD';
                ctx.fill();
                ctx.strokeStyle = 'rgba(32,184,205,0.3)';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.fillStyle = mutedColor;
                ctx.font = '10px Inter, system-ui, sans-serif';
                ctx.textAlign = 'center';
                const label = data[i].label.length > 8 ? data[i].label.slice(0, 7) + '…' : data[i].label;
                ctx.fillText(label, p.x, padT + chartH + 16);
            });

        } else if (type === 'chart_donut') {
            const cx = W * 0.38, cy = H / 2;
            const outerR = Math.min(cx, cy) * 0.82;
            const innerR = outerR * 0.55;
            const total = data.reduce((s, d) => s + d.value, 0) || 1;

            let startAngle = -Math.PI / 2;
            data.forEach((d, i) => {
                const slice = (d.value / total) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, outerR, startAngle, startAngle + slice);
                ctx.closePath();
                ctx.fillStyle = COLORS[i % COLORS.length];
                ctx.fill();
                startAngle += slice;
            });

            // Gaura din mijloc (donut)
            ctx.beginPath();
            ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
            ctx.fillStyle = style.getPropertyValue('--bg-primary').trim() || 'transparent';
            ctx.fill();

            // Total în centru
            ctx.fillStyle = textColor;
            ctx.font = `bold 16px Inter, system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(String(total), cx, cy + 3);
            ctx.fillStyle = mutedColor;
            ctx.font = '10px Inter, system-ui, sans-serif';
            ctx.fillText('total', cx, cy + 16);

            // Legendă dreapta
            const legendX = W * 0.72;
            const legendStartY = cy - (data.length * 20) / 2;
            data.forEach((d, i) => {
                const y = legendStartY + i * 22;
                ctx.fillStyle = COLORS[i % COLORS.length];
                ctx.beginPath();
                ctx.roundRect(legendX, y, 10, 10, 3);
                ctx.fill();

                ctx.fillStyle = mutedColor;
                ctx.font = '11px Inter, system-ui, sans-serif';
                ctx.textAlign = 'left';
                const label = d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label;
                ctx.fillText(`${label}  ${d.value}`, legendX + 16, y + 9);
            });
        }

    }, [type, content, isEditing]);

    return (
        <div className="my-6 bg-transparent group/chart relative">
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
                <canvas
                    ref={canvasRef}
                    style={{ width: '100%', height: type === 'chart_donut' ? '200px' : '240px', display: 'block' }}
                />
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
    // Detect dark mode for theme sync
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    setIsDark(document.documentElement.classList.contains('dark'));
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true });
        setIsDark(document.documentElement.classList.contains('dark'));
        return () => observer.disconnect();
    }, []);

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

    const blobUrl = React.useMemo(() => {
        const html = buildWidgetHtml(content, isDark);
        const blob = new Blob([html], { type: 'text/html' });
        return URL.createObjectURL(blob);
    }, [content, isDark]);

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
                <div className="px-3 py-1.5 text-xs text-pplx-muted font-medium flex items-center gap-2">
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
