'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileText, Plus, Loader2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Subject } from '@/lib/types';
import { ProcessingOverlay } from '@/components/ui/ProcessingOverlay';
import { toast } from 'sonner';

interface AddSubjectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AddSubjectModal({ isOpen, onClose }: AddSubjectModalProps) {
    const [title, setTitle] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [suppFiles, setSuppFiles] = useState<File[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const addSubject = useStore((state) => state.addSubject);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const suppFileInputRef = useRef<HTMLInputElement>(null);

    // SSE progress state
    const [progress, setProgress] = useState(0);
    const [stepName, setStepName] = useState('Starting…');
    const [details, setDetails] = useState('');
    const [streamError, setStreamError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSuppFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSuppFiles(Array.from(e.target.files));
        }
    };

    const handleGenerate = async () => {
        if (!title || !file) {
            toast.error('Please provide a title and upload a file.');
            return;
        }

        setIsGenerating(true);
        setProgress(0);
        setStepName('Starting…');
        setDetails('Uploading your files…');
        setStreamError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            suppFiles.forEach(f => formData.append('suppFiles', f));
            formData.append('title', title);

            const response = await fetch('/api/ingest', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok || !response.body) {
                throw new Error('Failed to start processing. Please try again.');
            }

            // Read SSE stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse complete SSE events from buffer
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || ''; // Keep incomplete last chunk

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data: ')) continue;

                    try {
                        const event = JSON.parse(trimmed.slice(6));

                        if (event.type === 'progress') {
                            setProgress(event.percentage);
                            setStepName(event.step);
                            setDetails(event.details);
                        } else if (event.type === 'complete') {
                            setProgress(100);
                            setStepName('All done!');
                            setDetails('Your course is ready');

                            const newSubject: Subject = {
                                id: event.subjectId,
                                title,
                                lastStudied: new Date().toISOString(),
                                progress: 0,
                                topics: [],
                            };

                            addSubject(newSubject);

                            // Brief pause to show completion state
                            await new Promise(r => setTimeout(r, 1200));
                            toast.success('Subject created successfully!');
                            onClose();
                            setTitle('');
                            setFile(null);
                            setSuppFiles([]);
                            setIsGenerating(false);
                            return;
                        } else if (event.type === 'error') {
                            setStreamError(event.message);
                            // Keep overlay visible with error state for 3s, then dismiss
                            await new Promise(r => setTimeout(r, 3000));
                            setIsGenerating(false);
                            return;
                        }
                    } catch {
                        // Skip malformed events
                    }
                }
            }

            // If stream ends without a complete event, treat as error
            if (!streamError) {
                setStreamError('Processing ended unexpectedly. Please try again.');
                await new Promise(r => setTimeout(r, 3000));
                setIsGenerating(false);
            }

        } catch (error: any) {
            console.error('Generation failed:', error);
            setStreamError(error.message);
            toast.error(`Error: ${error.message}`);
            // Keep overlay with error for 3s
            await new Promise(r => setTimeout(r, 3000));
            setIsGenerating(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
                        >
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-gray-900">Add New Subject</h2>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Subject Name
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g. Linear Algebra II"
                                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Main Reference Material
                                    </label>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer group ${file ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50'
                                            }`}
                                    >
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept=".pdf"
                                            className="hidden"
                                        />
                                        <div className={`p-3 rounded-full mb-3 transition-colors ${file ? 'bg-blue-100' : 'bg-gray-50 group-hover:bg-white'
                                            }`}>
                                            <Upload className={file ? "text-blue-600" : "text-gray-400 group-hover:text-blue-500"} size={24} />
                                        </div>
                                        <p className="text-sm font-medium text-gray-600">
                                            {file ? file.name : 'Click to upload textbook PDF'}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">MAX 50MB</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Supplementary Materials
                                    </label>
                                    <div
                                        onClick={() => suppFileInputRef.current?.click()}
                                        className="border border-gray-200 rounded-lg p-4 flex flex-col gap-3 hover:bg-gray-50 cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-gray-100 rounded-lg">
                                                <FileText size={20} className="text-gray-500" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-600">Add lecture notes, slides, etc.</p>
                                            </div>
                                            <Plus size={18} className="text-gray-400" />
                                        </div>
                                        {suppFiles.length > 0 && (
                                            <ul className="text-sm text-gray-600 list-disc list-inside mt-2">
                                                {suppFiles.map((f, i) => (
                                                    <li key={i}>{f.name}</li>
                                                ))}
                                            </ul>
                                        )}
                                        <input
                                            type="file"
                                            ref={suppFileInputRef}
                                            onChange={handleSuppFileChange}
                                            accept=".pdf"
                                            multiple
                                            className="hidden"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={!title || !file || isGenerating}
                                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            Processing…
                                        </>
                                    ) : (
                                        'Generate Course'
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                    {isGenerating && (
                        <ProcessingOverlay
                            progress={progress}
                            stepName={stepName}
                            details={details}
                            error={streamError}
                        />
                    )}
                </>
            )}
        </AnimatePresence>
    );
}
