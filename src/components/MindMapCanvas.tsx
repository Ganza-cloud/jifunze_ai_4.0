'use client';

import { motion } from 'framer-motion';
import { Subject } from '@/lib/types';

interface MindMapCanvasProps {
    subject: Subject;
}

export function MindMapCanvas({ subject }: MindMapCanvasProps) {
    return (
        <div className="h-[60vh] relative bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden flex items-center justify-center">
            {/* Background Dots */}
            <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)',
                backgroundSize: '20px 20px'
            }}></div>

            {/* Center Node */}
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
                className="relative z-10 w-32 h-32 bg-blue-600 rounded-full flex items-center justify-center shadow-xl shadow-blue-200"
            >
                <span className="text-white font-bold text-center px-4">{subject.title}</span>

                {/* Connecting Lines (Simulated with absolute divs for now) */}
                <div className="absolute top-1/2 left-1/2 w-[200px] h-[2px] bg-blue-300 origin-left -rotate-45 -z-10" />
                <div className="absolute top-1/2 left-1/2 w-[150px] h-[2px] bg-blue-300 origin-left rotate-12 -z-10" />
                <div className="absolute top-1/2 left-1/2 w-[180px] h-[2px] bg-blue-300 origin-left rotate-[130deg] -z-10" />
            </motion.div>

            {/* Satellite Nodes */}
            <MockNode label="Key Concepts" x={-120} y={-100} delay={0.2} />
            <MockNode label="History" x={140} y={20} delay={0.3} />
            <MockNode label="Applications" x={-80} y={120} delay={0.4} />

            <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur px-3 py-1 rounded-full text-xs text-slate-400 border border-slate-100">
                Interactive Canvas (Preview)
            </div>
        </div>
    );
}

function MockNode({ label, x, y, delay }: { label: string; x: number; y: number; delay: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1, x, y }}
            transition={{ delay, type: 'spring' }}
            className="absolute bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 text-slate-600 font-medium text-sm"
        >
            {label}
        </motion.div>
    );
}
