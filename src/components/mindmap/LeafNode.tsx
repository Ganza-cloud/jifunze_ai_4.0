'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

interface LeafNodeData {
    label: string;
    parentId?: string;
    onDeepDive?: (label: string, type: string) => void;
    [key: string]: unknown;
}

export function LeafNode({ data }: NodeProps) {
    const d = data as LeafNodeData;

    return (
        <div className="relative group">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    d.onDeepDive?.(d.label, 'leaf');
                }}
                className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-full border border-blue-200 shadow-sm shadow-blue-100/50 text-xs font-medium text-blue-700 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 hover:shadow-md transition-all duration-200 whitespace-nowrap max-w-[160px] truncate"
            >
                {d.label}
            </button>

            <Handle
                type="target"
                position={Position.Left}
                className="!bg-indigo-300 !w-1.5 !h-1.5 !border-0"
            />
            <Handle
                type="target"
                position={Position.Top}
                id="target-top"
                className="!bg-indigo-300 !w-1.5 !h-1.5 !border-0"
            />
        </div>
    );
}
