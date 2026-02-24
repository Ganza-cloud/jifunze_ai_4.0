import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withFallback } from '@/lib/llm';
import { generateObject } from 'ai';
import { z } from 'zod';
import { MindmapNode, MindmapEdge } from '@/lib/types';

export const maxDuration = 60;

// Zod schema: LLM outputs a tree, we compute positions ourselves
const mindmapTreeSchema = z.object({
    subject: z.object({
        label: z.string(),
        topics: z.array(z.object({
            id: z.string(),
            label: z.string(),
            concepts: z.array(z.object({
                id: z.string(),
                label: z.string(),
            }))
        }))
    })
});

/**
 * Compute radial positions for nodes so the graph looks like a proper mindmap.
 * Root at center, branches in a circle, leaves around each branch.
 */
function computeLayout(tree: z.infer<typeof mindmapTreeSchema>): {
    nodes: MindmapNode[];
    edges: MindmapEdge[];
} {
    const nodes: MindmapNode[] = [];
    const edges: MindmapEdge[] = [];

    const rootId = 'root';
    const centerX = 0;
    const centerY = 0;

    // Root node
    nodes.push({
        id: rootId,
        type: 'root',
        position: { x: centerX, y: centerY },
        data: { label: tree.subject.label },
    });

    const topics = tree.subject.topics;
    const branchRadius = 300;
    const leafRadius = 160;

    topics.forEach((topic, i) => {
        // Distribute branches evenly around the root
        const angle = (2 * Math.PI * i) / topics.length - Math.PI / 2;
        const bx = centerX + branchRadius * Math.cos(angle);
        const by = centerY + branchRadius * Math.sin(angle);

        const branchId = `branch-${topic.id}`;
        nodes.push({
            id: branchId,
            type: 'branch',
            position: { x: bx, y: by },
            data: { label: topic.label, parentId: rootId },
        });
        edges.push({
            id: `e-${rootId}-${branchId}`,
            source: rootId,
            target: branchId,
        });

        // Distribute leaves around each branch
        const concepts = topic.concepts;
        concepts.forEach((concept, j) => {
            const leafAngle = angle + ((j - (concepts.length - 1) / 2) * 0.4);
            const lx = bx + leafRadius * Math.cos(leafAngle);
            const ly = by + leafRadius * Math.sin(leafAngle);

            const leafId = `leaf-${concept.id}`;
            nodes.push({
                id: leafId,
                type: 'leaf',
                position: { x: lx, y: ly },
                data: { label: concept.label, parentId: branchId },
            });
            edges.push({
                id: `e-${branchId}-${leafId}`,
                source: branchId,
                target: leafId,
            });
        });
    });

    return { nodes, edges };
}

export async function POST(req: NextRequest) {
    try {
        const { subjectId } = await req.json();

        if (!subjectId) {
            return NextResponse.json({ error: 'subjectId is required' }, { status: 400 });
        }

        // Check if we already have mindmap data cached
        const { data: subject, error: fetchError } = await supabase
            .from('subjects')
            .select('title, topics, mindmap_data')
            .eq('id', subjectId)
            .single();

        if (fetchError || !subject) {
            return NextResponse.json({ error: 'Subject not found' }, { status: 404 });
        }

        // Return cached data if it exists
        if (subject.mindmap_data && subject.mindmap_data.nodes?.length > 0) {
            console.log('[generate-mindmap] Returning cached mindmap data');
            return NextResponse.json(subject.mindmap_data);
        }

        // Build a text representation of topics for the LLM
        const topicsText = JSON.stringify(subject.topics || [], null, 2);

        console.log('[generate-mindmap] Generating mindmap for:', subjectId);

        const { object: tree } = await withFallback((model) =>
            generateObject({
                model,
                schema: mindmapTreeSchema,
                prompt: `You are analyzing a course called "${subject.title}". 
Based on the following topic structure, generate a mindmap tree.

TOPIC STRUCTURE:
${topicsText.slice(0, 6000)}

Rules:
- The root "label" must be the subject title: "${subject.title}"
- Each "topic" becomes a branch with a short, clear label  
- Each topic's key concepts become leaves (max 5 per branch to avoid clutter)
- Use short labels (2-4 words max)
- Generate unique IDs for each topic and concept (e.g., "t1", "c1-1")`,
            })
        );

        // Compute positions server-side
        const mindmapData = computeLayout(tree);

        // Cache the result
        await supabase
            .from('subjects')
            .update({ mindmap_data: mindmapData })
            .eq('id', subjectId);

        console.log('[generate-mindmap] Generated', mindmapData.nodes.length, 'nodes');

        return NextResponse.json(mindmapData);

    } catch (error: any) {
        console.error('[generate-mindmap] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
