// (Assumed file content matches a standard wrapper for ChatInterface)
// Adding ThinkingEvent import and prop propagation
import React from 'react';
import { ChatInterface } from './ChatInterface';
import { Message, FocusMode, Attachment, Note } from '../types';
import { ThinkingEvent } from '../src/agent/types'; // Import
import { X, Maximize2, Minimize2, Pencil, ChevronDown } from 'lucide-react';

interface SideChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
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
  activeNote?: Note;
  onNewChat: () => void;
  mode: 'sidebar' | 'floating';
  onModeChange: (mode: 'sidebar' | 'floating') => void;
  thinkingEvents?: ThinkingEvent[]; // New Prop
}

export const SideChatPanel: React.FC<SideChatPanelProps> = ({
  isOpen,
  onClose,
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
  activeNote,
  onNewChat,
  mode,
  onModeChange,
  thinkingEvents // Destructure
}) => {
  if (!isOpen) return null;

  return (
    <div className={`fixed z-40 flex flex-col bg-pplx-card border-l border-pplx-border shadow-2xl transition-all duration-300 md:bg-[#151515] md:border-white/10 ${mode === 'sidebar'
        ? 'top-0 bottom-0 right-0 w-[400px]'
        : 'top-20 right-4 w-[400px] h-[600px] rounded-2xl border border-pplx-border/50'
      }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-pplx-border/50 shrink-0 md:border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={onNewChat} className="flex items-center gap-1.5 text-sm font-medium text-pplx-text/90 hover:text-pplx-text transition-colors">
            <span>New AI chat</span>
            <ChevronDown size={14} className="opacity-70" />
          </button>
          {activeNote && <span className="text-xs text-pplx-muted truncate max-w-[150px]">({activeNote.title})</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onNewChat} className="p-1.5 text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover rounded" title="New Chat">
            <Pencil size={14} />
          </button>
          <button onClick={() => onModeChange(mode === 'sidebar' ? 'floating' : 'sidebar')} className="p-1.5 text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover rounded">
            {mode === 'sidebar' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={onClose} className="p-1.5 text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover rounded">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        <ChatInterface
          messages={messages}
          isThinking={isThinking}
          onSendMessage={onSendMessage}
          onStopGeneration={onStopGeneration}
          onRegenerate={onRegenerate}
          onEditMessage={onEditMessage}
          onCopyText={onCopyText}
          onShare={onShare}
          onTTS={onTTS}
          isPlayingAudio={isPlayingAudio}
          copiedId={copiedId}
          isSidePanel={true}
          activeNote={activeNote}
          thinkingEvents={thinkingEvents} // Pass prop
        />
      </div>
    </div>
  );
};
