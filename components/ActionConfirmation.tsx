
import React, { useState } from 'react';
import { Check, X, Edit3, FileText, AlertCircle, Type, AlignLeft, Trash2, FolderPlus, Table, Calendar, Clock, MapPin } from 'lucide-react';
import { PendingAction } from '../types';

interface ActionConfirmationProps {
  action: PendingAction;
  onConfirm: (modifiedData: any) => void;
  onCancel: () => void;
}

export const ActionConfirmation: React.FC<ActionConfirmationProps> = ({ action, onConfirm, onCancel }) => {
  const isBlockOperation = action.type === 'block_operation';
  const isCalendarEvent = action.type === 'calendar_event';
  
  // State for Page/Block operations
  const [title, setTitle] = useState(
      isBlockOperation ? action.data.args.pageTitle : (isCalendarEvent ? action.data.args.title : action.data.title)
  );
  const [content, setContent] = useState(
      isBlockOperation 
        ? (action.data.args.content || action.data.args.newContent || "Block Deletion") 
        : (isCalendarEvent ? action.data.args.description : action.data.content)
  );

  // Helper to convert timestamp to datetime-local string
  const toDateTimeString = (ts: any) => {
    if (!ts) return '';
    const date = new Date(Number(ts));
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Calendar specific state
  const [startDate, setStartDate] = useState(isCalendarEvent ? toDateTimeString(action.data.args.startDate) : '');
  const [endDate, setEndDate] = useState(isCalendarEvent ? toDateTimeString(action.data.args.endDate) : '');
  const [location, setLocation] = useState(isCalendarEvent ? action.data.args.location : '');

  const wordCount = (content || "").trim().split(/\s+/).length;
  const isUpdate = action.type === 'update_page';

  // --- CALENDAR EVENT CONFIRMATION ---
  if (isCalendarEvent) {
      const opType = action.data.operation; // 'add', 'update', 'delete'
      const opName = opType === 'add' ? 'Add Event' : opType === 'update' ? 'Update Event' : 'Delete Event';
      const opColor = opType === 'delete' ? 'text-red-500 bg-red-500/10' : 'text-blue-500 bg-blue-500/10';
      const Icon = opType === 'delete' ? Trash2 : (opType === 'add' ? Calendar : Edit3);

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-pplx-card border border-pplx-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="px-6 py-5 border-b border-pplx-border bg-pplx-secondary/30">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${opColor}`}>
                        <Icon size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-pplx-text tracking-tight">
                            {opName}
                        </h2>
                        <p className="text-xs text-pplx-muted">
                            Review calendar changes
                        </p>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="px-6 py-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
                {/* Title */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-pplx-muted uppercase tracking-wider flex items-center gap-1.5">
                        <Type size={12} /> Event Title
                    </label>
                    <input 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={opType === 'delete'}
                        className="w-full bg-pplx-input border border-transparent focus:border-pplx-accent hover:border-pplx-border rounded-xl px-3 py-2 text-sm font-semibold text-pplx-text shadow-sm outline-none transition-all placeholder-pplx-muted/50"
                    />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-pplx-muted uppercase tracking-wider flex items-center gap-1.5">
                            <Clock size={12} /> Start
                        </label>
                        <input 
                            type="datetime-local"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            disabled={opType === 'delete'}
                            className="w-full bg-pplx-input border border-transparent focus:border-pplx-accent hover:border-pplx-border rounded-xl px-3 py-2 text-xs font-mono text-pplx-text shadow-sm outline-none transition-all disabled:opacity-70"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-pplx-muted uppercase tracking-wider flex items-center gap-1.5">
                            <Clock size={12} /> End
                        </label>
                        <input 
                            type="datetime-local"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            disabled={opType === 'delete'}
                            className="w-full bg-pplx-input border border-transparent focus:border-pplx-accent hover:border-pplx-border rounded-xl px-3 py-2 text-xs font-mono text-pplx-text shadow-sm outline-none transition-all disabled:opacity-70"
                        />
                    </div>
                </div>

                {/* Location */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-pplx-muted uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin size={12} /> Location
                    </label>
                    <input 
                        value={location || ''}
                        onChange={(e) => setLocation(e.target.value)}
                        disabled={opType === 'delete'}
                        placeholder="Add location..."
                        className="w-full bg-pplx-input border border-transparent focus:border-pplx-accent hover:border-pplx-border rounded-xl px-3 py-2 text-sm text-pplx-text shadow-sm outline-none transition-all placeholder-pplx-muted/50 disabled:opacity-70"
                    />
                </div>

                {/* Description */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-pplx-muted uppercase tracking-wider flex items-center gap-1.5">
                        <AlignLeft size={12} /> Description
                    </label>
                    <textarea 
                        value={content || ''}
                        onChange={(e) => setContent(e.target.value)}
                        disabled={opType === 'delete'}
                        placeholder="Add description..."
                        className="w-full bg-pplx-input border border-transparent focus:border-pplx-accent hover:border-pplx-border rounded-xl px-3 py-2 text-sm text-pplx-text shadow-sm outline-none resize-y min-h-[80px] transition-all placeholder-pplx-muted/50 disabled:opacity-70"
                    />
                </div>

                {opType === 'delete' && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                        Are you sure you want to delete this event? This action cannot be undone.
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-pplx-border bg-pplx-card flex items-center justify-between gap-4">
                <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-medium text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover transition-colors flex items-center gap-2">
                    <X size={16} /> Cancel
                </button>
                <button 
                    onClick={() => onConfirm({ 
                        ...action.data.args, 
                        title, 
                        description: content,
                        startDate: startDate ? new Date(startDate).getTime() : action.data.args.startDate,
                        endDate: endDate ? new Date(endDate).getTime() : action.data.args.endDate,
                        location
                    })}
                    className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 ${opType === 'delete' ? 'bg-red-500 shadow-red-500/20' : 'bg-blue-600 shadow-blue-600/20'}`}
                >
                    <Check size={16} strokeWidth={3} />
                    <span>Confirm {opType === 'delete' ? 'Delete' : 'Save'}</span>
                </button>
            </div>
          </div>
        </div>
      );
  }

  // --- BLOCK OPERATION CONFIRMATION ---
  if (isBlockOperation) {
      const opType = action.data.operation;
      const opName = opType === 'insert_block' ? 'Insert Content' : opType === 'replace_block' ? 'Update Content' : opType === 'update_table_cell' ? 'Update Table Cell' : 'Delete Content';
      const opColor = opType === 'delete_block' ? 'text-red-500 bg-red-500/10' : 'text-blue-500 bg-blue-500/10';
      const Icon = opType === 'delete_block' ? Trash2 : (opType === 'insert_block' ? FolderPlus : (opType === 'update_table_cell' ? Table : Edit3));

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-pplx-card border border-pplx-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="px-6 py-5 border-b border-pplx-border bg-pplx-secondary/30">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`p-1.5 rounded-lg ${opColor}`}>
                                <Icon size={16} />
                            </div>
                            <h2 className="text-lg font-bold text-pplx-text tracking-tight">
                                {opName}
                            </h2>
                        </div>
                        <p className="text-xs text-pplx-muted pl-1">
                            Target Page: <span className="font-semibold text-pplx-text">{title}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="px-6 py-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                <div className="flex flex-col min-h-0 group">
                     <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-pplx-muted uppercase tracking-wider ml-1">
                            <AlignLeft size={12} /> {opType === 'delete_block' ? 'Content to Remove' : (opType === 'update_table_cell' ? 'New Cell Value' : 'Content to Add/Update')}
                        </label>
                        {opType === 'update_table_cell' && (
                            <span className="text-[10px] text-pplx-muted bg-pplx-secondary px-2 py-0.5 rounded-full">
                                Row: {action.data.args.rowIndex}, Col: {action.data.args.colIndex}
                            </span>
                        )}
                     </div>
                     <div className="relative">
                         <textarea 
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            disabled={opType === 'delete_block'}
                            className={`w-full bg-pplx-input border border-transparent focus:border-pplx-accent hover:border-pplx-border rounded-xl p-4 min-h-[150px] text-sm text-pplx-text leading-7 whitespace-pre-wrap font-sans shadow-sm outline-none resize-y transition-all custom-scrollbar placeholder-pplx-muted/50 ${opType === 'delete_block' ? 'opacity-70 cursor-not-allowed' : ''}`}
                         />
                     </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-pplx-border bg-pplx-card flex items-center justify-between gap-4">
                <button onClick={onCancel} className="px-5 py-2.5 rounded-xl text-sm font-medium text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover transition-colors flex items-center gap-2">
                    <X size={16} /> Cancel
                </button>
                <button 
                    onClick={() => onConfirm({ title, content })}
                    className="flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-bold text-pplx-primary bg-pplx-text hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-pplx-accent/10"
                >
                    <Check size={18} strokeWidth={3} />
                    <span>Confirm {opType === 'delete_block' ? 'Deletion' : 'Changes'}</span>
                </button>
            </div>
          </div>
        </div>
      );
  }

  // --- DEFAULT PAGE CONFIRMATION ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-pplx-card border border-pplx-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header - Structured Info */}
        <div className="px-6 py-5 border-b border-pplx-border bg-pplx-secondary/30">
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className={`p-1.5 rounded-lg ${isUpdate ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'}`}>
                            {isUpdate ? <Edit3 size={16} /> : <FileText size={16} />}
                        </div>
                        <h2 className="text-lg font-bold text-pplx-text tracking-tight">
                            {isUpdate ? 'Update Existing Page' : 'Create New Page'}
                        </h2>
                    </div>
                    <p className="text-xs text-pplx-muted pl-1">
                        Review and modify the content before saving to your library.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono text-pplx-muted bg-pplx-primary border border-pplx-border px-2 py-1 rounded-md">
                    <span className="uppercase tracking-wider">Storage:</span>
                    <span className="text-pplx-text font-bold">Library</span>
                </div>
            </div>
        </div>

        {/* Editable Body */}
        <div className="px-6 py-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
            
            {/* Title Input */}
            <div className="group">
                <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-pplx-muted uppercase tracking-wider ml-1">
                        <Type size={12} /> Page Title
                    </label>
                    <span className="text-[10px] text-pplx-muted opacity-0 group-hover:opacity-100 transition-opacity">Editable</span>
                </div>
                <input 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-pplx-input border border-transparent focus:border-pplx-accent hover:border-pplx-border rounded-xl px-4 py-3.5 text-lg font-semibold text-pplx-text shadow-sm outline-none transition-all placeholder-pplx-muted/50"
                    placeholder="Enter page title..."
                />
            </div>
            
            {/* Content Textarea */}
            <div className="flex flex-col min-h-0 group">
                 <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-pplx-muted uppercase tracking-wider ml-1">
                        <AlignLeft size={12} /> Content Body
                    </label>
                    <span className="text-[10px] text-pplx-muted bg-pplx-secondary px-2 py-0.5 rounded-full">
                        ~{wordCount} words
                    </span>
                 </div>
                 <div className="relative">
                     <textarea 
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="w-full bg-pplx-input border border-transparent focus:border-pplx-accent hover:border-pplx-border rounded-xl p-4 min-h-[250px] text-sm text-pplx-text leading-7 whitespace-pre-wrap font-sans shadow-sm outline-none resize-y transition-all custom-scrollbar placeholder-pplx-muted/50"
                        placeholder="Page content..."
                     />
                 </div>
            </div>

            {/* Warning / Info Box */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-pplx-secondary/50 border border-pplx-border/50">
                <AlertCircle size={16} className="text-pplx-accent shrink-0 mt-0.5" />
                <p className="text-xs text-pplx-muted leading-relaxed">
                    This action will {isUpdate ? 'append data to' : 'create a new entry in'} your personal knowledge base. You can further edit this page later in the <strong>Library</strong> view.
                </p>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-5 border-t border-pplx-border bg-pplx-card flex items-center justify-between gap-4">
            <button 
                onClick={onCancel}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-pplx-muted hover:text-pplx-text hover:bg-pplx-hover transition-colors flex items-center gap-2"
            >
                <X size={16} /> Cancel
            </button>
            <button 
                onClick={() => onConfirm({ title, content })}
                className="flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-bold text-pplx-primary bg-pplx-text hover:opacity-90 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-pplx-accent/10"
            >
                <Check size={18} strokeWidth={3} />
                <span>Confirm Changes</span>
            </button>
        </div>
      </div>
    </div>
  );
};
