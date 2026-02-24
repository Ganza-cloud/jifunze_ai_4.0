'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ReactFlow,
    ReactFlowProvider,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    BackgroundVariant,
    type Node,
    type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { RootNode } from './mindmap/RootNode';
import { BranchNode } from './mindmap/BranchNode';
import { LeafNode } from './mindmap/LeafNode';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface InteractiveMindmapProps {
    subjectId: string;
    onNodeClick: (label: string, type: string) => void;
}

function MindmapCanvas({ subjectId, onNodeClick }: InteractiveMindmapProps) {
    const [allNodes, setAllNodes] = useState<Node[]>([]);
    const [allEdges, setAllEdges] = useState<Edge[]>([]);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const [expandedBranches, setExpandedBranches] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Custom node types with callbacks injected via data
    const nodeTypes = useMemo(() => ({
        root: RootNode,
        branch: BranchNode,
        leaf: LeafNode,
    }), []);

    // Fetch mindmap data
    const fetchMindmap = useCallback(async (forceRegenerate = false) => {
        try {
            setIsLoading(true);
            setError(null);

            const res = await fetch('/api/generate-mindmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subjectId, forceRegenerate }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to generate mindmap');
            }

            const data = await res.json();

            // Store ALL nodes/edges as the source of truth
            setAllNodes(data.nodes || []);
            setAllEdges(data.edges || []);
        } catch (err: any) {
            console.error('[InteractiveMindmap] Error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [subjectId]);

    useEffect(() => {
        if (subjectId) {
            fetchMindmap(false);
        }
    }, [subjectId, fetchMindmap]);

    // Toggle expand/collapse for a branch
    const handleToggleExpand = useCallback((branchId: string) => {
        setExpandedBranches(prev => {
            const next = new Set(prev);
            if (next.has(branchId)) {
                next.delete(branchId);
            } else {
                next.add(branchId);
            }
            return next;
        });
    }, []);

    // Deep dive handler
    const handleDeepDive = useCallback((label: string, type: string) => {
        onNodeClick(label, type);
    }, [onNodeClick]);

    // Compute visible nodes/edges based on expand state
    useEffect(() => {
        if (allNodes.length === 0) return;

        // Inject callbacks into node data
        const visibleNodes: Node[] = [];
        const visibleEdges: Edge[] = [];

        for (const node of allNodes) {
            const nodeType = node.type as string;

            if (nodeType === 'root') {
                visibleNodes.push(node);
            } else if (nodeType === 'branch') {
                visibleNodes.push({
                    ...node,
                    data: {
                        ...node.data,
                        isExpanded: expandedBranches.has(node.id),
                        onToggleExpand: handleToggleExpand,
                        onDeepDive: handleDeepDive,
                    },
                });
            } else if (nodeType === 'leaf') {
                // Only show leaf if its parent branch is expanded
                const parentId = (node.data as any).parentId;
                if (parentId && expandedBranches.has(parentId)) {
                    visibleNodes.push({
                        ...node,
                        data: {
                            ...node.data,
                            onDeepDive: handleDeepDive,
                        },
                    });
                }
            }
        }

        // Only show edges whose source AND target are visible
        const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
        for (const edge of allEdges) {
            if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
                visibleEdges.push(edge);
            }
        }

        setNodes(visibleNodes);
        setEdges(visibleEdges);
    }, [allNodes, allEdges, expandedBranches, handleToggleExpand, handleDeepDive, setNodes, setEdges]);

    if (isLoading) {
        return (
            <div className="h-[65vh] bg-slate-50 rounded-3xl border border-slate-200 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm text-slate-500">Generating your knowledge graph...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-[65vh] bg-slate-50 rounded-3xl border border-slate-200 flex flex-col items-center justify-center gap-3">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <p className="text-sm text-red-600">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                    <RefreshCw size={14} />
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Regenerate Button */}
            <div className="flex justify-end mb-2">
                <button
                    onClick={() => fetchMindmap(true)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all disabled:opacity-50 shadow-sm"
                    title="Regenerate Mindmap"
                >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    Regenerate
                </button>
            </div>
            <div className="h-[65vh] rounded-3xl border border-slate-200 overflow-hidden bg-white">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.3 }}
                    panOnDrag
                    zoomOnPinch
                    zoomOnScroll
                    minZoom={0.3}
                    maxZoom={2}
                    defaultEdgeOptions={{
                        style: { stroke: '#94a3b8', strokeWidth: 2 },
                        animated: true,
                    }}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
                    <Controls
                        showInteractive={false}
                        className="!bg-white !border-slate-200 !shadow-lg !rounded-xl"
                    />
                </ReactFlow>
            </div>
        </div>
    );
}

// Wrap in provider as required by React Flow
export function InteractiveMindmap(props: InteractiveMindmapProps) {
    return (
        <ReactFlowProvider>
            <MindmapCanvas {...props} />
        </ReactFlowProvider>
    );
}
