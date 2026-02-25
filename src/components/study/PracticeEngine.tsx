'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, CheckCircle2, XCircle, ArrowRight, BrainCircuit, Loader2, History, Trash2, ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';
import Confetti from 'react-confetti';
import { toast } from 'sonner';
import { usePracticeStore, QuizType, PracticeSession } from '@/store/usePracticeStore';

type PracticeState = 'library' | 'config' | 'loading' | 'active' | 'result';

interface PracticeEngineProps {
    subjectId: string;
    subtopicName: string;
    topicName: string;
}

export function PracticeEngine({ subjectId, subtopicName, topicName }: PracticeEngineProps) {
    const {
        activeSession,
        pastPractices,
        startSession,
        updateSessionData,
        endSession,
        clearActiveSession,
        deletePastPractice
    } = usePracticeStore();

    const [state, setState] = useState<PracticeState>('library');
    const [quizType, setQuizType] = useState<QuizType>('mcq');
    const [questionCount, setQuestionCount] = useState(5);

    // Local tracking for currently selected answer or revealed solution
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [showSolution, setShowSolution] = useState(false);

    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Initialize state on mount
    useEffect(() => {
        if (activeSession && activeSession.subjectId === subjectId && activeSession.subtopicName === subtopicName) {
            setState('active');
        } else {
            setState('library');
        }
    }, [activeSession, subjectId, subtopicName]);

    const handleGenerate = async () => {
        setState('loading');
        try {
            const res = await fetch('/api/practice/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subjectId,
                    subtopicNames: [subtopicName],
                    type: quizType,
                    count: questionCount
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Generation failed');
            }

            const data = await res.json();

            // Start persisted session
            startSession({
                subjectId,
                subtopicName,
                quizType,
                questions: data.questions,
                currentQuestionIndex: 0,
                score: 0
            });

            setSelectedAnswer(null);
            setShowSolution(false);
            setState('active');
        } catch (error: any) {
            console.error('Failed to generate practice:', error);
            toast.error(error.message);
            setState('config');
        }
    };

    const handleMCQAnswer = (index: number) => {
        if (selectedAnswer !== null || !activeSession) return;

        setSelectedAnswer(index);
        const q = activeSession.questions[activeSession.currentQuestionIndex];

        let newScore = activeSession.score;
        if (index === q.correctIndex) {
            newScore += 1;
        }

        updateSessionData({ score: newScore });
    };

    const handleNext = () => {
        if (!activeSession) return;

        if (activeSession.currentQuestionIndex < activeSession.questions.length - 1) {
            updateSessionData({
                currentQuestionIndex: activeSession.currentQuestionIndex + 1
            });
            setSelectedAnswer(null);
            setShowSolution(false);
        } else {
            endSession();
            setState('result');
        }
    };

    const handleQuitSession = () => {
        if (confirm("Are you sure you want to quit this session? Your progress will be lost.")) {
            clearActiveSession();
            setState('library');
        }
    };

    const renderLibrary = () => {
        const topicPractices = pastPractices.filter(
            p => p.subjectId === subjectId && p.subtopicName === subtopicName
        );

        return (
            <motion.div
                key="library"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col h-full w-full max-w-2xl mx-auto"
            >
                <div className="p-6 md:p-8 flex-1 overflow-y-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">Practice Library</h2>
                            <p className="text-gray-500 text-sm">Past sessions for {subtopicName}</p>
                        </div>
                        <button
                            onClick={() => setState('config')}
                            className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-sm hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <Play size={16} fill="currentColor" />
                            New Practice
                        </button>
                    </div>

                    {topicPractices.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                            <BrainCircuit size={48} className="text-gray-300 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-1">No practices yet</h3>
                            <p className="text-sm text-gray-500 mb-6">Test your knowledge with custom questions.</p>
                            <button
                                onClick={() => setState('config')}
                                className="bg-white border border-gray-200 text-gray-700 rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                            >
                                Start First Session
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {topicPractices.map((practice) => (
                                <div key={practice.id} className="bg-white border border-gray-100 p-5 rounded-xl flex items-center justify-between shadow-sm hover:shadow-md transition-all group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">
                                            {practice.quizType === 'mcq' ? `${Math.round((practice.score / practice.questions.length) * 100)}%` : '—'}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                                {practice.quizType === 'mcq' ? 'Multiple Choice' : 'Exam Style'}
                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                                                    {practice.questions.length} Qs
                                                </span>
                                            </h4>
                                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                                                <History size={12} />
                                                {new Date(practice.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => deletePastPractice(practice.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Session"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        );
    };

    return (
        <div className="h-full bg-gray-50 flex flex-col relative overflow-hidden">
            <AnimatePresence mode="wait">
                {state === 'library' && renderLibrary()}

                {state === 'config' && (
                    <motion.div
                        key="config"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full justify-center relative"
                    >
                        <button
                            onClick={() => setState('library')}
                            className="absolute top-6 left-6 p-2 text-gray-400 hover:text-gray-900 bg-white border border-gray-200 rounded-full shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center group"
                            title="Back to Library"
                        >
                            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                        </button>

                        <h2 className="text-2xl font-bold text-gray-900 mb-2 mt-8 text-center">Configure Session</h2>
                        <p className="text-center text-sm text-gray-500 mb-8">Customize your practice for {subtopicName}</p>

                        <div className="space-y-4 mb-8">
                            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                <label className="text-sm font-semibold text-gray-900 mb-3 block">Testing Mode</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setQuizType('mcq')}
                                        className={clsx(
                                            "py-3 px-4 rounded-xl text-sm font-medium border-2 transition-all",
                                            quizType === 'mcq'
                                                ? "bg-blue-50 border-blue-500 text-blue-700"
                                                : "bg-white border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                                        )}
                                    >
                                        Multiple Choice
                                    </button>
                                    <button
                                        onClick={() => setQuizType('exam')}
                                        className={clsx(
                                            "py-3 px-4 rounded-xl text-sm font-medium border-2 transition-all",
                                            quizType === 'exam'
                                                ? "bg-blue-50 border-blue-500 text-blue-700"
                                                : "bg-white border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50"
                                        )}
                                    >
                                        Exam Style
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-4 text-center bg-gray-50 py-2 rounded-lg">
                                    {quizType === 'mcq' ? 'Speed and recall testing with 4 options.' : 'Deep problem solving on paper.'}
                                </p>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                <label className="text-sm font-semibold text-gray-900 mb-4 flex justify-between">
                                    <span>Question Count</span>
                                    <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{questionCount}</span>
                                </label>
                                <input
                                    type="range"
                                    min="5"
                                    max="20"
                                    step="5"
                                    value={questionCount}
                                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                                    className="w-full accent-blue-600"
                                />
                                <div className="flex justify-between text-xs font-medium text-gray-400 mt-2 px-1">
                                    <span>5</span>
                                    <span>10</span>
                                    <span>15</span>
                                    <span>20</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleGenerate}
                            className="w-full bg-gray-900 text-white rounded-xl py-4 font-semibold shadow-lg hover:bg-black active:scale-[0.98] transition-all flex justify-center items-center gap-2"
                        >
                            Generate Set
                        </button>
                    </motion.div>
                )}

                {state === 'loading' && (
                    <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex-1 flex flex-col items-center justify-center p-8 text-center"
                    >
                        <Loader2 size={40} className="text-blue-600 animate-spin mb-6" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Crafting your session…</h2>
                        <p className="text-sm text-gray-500 max-w-[200px]">Generating custom {quizType === 'mcq' ? 'multiple choice' : 'exam style'} problems based on your notes.</p>
                    </motion.div>
                )}

                {state === 'active' && activeSession && (
                    <motion.div
                        key="active"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex-1 flex flex-col h-full bg-white relative"
                    >
                        {/* Segmented Progress Bar */}
                        <div className="flex gap-1 p-3 bg-white border-b border-gray-100 shadow-sm z-10 sticky top-0">
                            {activeSession.questions.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${idx <= activeSession.currentQuestionIndex ? 'bg-green-500' : 'bg-gray-100'}`}
                                />
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-8 md:px-8">
                            <div className="max-w-2xl mx-auto flex flex-col h-full">
                                <div className="flex justify-between items-center mb-8">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={handleQuitSession}
                                            className="p-1.5 -ml-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                            title="Quit Session"
                                        >
                                            <XCircle size={20} />
                                        </button>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            Question {activeSession.currentQuestionIndex + 1} of {activeSession.questions.length}
                                        </span>
                                    </div>
                                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
                                        {activeSession.quizType === 'mcq' ? 'Multiple Choice' : 'Exam Mode'}
                                    </span>
                                </div>

                                <h3 className={`text-gray-900 leading-relaxed mb-10 ${activeSession.quizType === 'exam' ? 'font-serif text-2xl' : 'text-xl font-medium'}`}>
                                    {activeSession.questions[activeSession.currentQuestionIndex].question}
                                </h3>

                                <div className="space-y-4 pb-24">
                                    {activeSession.quizType === 'mcq' ? (
                                        <>
                                            {activeSession.questions[activeSession.currentQuestionIndex].options?.map((opt: string, idx: number) => {
                                                const isSelected = selectedAnswer === idx;
                                                const isCorrect = idx === activeSession.questions[activeSession.currentQuestionIndex].correctIndex;
                                                const showResult = selectedAnswer !== null;

                                                let styleClass = "border-gray-200 hover:border-blue-400 hover:bg-blue-50 text-gray-700 bg-white";
                                                if (showResult) {
                                                    if (isCorrect) styleClass = "border-green-500 bg-green-50 text-green-800";
                                                    else if (isSelected && !isCorrect) styleClass = "border-red-500 bg-red-50 text-red-800";
                                                    else styleClass = "border-gray-100 opacity-40 bg-white text-gray-400";
                                                } else if (isSelected) {
                                                    styleClass = "border-blue-500 bg-blue-50 text-blue-800";
                                                }

                                                return (
                                                    <button
                                                        key={idx}
                                                        disabled={showResult}
                                                        onClick={() => handleMCQAnswer(idx)}
                                                        className={clsx(
                                                            "w-full p-4 md:p-5 rounded-2xl border-2 text-left transition-all font-medium flex justify-between items-center group",
                                                            styleClass
                                                        )}
                                                    >
                                                        <span className="text-gray-900 flex-1 pr-4">{opt}</span>
                                                        <div className="shrink-0 flex items-center justify-center w-6 h-6">
                                                            {showResult && isCorrect && <CheckCircle2 size={24} className="text-green-600 drop-shadow-sm" />}
                                                            {showResult && isSelected && !isCorrect && <XCircle size={24} className="text-red-500 drop-shadow-sm" />}
                                                            {!showResult && <div className="w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-blue-400 transition-colors" />}
                                                        </div>
                                                    </button>
                                                );
                                            })}

                                            {selectedAnswer !== null && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="mt-8 p-5 md:p-6 bg-blue-50/80 rounded-2xl border border-blue-100"
                                                >
                                                    <p className="text-sm text-blue-900 leading-relaxed">
                                                        <span className="font-bold flex items-center gap-2 mb-2 uppercase tracking-wide text-xs text-blue-800">
                                                            <CheckCircle2 size={16} /> Explanation
                                                        </span>
                                                        {activeSession.questions[activeSession.currentQuestionIndex].explanation}
                                                    </p>
                                                </motion.div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="space-y-6 pt-4">
                                            {!showSolution ? (
                                                <button
                                                    onClick={() => setShowSolution(true)}
                                                    className="w-full py-4 bg-white border-2 border-gray-900 text-gray-900 rounded-2xl font-semibold shadow-sm hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                                >
                                                    Show Solution
                                                </button>
                                            ) : (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="bg-blue-50/50 p-6 md:p-8 rounded-3xl border border-blue-100"
                                                >
                                                    <h4 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                                                        <CheckCircle2 size={20} className="text-blue-500" />
                                                        Solution
                                                    </h4>
                                                    <div className="text-gray-800 leading-relaxed whitespace-pre-wrap font-serif text-lg">
                                                        {activeSession.questions[activeSession.currentQuestionIndex].solutionStepByStep}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Sticky Action Footer */}
                        <AnimatePresence>
                            {((selectedAnswer !== null && activeSession.quizType === 'mcq') || (showSolution && activeSession.quizType === 'exam')) && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 20 }}
                                    className="absolute bottom-0 inset-x-0 p-4 md:p-6 bg-white/90 backdrop-blur-md border-t border-gray-100 z-20 flex justify-center"
                                >
                                    <button
                                        onClick={handleNext}
                                        className="w-full max-w-2xl py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-all shadow-xl shadow-blue-600/20"
                                    >
                                        {activeSession.currentQuestionIndex < activeSession.questions.length - 1 ? 'Next Question' : 'Finish Practice'}
                                        <ArrowRight size={20} />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}

                {state === 'result' && (
                    <motion.div
                        key="result"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex-1 flex flex-col items-center justify-center p-8 text-center"
                    >
                        <Confetti
                            width={windowSize.width}
                            height={windowSize.height}
                            recycle={false}
                            numberOfPieces={500}
                        />

                        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6 text-green-500 shadow-inner">
                            <CheckCircle2 size={48} />
                        </div>

                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Practice Complete!</h2>

                        <div className="bg-white px-8 py-6 rounded-3xl shadow-sm border border-gray-100 my-8 w-full max-w-xs relative overflow-hidden">
                            <div className="absolute top-0 inset-x-0 h-1 bg-green-500" />
                            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider mb-2">Final Score</p>
                            <p className="text-6xl font-black text-gray-900 mb-1">
                                {pastPractices[0]?.score || 0} <span className="text-3xl text-gray-300 font-medium">/ {pastPractices[0]?.questions?.length || questionCount}</span>
                            </p>
                            {pastPractices[0]?.quizType === 'mcq' && (
                                <p className="text-sm text-green-600 font-medium mt-2">
                                    {Math.round(((pastPractices[0]?.score || 0) / (pastPractices[0]?.questions?.length || questionCount)) * 100)}% Accuracy
                                </p>
                            )}
                        </div>

                        <button
                            onClick={() => setState('library')}
                            className="bg-gray-900 text-white rounded-xl px-10 py-4 font-semibold shadow-xl hover:bg-gray-800 active:scale-95 transition-all text-lg"
                        >
                            Back to Library
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
