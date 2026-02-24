'use client';

import { Subject } from '@/lib/types';
import { motion } from 'framer-motion';
import { BookOpen, Clock, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';
import { useState } from 'react';

interface SubjectCardProps {
    subject: Subject;
}

export function SubjectCard({ subject }: SubjectCardProps) {
    const removeSubject = useStore((state) => state.removeSubject);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault(); // Prevent navigation from the Link
        e.stopPropagation();

        if (!confirm(`Delete "${subject.title}"? This will permanently remove all notes and vectors.`)) {
            return;
        }

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
                className={`group relative overflow-hidden rounded-2xl bg-white border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer h-full ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
            >
                {/* Delete button */}
                <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="absolute top-3 right-3 p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all z-10"
                    title="Delete subject"
                >
                    <Trash2 size={16} />
                </button>

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
