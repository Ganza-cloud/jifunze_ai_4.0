'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, BrainCircuit, History, Trash2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface ChatSession {
    id: string;
    subject_id: string;
    subtopic_name: string;
    title: string;
    created_at: string;
}

interface PracticeSession {
    id: string;
    subject_id: string;
    subtopic_name: string;
    score: number;
    total_questions: number;
    created_at: string;
}

export function GlobalHistorySidebar() {
    const { isHistoryOpen, toggleHistory, setActiveSessionId } = useStore();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'chats' | 'practices'>('chats');
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [practiceSessions, setPracticeSessions] = useState<PracticeSession[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isHistoryOpen) {
            fetchHistory();
        }
    }, [isHistoryOpen, activeTab]);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'chats') {
                const { data, error } = await supabase
                    .from('chat_sessions')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                setChatSessions(data || []);
            } else {
                const { data, error } = await supabase
                    .from('practice_sessions')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                setPracticeSessions(data || []);
            }
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChatClick = (session: ChatSession) => {
        setActiveSessionId(session.id);
        toggleHistory();
        // Route to the generic chat page with session ID
        router.push(`/study/${session.id}?subjectId=${session.subject_id}&subtopicName=${encodeURIComponent(session.subtopic_name)}&sessionId=${session.id}&tab=chat`);
    };

    const handlePracticeClick = (session: PracticeSession) => {
        // Since practice results are handled by a modal or local state normally, for now we can route or show modal
        // Simplest implementation: log or toggle a specific practice review state if not implemented otherwise.
        console.log("Practice session click:", session);
        alert(`Practice Result for ${session.subtopic_name}:\nScore: ${session.score}/${session.total_questions}`);
    };

    return (
        <AnimatePresence>
            {isHistoryOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={toggleHistory}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                    />
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col border-l border-gray-100"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <History size={20} className="text-gray-500" />
                                History Library
                            </h2>
                            <button
                                onClick={toggleHistory}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-gray-100 p-2 gap-2 bg-white">
                            <button
                                onClick={() => setActiveTab('chats')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-xl transition-all ${activeTab === 'chats'
                                    ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                                    }`}
                            >
                                <MessageSquare size={16} />
                                Chats
                            </button>
                            <button
                                onClick={() => setActiveTab('practices')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold rounded-xl transition-all ${activeTab === 'practices'
                                    ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                                    }`}
                            >
                                <BrainCircuit size={16} />
                                Practices
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
                            {isLoading ? (
                                <div className="flex justify-center items-center py-12">
                                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : activeTab === 'chats' ? (
                                chatSessions.length === 0 ? (
                                    <EmptyState icon={<MessageSquare size={32} />} message="No chat history yet" />
                                ) : (
                                    <div className="space-y-3">
                                        {chatSessions.map((session) => (
                                            <button
                                                key={session.id}
                                                onClick={() => handleChatClick(session)}
                                                className="w-full text-left bg-white p-4 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
                                            >
                                                <h4 className="font-semibold text-gray-900 truncate pr-4">{session.title}</h4>
                                                <div className="flex items-center justify-between mt-2">
                                                    <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                                                        {session.subtopic_name}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-medium">
                                                        {new Date(session.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )
                            ) : (
                                practiceSessions.length === 0 ? (
                                    <EmptyState icon={<BrainCircuit size={32} />} message="No practice history yet" />
                                ) : (
                                    <div className="space-y-3">
                                        {practiceSessions.map((session) => (
                                            <button
                                                key={session.id}
                                                onClick={() => handlePracticeClick(session)}
                                                className="w-full text-left bg-white p-4 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all flex items-center gap-4"
                                            >
                                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg border border-blue-100">
                                                    {Math.round((session.score / session.total_questions) * 100)}%
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-semibold text-gray-900 truncate">Practice Session</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100 truncate max-w-[120px]">
                                                            {session.subtopic_name}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-medium ml-auto">
                                                            {session.score}/{session.total_questions} Qs
                                                        </span>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

const EmptyState = ({ icon, message }: { icon: React.ReactNode, message: string }) => (
    <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
        <div className="mb-3 opacity-50">{icon}</div>
        <p className="font-medium text-sm">{message}</p>
    </div>
);
