'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MessageSquare, FileText, BrainCircuit } from 'lucide-react';
import Link from 'next/link';

interface StudyLayoutProps {
    subtopicTitle: string;
    activeTab: 'chat' | 'summary' | 'practice';
    onTabChange: (tab: 'chat' | 'summary' | 'practice') => void;
    children: ReactNode;
}

export function StudyLayout({ subtopicTitle, activeTab, onTabChange, children }: StudyLayoutProps) {

    const tabs = [
        { id: 'chat', icon: MessageSquare, label: 'AI Tutor' },
        { id: 'summary', icon: FileText, label: 'Summary' },
        { id: 'practice', icon: BrainCircuit, label: 'Practice' },
    ] as const;

    return (
        <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
            {/* Sticky Header */}
            <header className="flex-none bg-white border-b border-gray-200 z-50">
                <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="p-2 -ml-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className="font-semibold text-gray-900 truncate max-w-[200px] sm:max-w-md">
                            {subtopicTitle || 'Study Session'}
                        </h1>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="max-w-2xl mx-auto px-4 flex border-t border-gray-100">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange(tab.id)}
                                className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 relative ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                                    } transition-colors`}
                            >
                                <Icon size={20} />
                                <span className="text-[10px] font-medium uppercase tracking-wider">{tab.label}</span>
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTabIndicator"
                                        className="absolute bottom-0 w-full h-0.5 bg-blue-600"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            </header>

            {/* Main Content Area (Slide Container) */}
            <main className="flex-1 relative w-full max-w-2xl mx-auto bg-white shadow-sm sm:border-x border-gray-100 overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                    {children}
                </AnimatePresence>
            </main>
        </div>
    );
}
