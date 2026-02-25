'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { StudyLayout } from '@/components/study/StudyLayout';
import { ChatInterface } from '@/components/study/ChatInterface';
import { SummaryView } from '@/components/study/SummaryView';
import { PracticeEngine } from '@/components/study/PracticeEngine';
import { motion } from 'framer-motion';

function StudyPageContent() {
    const { subtopicId } = useParams();
    const searchParams = useSearchParams();

    const topicName = searchParams.get('topicName') || '';
    const subtopicName = searchParams.get('subtopicName') || '';
    const subjectId = searchParams.get('subjectId') || '';

    const [activeTab, setActiveTab] = useState<'chat' | 'summary' | 'practice'>('summary');

    // Build a human-readable header: "Topic > Subtopic" or just subtopic name
    const headerTitle = topicName && subtopicName
        ? `${topicName} › ${subtopicName}`
        : subtopicName || (subtopicId as string) || 'Study Session';

    return (
        <StudyLayout
            subtopicTitle={headerTitle}
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
                {activeTab === 'chat' && (
                    <ChatInterface
                        conceptName={subtopicName}
                        subjectId={subjectId}
                        subjectName=""
                        subtopicName={subtopicName}
                    />
                )}
                {activeTab === 'summary' && (
                    <SummaryView
                        subjectId={subjectId}
                        subtopicName={subtopicName}
                        topicName={topicName}
                    />
                )}
                {activeTab === 'practice' && (
                    <PracticeEngine
                        subjectId={subjectId}
                        subtopicName={subtopicName}
                        topicName={topicName}
                    />
                )}
            </motion.div>
        </StudyLayout>
    );
}

export default function StudyPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>}>
            <StudyPageContent />
        </Suspense>
    );
}
