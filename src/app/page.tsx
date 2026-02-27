'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { SubjectCard } from '@/components/SubjectCard';
import { AddSubjectModal } from '@/components/AddSubjectModal';
import { Plus, Loader2, MoreHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Subject } from '@/lib/types';

export default function Home() {
    const { subjects, isLoaded, setSubjects, toggleHistory } = useStore();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Hydrate subjects from Supabase on first mount
    useEffect(() => {
        if (isLoaded) return; // Already loaded

        async function fetchSubjects() {
            try {
                const { data, error } = await supabase
                    .from('subjects')
                    .select('id, title, topics, progress, last_studied, mindmap_data')
                    .order('last_studied', { ascending: false });

                if (error) {
                    console.error('[Home] Failed to fetch subjects:', error);
                    setSubjects([]);
                    return;
                }

                const mapped: Subject[] = (data || []).map((row: any) => ({
                    id: row.id,
                    title: row.title,
                    topics: row.topics || [],
                    progress: row.progress || 0,
                    lastStudied: row.last_studied || new Date().toISOString(),
                    mindmap_data: row.mindmap_data || undefined,
                }));

                console.log(`[Home] Loaded ${mapped.length} subjects from Supabase`);
                setSubjects(mapped);
            } catch (err) {
                console.error('[Home] Unexpected error fetching subjects:', err);
                setSubjects([]);
            }
        }

        fetchSubjects();
    }, [isLoaded, setSubjects]);

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <header className="mb-12 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Library</h1>
                        <p className="text-gray-500">Continue learning where you left off</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleHistory}
                            className="p-3 hover:bg-gray-100 rounded-full text-gray-600 transition-colors border border-gray-200"
                        >
                            <MoreHorizontal size={20} />
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition-colors shadow-lg hover:shadow-xl active:scale-95 transform duration-200"
                        >
                            <Plus size={20} />
                            <span className="font-medium">Add Subject</span>
                        </button>
                    </div>
                </header>

                {!isLoaded ? (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
                        <Loader2 size={32} className="animate-spin" />
                        <p className="text-sm font-medium">Loading your library...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {subjects.map((subject) => (
                            <SubjectCard key={subject.id} subject={subject} />
                        ))}

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setIsModalOpen(true)}
                            className="group flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all min-h-[200px]"
                        >
                            <div className="p-4 bg-white rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
                                <Plus size={24} className="text-gray-400 group-hover:text-blue-500" />
                            </div>
                            <span className="font-medium text-gray-500 group-hover:text-blue-600">Create New Unit</span>
                        </motion.button>
                    </div>
                )}
            </div>

            <AddSubjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </main>
    );
}
