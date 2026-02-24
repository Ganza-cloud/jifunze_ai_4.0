'use client';

import { BookOpen, HelpCircle } from 'lucide-react';

export function NoQuizzesYet() {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6 relative group">
                <HelpCircle className="w-10 h-10 text-indigo-400" />
                <div className="absolute top-2 right-4 transform rotate-12">
                    <BookOpen className="w-6 h-6 text-indigo-200" />
                </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2">No Quizzes Available</h3>
            <p className="text-gray-500 max-w-xs mb-6">
                Start chatting or reading summaries to generate personalized quizzes for this topic.
            </p>

            <button
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-sm shadow-indigo-200"
                onClick={() => window.alert("Generating a quiz... (Feature coming soon!)")}
            >
                Generate Quiz
            </button>
        </div>
    );
}
