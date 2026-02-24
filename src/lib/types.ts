export type Concept = {
    id: string;
    title: string;
    content?: string;
};

export type Subtopic = {
    id: string;
    title: string;
    concepts: Concept[];
};

export type Topic = {
    id: string;
    title: string;
    subtopics: Subtopic[];
};

// React Flow-compatible mindmap types
export type MindmapNode = {
    id: string;
    type: 'root' | 'branch' | 'leaf';
    position: { x: number; y: number };
    data: { label: string; parentId?: string };
};

export type MindmapEdge = {
    id: string;
    source: string;
    target: string;
};

export type MindmapData = {
    nodes: MindmapNode[];
    edges: MindmapEdge[];
};

export type Subject = {
    id: string;
    title: string;
    lastStudied: string; // ISO date string
    progress: number; // 0-100
    topics: Topic[];
    mindmap_data?: MindmapData;
};
