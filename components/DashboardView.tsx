

import React, { useMemo } from 'react';
import { Message, Role, Attachment } from '../types';
import { 
  LayoutDashboard, PieChart as PieIcon, TrendingUp, 
  Activity, Calendar, CheckCircle2, 
  ArrowRight, Globe, BarChart3, 
  Share2, Printer, ImageIcon, Zap, X
} from 'lucide-react';
import { PerplexityLogo } from '../constants';

interface DashboardViewProps {
  message: Message | undefined;
  onClose: () => void;
}

// --- Types ---

interface Metric {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  percentage?: string;
}

interface ChartData {
  title: string;
  labels: string[];
  values: number[];
  unit: string;
  type: 'bar' | 'line' | 'pie';
}

interface DashboardSection {
  id: string;
  type: 'text' | 'list' | 'chart' | 'table';
  title?: string;
  content: any;
  colSpan: 1 | 2 | 3;
}

// --- Parsing Logic ---

const extractMetrics = (text: string): Metric[] => {
  const metrics: Metric[] = [];
  const lines = text.split('\n');
  
  // Regex for Currency/Numbers: $50M, €200k, 50%, 10.5
  const metricRegex = /^[-*•]?\s?([$€£¥]?\d{1,3}(,\d{3})*(\.\d+)?(\s?[kKmMbBtT]?)%?)\s?[:\-]?\s?(.*)$/;

  lines.forEach(line => {
    if (line.length > 60) return; 
    
    // Check for "Trend" keywords
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    if (line.toLowerCase().includes('increase') || line.toLowerCase().includes('growth') || line.toLowerCase().includes('up')) trend = 'up';
    if (line.toLowerCase().includes('decrease') || line.toLowerCase().includes('drop') || line.toLowerCase().includes('down')) trend = 'down';

    const match = line.trim().match(metricRegex);
    if (match) {
        // match[1] = value, match[5] = label (usually)
        // Check if label is actually first: "Revenue: $50M"
        if (line.includes(':')) {
            const parts = line.split(':');
            if (parts.length === 2) {
                const p1 = parts[0].trim().replace(/^[-*•]\s?/, '');
                const p2 = parts[1].trim();
                
                // Determine which part is the number
                if (p2.match(/\d/)) {
                     metrics.push({ value: p2, label: p1, trend });
                } else if (p1.match(/\d/)) {
                     metrics.push({ value: p1, label: p2, trend });
                }
            }
        } else {
             // Standard bullet: "$50M revenue"
             metrics.push({ value: match[1], label: match[5] || 'Metric', trend });
        }
    }
  });
  return metrics.slice(0, 4); 
};

const parseMarkdownTable = (tableBlock: string): ChartData | null => {
    try {
        const lines = tableBlock.trim().split('\n');
        if (lines.length < 3) return null;

        const header = lines[0].split('|').map(c => c.trim()).filter(c => c);
        const rows = lines.slice(2).map(line => line.split('|').map(c => c.trim()).filter(c => c));

        // Detect numeric column (usually index 1)
        const isNumeric = rows.every(r => r[1] && !isNaN(parseFloat(r[1].replace(/[^0-9.-]/g, ''))));

        if (header.length >= 2 && isNumeric) {
            // Heuristic: If labels are < 5, maybe Pie? Else Bar.
            const type = rows.length <= 5 ? 'pie' : 'bar';
            
            return {
                title: header[1] || 'Data Analysis',
                labels: rows.map(r => r[0]),
                values: rows.map(r => parseFloat(r[1].replace(/[^0-9.-]/g, ''))),
                unit: header[1],
                type: type
            };
        }
        return null;
    } catch (e) {
        return null;
    }
};

const processContent = (text: string): { sections: DashboardSection[], metrics: Metric[] } => {
    const sections: DashboardSection[] = [];
    const metrics = extractMetrics(text);
    const rawSections = text.split(/(?=^#{1,3}\s)/m); // Split by Headers

    rawSections.forEach((sectionRaw) => {
        const lines = sectionRaw.trim().split('\n');
        if (lines.length === 0) return;

        let title = "";
        let contentLines = lines;

        if (lines[0].startsWith('#')) {
            title = lines[0].replace(/^#{1,6}\s/, '').trim();
            contentLines = lines.slice(1);
        }

        // Detect Table -> Chart
        const tableStartIndex = contentLines.findIndex(l => l.trim().startsWith('|'));
        if (tableStartIndex !== -1) {
             let tableEndIndex = contentLines.slice(tableStartIndex).findIndex(l => !l.trim().startsWith('|'));
             if (tableEndIndex === -1) tableEndIndex = contentLines.length;
             else tableEndIndex += tableStartIndex;

             const tableBlock = contentLines.slice(tableStartIndex, tableEndIndex).join('\n');
             const chartData = parseMarkdownTable(tableBlock);
             
             if (chartData) {
                 sections.push({
                     id: Math.random().toString(),
                     type: 'chart',
                     title: title || chartData.title,
                     content: chartData,
                     colSpan: chartData.type === 'bar' ? 2 : 1
                 });
                 return; // Consume section as chart
             }
        }

        // Detect List
        const isList = contentLines.every(l => l.trim().startsWith('- ') || l.trim().startsWith('* ') || l.trim().match(/^\d+\./) || l.trim() === '');
        if (isList && contentLines.some(l => l.trim().length > 0)) {
            const items = contentLines
                .filter(l => l.trim().length > 0)
                .map(l => l.replace(/^[-*•]\s?/, '').replace(/^\d+\.\s?/, ''));
            
            sections.push({
                id: Math.random().toString(),
                type: 'list',
                title: title,
                content: items,
                colSpan: 1
            });
            return;
        }

        // Default Text
        const cleanText = contentLines.join('\n').trim();
        if (cleanText.length > 0) {
            sections.push({
                id: Math.random().toString(),
                type: 'text',
                title: title,
                content: cleanText,
                colSpan: cleanText.length > 300 ? 2 : 1
            });
        }
    });

    return { sections, metrics };
};

// --- Components ---

const MetricCard: React.FC<{ metric: Metric }> = ({ metric }) => (
    <div className="bg-pplx-card border border-pplx-border p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md transition-all print-break-inside">
        <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-pplx-muted uppercase tracking-widest">{metric.label}</span>
            {metric.trend === 'up' && <TrendingUp size={16} className="text-green-500" />}
            {metric.trend === 'down' && <TrendingUp size={16} className="text-red-500 transform rotate-180" />}
            {metric.trend === 'neutral' && <Activity size={16} className="text-pplx-accent opacity-50" />}
        </div>
        <div className="text-3xl font-light text-pplx-text truncate tracking-tight">
            {metric.value}
        </div>
        {metric.trend !== 'neutral' && (
             <div className="mt-2 text-[10px] font-medium flex items-center gap-1">
                 <span className={metric.trend === 'up' ? 'text-green-500' : 'text-red-500'}>
                     {metric.trend === 'up' ? 'Positive Trend' : 'Negative Trend'}
                 </span>
             </div>
        )}
    </div>
);

const BarChart: React.FC<{ data: ChartData }> = ({ data }) => {
    const max = Math.max(...data.values);
    return (
        <div className="flex flex-col h-full w-full min-h-[200px]">
            <div className="flex items-end justify-between gap-3 h-40 w-full pt-4 px-2">
                {data.values.map((val, idx) => (
                    <div key={idx} className="flex flex-col items-center flex-1 group relative">
                        {/* Tooltip */}
                        <div className="absolute -top-8 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {val} {data.unit}
                        </div>
                        <div 
                            className="w-full bg-pplx-accent opacity-90 hover:opacity-100 rounded-t-sm transition-all relative"
                            style={{ height: `${(val / max) * 100}%` }}
                        />
                    </div>
                ))}
            </div>
            <div className="flex justify-between gap-3 mt-3 border-t border-pplx-border pt-2">
                {data.labels.map((lbl, idx) => (
                    <div key={idx} className="flex-1 text-center">
                        <p className="text-[10px] text-pplx-muted truncate w-full" title={lbl}>{lbl}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DonutChart: React.FC<{ data: ChartData }> = ({ data }) => {
    // Simple SVG Donut Logic
    const total = data.values.reduce((a, b) => a + b, 0);
    let cumulativePercent = 0;

    const slices = data.values.map((val, idx) => {
        const percent = val / total;
        const startX = Math.cos(2 * Math.PI * cumulativePercent);
        const startY = Math.sin(2 * Math.PI * cumulativePercent);
        cumulativePercent += percent;
        const endX = Math.cos(2 * Math.PI * cumulativePercent);
        const endY = Math.sin(2 * Math.PI * cumulativePercent);
        
        const largeArc = percent > 0.5 ? 1 : 0;
        
        // Colors
        const hue = (idx * 360) / data.values.length;
        const color = `hsl(${hue}, 70%, 50%)`;

        return (
            <path
                key={idx}
                d={`M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArc} 1 ${endX} ${endY} Z`}
                fill={color}
                className="hover:opacity-80 transition-opacity"
                transform="rotate(-90)"
            />
        );
    });

    return (
        <div className="flex items-center justify-around h-full p-4">
             <div className="w-32 h-32 relative">
                 <svg viewBox="-1 -1 2 2" className="overflow-visible w-full h-full">
                     {slices}
                 </svg>
                 {/* Hole for Donut */}
                 <div className="absolute inset-0 m-auto w-16 h-16 bg-pplx-card rounded-full flex items-center justify-center border border-pplx-border">
                     <PieIcon size={20} className="text-pplx-muted" />
                 </div>
             </div>
             <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                 {data.labels.map((lbl, idx) => (
                     <div key={idx} className="flex items-center gap-2 text-xs">
                         <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: `hsl(${(idx * 360) / data.values.length}, 70%, 50%)` }} 
                         />
                         <span className="text-pplx-text truncate max-w-[100px]">{lbl}</span>
                         <span className="text-pplx-muted font-mono">{data.values[idx]}</span>
                     </div>
                 ))}
             </div>
        </div>
    );
};

const ChartCard: React.FC<{ section: DashboardSection }> = ({ section }) => (
    <div className={`bg-pplx-card border border-pplx-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col print-break-inside ${section.colSpan === 2 ? 'md:col-span-2' : ''}`}>
        <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-pplx-text flex items-center gap-2.5">
                <BarChart3 size={18} className="text-pplx-accent"/> 
                {section.title || "Data Visualization"}
            </h3>
        </div>
        <div className="flex-1 min-h-[200px]">
            {(section.content as ChartData).type === 'pie' 
                ? <DonutChart data={section.content as ChartData} />
                : <BarChart data={section.content as ChartData} />
            }
        </div>
    </div>
);

const ListCard: React.FC<{ section: DashboardSection }> = ({ section }) => (
    <div className="bg-pplx-card border border-pplx-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col h-full print-break-inside">
        <div className="flex items-center gap-2 mb-4 border-b border-pplx-border/50 pb-3">
            <CheckCircle2 size={18} className="text-pplx-accent" />
            <h3 className="font-semibold text-pplx-text text-sm uppercase tracking-wide">{section.title || "Key Points"}</h3>
        </div>
        <ul className="space-y-3 flex-1">
            {(section.content as string[]).slice(0, 6).map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-pplx-text/90">
                    <div className="w-1.5 h-1.5 rounded-full bg-pplx-accent mt-1.5 shrink-0" />
                    <span className="leading-relaxed">{item}</span>
                </li>
            ))}
        </ul>
    </div>
);

const TextCard: React.FC<{ section: DashboardSection }> = ({ section }) => (
    <div className={`bg-pplx-card border border-pplx-border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all print-break-inside ${section.colSpan === 2 ? 'md:col-span-2' : ''}`}>
        {section.title && (
            <div className="flex items-center gap-2 mb-4">
                <Zap size={18} className="text-yellow-500" />
                <h3 className="font-bold text-lg text-pplx-text">{section.title}</h3>
            </div>
        )}
        <div className="text-sm text-pplx-text/80 leading-7 whitespace-pre-wrap font-sans text-justify">
            {(section.content as string)}
        </div>
    </div>
);

const ImageGallery: React.FC<{ images: Attachment[] }> = ({ images }) => (
    <div className="md:col-span-3 bg-pplx-secondary/20 border border-pplx-border rounded-2xl p-6 print-break-inside">
        <div className="flex items-center gap-2 mb-4">
            <ImageIcon size={18} className="text-pplx-accent" />
            <h3 className="font-bold text-lg text-pplx-text">Visual Context</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {images.map((img, idx) => (
                <div key={idx} className="group relative aspect-video rounded-lg overflow-hidden border border-pplx-border bg-pplx-card">
                    <img 
                        src={img.content} 
                        alt={img.name} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-xs font-medium px-2 py-1 bg-black/50 rounded backdrop-blur-sm">
                            {img.name || 'Image'}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// --- Main Component ---

export const DashboardView: React.FC<DashboardViewProps> = ({ message, onClose }) => {
  const dashboardData = useMemo(() => {
    if (!message || message.role !== Role.MODEL) return null;

    // Aggregate Images from the message
    const images = (message.attachments || []).filter(a => a.type === 'image');
    
    return {
        ...processContent(message.content),
        citations: message.citations || [],
        timestamp: message.timestamp,
        images: images
    };
  }, [message]);

  const handleExport = () => {
      window.print();
  };

  const handleShare = async () => {
      if (dashboardData && navigator.share) {
          try {
              await navigator.share({
                  title: 'Perplex Analysis Dashboard',
                  text: `Check out this analysis generated by Perplex.\n\nMetrics: ${dashboardData.metrics.map(m => `${m.label}: ${m.value}`).join(', ')}`,
                  url: window.location.href
              });
          } catch (e) {
              console.log('Share cancelled');
          }
      } else {
          alert("Share via URL copied to clipboard");
      }
  };

  if (!dashboardData) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-pplx-muted bg-pplx-secondary/30">
            <div className="animate-pulse flex flex-col items-center">
                <LayoutDashboard size={48} className="opacity-20 mb-4" />
                <p>Generating Dashboard Analysis...</p>
            </div>
        </div>
    );
  }

  return (
    <div 
        className={`fixed top-0 left-0 right-0 z-50 bg-pplx-primary overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-10 duration-300`} 
        style={{ 
            bottom: document.body.classList.contains('dock-active') && window.innerWidth < 640 
                ? 'calc(72px + env(safe-area-inset-bottom))' 
                : '0px' 
        }}
        id="dashboard-container"
    >
        <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 pb-24">
            
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-pplx-border pb-6 sticky top-0 bg-pplx-primary/80 backdrop-blur-md supports-[backdrop-filter]:bg-pplx-primary/50 z-10 pt-4">
                <div>
                    <div className="flex items-center gap-2 text-pplx-accent mb-2">
                        <button onClick={onClose} className="md:hidden mr-2 p-1 -ml-1 text-pplx-text"><ArrowRight className="rotate-180" /></button>
                        <PerplexityLogo className="w-6 h-6" />
                        <span className="text-xs font-bold uppercase tracking-widest bg-pplx-accent/10 px-2 py-0.5 rounded">Professional Report</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-serif text-pplx-text font-medium tracking-tight">Executive Dashboard</h1>
                    <p className="text-sm text-pplx-muted mt-2 flex items-center gap-2">
                        <Calendar size={14} /> Generated {dashboardData ? new Date(dashboardData.timestamp).toLocaleDateString() : ''}
                    </p>
                </div>
                <div className="flex gap-3 print:hidden items-center">
                    <button 
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-pplx-card border border-pplx-border rounded-lg text-xs font-bold text-pplx-text hover:bg-pplx-hover transition-colors shadow-sm" 
                    >
                        <Printer size={16} /> Export PDF
                    </button>
                    <button 
                        onClick={handleShare}
                        className="flex items-center gap-2 px-4 py-2 bg-pplx-accent text-black rounded-lg text-xs font-bold hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20"
                    >
                        <Share2 size={16} /> Share
                    </button>
                    <button 
                        onClick={onClose}
                        className="p-2 bg-pplx-secondary rounded-full text-pplx-text hover:bg-pplx-hover transition-colors ml-2 hidden md:block"
                        title="Close Dashboard"
                    >
                        <X size={20} />
                    </button>
                </div>
            </header>

            {/* 1. Key Metrics Section */}
            {dashboardData.metrics.length > 0 && (
                <section>
                    <h2 className="text-sm font-bold text-pplx-muted uppercase tracking-wider mb-4">Key Performance Indicators</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
                        {dashboardData.metrics.map((m, i) => <MetricCard key={i} metric={m} />)}
                    </div>
                </section>
            )}

            {/* 2. Visual Analysis (Charts & Insights) */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
                {/* Main Content Area */}
                <div className="md:col-span-2 space-y-6">
                    {/* Render Charts first, then Text */}
                    {dashboardData.sections.filter(s => s.type === 'chart').map((section) => (
                         <ChartCard key={section.id} section={section} />
                    ))}
                    
                    {dashboardData.sections.filter(s => s.type === 'text').map((section) => (
                        <TextCard key={section.id} section={section} />
                    ))}
                </div>

                {/* Sidebar (Lists & Details) */}
                <div className="md:col-span-1 space-y-6">
                     {dashboardData.sections.filter(s => s.type === 'list').map((section) => (
                        <ListCard key={section.id} section={section} />
                    ))}

                    {/* Sources */}
                    {dashboardData.citations.length > 0 && (
                        <div className="bg-pplx-card border border-pplx-border rounded-2xl p-6 shadow-sm print-break-inside">
                            <h3 className="font-bold text-xs text-pplx-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Globe size={14} /> Verified Sources
                            </h3>
                            <div className="flex flex-col gap-3">
                                {dashboardData.citations.slice(0, 5).map((cit, idx) => (
                                    <a 
                                        key={idx} 
                                        href={cit.uri} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="flex items-center justify-between p-2 rounded-lg bg-pplx-secondary/50 hover:bg-pplx-hover transition-colors group"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-6 h-6 rounded bg-pplx-accent/10 text-pplx-accent flex items-center justify-center shrink-0 text-[10px] font-bold">
                                                {idx + 1}
                                            </div>
                                            <span className="text-xs text-pplx-text truncate font-medium">{cit.title}</span>
                                        </div>
                                        <ArrowRight size={14} className="text-pplx-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>
            
            {/* 3. Visual Gallery (Images) */}
            {dashboardData.images.length > 0 && (
                <section className="animate-fadeIn">
                     <h2 className="text-sm font-bold text-pplx-muted uppercase tracking-wider mb-4">Visual Context</h2>
                     <ImageGallery images={dashboardData.images} />
                </section>
            )}

            {/* Footer Report Info */}
            <footer className="mt-12 pt-6 border-t border-pplx-border flex justify-between items-center text-[10px] text-pplx-muted print:flex">
                <span>CONFIDENTIAL REPORT</span>
                <span>Generated by Perplex AI Clone</span>
            </footer>

        </div>
    </div>
  );
};