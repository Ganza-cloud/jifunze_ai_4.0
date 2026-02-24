'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Settings2, CheckCircle2, XCircle, ArrowRight, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { NoQuizzesYet } from '@/components/ui/NoQuizzesYet';

type QuizState = 'start' | 'config' | 'active' | 'result';

export function QuizEngine() {
    const [state, setState] = useState<QuizState>('start');
    const [quizType, setQuizType] = useState<'mcq' | 'exam'>('mcq');
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showSolution, setShowSolution] = useState(false);

    // Mock Question Data - In real app, this comes from props or API
    const questions: any[] = []; // Empty for now to test Empty State

    // If no questions, show the empty state
    if (questions.length === 0) {
        return <NoQuizzesYet />;
    }

    const question = questions[currentQuestion];

    const handleStart = () => setState('config');
    const handleLaunch = () => setState('active');

    const handleAnswer = (index: number) => {
        if (selectedAnswer !== null) return;
        setSelectedAnswer(index);
    };

    return (
        <div className="h-full bg-gray-50 flex flex-col relative overflow-hidden">
            <AnimatePresence mode="wait">
                {state === 'start' && (
                    <motion.div
                        key="start"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex-1 flex flex-col items-center justify-center p-8 text-center"
                    >
                        <div className="w-24 h-24 bg-white rounded-3xl shadow-lg flex items-center justify-center mb-6 text-blue-600">
                            <BookOpen size={48} />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Practice Quiz</h2>
                        <p className="text-gray-500 mb-8 max-w-xs">Test your knowledge on this topic with a quick generated quiz.</p>
                        <button
                            onClick={handleStart}
                            className="w-full max-w-xs bg-blue-600 text-white rounded-xl py-4 font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Play size={20} fill="currentColor" />
                            Start Practice
                        </button>
                    </motion.div>
                )}

                {state === 'config' && (
                    <motion.div
                        key="config"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full justify-center"
                    >
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Quiz Settings</h2>

                        <div className="space-y-4 mb-8">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <label className="text-sm font-medium text-gray-700 mb-3 block">Quiz Type</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setQuizType('mcq')}
                                        className={clsx(
                                            "py-3 px-4 rounded-lg text-sm font-medium border transition-all",
                                            quizType === 'mcq'
                                                ? "bg-blue-50 border-blue-200 text-blue-700"
                                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                                        )}
                                    >
                                        Multiple Choice
                                    </button>
                                    <button
                                        onClick={() => setQuizType('exam')}
                                        className={clsx(
                                            "py-3 px-4 rounded-lg text-sm font-medium border transition-all",
                                            quizType === 'exam'
                                                ? "bg-blue-50 border-blue-200 text-blue-700"
                                                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                                        )}
                                    >
                                        Exam Style
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Question Count</label>
                                <input type="range" min="5" max="20" defaultValue="10" className="w-full accent-blue-600" />
                                <div className="flex justify-between text-xs text-gray-400 mt-1">
                                    <span>5</span>
                                    <span>20</span>
                                </div>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <label className="text-sm font-medium text-gray-700 mb-2 block">Difficulty</label>
                                <div className="flex gap-2">
                                    {['Easy', 'Medium', 'Hard'].map(d => (
                                        <button key={d} className="flex-1 py-2 text-xs font-medium bg-gray-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg border border-transparent hover:border-blue-200 transition-colors">
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleLaunch}
                            className="w-full bg-black text-white rounded-xl py-4 font-semibold shadow-lg hover:bg-gray-800 active:scale-95 transition-all"
                        >
                            Begin Quiz
                        </button>
                    </motion.div>
                )}

                {state === 'active' && (
                    <motion.div
                        key="active"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex-1 flex flex-col"
                    >
                        {/* Progress Bar */}
                        <div className="h-1.5 bg-gray-200 w-full">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: '10%' }}
                                className="h-full bg-green-500"
                            />
                        </div>

                        <div className="flex-1 p-6 flex flex-col max-w-md mx-auto w-full">
                            <div className="flex-1 flex flex-col justify-center">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Question {currentQuestion + 1} of 10</span>
                                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                        {quizType === 'mcq' ? 'Multiple Choice' : 'Exam Mode'}
                                    </span>
                                </div>

                                <h3 className="text-xl font-medium text-gray-900 leading-relaxed mb-8">
                                    {question.text}
                                </h3>

                                <div className="space-y-3">
                                    {quizType === 'mcq' ? (
                                        question.options.map((opt: any, idx: any) => {
                                            const isSelected = selectedAnswer === idx;
                                            const isCorrect = idx === question.correct;
                                            const showResult = selectedAnswer !== null;

                                            let styleClass = "border-gray-200 hover:border-blue-300 hover:bg-blue-50";
                                            if (showResult) {
                                                if (isCorrect) styleClass = "border-green-500 bg-green-50 text-green-700";
                                                else if (isSelected && !isCorrect) styleClass = "border-red-500 bg-red-50 text-red-700";
                                                else styleClass = "border-gray-100 opacity-50";
                                            } else if (isSelected) {
                                                styleClass = "border-blue-500 bg-blue-50 text-blue-700";
                                            }

                                            return (
                                                <button
                                                    key={idx}
                                                    disabled={showResult}
                                                    onClick={() => handleAnswer(idx)}
                                                    className={clsx(
                                                        "w-full p-4 rounded-xl border-2 text-left transition-all font-medium flex justify-between items-center",
                                                        styleClass
                                                    )}
                                                >
                                                    <span>{opt}</span>
                                                    {showResult && isCorrect && <CheckCircle2 size={20} className="text-green-600" />}
                                                    {showResult && isSelected && !isCorrect && <XCircle size={20} className="text-red-600" />}
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <div className="space-y-4">
                                            {!showSolution ? (
                                                <button
                                                    onClick={() => setShowSolution(true)}
                                                    className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                                                >
                                                    Show Solution
                                                </button>
                                            ) : (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="bg-blue-50 p-6 rounded-xl border border-blue-100"
                                                >
                                                    <h4 className="font-semibold text-blue-900 mb-2">Solution</h4>
                                                    <p className="text-blue-800 leading-relaxed text-sm">{question.explanation}</p>

                                                    <div className="mt-6 flex gap-3">
                                                        <button className="flex-1 py-3 bg-white border border-red-200 text-red-600 font-medium rounded-lg hover:bg-red-50">
                                                            I missed it
                                                        </button>
                                                        <button className="flex-1 py-3 bg-white border border-green-200 text-green-600 font-medium rounded-lg hover:bg-green-50">
                                                            I got it
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {(selectedAnswer !== null || (quizType === 'exam' && showSolution)) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-6"
                                >
                                    <button className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors">
                                        Next Question
                                        <ArrowRight size={18} />
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
