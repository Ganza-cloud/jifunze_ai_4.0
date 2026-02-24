'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface ProcessingOverlayProps {
    message?: string;
}

export function ProcessingOverlay({ message = "Reading your notes..." }: ProcessingOverlayProps) {
    return (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center border border-gray-100"
            >
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <motion.div
                        className="absolute inset-0 border-4 border-blue-600 rounded-full opacity-20"
                        animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    />
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">{message}</h3>

                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mt-4">
                    <motion.div
                        className="h-full bg-blue-600 rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
                    />
                </div>
                <p className="text-xs text-gray-500 mt-4">This might take a few moments</p>
            </motion.div>
        </div>
    );
}
