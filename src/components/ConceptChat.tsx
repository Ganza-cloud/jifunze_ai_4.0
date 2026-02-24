'use client';

import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { motion } from 'framer-motion';
import { Send, Sparkles, Bot, User, ArrowLeft } from 'lucide-react';
import { useRef, useEffect, useCallback, useState } from 'react';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

// Hidden trigger prefix — messages starting with this are not shown in the UI
const SYSTEM_TRIGGER_PREFIX = '[[SYSTEM_TRIGGER]]';

interface ConceptChatProps {
    subjectId: string;
    subjectName?: string;
    selectedNode: { label: string; type: string } | null;
    onBackToMindmap: () => void;
}

export function ConceptChat({ subjectId, subjectName, selectedNode, onBackToMindmap }: ConceptChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasTriggeredRef = useRef<string | null>(null);
    const [inputValue, setInputValue] = useState('');

    const { messages, sendMessage, setMessages, status, error } = useChat({
        id: `concept-${subjectId}`,
        transport: new TextStreamChatTransport({
            api: '/api/chat',
            body: {
                subjectId,
                subjectName,
                conceptName: selectedNode?.label
            },
        }),
        onError: (err) => {
            console.error('[ConceptChat] useChat error:', err);
        },
    });

    const isLoading = status === 'submitted' || status === 'streaming';

    // Debug: log status changes
    useEffect(() => {
        console.log('[ConceptChat] status:', status, 'messages:', messages.length, 'error:', error?.message);
    }, [status, messages.length, error]);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, scrollToBottom]);

    // When selectedNode changes, auto-trigger the AI using append
    useEffect(() => {
        if (!selectedNode) return;

        const nodeKey = `${selectedNode.label}-${selectedNode.type}`;
        const isFromMindmap = hasTriggeredRef.current !== nodeKey;

        // If we switched to a new node, clear history first
        if (isFromMindmap) {
            hasTriggeredRef.current = nodeKey;
            setMessages([]);
            return; // Wait for the next render when messages.length === 0
        }

        // Action 6: Programmatic Trigger using sendMessage
        if (messages.length === 0 && !isLoading) {
            const initialPromptFromNode = `${SYSTEM_TRIGGER_PREFIX}The student clicked on the concept: '${selectedNode.label}'. Start the conversation by giving a 2-sentence summary of this concept based ONLY on the uploaded reference materials, and end by asking them a guiding question to test their understanding.`;
            console.log("Submitting payload from programmatic trigger:", initialPromptFromNode);
            sendMessage({ text: initialPromptFromNode });
        }
    }, [selectedNode, messages.length, isLoading, sendMessage, setMessages]);

    // Helper to extract text content from a message
    const getMessageText = (msg: (typeof messages)[number]): string => {
        if (msg.parts && Array.isArray(msg.parts)) {
            return msg.parts
                .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                .map((p) => p.text)
                .join('');
        }
        return (msg as any).content || '';
    };

    // Filter out system trigger messages from display
    const visibleMessages = messages.filter((msg) => {
        const text = getMessageText(msg);
        return !text.startsWith(SYSTEM_TRIGGER_PREFIX);
    });

    // Custom submit handler to add logging
    const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;
        console.log("Submitting payload:", [...messages, { role: 'user', content: inputValue }]);
        sendMessage({ text: inputValue });
        setInputValue('');
    };

    return (
        <div className="flex flex-col h-[65vh] bg-white rounded-3xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                <button
                    onClick={onBackToMindmap}
                    className="p-1.5 hover:bg-white/60 rounded-lg transition-colors"
                >
                    <ArrowLeft size={18} className="text-slate-600" />
                </button>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800 truncate">
                        {selectedNode ? `Exploring: ${selectedNode.label}` : 'Concept Chat'}
                    </h3>
                    <p className="text-xs text-slate-500">Ask anything about this concept</p>
                </div>
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <Sparkles size={14} className="text-white" />
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                        <strong>Error:</strong> {error.message || 'Something went wrong. Check console for details.'}
                    </div>
                )}
                {visibleMessages.length === 0 && !isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">
                                {selectedNode
                                    ? 'Starting conversation...'
                                    : 'Tap a node on the mindmap to start exploring'}
                            </p>
                        </div>
                    </div>
                ) : (
                    visibleMessages.map((msg) => {
                        const text = getMessageText(msg);
                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                <div className={`flex-none w-7 h-7 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-blue-600 text-white'
                                    }`}>
                                    {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                                </div>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'user'
                                    ? 'bg-slate-100 text-slate-900 rounded-tr-sm'
                                    : 'bg-blue-50 text-blue-900 rounded-tl-sm border border-blue-100'
                                    }`}>
                                    {msg.role === 'user' ? (
                                        text
                                    ) : (
                                        <MarkdownRenderer content={text} />
                                    )}
                                </div>
                            </motion.div>
                        );
                    })
                )}
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-2.5"
                    >
                        <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center">
                            <Bot size={12} />
                        </div>
                        <div className="bg-blue-50 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 border border-blue-100">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-slate-100 p-3 bg-white">
                <form onSubmit={onFormSubmit} className="relative flex items-center gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Ask a follow-up question..."
                        className="w-full bg-slate-100 text-slate-900 placeholder-slate-400 rounded-full px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all border border-transparent focus:border-blue-200"
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isLoading}
                        className="absolute right-1.5 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors shadow-sm"
                    >
                        <Send size={14} />
                    </button>
                </form>
            </div>
        </div>
    );
}
