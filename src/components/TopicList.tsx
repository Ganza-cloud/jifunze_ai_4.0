'use client';

import { Topic } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, PlayCircle, FileText } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

interface TopicListProps {
    topics: Topic[];
    subjectId: string;
}

export function TopicList({ topics, subjectId }: TopicListProps) {
    return (
        <div className="space-y-4 pb-20">
            {topics.map((topic, index) => (
                <TopicItem key={topic.id} topic={topic} index={index} subjectId={subjectId} />
            ))}
            {topics.length === 0 && (
                <div className="text-center py-20 text-gray-400">
                    <p>No topics generated for this subject yet.</p>
                </div>
            )}
        </div>
    );
}

function TopicItem({ topic, index, subjectId }: { topic: Topic; index: number; subjectId: string }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm"
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
            >
                <span className="font-semibold text-lg text-gray-900">{topic.title}</span>
                <ChevronDown
                    className={`transform transition-transform duration-200 text-gray-400 ${isOpen ? 'rotate-180' : ''
                        }`}
                />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100"
                    >
                        <div className="p-4 space-y-2">
                            {topic.subtopics.map((subtopic) => (
                                <div key={subtopic.id} className="p-4 rounded-xl bg-gray-50">
                                    <h4 className="font-medium text-gray-900 mb-3">{subtopic.title}</h4>
                                    <div className="space-y-2">
                                        {subtopic.concepts.map((concept) => (
                                            <div key={concept.id} className="flex items-center gap-2 text-sm text-gray-600 pl-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                                {concept.title}
                                            </div>
                                        ))}
                                    </div>
                                    <Link href={`/study/${subtopic.id}?topicName=${encodeURIComponent(topic.title)}&subtopicName=${encodeURIComponent(subtopic.title)}&subjectId=${encodeURIComponent(subjectId)}`} className="mt-4 w-full py-2.5 bg-white border border-gray-200 text-blue-600 font-medium rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all flex items-center justify-center gap-2 shadow-sm">
                                        <PlayCircle size={18} />
                                        Start Studying
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
