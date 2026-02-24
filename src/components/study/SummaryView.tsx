'use client';

import React, { useEffect, useState } from 'react';
import { useCompletion } from '@ai-sdk/react';
import { Download, RefreshCw, Loader2 } from 'lucide-react';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { useParams } from 'next/navigation';

export function SummaryView() {
    const { subtopicId } = useParams();
    const [subtopicTitle, setSubtopicTitle] = useState('');

    const { completion, complete, isLoading, error } = useCompletion({
        api: '/api/summary',
    });

    useEffect(() => {
        // Format title from ID (simple mock, ideally verify from store/subject)
        if (subtopicId) {
            const title = (subtopicId as string)
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            setSubtopicTitle(title);

            // Trigger completion on mount
            complete('', { body: { subtopicId } });
        }
    }, [subtopicId, complete]);

    const handleRegenerate = () => {
        complete('', { body: { subtopicId } });
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10 w-full">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {subtopicTitle || "Generated Summary"}
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
                    <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Download size={18} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto w-full">
                {/* Changed p-6 md:p-8 structure to separate loading/error handling */}

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
                ) : (completion || isLoading) ? (
                    <div className="p-6 md:p-8 max-w-none w-full">
                        {isLoading && !completion && (
                            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                                <p className="text-gray-400 text-sm">Thinking...</p>
                            </div>
                        )}

                        {completion && (
                            <MarkdownRenderer content={completion} />
                        )}

                        {/* Cursor Blinker when streaming */}
                        {isLoading && completion && (
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
