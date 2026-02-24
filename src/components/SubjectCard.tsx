'use client';

import { Subject } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Clock, Trash2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';
import { useState, useEffect, useRef } from 'react';

interface SubjectCardProps {
    subject: Subject;
}

export function SubjectCard({ subject }: SubjectCardProps) {
    const removeSubject = useStore((state) => state.removeSubject);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmMode, setConfirmMode] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-reset confirm mode after 5 seconds
    useEffect(() => {
        if (confirmMode) {
            timeoutRef.current = setTimeout(() => setConfirmMode(false), 5000);
        }
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [confirmMode]);

    const handleTrashClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmMode(true);
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmMode(false);
    };

    const handleConfirmDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirmMode(false);
        setIsDeleting(true);

        try {
            const res = await fetch('/api/subjects/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subjectId: subject.id }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete');
            }

            removeSubject(subject.id);
            toast.success(`"${subject.title}" deleted.`);
        } catch (err: any) {
            console.error('Delete failed:', err);
            toast.error(`Delete failed: ${err.message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Link href={`/subject/${subject.id}`}>
            <motion.div
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className={`group relative overflow-hidden rounded-2xl border p-6 shadow-sm hover:shadow-md transition-all cursor-pointer h-full ${isDeleting ? 'opacity-50 pointer-events-none' : ''
                    } ${confirmMode
                        ? 'bg-red-50 border-red-200'
                        : 'bg-white border-gray-100'
                    }`}
            >
                {/* Delete / Confirm UI */}
                <AnimatePresence mode="wait">
                    {confirmMode ? (
                        <motion.div
                            key="confirm"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-red-50/95 backdrop-blur-sm rounded-2xl"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                            <AlertTriangle size={32} className="text-red-500 mb-3" />
                            <p className="text-sm font-semibold text-red-800 mb-1 text-center">
                                Delete &ldquo;{subject.title}&rdquo;?
                            </p>
                            <p className="text-xs text-red-600 mb-4 text-center">
                                All notes and data will be permanently removed.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={handleCancel}
                                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.button
                            key="trash"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={handleTrashClick}
                            disabled={isDeleting}
                            className="absolute top-3 right-3 p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all z-10"
                            title="Delete subject"
                        >
                            <Trash2 size={16} />
                        </motion.button>
                    )}
                </AnimatePresence>

                <div className="flex flex-col h-full justify-between">
                    <div>
                        <div className="mb-4 flex items-center justify-between">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                <BookOpen size={20} />
                            </div>
                            <span className="text-xs font-medium text-gray-400 flex items-center gap-1 mr-6">
                                <Clock size={12} />
                                {new Date(subject.lastStudied).toLocaleDateString()}
                            </span>
                        </div>

                        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                            {subject.title}
                        </h3>

                        <p className="text-sm text-gray-500 mb-4">
                            {subject.topics.length} Topics • {subject.progress}% Complete
                        </p>
                    </div>

                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${subject.progress}%` }}
                            transition={{ duration: 1, delay: 0.2 }}
                            className="bg-blue-600 h-2 rounded-full"
                        />
                    </div>
                </div>
            </motion.div>
        </Link>
    );
}
