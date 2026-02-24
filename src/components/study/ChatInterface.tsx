'use client';

import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { motion } from 'framer-motion';
import { Send, Sparkles, User, Bot } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';

const STARTER_PROMPTS = [
    "Explain the basic concept",
    "Give me a real-world example",
    "How does this relate to previous topics?",
    "Create a practice problem"
];

interface ChatInterfaceProps {
    conceptName?: string;
}

export function ChatInterface({ conceptName }: ChatInterfaceProps = {}) {
    const { subtopicId } = useParams();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [inputValue, setInputValue] = useState('');

    const {
        messages,
        sendMessage,
        status,
        error
    } = useChat({
        transport: new TextStreamChatTransport({
            api: '/api/chat',
            body: { subtopicId, conceptName },
        }),
        onError: (err) => {
            console.error('[ChatInterface] useChat error:', err);
        },
    });

    const isLoading = status === 'submitted' || status === 'streaming';

    // Debug: log status changes
    useEffect(() => {
        console.log('[ChatInterface] status:', status, 'messages:', messages.length, 'error:', error?.message);
    }, [status, messages.length, error]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleStarterClick = (prompt: string) => {
        sendMessage({ text: prompt });
    };

    const onFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;
        console.log("Submitting payload:", [...messages, { role: 'user', content: inputValue }]);
        sendMessage({ text: inputValue });
        setInputValue('');
    };

    // Helper to extract text content from a message's parts
    const getMessageText = (msg: (typeof messages)[number]): string => {
        return msg.parts
            ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map((p) => p.text)
            .join('') || '';
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-2">
                        <strong>Error:</strong> {error.message || 'Something went wrong. Check console for details.'}
                    </div>
                )}
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2">
                            <Sparkles size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-gray-900">How can I help you learn?</h3>
                            <p className="text-sm text-gray-500 mt-1">Ask me anything about this topic.</p>
                        </div>
                        <div className="grid gap-2 w-full max-w-sm">
                            {STARTER_PROMPTS.map((prompt) => (
                                <button
                                    key={prompt}
                                    onClick={() => handleStarterClick(prompt)}
                                    className="px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm text-gray-700 rounded-xl transition-colors text-left border border-gray-100 hover:border-gray-200"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const text = getMessageText(msg);
                        return (
                            <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                <div className={`flex-none w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-gray-900 text-white' : 'bg-blue-600 text-white'
                                    }`}>
                                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                                </div>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user'
                                    ? 'bg-gray-100 text-gray-900 rounded-tr-none'
                                    : 'bg-blue-50 text-blue-900 rounded-tl-none border border-blue-100'
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
                        className="flex gap-3"
                    >
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center">
                            <Bot size={14} />
                        </div>
                        <div className="bg-gray-50 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 p-4">
                <form onSubmit={onFormSubmit} className="relative flex items-center gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type your question..."
                        className="w-full bg-gray-100 text-gray-900 placeholder-gray-500 rounded-full px-5 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all border border-transparent focus:border-blue-200"
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim() || isLoading}
                        className="absolute right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
                    >
                        <Send size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
}
