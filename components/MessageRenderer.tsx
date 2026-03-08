
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy } from 'lucide-react';

interface MessageRendererProps {
    content: string;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ content }) => {
    return (
        <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
                p: ({node, ...props}) => <p className="mb-6 leading-7 md:leading-8 text-pplx-text font-normal text-[15px] md:text-[16px]" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-6 space-y-2 text-pplx-text/90" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-6 space-y-2 text-pplx-text/90" {...props} />,
                li: ({node, ...props}) => <li className="pl-1 leading-7" {...props} />,
                h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-4 mt-8 text-pplx-text pb-2" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-xl font-semibold mb-3 mt-6 text-pplx-text" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-lg font-semibold mb-2 mt-4 text-pplx-text" {...props} />,
                blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-pplx-accent pl-4 italic my-4 text-gray-400 bg-pplx-secondary/20 py-2 pr-2 rounded-r-lg" {...props} />,
                code: ({node, ...props}) => {
                    const match = /language-(\w+)/.exec(props.className || '')
                    // @ts-ignore
                    const isInline = !match && !String(props.children).includes('\n');
                    return isInline ? <code className="bg-pplx-secondary text-pplx-accent px-1.5 py-0.5 rounded text-sm font-mono border border-pplx-border/50" {...props} /> : <div className="relative my-6 rounded-lg overflow-hidden border border-pplx-border bg-[#1e1e1e] shadow-sm"><div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-white/10"><span className="text-xs text-gray-400 font-mono lowercase">{match?.[1] || 'code'}</span><button onClick={() => navigator.clipboard.writeText(String(props.children))} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"><Copy size={12} /> Copy</button></div><pre className="p-4 overflow-x-auto text-sm text-gray-200 font-mono leading-relaxed custom-scrollbar"><code className={props.className} {...props} /></pre></div>
                },
                table: ({node, ...props}) => (<div className="my-6 w-full overflow-hidden rounded-lg border border-pplx-border shadow-sm"><div className="overflow-x-auto"><table className="w-full border-collapse text-sm text-left" {...props} /></div></div>),
                thead: ({node, ...props}) => <thead className="bg-pplx-secondary/50 text-pplx-text font-semibold uppercase tracking-wider text-xs" {...props} />,
                th: ({node, ...props}) => <th className="px-4 py-3 border-b border-pplx-border/50 whitespace-nowrap" {...props} />,
                td: ({node, ...props}) => <td className="px-4 py-3 border-b border-pplx-border/30 text-pplx-text/90 align-top leading-relaxed" {...props} />,
                a: ({node, ...props}) => <a className="text-pplx-accent hover:underline decoration-pplx-accent/50 underline-offset-2 transition-all font-medium" target="_blank" rel="noopener noreferrer" {...props} />,
                hr: ({node, ...props}) => <hr className="my-8 border-t border-pplx-border/60" {...props} />
            }}
        >
            {content}
        </ReactMarkdown>
    );
};
