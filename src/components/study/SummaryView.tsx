'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useCompletion } from '@ai-sdk/react';
import { Download, RefreshCw, Loader2 } from 'lucide-react';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

interface SummaryViewProps {
    subjectId: string;
    subtopicName: string;
    topicName: string;
}

export function SummaryView({ subjectId, subtopicName, topicName }: SummaryViewProps) {
    const [cachedText, setCachedText] = useState<string | null>(null);
    const [hasLoaded, setHasLoaded] = useState(false);

    const { completion, complete, isLoading, error } = useCompletion({
        api: '/api/summary',
        streamProtocol: 'text',
        onFinish: (_prompt, finalCompletion) => {
            // Save the completed text so it persists across tab switches
            if (finalCompletion) {
                setCachedText(finalCompletion);
            }
        },
    });

    // Load summary on mount — the API checks cache first
    useEffect(() => {
        if (subtopicName && subjectId && !hasLoaded) {
            setHasLoaded(true);
            complete('', { body: { subjectId, subtopicName, topicName } });
        }
    }, [subtopicName, subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRegenerate = useCallback(() => {
        setCachedText(null);
        complete('', { body: { subjectId, subtopicName, topicName, forceRegenerate: true } });
    }, [complete, subjectId, subtopicName, topicName]);

    const handleDownload = useCallback(() => {
        const text = completion || cachedText;
        if (!text) return;

        const filename = subtopicName
            ? `${subtopicName.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_')}_Summary.md`
            : 'Summary.md';

        const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [completion, cachedText, subtopicName]);

    const displayTitle = topicName && subtopicName
        ? `${topicName} › ${subtopicName}`
        : subtopicName || 'Generated Summary';

    // Show completion text, or fall back to cached text from a previous tab switch
    const displayText = completion || cachedText;

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10 w-full">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {displayTitle}
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRegenerate}
                        disabled={isLoading}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Regenerate Summary"
                    >
                        <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={!displayText}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-30"
                        title="Download as Markdown"
                    >
                        <Download size={18} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto w-full">
                {error ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center text-red-500">
                        <p>Error generating summary. Please try again.</p>
                        <button
                            onClick={handleRegenerate}
                            className="mt-4 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                        >
                            Retry
                        </button>
                    </div>
                ) : (displayText || isLoading) ? (
                    <div className="p-6 md:p-8 max-w-none w-full">
                        {isLoading && !displayText && (
                            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                                <p className="text-gray-400 text-sm">Generating summary for {subtopicName || 'this topic'}...</p>
                            </div>
                        )}

                        {displayText && (
                            <MarkdownRenderer content={displayText} />
                        )}

                        {/* Cursor Blinker when streaming */}
                        {isLoading && displayText && (
                            <span className="inline-block w-2 h-5 ml-1 bg-blue-500 animate-pulse align-middle" />
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-400">
                        <p>No summary generated yet.</p>
                        <button
                            onClick={handleRegenerate}
                            className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                        >
                            Generate Summary
                        </button>
                    </div>
                )}

                <div className="h-24" /> {/* Bottom spacer */}
            </div>
        </div>
    );
}
