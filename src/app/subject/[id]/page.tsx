'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TopicList } from '@/components/TopicList';
import { InteractiveMindmap } from '@/components/InteractiveMindmap';
import { PracticeLibrary } from '@/components/study/PracticeLibrary';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, List, Share2, MoreHorizontal, Loader2, MessageCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { supabase } from '@/lib/supabase';
import { Subject } from '@/lib/types';

type TabKey = 'topics' | 'mindmap' | 'practice';
const TABS: { key: TabKey; label: string }[] = [
    { key: 'topics', label: 'Topical Breakdown' },
    { key: 'mindmap', label: 'Mind Map' },
    { key: 'practice', label: 'Practice' },
];

export default function SubjectPage() {
    const { id } = useParams();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabKey>('topics');
    const [subject, setSubject] = useState<Subject | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<{ label: string; type: string } | null>(null);

    // Track numeric index for directional sliding
    const tabIndex = (key: TabKey) => TABS.findIndex((t) => t.key === key);
    const [[page, direction], setPage] = useState([0, 0]);

    const switchTab = useCallback((newTab: TabKey) => {
        if (newTab === activeTab) return;
        const newDirection = tabIndex(newTab) > tabIndex(activeTab) ? 1 : -1;
        setPage([page + newDirection, newDirection]);
        setActiveTab(newTab);
    }, [activeTab, page]);

    // When a mindmap node is clicked
    const handleNodeClick = useCallback((label: string, type: string) => {
        setSelectedNode({ label, type });
        // The mindmap internal component now handles opening the chat drawer
    }, []);

    const handleBackToMindmap = useCallback(() => {
        switchTab('mindmap');
    }, [switchTab]);

    // Animation variants for the slide effect
    const slideVariants = {
        enter: (dir: number) => ({
            x: dir > 0 ? '100%' : '-100%',
            opacity: 0,
            position: 'absolute' as const,
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            position: 'relative' as const,
        },
        exit: (dir: number) => ({
            zIndex: 0,
            x: dir < 0 ? '100%' : '-100%',
            opacity: 0,
            position: 'absolute' as const,
        }),
    };

    useEffect(() => {
        async function fetchSubject() {
            try {
                const { data, error } = await supabase
                    .from('subjects')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                if (!data) throw new Error('Subject not found');

                setSubject({
                    id: data.id,
                    title: data.title,
                    lastStudied: data.last_studied || new Date().toISOString(),
                    progress: data.progress || 0,
                    topics: data.topics || [],
                    mindmap_data: data.mindmap_data || undefined,
                });
            } catch (err: any) {
                console.error('Error fetching subject:', err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        }

        if (id) {
            fetchSubject();
        }
    }, [id]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (error || !subject) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900">Subject Not Found</h2>
                    <p className="text-gray-500 mt-2">{error || "We couldn't find that subject."}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="mt-4 text-blue-600 hover:underline"
                    >
                        Return Home
                    </button>
                </div>
            </div>
        );
    }

    // Compute active tab highlight position (percentages for 3 tabs)
    const activeIndex = tabIndex(activeTab);
    const tabWidth = 100 / TABS.length;

    return (
        <main className="min-h-screen bg-gray-50 overflow-x-hidden">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200">
                <div className="max-w-3xl mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        <button
                            onClick={() => router.push('/')}
                            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h1 className="font-bold text-lg text-gray-900">{subject.title}</h1>
                        <button className="p-2 -mr-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
                            <MoreHorizontal size={20} />
                        </button>
                    </div>

                    {/* Navigation Tabs — 3-way */}
                    <div className="flex p-1 bg-gray-100/50 rounded-xl mb-4 relative">
                        {/* Animated Highlight */}
                        <motion.div
                            className="absolute top-1 bottom-1 bg-white rounded-lg shadow-sm"
                            initial={false}
                            animate={{
                                left: `calc(${activeIndex * tabWidth}% + 4px)`,
                                width: `calc(${tabWidth}% - 8px)`,
                            }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />

                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => switchTab(tab.key)}
                                className={clsx(
                                    "flex-1 py-2.5 text-xs sm:text-sm font-medium rounded-lg relative z-10 transition-colors",
                                    activeTab === tab.key ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-3xl mx-auto px-4 py-6 relative">
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                    <motion.div
                        key={page}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            x: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 }
                        }}
                        className="w-full"
                    >
                        {activeTab === 'topics' && (
                            <TopicList topics={subject.topics} subjectId={subject.id} />
                        )}
                        {activeTab === 'mindmap' && (
                            <InteractiveMindmap
                                subjectId={subject.id}
                                onNodeClick={handleNodeClick}
                            />
                        )}
                        {activeTab === 'practice' && (
                            <PracticeLibrary subject={subject} />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </main>
    );
}
