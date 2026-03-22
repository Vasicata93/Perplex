import React, { useRef, useEffect, useState } from 'react';
import { Message, Role, Attachment, Note, FocusMode } from '../types';
import { InputArea } from './InputArea';
import { MessageRenderer } from './MessageRenderer';
import { PerplexityLogo } from '../constants';
import { User, BookOpen, Globe, Copy, Check, RefreshCw, Share2, Volume2, FileText, Pencil, ChevronDown, Loader2, BrainCircuit } from 'lucide-react';
import { ThinkingEvent } from '../src/agent/types';

interface ChatInterfaceProps {
  messages: Message[];
  isThinking: boolean;
  onSendMessage: (text: string, focusModes: FocusMode[], attachments: Attachment[]) => void;
  onStopGeneration: () => void;
  onRegenerate: (messageId: string) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onCopyText: (id: string, text: string) => void;
  onShare: (text: string) => void;
  onTTS: (text: string) => void;
  isPlayingAudio: boolean;
  copiedId: string | null;
  isSidePanel?: boolean;
  activeNote?: Note;
  thinkingEvents?: ThinkingEvent[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isThinking,
  onSendMessage,
  onStopGeneration,
  onRegenerate,
  onEditMessage,
  onCopyText,
  onShare,
  onTTS,
  isPlayingAudio,
  copiedId,
  isSidePanel = false,
  activeNote,
  thinkingEvents = []
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedThinkingIds, setExpandedThinkingIds] = useState<Set<string>>(new Set());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const handleEditSubmit = (id: string) => {
    onEditMessage(id, editValue);
    setEditingMessageId(null);
  };

  const toggleThinking = (id: string) => {
    setExpandedThinkingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Helper to get the status label for the header
  const getThinkingLabel = (msg: Message, events: ThinkingEvent[]) => {
    if (msg.isThinking) {
      // If we have active events, show the last one
      if (events && events.length > 0) {
        return events[events.length - 1].label;
      }
      if (msg.reasoning) return "Analizez...";
      return "Gândesc...";
    }
    // Completed state
    return "Proces de gândire";
  };

  const filteredMessages = messages.filter(m => m.role !== Role.SYSTEM);

  return (
    <div className={`flex flex-col h-full relative overflow-hidden ${isSidePanel ? 'bg-pplx-card' : 'bg-pplx-primary'}`}>
      {/* Top Gradient Fade */}
      <div className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-pplx-card to-transparent z-10 pointer-events-none ${isSidePanel ? 'h-6 opacity-80' : 'h-12'}`} />

      {/* Messages Area */}
      <div className={`flex-1 overflow-y-auto custom-scrollbar p-4 space-y-8 relative ${isSidePanel ? 'pt-2' : 'pt-12'} pb-10`}>
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-pplx-muted opacity-50">
            <PerplexityLogo className="w-12 h-12 mb-4" />
            <p className="text-sm font-serif italic">How can I help with this page?</p>
          </div>
        ) : (
          filteredMessages.map((msg, idx) => {
            const isLastMessage = idx === filteredMessages.length - 1;
            const activeEvents = (isLastMessage && msg.isThinking) ? thinkingEvents : [];

            return (
              <div key={msg.id} className="flex flex-col space-y-3 animate-fadeIn">
                <div className={`flex ${msg.role === Role.USER ? 'justify-end' : 'justify-start flex-col'} w-full group items-start`}>

                  {/* Model Header */}
                  {msg.role === Role.MODEL && (
                    <div className="flex flex-col gap-2 mb-2 w-full">
                      <div className="flex items-center gap-3 select-none">
                        <div className="w-8 h-8 rounded-full bg-pplx-accent/10 flex items-center justify-center border border-transparent shrink-0">
                          <PerplexityLogo className={`w-5 h-5 text-pplx-accent ${msg.isThinking ? 'animate-spin-y' : ''}`} />
                        </div>

                        {/* Unified Thinking Indicator (Manus/Claude Style) */}
                        {(msg.isThinking || msg.reasoning) && (
                          <div className="flex flex-col items-start min-w-0 flex-1">
                            <button
                              onClick={() => toggleThinking(msg.id)}
                              className="flex items-center gap-2 group cursor-pointer transition-all select-none"
                            >
                              <span className={`text-xs font-semibold truncate ${msg.isThinking ? 'text-pplx-accent animate-pulse' : 'text-pplx-muted group-hover:text-pplx-text'}`}>
                                {getThinkingLabel(msg, activeEvents)}
                              </span>

                              <ChevronDown
                                size={12}
                                className={`text-pplx-muted transition-transform duration-300 ${expandedThinkingIds.has(msg.id) ? 'rotate-180' : ''}`}
                              />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Detailed Thinking Process Area (Seamless) */}
                      {expandedThinkingIds.has(msg.id) && (
                        <div className="ml-11 mb-2 animate-in slide-in-from-top-2 duration-200 fade-in">
                          <div className="relative pl-4 border-l-2 border-pplx-border/40 py-1 space-y-3">

                            {/* Live Events List */}
                            {activeEvents && activeEvents.length > 0 && (
                              <div className="space-y-2 mb-3">
                                {activeEvents.map((event, idx) => (
                                  <div key={`${event.stepId}-${idx}`} className="flex items-start gap-3 text-xs">
                                    <div className="mt-0.5 shrink-0">
                                      {event.status === 'done' ? (
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500/80 shadow-[0_0_5px_rgba(34,197,94,0.4)]" />
                                      ) : (
                                        <Loader2 size={10} className="text-pplx-accent animate-spin" />
                                      )}
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                      <span className={`${event.status === 'active' ? 'text-pplx-text font-medium' : 'text-pplx-muted'}`}>
                                        {event.label}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Reasoning Text (Merged) */}
                            {msg.reasoning && (
                              <div className="bg-pplx-secondary/30 rounded-lg p-3 text-xs text-pplx-muted/90 font-mono leading-relaxed whitespace-pre-wrap border border-pplx-border/30">
                                <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-wider opacity-60">
                                  <BrainCircuit size={12} /> Clarificare Internă
                                </div>
                                {msg.reasoning.trim()}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content Container */}
                  <div className={`flex flex-col min-w-0 ${msg.role === Role.USER ? 'items-end max-w-[90%]' : 'items-start w-full'} group`}>

                    {/* User Label */}
                    {msg.role === Role.USER && (
                      <div className="flex items-center gap-2 mb-2 mr-1 justify-end w-full group">
                        {/* User Actions (Visible on hover) */}
                        <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mr-2 ${editingMessageId === msg.id ? 'opacity-100' : ''}`}>
                          <button
                            onClick={() => { setEditingMessageId(msg.id); setEditValue(msg.content); }}
                            className="p-1 text-pplx-muted hover:text-pplx-text rounded hover:bg-pplx-hover transition-colors"
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => onCopyText(msg.id, msg.content)}
                            className="p-1 text-pplx-muted hover:text-pplx-text rounded hover:bg-pplx-hover transition-colors relative"
                            title="Copy"
                          >
                            {copiedId === msg.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                          </button>
                        </div>

                        <span className="text-[10px] font-bold text-pplx-text/50 uppercase tracking-widest">You</span>
                        <div className="w-6 h-6 rounded-full bg-pplx-secondary border border-pplx-border flex items-center justify-center">
                          <User size={12} className="text-pplx-text/70" />
                        </div>
                      </div>
                    )}

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className={`mt-2 mb-2 grid grid-cols-2 gap-2 ${msg.role === Role.USER ? 'justify-items-end' : ''}`}>
                        {msg.attachments.map((att, i) => (
                          <div key={i} className="group relative aspect-square rounded-xl border border-pplx-border overflow-hidden bg-pplx-secondary w-20 h-20">
                            {att.type === 'image' ? (
                              <img src={att.content} alt="attachment" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                                <FileText className="text-pplx-muted mb-1" size={20} />
                                <span className="text-[10px] text-pplx-text truncate w-full px-1">{att.name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}



                    {/* Content Bubble OR Edit Mode */}
                    {editingMessageId === msg.id ? (
                      <div className="w-full bg-pplx-secondary border border-pplx-border rounded-2xl p-4 mt-1 animate-fadeIn">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full bg-transparent text-pplx-text outline-none resize-none text-[15px] leading-7 font-sans min-h-[80px]"
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
                            onClick={() => handleEditSubmit(msg.id)}
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
                        {msg.role === Role.USER ? msg.content : <MessageRenderer content={msg.content} />}
                      </div>
                    )}

                    {/* Sources */}
                    {msg.role === Role.MODEL && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 w-full pt-2 border-t border-pplx-border/20">
                        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-pplx-muted mb-2 tracking-widest opacity-80">
                          <BookOpen size={9} /> <span>Sources</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {msg.citations.map((cit, idx) => (
                            <a key={idx} href={cit.uri} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2 py-1.5 bg-pplx-card hover:bg-pplx-hover border border-pplx-border/50 rounded-md transition-all group overflow-hidden">
                              <Globe size={8} className="text-pplx-muted shrink-0" />
                              <span className="text-[9px] font-medium text-pplx-text truncate leading-none">{cit.title}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {msg.role === Role.MODEL && !msg.isThinking && (
                      <div className="flex items-center gap-1 mt-4 border-t border-pplx-border/30 pt-2 w-full flex-wrap">
                        <button onClick={() => onRegenerate(msg.id)} className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover rounded-lg transition-colors">
                          <RefreshCw size={12} /> <span>Rewrite</span>
                        </button>
                        <button onClick={() => onCopyText(msg.id, msg.content)} className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover rounded-lg transition-colors">
                          {copiedId === msg.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />} <span>Copy</span>
                        </button>
                        <button onClick={() => onTTS(msg.content)} className={`flex items-center gap-1.5 px-2 py-1.5 text-[10px] rounded-lg transition-colors ${isPlayingAudio ? 'text-pplx-accent bg-pplx-accent/10' : 'text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover'}`}>
                          <Volume2 size={12} /> <span>Read</span>
                        </button>
                        <button onClick={() => onShare(msg.content)} className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover rounded-lg transition-colors">
                          <Share2 size={12} /> <span>Share</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>);
          })
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className={`p-4 bg-pplx-card sticky bottom-0 z-30 border-t border-pplx-border/10 ${isSidePanel ? 'md:p-4 p-2 md:bg-[#151515] md:border-white/10' : ''}`}>
        {/* Bottom Gradient Fade - Perfectly glued to input box */}
        <div className="absolute bottom-[calc(100%-16px)] left-0 right-0 h-12 bg-gradient-to-t from-pplx-card via-pplx-card/50 to-transparent z-10 pointer-events-none" />
        <InputArea
          onSendMessage={(text, focusModes, _proMode, atts) => onSendMessage(text, focusModes, atts)}
          isThinking={isThinking}
          onStop={onStopGeneration}
          placeholder="Ask about this page..."
          compact={true}
          activeNote={activeNote}
          mobileSidePanel={isSidePanel}
        />
      </div>
    </div>
  );
};
