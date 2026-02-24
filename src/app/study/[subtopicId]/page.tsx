'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { StudyLayout } from '@/components/study/StudyLayout';
import { ChatInterface } from '@/components/study/ChatInterface';
import { SummaryView } from '@/components/study/SummaryView';
import { QuizEngine } from '@/components/study/QuizEngine';
import { motion } from 'framer-motion';

export default function StudyPage() {
    const { subtopicId } = useParams();
    const [activeTab, setActiveTab] = useState<'chat' | 'summary' | 'quiz'>('summary');

    // Mock title derivation (in real app, fetch from store/API)
    const formatTitle = (id: string) => {
        if (!id) return 'Study Session';
        return id.toString().split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    return (
        <StudyLayout
            subtopicTitle={formatTitle(subtopicId as string)}
            activeTab={activeTab}
            onTabChange={setActiveTab}
        >
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full"
            >
                {activeTab === 'chat' && <ChatInterface conceptName={formatTitle(subtopicId as string)} />}
                {activeTab === 'summary' && <SummaryView />}
                {activeTab === 'quiz' && <QuizEngine />}
            </motion.div>
        </StudyLayout>
    );
}
