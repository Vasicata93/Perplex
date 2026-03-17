import React, { useState, useEffect, useRef } from 'react';
import { ThinkingEvent } from '../agent/types';
import { ChevronDown, ChevronUp, Loader2, CheckCircle2 } from 'lucide-react';

interface ThinkingBarProps {
    events: ThinkingEvent[];
}

export const ThinkingBar: React.FC<ThinkingBarProps> = ({ events }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of list when expanded and new events come in
    useEffect(() => {
        if (isExpanded && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [events, isExpanded]);

    if (!events || events.length === 0) return null;

    const activeEvent = events.find(e => e.status === 'active') || events[events.length - 1];
    const isDone = events.every(e => e.status === 'done');

    return (
        <div className="w-full max-w-2xl mx-auto mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Main Bar */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg border transition-all duration-200 group ${isExpanded
                        ? 'bg-pplx-secondary border-pplx-border'
                        : 'bg-pplx-secondary/50 border-transparent hover:bg-pplx-secondary hover:border-pplx-border/50'
                    }`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`shrink-0 ${isDone ? 'text-green-500' : 'text-pplx-accent'}`}>
                        {isDone ? (
                            <CheckCircle2 size={18} className="animate-in zoom-in duration-300" />
                        ) : (
                            <Loader2 size={18} className="animate-spin" />
                        )}
                    </div>
                    <span className="text-sm font-medium text-pplx-text truncate">
                        {activeEvent ? activeEvent.label : 'Processing...'}
                    </span>
                </div>
                <div className="text-pplx-muted group-hover:text-pplx-text transition-colors">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </button>

            {/* Detailed List */}
            {isExpanded && (
                <div className="mt-2 pl-4 pr-2 py-2 space-y-3 bg-pplx-secondary/30 rounded-lg border border-pplx-border/50 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
                    {events.map((event, idx) => (
                        <div key={`${event.stepId}-${idx}`} className="flex items-start gap-3 text-sm">
                            <div className="mt-1 shrink-0">
                                {event.status === 'done' ? (
                                    <div className="w-2 h-2 rounded-full bg-green-500/80 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                ) : (
                                    <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
                                )}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className={`font-medium ${event.status === 'active' ? 'text-pplx-text' : 'text-pplx-muted'}`}>
                                    {event.label}
                                </span>
                                {event.detail && (
                                    <span className="text-xs text-pplx-muted/70 mt-0.5 font-mono break-all opacity-80">
                                        {event.detail}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>
            )}
        </div>
    );
};