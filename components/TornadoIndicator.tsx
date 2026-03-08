
import React, { useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

interface TornadoIndicatorProps {
    isThinking: boolean;
    reasoning?: string;
}

export const TornadoIndicator: React.FC<TornadoIndicatorProps> = ({ isThinking, reasoning }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Always render if thinking OR if we have reasoning to show
    if (!isThinking && !reasoning) return null;
    
    return (
        <div className="flex flex-col justify-center">
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 group cursor-pointer transition-all w-fit py-1 px-1 rounded-lg"
            >
                <span className={`text-[11px] font-bold uppercase tracking-wider ${isThinking ? 'text-pplx-accent animate-pulse' : 'text-pplx-muted group-hover:text-pplx-text'}`}>
                    {isThinking ? 'Thinking' : 'Thought Process'}
                </span>
                
                <ChevronDown 
                    size={12} 
                    className={`text-pplx-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
                />
            </button>

            {isExpanded && (
                <div className="mt-2 border-l-2 border-pplx-border animate-in fade-in slide-in-from-top-1 duration-300 w-full max-w-2xl">
                    <div className="bg-pplx-secondary/30 rounded-lg p-3 text-[11px] font-mono text-pplx-muted leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar ml-2">
                        {reasoning ? (
                            <div className="flex flex-col gap-1">
                                {reasoning.split('\n').map((step, i) => (
                                    <div key={i} className="flex gap-2">
                                        <span className="opacity-50 select-none">{i + 1}.</span>
                                        <span>{step}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <span className="flex items-center gap-2"><Loader2 size={10} className="animate-spin" /> Analyzing query...</span>
                                <span className="opacity-50">Planning search strategy...</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
