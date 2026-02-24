'use client';

import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ProcessingOverlayProps {
    progress: number;      // 0-100
    stepName: string;      // "Reading your PDF"
    details: string;       // "Extracting text from main.pdf…"
    error?: string | null; // Error message if failed
}

export function ProcessingOverlay({ progress, stepName, details, error }: ProcessingOverlayProps) {
    const isComplete = progress >= 100 && !error;

    return (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[60] flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center border border-gray-100"
            >
                {/* Icon */}
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 relative ${error ? 'bg-red-50 text-red-600'
                        : isComplete ? 'bg-green-50 text-green-600'
                            : 'bg-blue-50 text-blue-600'
                    }`}>
                    {error ? (
                        <AlertCircle className="w-8 h-8" />
                    ) : isComplete ? (
                        <CheckCircle2 className="w-8 h-8" />
                    ) : (
                        <>
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <motion.div
                                className="absolute inset-0 border-4 border-blue-600 rounded-full opacity-20"
                                animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        </>
                    )}
                </div>

                {/* Step Name */}
                <h3 className={`text-xl font-bold mb-2 ${error ? 'text-red-800' : 'text-gray-900'
                    }`}>
                    {error ? 'Something went wrong' : isComplete ? 'All done!' : stepName}
                </h3>

                {/* Progress Bar */}
                {!error && (
                    <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mt-4">
                        <motion.div
                            className={`h-full rounded-full ${isComplete ? 'bg-green-500' : 'bg-blue-600'}`}
                            initial={{ width: '0%' }}
                            animate={{ width: `${Math.min(progress, 100)}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                    </div>
                )}

                {/* Percentage */}
                {!error && !isComplete && (
                    <p className="text-sm font-semibold text-blue-600 mt-2">
                        {Math.round(progress)}%
                    </p>
                )}

                {/* Details or Error message */}
                <p className={`text-xs mt-3 ${error ? 'text-red-600' : 'text-gray-500'}`}>
                    {error || details}
                </p>
            </motion.div>
        </div>
    );
}
