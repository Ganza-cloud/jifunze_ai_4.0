'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { ChevronRight } from 'lucide-react';

interface BranchNodeData {
    label: string;
    parentId?: string;
    isExpanded?: boolean;
    onToggleExpand?: (nodeId: string) => void;
    onDeepDive?: (label: string, type: string) => void;
    [key: string]: unknown;
}

export function BranchNode({ id, data }: NodeProps) {
    const d = data as BranchNodeData;

    return (
        <div className="relative group">
            <div className="flex items-center gap-0 bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden transition-all duration-200 hover:shadow-xl hover:border-blue-300">
                {/* Expand/Collapse Toggle */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        d.onToggleExpand?.(id);
                    }}
                    className="px-2.5 py-3.5 hover:bg-blue-50 transition-colors border-r border-slate-100"
                    title={d.isExpanded ? 'Collapse' : 'Expand'}
                >
                    <ChevronRight
                        size={14}
                        className={`text-slate-400 transition-transform duration-200 ${d.isExpanded ? 'rotate-90' : ''
                            }`}
                    />
                </button>

                {/* Label — Deep Dive click */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        d.onDeepDive?.(d.label, 'branch');
                    }}
                    className="px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-blue-50 transition-colors whitespace-nowrap"
                >
                    {d.label}
                </button>
            </div>

            {/* Handles */}
            <Handle
                type="target"
                position={Position.Left}
                className="!bg-blue-400 !w-2 !h-2 !border-0"
            />
            <Handle
                type="target"
                position={Position.Top}
                id="target-top"
                className="!bg-blue-400 !w-2 !h-2 !border-0"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!bg-indigo-400 !w-2 !h-2 !border-0"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="source-bottom"
                className="!bg-indigo-400 !w-2 !h-2 !border-0"
            />
        </div>
    );
}
