'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';

export function RootNode({ data }: NodeProps) {
    return (
        <div className="relative group">
            <div className="w-36 h-36 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 shadow-xl shadow-blue-200/50 flex items-center justify-center cursor-default transition-transform duration-200 group-hover:scale-105">
                <span className="text-white font-bold text-center px-4 text-sm leading-tight drop-shadow-sm">
                    {(data as any).label}
                </span>
            </div>
            <Handle
                type="source"
                position={Position.Right}
                className="!bg-blue-400 !w-2 !h-2 !border-0"
            />
            <Handle
                type="source"
                position={Position.Left}
                id="left"
                className="!bg-blue-400 !w-2 !h-2 !border-0"
            />
            <Handle
                type="source"
                position={Position.Top}
                id="top"
                className="!bg-blue-400 !w-2 !h-2 !border-0"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                className="!bg-blue-400 !w-2 !h-2 !border-0"
            />
        </div>
    );
}
